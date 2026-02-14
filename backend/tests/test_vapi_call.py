"""
Standalone Vapi call listener — waits for an inbound call to complete,
then saves the full call output to test_call_output.json.

Usage:
    1. source backend/.env
    2. python backend/tests/test_vapi_call.py
    3. Call your Vapi phone number and complete the triage conversation
    4. The script detects the completed call and saves the output
"""

from vapi import Vapi
import os
from dotenv import load_dotenv

load_dotenv()
VAPI_API_KEY = os.environ["VAPI_API_KEY"]
VAPI_ASSISTANT_ID = os.environ["VAPI_ASSISTANT_ID"]

def main():
    client = Vapi(token=VAPI_API_KEY)

    calls = client.calls.list(assistant_id=VAPI_ASSISTANT_ID, limit=1)

    for call in calls:
        transcript = getattr(call, "transcript", None) or (
            getattr(call, "artifact", None).transcript if getattr(call, "artifact", None) else None
        )

        summary = None
        if getattr(call, "analysis", None):
            summary = getattr(call.analysis, "summary", None)
        if not summary:
            summary = getattr(call, "summary", None)

        if not summary and getattr(call, "structured_outputs", None):
            for item in call.structured_outputs.values():
                if item.get("name") == "Call Summary" and item.get("result"):
                    summary = item["result"]
                    break

        print(call.id, call.status)
        print("TRANSCRIPT:", transcript or "<none>")
        print("SUMMARY:", summary or "<none>")
        print("-" * 40)



if __name__ == "__main__":
    main()
