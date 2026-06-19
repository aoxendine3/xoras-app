#!/usr/bin/env python3
"""
Xoras CDP - Deep DOM Inspection of Immunefi form
"""
import json
import asyncio
import websockets
import urllib.request

TARGET_TAB_ID = "CC77F3F9A3F1B5C51F847FE542F3773E"

def get_ws_url(tab_id):
    url = "http://127.0.0.1:9222/json"
    with urllib.request.urlopen(url) as r:
        tabs = json.loads(r.read())
    for tab in tabs:
        if tab.get("id") == tab_id:
            return tab.get("webSocketDebuggerUrl")
    return None

async def js(ws, expression, cmd_id=1):
    payload = {"id": cmd_id, "method": "Runtime.evaluate", "params": {"expression": expression, "returnByValue": True, "awaitPromise": True}}
    await ws.send(json.dumps(payload))
    while True:
        msg = json.loads(await ws.recv())
        if msg.get("id") == cmd_id:
            return msg.get("result", {}).get("result", {}).get("value")

async def inspect():
    ws_url = get_ws_url(TARGET_TAB_ID)
    async with websockets.connect(ws_url) as ws:
        print("=== PAGE TITLE ===")
        title = await js(ws, "document.title", 1)
        print(title)
        
        print("\n=== ALL INTERACTIVE ELEMENTS (deep) ===")
        els = await js(ws, """
            JSON.stringify(
                Array.from(document.querySelectorAll('input, textarea, [contenteditable], [role="combobox"], [role="listbox"], [role="option"], [role="radio"], [aria-label]'))
                .slice(0, 40)
                .map(el => ({
                    tag: el.tagName,
                    type: el.type || '',
                    role: el.getAttribute('role') || '',
                    label: el.getAttribute('aria-label') || '',
                    placeholder: el.placeholder || '',
                    id: el.id || '',
                    name: el.name || '',
                    contenteditable: el.getAttribute('contenteditable') || '',
                    text: (el.textContent||'').trim().slice(0, 80),
                    class: (el.className||'').slice(0,80)
                }))
            )
        """, 2)
        for i, el in enumerate(json.loads(els)):
            print(f"[{i}] {el['tag']} role={el['role']} label={el['label']} placeholder={el['placeholder']} ce={el['contenteditable']} text={el['text'][:50]}")
        
        print("\n=== FULL PAGE TEXT CONTENT (first 2000 chars) ===")
        text = await js(ws, "document.body.innerText.slice(0, 2000)", 3)
        print(text)

if __name__ == "__main__":
    asyncio.run(inspect())
