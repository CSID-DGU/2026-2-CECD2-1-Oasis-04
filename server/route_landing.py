"""휴대폰에서 열 경로 안내를 조회 시점 기준으로 하루 동안 보관한다."""
import json
import sqlite3
import time
from contextlib import closing
from html import escape
from os import environ
from pathlib import Path


def _connect():
    default = Path(__file__).with_name("route_landings.sqlite3")
    return sqlite3.connect(environ.get("ROUTE_LANDING_DB") or default)


def save_landings(entries):
    if not entries:
        return
    now = int(time.time())
    with closing(_connect()) as db, db:
        db.execute("CREATE TABLE IF NOT EXISTS landings (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, body TEXT NOT NULL)")
        db.execute("DELETE FROM landings WHERE expires <= ?", (now,))
        db.executemany("INSERT INTO landings VALUES (?, ?, ?)", [
            (route_id, now + 86400, json.dumps([route.summary, route.instructions], ensure_ascii=False))
            for route_id, route in entries
        ])


def landing_page(route_id):
    with closing(_connect()) as db:
        exists = db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='landings'").fetchone()
        row = db.execute("SELECT body FROM landings WHERE id=? AND expires>?", (route_id, int(time.time()))).fetchone() if exists else None
    content = "<p>경로를 찾을 수 없거나 공유 시간이 지났습니다.</p>"
    if row:
        summary, instructions = json.loads(row[0])
        steps = "".join(f"<li>{escape(step)}</li>" for step in instructions if step)
        content = f"<p>{escape(summary)}</p><ol>{steps}</ol>"
    html = ('<!doctype html><html lang="ko"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>선택한 경로</title>'
            '<style>body{font:1.1rem/1.6 system-ui;max-width:40rem;margin:2rem auto;padding:0 1rem}li{margin:1rem 0}</style>'
            f'<main><h1>선택한 경로</h1>{content}</main></html>')
    return html, 200 if row else 404
