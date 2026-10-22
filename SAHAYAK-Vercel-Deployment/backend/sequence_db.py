"""SQLite storage for continuous-sign samples; deliberately separate from legacy gesture_db.db."""
from __future__ import annotations
import json, sqlite3
from pathlib import Path
from datetime import datetime, timezone
from sequence_features import summarize_sequence

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "continuous_gesture_db.db"

def connect(path: Path | str = DB_PATH):
    con = sqlite3.connect(str(path), timeout=15)
    con.row_factory = sqlite3.Row
    return con

def init_db(path: Path | str = DB_PATH):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as con:
        con.execute("""CREATE TABLE IF NOT EXISTS sequence_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            frames_json TEXT NOT NULL,
            frame_count INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'webcam'
        )""")
        con.execute("CREATE INDEX IF NOT EXISTS idx_sequence_label ON sequence_samples(label)")
    return Path(path)

def add_sample(label, frames, path: Path | str = DB_PATH, source='webcam'):
    if not isinstance(label, str) or not label.strip():
        raise ValueError('A non-empty training label is required.')
    # Validate non-empty variable-length feature frames and finite values before saving.
    summarize_sequence(frames)
    clean_label = '_'.join(label.strip().upper().split())[:60]
    payload = json.dumps(frames, separators=(',', ':'), allow_nan=False)
    init_db(path)
    with connect(path) as con:
        cur = con.execute('INSERT INTO sequence_samples(label,frames_json,frame_count,created_at,source) VALUES(?,?,?,?,?)',
                           (clean_label, payload, len(frames), datetime.now(timezone.utc).isoformat(), source))
        return cur.lastrowid

def load_samples(path: Path | str = DB_PATH):
    init_db(path)
    with connect(path) as con:
        rows = con.execute('SELECT label,frames_json,frame_count,created_at FROM sequence_samples ORDER BY id').fetchall()
    out=[]
    for row in rows:
        frames=json.loads(row['frames_json'])
        summarize_sequence(frames)
        out.append({'label':row['label'],'frames':frames,'created_at':row['created_at']})
    return out

def summary(path: Path | str = DB_PATH):
    init_db(path)
    with connect(path) as con:
        rows=con.execute('SELECT label, COUNT(*) AS n FROM sequence_samples GROUP BY label ORDER BY label').fetchall()
        total=con.execute('SELECT COUNT(*) FROM sequence_samples').fetchone()[0]
    return {'database':str(path),'total_samples':total,'labels':{r['label']:r['n'] for r in rows}}
