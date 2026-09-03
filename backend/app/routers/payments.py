"""Stripe — two deliberately separate relationships, never conflated (client
brief #29):

- Membership (£9/mo, site-wide): affects the member's OWN experience of the
  whole platform — currently just "no ads anywhere," more perks may land
  later. This is NOT a "subscription" in this codebase's vocabulary, on
  purpose — that word is reserved for the other one, below, and using it
  for both was a real, confusing naming collision (Settings used to title
  this section "Subscription" too).
- Subscription (£2/mo, per-debater): supports one specific debater and
  unlocks perks tied to THEM specifically (TBD). Free-and-unpaid "follow"
  is a third, separate relationship again (routers/profiles.py) — just
  more of that debater in your feed, no money, no perks.
"""
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request

from ..config import (
    FRONTEND_URL,
    STRIPE_PRICE_ID_DEBATER,
    STRIPE_PRICE_ID_MEMBERSHIP,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
)
from ..db import db
from ..deps import get_current_user, require_xhr
from ..models import User

router = APIRouter()


def _require_stripe():
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payments not configured")
    stripe.api_key = STRIPE_SECRET_KEY


@router.post("/payments/checkout/membership")
async def checkout_membership(user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    """£9/mo site-wide membership — removes ads everywhere. Not a
    "subscription": see this module's docstring for why that word is
    reserved for checkout_debater below."""
    _require_stripe()
    if not STRIPE_PRICE_ID_MEMBERSHIP:
        raise HTTPException(status_code=503, detail="Membership price not configured")
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": STRIPE_PRICE_ID_MEMBERSHIP, "quantity": 1}],
        client_reference_id=user.user_id,
        metadata={"kind": "membership", "user_id": user.user_id},
        success_url=f"{FRONTEND_URL}/settings?upgraded=1",
        cancel_url=f"{FRONTEND_URL}/settings",
    )
    return {"checkout_url": session.url}


@router.post("/payments/checkout/debater/{debater_user_id}")
async def checkout_debater(debater_user_id: str, user: User = Depends(get_current_user), _xhr: None = Depends(require_xhr)):
    """£2/mo subscription to one specific debater — separate product from
    the £9/mo site-wide membership above."""
    _require_stripe()
    if not STRIPE_PRICE_ID_DEBATER:
        raise HTTPException(status_code=503, detail="Debater price not configured")
    debater = await db.users.find_one({"user_id": debater_user_id}, {"_id": 0})
    if not debater or not debater.get("is_debater"):
        raise HTTPException(status_code=404, detail="Debater not found")
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": STRIPE_PRICE_ID_DEBATER, "quantity": 1}],
        client_reference_id=user.user_id,
        metadata={"kind": "debater_subscription", "user_id": user.user_id, "debater_id": debater_user_id},
        success_url=f"{FRONTEND_URL}/u/{debater_user_id}?subscribed=1",
        cancel_url=f"{FRONTEND_URL}/u/{debater_user_id}",
    )
    return {"checkout_url": session.url}


@router.post("/payments/webhook")
async def payments_webhook(request: Request):
    _require_stripe()
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        # .to_dict(): the installed stripe SDK (15.x) returns a typed Session
        # object here, not a plain dict — session.get(...) throws
        # AttributeError ("'get' is a dict method, but a Session is not a
        # dict"). Confirmed live: this crashed every real webhook delivery
        # with a 500 until this fix, so membership/subscription perks never
        # actually applied after a real payment despite checkout succeeding.
        session = event["data"]["object"].to_dict()
        meta = session.get("metadata") or {}
        now = datetime.now(timezone.utc).isoformat()
        if meta.get("kind") == "membership":
            await db.users.update_one(
                {"user_id": meta["user_id"]},
                {"$set": {"ad_free": True, "stripe_platform_sub_id": session.get("subscription")}},
            )
        elif meta.get("kind") == "debater_subscription":
            await db.subscriptions_debater.update_one(
                {"subscriber_id": meta["user_id"], "debater_id": meta["debater_id"]},
                {"$set": {
                    "subscriber_id": meta["user_id"],
                    "debater_id": meta["debater_id"],
                    "active": True,
                    "stripe_sub_id": session.get("subscription"),
                    "created_at": now,
                }},
                upsert=True,
            )
    elif event["type"] == "customer.subscription.deleted":
        sub_id = event["data"]["object"]["id"]
        await db.users.update_one({"stripe_platform_sub_id": sub_id}, {"$set": {"ad_free": False}})
        await db.subscriptions_debater.update_many({"stripe_sub_id": sub_id}, {"$set": {"active": False}})

    return {"received": True}
