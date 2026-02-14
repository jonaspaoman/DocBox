Summary of project (DocBox):

Docbox is an ER management system that optimizes the intake and discharge of patients. This product needs to be demo’ed for a hackathon, so the system will manage a few real people calling in, but also stream through “fake” patients to simulate a live scenario for demo purposes. Here are the key elements of the product:

Intake:
Patients should be able to call in via a mobile app. This app should act as a triage nurse — the triage nurse should be an AI model. The goal of the model should be to fill out the following:

Create Triage Notes: Before a doctor even calls you back to a room, they can open your digital chart and read the exact notes the triage nurse wrote. They will see your vital signs, your medical history, and the narrative the nurse typed out about why you are there.

Create an ESI score: Level 1 (Resuscitation), Level 2 (Emergency), Level 3 (Urgent), Level 4 (Semi-urgent), Level 5 (Non-urgent). The agent should route to 9/11 if it flags someone at level 1 or level 2. Once finished, the agent should update a database with a patient and their summary (keep to under 4 sentences, 2 sentences is best).

The intake system is also responsible for creating “real” data through the system.

Summary: 
In: take in patient calls (only one person will call in at a point of time). 
Out: update the database with {unique patient ID, patient notes, ESI score} and send to the backend the PID.

Outtake:
An AI Agent should flag anyone in an “ER bed” who is ready to discharge. The agent should decide to discharge a patient based on the patient’s data over time, open-source emergency room data, and basic medical guidelines. How this works is that the agent should maintain a database with the field {Patient ID, time_to_discharge}. When a change happens (patient is moved from the waiting room to the ER), the agent should compute a time_to_discharge. It should also read the patient’s data to figure out when a test result will be coming in. Since we are simulating the data, we will have, in the patient database, lab results with a global time that they arrive. Do not flag a patient until that test comes back. 

We should have the backend scan through the agent’s time_to_discharge fields and if the global timer is greater than the time_to_discharge, the agent should send a notification to the doctor’s mobile app.
The mobile app notification should show the patient's name and a summary of why the system believes they are ready to discharge the patient. If the doctor disagrees with discharge, then you should have a button that has the doctor talk briefly to a chat agent that figures out what the doctor is waiting for, and log that back into a database, only flagging the doctor again after that condition is met.

If the doctor agrees with the discharge, it should allow the doctor to open the notification and see a scroll-and-click of all discharge paperwork. The paperwork that it should fill out isthe ED clinical note that follows the “ED SOAP note template,” the “After Visit Summary (AVS)”, and a work/school form option that you can click. If the doctor wishes to edit, it should allow that, and at the end, it should have an accept or deny button.

Summary:
In: a ER database
Out: a notification to the frontend to discharge a patient and an update to the patient database with the approved discharge papers.






Observability:
At a certain clock cycle, we update the states of patients in the backend and broadcast any patient who had an updated state variable (i.e. color or status). Front end loops through this list of updates and performs action (this is usually an animation, color change, both, or nothing).

Patient = {"PID": null,
  "color": null,
  "status": null}


def update_patient(patient_id, changes):
    patient = patients[patient_id]
    patient["version"] += 1
    
    for key, value in changes.items():
        patient[key] = value

    broadcast({
        "patient_id": patient_id,
        "changes": changes,
        "version": patient["version"]
    })


UI:

UI Summary (paste into “ER Intake/Outtake Optimizer”)
DocBox is a demo ER flow board that makes the start and end of an ER visit faster and more visible: call-ahead structured intake (pre-arrival info capture) and discharge orchestration (flagging who’s likely ready, and what’s blocking sign-off).
This UI is built around one mental model: patients are dots moving through a shared pipeline—Called In → Waiting Room → ER Beds → Done, with PENDING gates as overlays (e.g., PENDING: Nurse Accept, PENDING: Discharge Sign-off) that show owner, reason, and recommended action. The board answers instantly: where flow is breaking, what’s blocking discharge, and who needs to act next—so each role mostly does “yes/confirm” work, not typing.
Hackathon constraints: a few real callers (one at a time) plus a stream of simulated patients for a live-feeling board. Updates arrive in realtime via WebSockets (events/deltas, not refreshes). UI hosted on Vercel. 
Safety + positioning (always explicit): this is decision support + workflow orchestration, not autonomous clinical decision-making. Clinicians own decisions—the system suggests; nurses confirm priority; doctors sign discharge paperwork. Any ESI or “ready for discharge” outputs are suggestions only and require confirmation. If the system flags ESI 1–2, it only simulates a “Call 911 recommended” path and must never actually call 911.


APIs to use:
UI should be hosted on Vercel
Intake triage nurse voice agent should be hosted by Zingage

Important:
DO NOT actually ever call 9/11, only simulate doing so.


Patient Lifecycle:

```mermaid
graph LR
    CalledIn((Called In)) --> P1((PENDING))
    P1 --> WaitingRoom((Waiting Room))
    WaitingRoom --> P2((PENDING))
    P2 --> ER_BED((ER BED))
    
    ER_BED --> P3_Top((PENDING))
    P3_Top --> OR((OR))
    OR --> Dissolve((Dissolve))
    
    ER_BED --> P3_Mid((PENDING))
    P3_Mid --> Discharge((Discharge))
    Discharge --> Dissolve
    
    ER_BED --> P3_Bot((PENDING))
    P3_Bot --> ICU((ICU))
    ICU --> Dissolve



**Each pending state should be unique and that triggers a different animation
Either start at called in or pending1
Each patient has a unique probability to move to the next state



