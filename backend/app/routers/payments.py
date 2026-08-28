"""Stripe scaffold — two separate products, deliberately never conflated (client
brief #29): a £9/mo site-wide ad-free subscription and a £2/mo per-debater
subscription. No frontend wiring yet (that's Phase 3/5 of the delivery plan) —
this just gets the checkout + webhook plumbing in place, 503'ing like the
LiveKit integration does until real Stripe keys/price ids are configured.
"""
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request

from ..config import (
    FRONTEND_URL,
    STRIPE_PRICE_ID_DEBATER,
    STRIPE_PRICE_ID_PLATFORM,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
)
from ..db import db
from ..deps import get_current_user
from ..models import User

router = APIRouter()


def _require_stripe():
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payments not configured")
    stripe.api_key = STRIPE_SECRET_KEY


@router.post("/payments/checkout/platform")
async def checkout_platform(user: User = Depends(get_current_user)):
    """£9/mo site-wide ad-free subscription."""
    _require_stripe()
    if not STRIPE_PRICE_ID_PLATFORM:
        raise HTTPException(status_code=503, detail="Platform price not configured")
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": STRIPE_PRICE_ID_PLATFORM, "quantity": 1}],
        client_reference_id=user.user_id,
        metadata={"kind": "platform_ad_free", "user_id": user.user_id},
        success_url=f"{FRONTEND_URL}/dashboard?upgraded=1",
        cancel_url=f"{FRONTEND_URL}/dashboard",
    )
    return {"checkout_url": session.url}


@router.post("/payments/checkout/debater/{debater_user_id}")
async def checkout_debater(debater_user_id: str, user: User = Depends(get_current_user)):
    """£2/mo subscription to one specific debater — separate product from the
    platform ad-free subscription above."""
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
        success_url=f"{FRONTEND_URL}/dashboard?subscribed={debater_user_id}",
        cancel_url=f"{FRONTEND_URL}/dashboard",
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
        session = event["data"]["object"]
        meta = session.get("metadata", {})
        now = datetime.now(timezone.utc).isoformat()
        if meta.get("kind") == "platform_ad_free":
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
