
import sqlite3

path = "Code/gesture_db.db"

with sqlite3.connect(path) as db:
    tables = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()

    print("Tables found:", tables)

    if ("gesture",) in tables:
        signs = db.execute(
            "SELECT g_id, g_name FROM gesture ORDER BY g_id"
        ).fetchall()
        print("Existing signs:", signs)
    else:
        print("No gesture table found.")
