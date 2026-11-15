"""Play one real guest round against the live site and save it for a Reel.

    python marketing/reels/fetch_round.py <motion_id> <for|against> <out.json> "argument 1" ["argument 2" ...]

It starts a no-sign-up round, sends each argument, ends the round and
saves the motion, the full transcript and the AI's score report as JSON.
The guest round is an ordinary one, like any visitor's.
"""
import json
import sys
import urllib.request

API = "https://backend-kappa-lac-93.vercel.app/api"


def call(method, path, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", **(headers or {})})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def main():
    motion_id, side, out, *arguments = sys.argv[1:]
    motions = {m["id"]: m for m in call("GET", "/spar/guest/motions")["motions"]}
    d = call("POST", "/spar/guest/start", {"motion_id": motion_id, "side": side})
    g = {"X-Guest-Token": d["guest_token"]}
    for text in arguments:
        call("POST", f"/spar/{d['debate_id']}/message", {"text": text}, g)
    end = call("POST", f"/spar/{d['debate_id']}/end", None, g)
    full = call("GET", f"/spar/{d['debate_id']}", None, g)
    result = {
        "motion": motions[motion_id]["motion"], "tag": motions[motion_id]["tag"], "side": side,
        "messages": [{"role": m["role"], "text": m["text"]} for m in full["messages"]],
        "feedback": end["feedback"],
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1, ensure_ascii=False)
    print(json.dumps(result["feedback"]["scores"]), "->", out)


if __name__ == "__main__":
    main()
