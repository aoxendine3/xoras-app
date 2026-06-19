#!/usr/bin/env python3
"""
Xoras CDP - Immunefi Form Automation using proper keyboard events
"""
import json
import asyncio
import websockets
import urllib.request

TARGET_TAB_ID = "CC77F3F9A3F1B5C51F847FE542F3773E"

DESCRIPTION = """### Summary
The KYBER_SWAP command in Dispatcher.sol passes user-supplied targetData directly to kyberRouter via low-level call() with no validation of the function selector or output amounts. An attacker can craft arbitrary calldata to drain in-flight token balances.

### Technical Details
In src/router/Dispatcher.sol:

(address tokenIn, uint256 amountIn, address tokenOut, , bytes memory targetData) = abi.decode(_inputs, (address, uint256, address, uint256, bytes));
IERC20(tokenIn).forceApprove(kyberRouter, amountIn);
(bool success, ) = kyberRouter.call(targetData);

No validation that targetData encodes a legitimate swap, that the selector belongs to KyberRouter, or that tokenOut balance increases post-call.

### Impact
Arbitrary calldata execution in the context of the Router. Enables complete drain of in-flight user funds during multicall batches via CONTRACT_BALANCE pattern.

### Proof of Concept
See attached H01_KyberTargetData.t.sol
forge test --match-test testExploitKyberTargetData -vvv

### Recommended Fix
uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
(bool success, ) = kyberRouter.call(targetData);
require(success, "KyberSwap call failed");
uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
require(balanceAfter - balanceBefore >= minAmountOut, "Slippage exceeded");
Also enforce KyberRouter function selector whitelisting."""

def get_ws_url(tab_id):
    url = "http://127.0.0.1:9222/json"
    with urllib.request.urlopen(url) as r:
        tabs = json.loads(r.read())
    for tab in tabs:
        if tab.get("id") == tab_id:
            return tab.get("webSocketDebuggerUrl")
    return None

_id = 0
def nid():
    global _id
    _id += 1
    return _id

async def send(ws, method, params=None):
    i = nid()
    payload = {"id": i, "method": method, "params": params or {}}
    await ws.send(json.dumps(payload))
    while True:
        msg = json.loads(await ws.recv())
        if msg.get("id") == i:
            return msg

async def js(ws, expr):
    r = await send(ws, "Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    return r.get("result", {}).get("result", {}).get("value")

async def key(ws, key_str, code, key_code):
    """Dispatch a real keydown/keypress/keyup sequence"""
    for etype in ["keydown", "keypress", "keyup"]:
        await send(ws, "Input.dispatchKeyEvent", {
            "type": etype,
            "key": key_str,
            "code": code,
            "keyCode": key_code,
            "windowsVirtualKeyCode": key_code,
            "nativeVirtualKeyCode": key_code,
            "unmodifiedText": key_str,
            "text": key_str if etype != "keyup" else ""
        })
    await asyncio.sleep(0.05)

async def type_text(ws, text):
    """Type a string character by character"""
    for char in text:
        await send(ws, "Input.insertText", {"text": char})
        await asyncio.sleep(0.05)

async def press_key(ws, key_str, code, key_code):
    for etype in ["keydown", "keyup"]:
        await send(ws, "Input.dispatchKeyEvent", {
            "type": etype,
            "key": key_str,
            "code": code,
            "keyCode": key_code,
            "windowsVirtualKeyCode": key_code,
        })
    await asyncio.sleep(0.1)

async def fill_form():
    ws_url = get_ws_url(TARGET_TAB_ID)
    print(f"Connecting to Immunefi tab...")
    
    async with websockets.connect(ws_url) as ws:
        print("[1] Clicking the react-select control to open dropdown...")
        # Click the control container (not just the input)
        await js(ws, """
            var ctrl = document.querySelector('.react-select__control, [class*="control"], #react-select-2-input');
            if (ctrl) ctrl.click();
        """)
        await asyncio.sleep(0.5)
        
        # Focus the input
        await js(ws, "document.querySelector('#react-select-2-input').focus()")
        await asyncio.sleep(0.3)
        
        print("[1] Typing 'Spectra'...")
        await type_text(ws, "Spectra")
        await asyncio.sleep(1.5)
        
        # Check for options
        options = await js(ws, """
            JSON.stringify(Array.from(document.querySelectorAll('[class*="option"], [id*="option"]')).map(o => o.textContent.trim()).filter(t => t.length > 0))
        """)
        print(f"Options visible: {options}")
        
        # Press ArrowDown then Enter to select first option
        print("[1] Pressing ArrowDown + Enter to select...")
        await press_key(ws, "ArrowDown", "ArrowDown", 40)
        await asyncio.sleep(0.3)
        await press_key(ws, "Enter", "Enter", 13)
        await asyncio.sleep(1)
        
        # Verify selection
        selected = await js(ws, """
            var sv = document.querySelector('[class*="singleValue"], [class*="single-value"]');
            sv ? sv.textContent.trim() : 'nothing selected'
        """)
        print(f"Selected program: {selected}")
        
        # Click Next: Severity Level
        print("[2] Clicking Next: Severity Level...")
        await js(ws, """
            var btns = Array.from(document.querySelectorAll('button'));
            var btn = btns.find(b => b.textContent.includes('Next: Severity Level'));
            if (btn) btn.click();
        """)
        await asyncio.sleep(2)
        
        print("[2] Current page content:")
        page_text = await js(ws, "document.body.innerText.slice(0, 800)")
        print(page_text)

if __name__ == "__main__":
    asyncio.run(fill_form())
