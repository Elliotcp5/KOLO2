"""
Grant Pro Lifetime à des comptes spécifiques :
- pressardelliot@gmail.com (toi)
- applereview@trykolo.io (compte test Apple Review)

Usage:
    cd /app/backend && python -m scripts.grant_lifetime
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient


LIFETIME_EMAILS = [
    {"email": "pressardelliot@gmail.com", "label": "Owner (Elliot Pressard)"},
    {"email": "applereview@trykolo.io",  "label": "Apple Review Test Account"},
]


async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("MONGO_URL or DB_NAME missing in env")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    for entry in LIFETIME_EMAILS:
        email = entry["email"].lower()
        label = entry["label"]
        now_iso = datetime.now(timezone.utc).isoformat()

        # Cherche ou crée le user
        user = await db.users.find_one({"email": email})
        if not user:
            user_id = f"user_{uuid.uuid4().hex[:14]}"
            user_doc = {
                "user_id": user_id,
                "email": email,
                "first_name": label.split(" ")[0],
                "last_name": " ".join(label.split(" ")[1:])[:48] if " " in label else "",
                "created_at": now_iso,
                "onboarding_done": True,
                "pro_lifetime": True,
                "plan": "pro",
                "subscription_status": "active",
                "platform": "lifetime_grant",
                "updated_at": now_iso,
            }
            await db.users.insert_one(user_doc)
            print(f"✓ Created + granted Pro lifetime → {email} (user_id={user_id})")
        else:
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "pro_lifetime": True,
                    "plan": "pro",
                    "subscription_status": "active",
                    "platform": "lifetime_grant",
                    "onboarding_done": True,
                    "updated_at": now_iso,
                }},
            )
            print(f"✓ Granted Pro lifetime → {email} (user_id={user.get('user_id')})")

    # Vérification finale
    print("\n--- État final ---")
    async for u in db.users.find(
        {"email": {"$in": [e["email"].lower() for e in LIFETIME_EMAILS]}},
        {"_id": 0, "email": 1, "user_id": 1, "pro_lifetime": 1, "plan": 1, "subscription_status": 1},
    ):
        print(f"  {u['email']:35} | lifetime={u.get('pro_lifetime')} | plan={u.get('plan')} | status={u.get('subscription_status')}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
