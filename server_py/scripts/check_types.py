import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mysql_config import get_db, SessionLocal
from pixel_models import UserProject, UserTransaction
from sqlalchemy import text

db = SessionLocal()

print("--- UserProject Types ---")
try:
    projects = db.execute(text("SELECT DISTINCT type FROM user_projects")).fetchall()
    for p in projects:
        print(f"Project Type: '{p[0]}'")
except Exception as e:
    print(f"Error querying user_projects: {e}")

print("\n--- UserTransaction Types ---")
try:
    transactions = db.execute(text("SELECT DISTINCT type FROM user_transactions")).fetchall()
    for t in transactions:
        print(f"Transaction Type: '{t[0]}'")
except Exception as e:
    print(f"Error querying user_transactions: {e}")

print("\n--- Sample UserProject Records ---")
try:
    # Get one of each type
    types = db.execute(text("SELECT DISTINCT type FROM user_projects")).fetchall()
    for t in types:
        p = db.execute(text(f"SELECT * FROM user_projects WHERE type = '{t[0]}' LIMIT 1")).fetchone()
        if p:
            print(f"Type: {t[0]}, ID: {p.id}, TemplateID: {p.template_id}, Inputs: {p.input_images}")
except Exception as e:
    print(e)
