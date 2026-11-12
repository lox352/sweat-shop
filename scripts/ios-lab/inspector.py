"""A small WebKit Web Inspector protocol client, through ios_webkit_debug_proxy (see README.md).

Safari puts the page behind its Target domain: each command is sent to the page's target and its answer
unwrapped from Target.dispatchMessageFromTarget.
"""
import json, sys, time, urllib.request, itertools
import websocket


def pages(port=9222):
    return json.load(urllib.request.urlopen(f"http://localhost:{port}/json"))


class Inspector:
    def __init__(self, match, port=9222):
        page = next(p for p in pages(port) if match in p.get("url", ""))
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=30)
        self.ids = itertools.count(1)
        self.target = None
        self.events = []
        # Safari multiplexes the page behind Target: wait for its targetCreated.
        end = time.time() + 5
        while time.time() < end and not self.target:
            self.ws.settimeout(1)
            try:
                msg = json.loads(self.ws.recv())
            except websocket.WebSocketTimeoutException:
                continue
            if msg.get("method") == "Target.targetCreated":
                info = msg["params"]["targetInfo"]
                if info.get("type") == "page":
                    self.target = info["targetId"]
        self.ws.settimeout(60)

    def _send_raw(self, method, params):
        mid = next(self.ids)
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        return mid

    def call(self, method, params=None):
        if not self.target:
            mid = self._send_raw(method, params)
            return self._wait(mid, direct=True)
        inner = next(self.ids)
        self._send_raw("Target.sendMessageToTarget", {"targetId": self.target, "message": json.dumps({"id": inner, "method": method, "params": params or {}})})
        return self._wait(inner, direct=False)

    def _unwrap(self, msg):
        if msg.get("method") == "Target.dispatchMessageFromTarget":
            return json.loads(msg["params"]["message"])
        return msg

    def _wait(self, mid, direct):
        while True:
            msg = self._unwrap(json.loads(self.ws.recv()))
            if msg.get("id") == mid and "method" not in msg:
                if "error" in msg:
                    raise RuntimeError(f"{msg['error']}")
                return msg.get("result")
            if "method" in msg:
                self.events.append(msg)

    def drain(self, seconds):
        end = time.time() + seconds
        self.ws.settimeout(0.2)
        while time.time() < end:
            try:
                self.events.append(self._unwrap(json.loads(self.ws.recv())))
            except websocket.WebSocketTimeoutException:
                pass
        self.ws.settimeout(60)

    def js(self, expression):
        r = self.call("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
        if r.get("wasThrown"):
            raise RuntimeError(r["result"])
        return r["result"].get("value")
