"""Persist input snapshots only; verification is always recomputed from disk."""
import json
import sqlite3
from pathlib import Path
from typing import Any


class SnapshotStore:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.execute('PRAGMA journal_mode=WAL')
            connection.execute('CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, intent TEXT NOT NULL)')

    def connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path, timeout=10)

    def save(self, data: dict[str, Any], intent: str) -> None:
        with self.connect() as connection:
            connection.execute('INSERT OR REPLACE INTO snapshot VALUES(1, ?, ?)',
                               (json.dumps(data), intent))

    def load(self) -> tuple[dict[str, Any], str] | None:
        with self.connect() as connection:
            row = connection.execute('SELECT data, intent FROM snapshot WHERE id=1').fetchone()
        return (json.loads(row[0]), row[1]) if row else None
