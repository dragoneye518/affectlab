import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect
from mysql_config import PREFERRED_DB_URL

def list_tables():
    print(f"Connecting to {PREFERRED_DB_URL}")
    engine = create_engine(PREFERRED_DB_URL)
    insp = inspect(engine)
    print("Databases/Schemas:", insp.get_schema_names())
    print("\nTables in default schema:")
    for table in insp.get_table_names():
        print(f" - {table}")

if __name__ == "__main__":
    list_tables()
