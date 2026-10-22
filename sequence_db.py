
"""SQLite storage for continuous-sign samples.

Keeps the continuous-sign database separate from the legacy
gesture_db.db and closes connections reliably on Windows.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from sequence_features import summarize_sequence


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "continuous_gesture_db.db"


def connect(path: Path | str = DB_PATH) -> sqlite3.Connection:
    """Create a SQLite connection. Callers must close it."""
    con = sqlite3.connect(str(path), timeout=15)
    con.row_factory = sqlite3.Row
    return con


@contextmanager
def _managed_connection(path: Path | str = DB_PATH):
    """Commit or roll back transactions, then always close the connection."""
    con = connect(path)
    try:
        with con:
            yield con
    finally:
        con.close()


def init_db(path: Path | str = DB_PATH) -> Path:
    """Create the continuous-sign table if it does not exist."""
    db_path = Path(path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with _managed_connection(db_path) as con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS sequence_samples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                frames_json TEXT NOT NULL,
                frame_count INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'webcam'
            )
            """
        )
        con.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_sequence_label
            ON sequence_samples(label)
            """
        )

    return db_path


def add_sample(
    label,
    frames,
    path: Path | str = DB_PATH,
    source: str = "webcam",
):
    """Validate and append one continuous-sign recording."""
    if not isinstance(label, str) or not label.strip():
        raise ValueError("A non-empty training label is required.")

    # Validate the sequence format and numerical values first.
    summarize_sequence(frames)

    clean_label = "_".join(label.strip().upper().split())[:60]
    payload = json.dumps(
        frames,
        separators=(",", ":"),
        allow_nan=False,
    )

    init_db(path)

    with _managed_connection(path) as con:
        cur = con.execute(
            """
            INSERT INTO sequence_samples
                (label, frames_json, frame_count, created_at, source)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                clean_label,
                payload,
                len(frames),
                datetime.now(timezone.utc).isoformat(),
                source,
            ),
        )
        sample_id = cur.lastrowid

    return sample_id


def load_samples(path: Path | str = DB_PATH):
    """Load and validate stored sequences in insertion order."""
    init_db(path)

    with _managed_connection(path) as con:
        rows = con.execute(
            """
            SELECT label, frames_json, frame_count, created_at
            FROM sequence_samples
            ORDER BY id
            """
        ).fetchall()

    samples = []

    for row in rows:
        frames = json.loads(row["frames_json"])
        summarize_sequence(frames)

        samples.append(
            {
                "label": row["label"],
                "frames": frames,
                "created_at": row["created_at"],
            }
        )

    return samples


def summary(path: Path | str = DB_PATH):
    """Return sample counts grouped by label."""
    init_db(path)

    with _managed_connection(path) as con:
        rows = con.execute(
            """
            SELECT label, COUNT(*) AS n
            FROM sequence_samples
            GROUP BY label
            ORDER BY label
            """
        ).fetchall()

        total = con.execute(
            "SELECT COUNT(*) FROM sequence_samples"
        ).fetchone()[0]

    return {
        "database": str(path),
        "total_samples": total,
        "labels": {row["label"]: row["n"] for row in rows},
    }
