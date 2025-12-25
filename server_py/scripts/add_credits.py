import sys
import os

# Add server_py to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mysql_config import get_db, SessionLocal
from pixel_models import UserBalance, UserProfile
from sqlalchemy import text

def add_credits():
    db = SessionLocal()
    try:
        # 1. List current users and balances
        print("--- Current Balances ---")
        balances = db.query(UserBalance).all()
        for b in balances:
            user = db.query(UserProfile).filter(UserProfile.id == b.user_id).first()
            name = user.nick if user else "Unknown"
            print(f"User ID: {b.user_id} ({name}) - Balance: {b.balance}")

        # 2. Add 1000 credits to all users
        print("\n--- Adding 1000 Credits to ALL users ---")
        # Using execute for direct update to ensure it hits
        # Note: In candy_pixel_user schema
        db.execute(text("UPDATE candy_pixel_user.user_balance SET balance = balance + 1000"))
        db.commit()

        # 3. Verify
        print("\n--- New Balances ---")
        balances = db.query(UserBalance).all()
        for b in balances:
            user = db.query(UserProfile).filter(UserProfile.id == b.user_id).first()
            name = user.nick if user else "Unknown"
            print(f"User ID: {b.user_id} ({name}) - Balance: {b.balance}")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_credits()
