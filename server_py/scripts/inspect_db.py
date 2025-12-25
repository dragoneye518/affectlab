import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect
from mysql_config import PREFERRED_DB_URL

def inspect_table():
    print(f"Connecting to {PREFERRED_DB_URL}")
    engine = create_engine(PREFERRED_DB_URL)
    insp = inspect(engine)
    
    # Check user_profile in default DB
    if insp.has_table('user_profile'):
        print("\nColumns in 'user_profile' (yhlz_candyai):")
        for col in insp.get_columns('user_profile'):
            print(f" - {col['name']} ({col['type']})")
    
    # Check tables in candy_pixel_user
    print("\nTables in 'candy_pixel_user':")
    try:
        yhlz_user_tables = insp.get_table_names(schema='candy_pixel_user')
        print(yhlz_user_tables)
        
        target_tables = ['user_profile', 'user_balance', 'third_party_accounts']
        for tbl in target_tables:
            if tbl in yhlz_user_tables:
                 print(f"\nColumns in 'candy_pixel_user.{tbl}':")
                 for col in insp.get_columns(tbl, schema='candy_pixel_user'):
                    print(f" - {col['name']} ({col['type']})")
    except Exception as e:
        print(f"Could not access candy_pixel_user: {e}")

if __name__ == "__main__":
    inspect_table()
