"""
DocBox Backend Test Script
Run with: python test_backend.py
Requires the server to be running: uvicorn main:app --reload
"""

import asyncio
import json
import urllib.request
import urllib.error
import sys

BASE = "http://localhost:8000"
API = f"{BASE}/api"

passed = 0
failed = 0
test_pids: list[str] = []


def req(method: str, path: str, body: dict | None = None) -> tuple[int, any]:
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method)
    if data:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body) if body else None
        except (json.JSONDecodeError, ValueError):
            return e.code, {"error": body.decode(errors="replace")}


def test(name: str, condition: bool, detail: str = ""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  \033[32mPASS\033[0m  {name}")
    else:
        failed += 1
        print(f"  \033[31mFAIL\033[0m  {name} — {detail}")


def cleanup():
    """Delete test patients from Supabase so tests are repeatable."""
    for pid in test_pids:
        try:
            # Advance to done then there's no cleanup API — we just leave them
            # Actually let's try to delete via supabase directly
            pass
        except Exception:
            pass
    if test_pids:
        print(f"\n  Note: {len(test_pids)} test patient(s) were created. "
              "They remain in the DB (status=done or last state).")


def run_http_tests():
    global test_pids

    # 1. Server is running
    status, data = req("GET", "/sim/state")
    test("Server is running (GET /sim/state)", status == 200, f"status={status}")

    # 2. Inject patient
    status, data = req("POST", "/sim/inject")
    pid = None
    if status == 200 and data and "patient" in data:
        pid = data["patient"]["pid"]
        test_pids.append(pid)
    test("Inject patient (POST /sim/inject)", status == 200 and pid is not None,
         f"status={status}, data={data}")

    if not pid:
        print("  Skipping dependent tests (no patient injected)")
        return

    # 3. Get all patients
    status, data = req("GET", "/patients")
    found = any(p["pid"] == pid for p in data) if status == 200 and isinstance(data, list) else False
    test("Get all patients (GET /patients)", status == 200 and found,
         f"status={status}, found={found}")

    # 4. Get single patient
    status, data = req("GET", f"/patients/{pid}")
    test("Get single patient (GET /patients/pid)", status == 200 and data.get("pid") == pid,
         f"status={status}")

    # 5. Accept patient → waiting_room
    status, data = req("POST", f"/patients/{pid}/accept")
    test("Accept patient → waiting_room", status == 200 and data.get("status") == "waiting_room",
         f"status={status}, data={data}")

    # 6. Assign bed → er_bed
    status, data = req("POST", f"/patients/{pid}/assign-bed", {"bed_number": 3})
    test("Assign bed → er_bed", status == 200 and data.get("bed_number") == 3,
         f"status={status}, data={data}")

    # 7. Advance → discharge (green)
    status, data = req("POST", f"/patients/{pid}/advance")
    test("Advance → discharge", status == 200 and data.get("status") == "discharge",
         f"status={status}, data={data}")

    # Verify color is green
    status2, patient = req("GET", f"/patients/{pid}")
    test("Patient color is green after discharge",
         status2 == 200 and patient.get("color") == "green",
         f"color={patient.get('color') if status2 == 200 else 'N/A'}")

    # 8. Advance → done
    status, data = req("POST", f"/patients/{pid}/advance")
    test("Advance → done", status == 200 and data.get("status") == "done",
         f"status={status}, data={data}")

    # 9. Speed control
    status, data = req("POST", "/sim/speed", {"speed": 2.0})
    test("Speed control (POST /sim/speed)", status == 200 and data.get("speed") == 2.0,
         f"status={status}, data={data}")
    # Reset speed
    req("POST", "/sim/speed", {"speed": 1.0})

    # 10. Mode toggle
    status, data = req("POST", "/sim/mode", {"mode": "auto"})
    test("Mode toggle (POST /sim/mode)", status == 200 and data.get("mode") == "auto",
         f"status={status}, data={data}")
    # Reset mode
    req("POST", "/sim/mode", {"mode": "manual"})


async def run_ws_test():
    try:
        from websockets.asyncio.client import connect
    except ImportError:
        try:
            from websockets import connect
        except ImportError:
            test("WebSocket test (import websockets)", False, "pip install websockets")
            return

    # 11. WebSocket receives broadcasts
    try:
        async with connect("ws://localhost:8000/ws") as ws:
            # Small delay to ensure connection is fully registered server-side
            await asyncio.sleep(0.3)

            # Inject a patient via HTTP — should trigger broadcast
            status, data = req("POST", "/sim/inject")
            if status == 200 and data and "patient" in data:
                test_pids.append(data["patient"]["pid"])

            # Wait for a message
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=3.0)
                parsed = json.loads(msg)
                test("WebSocket receives patient_added",
                     parsed.get("type") == "patient_added",
                     f"type={parsed.get('type')}")
            except asyncio.TimeoutError:
                test("WebSocket receives patient_added", False, "timeout — no message received")
    except Exception as e:
        test("WebSocket connection", False, str(e))


async def run_sim_test():
    # 12. Start/stop sim
    status_start, _ = req("POST", "/sim/start")
    test("Start simulation", status_start == 200)

    # Wait a couple seconds for ticks to advance
    await asyncio.sleep(2.5)

    status_state, state = req("GET", "/sim/state")
    tick = state.get("current_tick", 0) if status_state == 200 else 0

    status_stop, _ = req("POST", "/sim/stop")
    test("Stop simulation", status_stop == 200)
    test("Tick advanced during sim", tick > 0, f"current_tick={tick}")


def main():
    print("\n  DocBox Backend Tests")
    print("  " + "=" * 40 + "\n")

    # Check server is reachable
    try:
        urllib.request.urlopen(f"{API}/sim/state", timeout=3)
    except urllib.error.URLError:
        print("  \033[31mERROR\033[0m  Server not reachable at localhost:8000")
        print("         Start it with: uvicorn main:app --reload\n")
        sys.exit(1)

    print("  HTTP Endpoint Tests")
    print("  " + "-" * 30)
    run_http_tests()

    print("\n  WebSocket Test")
    print("  " + "-" * 30)
    asyncio.run(run_ws_test())

    print("\n  Simulation Test")
    print("  " + "-" * 30)
    asyncio.run(run_sim_test())

    cleanup()

    print("\n  " + "=" * 40)
    print(f"  Results: \033[32m{passed} passed\033[0m, \033[31m{failed} failed\033[0m")
    print()

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
