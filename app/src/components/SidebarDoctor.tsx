"use client";

import { useState, useMemo, useEffect } from "react";
import { Patient } from "@/lib/types";
import * as api from "@/lib/api";
import { usePatientContext } from "@/context/PatientContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type InboxItem = {
  patient: Patient;
  subject: string;
  subjectColor: string;
  timestamp: Date;
};

type DischargePapers = Record<string, string>;
type View = "list" | "detail" | "review" | "note" | "reject";

const PAPER_FIELDS: { key: string; label: string; multiline: boolean }[] = [
  { key: "disposition", label: "Disposition", multiline: false },
  { key: "diagnosis", label: "Diagnosis", multiline: false },
  { key: "discharge_justification", label: "Discharge Justification", multiline: true },
  { key: "admitting_attending", label: "Admitting Attending", multiline: false },
  { key: "follow_up", label: "Follow-Up", multiline: false },
  { key: "follow_up_instructions", label: "Follow-Up Instructions", multiline: true },
  { key: "warning_instructions", label: "Warning / Return Instructions", multiline: true },
  { key: "soap_note", label: "SOAP Note", multiline: true },
  { key: "avs", label: "After Visit Summary (AVS)", multiline: true },
  { key: "work_school_form", label: "Work / School Form", multiline: true },
];

const ATTENDING_NAMES = [
  "Dr. Samuel Nguyen, MD — Emergency Medicine",
  "Dr. Rachel Kim, MD — Emergency Medicine",
  "Dr. James Okafor, MD — Emergency Medicine",
  "Dr. Lisa Fernandez, MD — Emergency Medicine",
];

function pickAttending(): string {
  return ATTENDING_NAMES[Math.floor(Math.random() * ATTENDING_NAMES.length)];
}

function generateDischargePapers(p: Patient): DischargePapers {
  if (p.discharge_papers && Object.keys(p.discharge_papers).length > 0) {
    return { ...p.discharge_papers };
  }

  const complaint = (p.chief_complaint ?? "").toLowerCase();
  const name = p.name;
  const age = p.age ?? 40;
  const sexChar = (p.sex ?? "M").charAt(0).toUpperCase();
  const dob = p.dob ?? "01/01/1986";
  const today = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const attending = pickAttending();

  interface Template {
    keywords: string[];
    disposition: string;
    diagnosis: string;
    justification: string;
    follow_up: string;
    follow_up_instructions: string;
    warning_instructions: string;
    soap_s: string;
    soap_o: string;
    soap_a: string;
    soap_p: string;
    avs_treatment: string;
    avs_care: string;
    work_restrictions: string;
  }

  const templates: Template[] = [
    {
      keywords: ["chest pain", "substernal"],
      disposition: "Discharged home in stable condition",
      diagnosis: "Non-cardiac chest pain — ACS ruled out (serial troponins negative, ECG unremarkable)",
      justification: `Serial troponins negative ×2 at 0h and 3h. ECG shows normal sinus rhythm without ST changes. HEART score 2 (low risk). Patient pain-free at time of discharge. Outpatient cardiology follow-up arranged.`,
      follow_up: "Cardiology follow-up in 48 hours",
      follow_up_instructions: `Follow up with cardiology within 48 hours for stress testing consideration. Continue aspirin 81mg daily.`,
      warning_instructions: `Return immediately if: chest pain recurs or worsens; pain radiates to arm, jaw, or back; shortness of breath; nausea with diaphoresis.`,
      soap_s: `${age}${sexChar} with PMH HTN, hyperlipidemia presents with substernal chest pain 7/10, onset ${Math.floor(Math.random() * 4) + 1}h ago. Radiating to left arm.`,
      soap_o: `VS: T 98.4 HR 88 BP 148/88 RR 18 SpO2 98%. Heart RRR, no murmurs. ECG: NSR, no ST changes. Troponin 0h: <0.01, 3h: <0.01.`,
      soap_a: `Non-cardiac chest pain. ACS ruled out with serial troponins and ECG. Low HEART score.`,
      soap_p: `Discharge home. ASA 81mg daily. Cardiology follow-up 48h for stress test consideration.`,
      avs_treatment: `Your heart was evaluated with blood tests (troponin) and an ECG. Both were normal.`,
      avs_care: `Take aspirin 81mg daily. Take nitroglycerin under your tongue if chest pain occurs.`,
      work_restrictions: `May return to work/school on ${today} with no restrictions.`,
    },
    {
      keywords: ["abdominal pain", "rlq", "abdomen"],
      disposition: "Admitted to general surgery for appendectomy",
      diagnosis: "Acute appendicitis — uncomplicated, CT-confirmed",
      justification: `CT abdomen/pelvis demonstrates enlarged, fluid-filled appendix with periappendiceal fat stranding. WBC elevated at 14.2k.`,
      follow_up: "Inpatient — surgical team to manage postoperatively",
      follow_up_instructions: `Patient will be managed by the surgical team postoperatively.`,
      warning_instructions: `Inpatient monitoring. Notify surgical team for: fever >101.5, worsening abdominal pain.`,
      soap_s: `${age}${sexChar} presents with ${Math.floor(Math.random() * 8) + 4}h of acute RLQ abdominal pain. Associated nausea, low-grade fever.`,
      soap_o: `VS: T 100.4 HR 92 BP 128/78. Abdomen: TTP RLQ with voluntary guarding. WBC 14.2k. CT: enlarged appendix with fat stranding.`,
      soap_a: `Acute uncomplicated appendicitis.`,
      soap_p: `Surgical consult. IV cefoxitin. NPO. Admit for laparoscopic appendectomy.`,
      avs_treatment: `A CT scan confirmed appendicitis. You will be admitted for surgery.`,
      avs_care: `Do not eat or drink anything before surgery.`,
      work_restrictions: `Patient is being admitted.`,
    },
    {
      keywords: ["migraine", "headache"],
      disposition: "Discharged home in stable condition after treatment",
      diagnosis: "Migraine with aura — no intracranial pathology on CT",
      justification: `CT head without contrast shows no acute intracranial pathology. Responded well to IV abortive therapy.`,
      follow_up: "Neurology follow-up in 1 week",
      follow_up_instructions: `Follow up with neurology in 1 week to discuss migraine prophylaxis.`,
      warning_instructions: `Return immediately if: worst headache of life recurs; fever or neck stiffness; vision changes.`,
      soap_s: `${age}${sexChar} with migraine history presents with severe headache 9/10. Visual scotoma preceded headache.`,
      soap_o: `VS: T 98.2 HR 76 BP 122/74. Alert, photophobic. Neuro intact. CT head: no acute pathology.`,
      soap_a: `Migraine with aura. CT negative for subarachnoid hemorrhage.`,
      soap_p: `IV ketorolac 30mg + metoclopramide 10mg. Headache improved to 2/10. Discharge with sumatriptan 50mg Rx.`,
      avs_treatment: `A CT scan of your head was normal. Your headache is consistent with a migraine.`,
      avs_care: `Take sumatriptan 50mg at the first sign of migraine. Rest in a dark, quiet room.`,
      work_restrictions: `May return to work/school tomorrow.`,
    },
    {
      keywords: ["laceration", "cut"],
      disposition: "Discharged home after wound repair",
      diagnosis: `Simple laceration, right forearm — no tendon or neurovascular involvement`,
      justification: `Wound irrigated. No tendon, nerve, or vascular injury. Repaired with 4-0 nylon interrupted sutures.`,
      follow_up: "PCP or wound clinic in 10–14 days for suture removal",
      follow_up_instructions: `Return in 10–14 days to have sutures removed. Keep wound clean and dry for 48 hours.`,
      warning_instructions: `Return if: increasing redness; pus or foul-smelling drainage; fever >100.4; numbness.`,
      soap_s: `${age}${sexChar} sustained 6cm laceration to volar right forearm from kitchen knife.`,
      soap_o: `VS stable. 6cm linear laceration, subcutaneous depth. No tendon exposure. NV intact. Repaired with 12 sutures.`,
      soap_a: `Simple forearm laceration, repaired.`,
      soap_p: `Wound care instructions given. Cephalexin 500mg QID ×7d. Suture removal 10–14 days.`,
      avs_treatment: `Your wound was cleaned and closed with 12 stitches.`,
      avs_care: `Keep the wound dry for 48 hours. Then gently wash daily.`,
      work_restrictions: `May return to work/school on ${today}. Avoid heavy lifting with right hand for 1 week.`,
    },
    {
      keywords: ["shortness of breath", "dyspnea", "breathing"],
      disposition: "Admitted to cardiology for CHF management",
      diagnosis: "Acute decompensated heart failure (CHF exacerbation)",
      justification: `Patient with known CHF (EF 35%) presenting with volume overload — 8 lb weight gain, bilateral crackles, BNP 2,450.`,
      follow_up: "Inpatient — cardiology team to manage",
      follow_up_instructions: `Patient will be managed inpatient by the cardiology service.`,
      warning_instructions: `Inpatient monitoring. Notify cardiology team for: worsening dyspnea, chest pain, hypotension.`,
      soap_s: `${age}${sexChar} with CHF (EF 35%) presents with 3 days worsening dyspnea at rest. 8 lb weight gain.`,
      soap_o: `VS: T 98.8 HR 110 BP 168/94 RR 28 SpO2 89%→94% on 4L NC. Bilateral crackles. S3 gallop. BNP 2,450.`,
      soap_a: `Acute decompensated heart failure with volume overload.`,
      soap_p: `IV furosemide 40mg. Supplemental O2. Fluid restriction 1.5L. Admit cardiology.`,
      avs_treatment: `Your heart failure has worsened, causing fluid to build up in your lungs.`,
      avs_care: `You are being admitted to the hospital for treatment.`,
      work_restrictions: `Patient is being admitted.`,
    },
    {
      keywords: ["ankle", "sprain"],
      disposition: "Discharged home in stable condition with crutches",
      diagnosis: `Left ankle sprain, grade ${Math.random() > 0.5 ? "1" : "2"} (lateral ankle)`,
      justification: `X-ray negative for fracture. NV exam intact. Patient ambulating with crutches.`,
      follow_up: "Orthopedics or PCP in 1 week if not improving",
      follow_up_instructions: `Follow up if symptoms are not improving. Begin gentle ROM exercises once pain allows.`,
      warning_instructions: `Return if: inability to feel or move toes; foot becomes cold, blue, or numb; severe pain uncontrolled.`,
      soap_s: `${age}${sexChar} with inversion injury to left ankle. Immediate pain and swelling.`,
      soap_o: `VS stable. Left ankle: swelling lateral malleolus. TTP over ATFL. X-ray: no fracture.`,
      soap_a: `Left lateral ankle sprain, grade 1–2.`,
      soap_p: `RICE protocol. Ibuprofen 600mg q6h PRN. Crutches NWB ×48-72h.`,
      avs_treatment: `Your ankle was examined and X-rayed. No fracture was found.`,
      avs_care: `Rest, Ice, Compression, Elevation. Take ibuprofen 600mg every 6 hours with food.`,
      work_restrictions: `May return to work/school on ${today} with restrictions.`,
    },
    {
      keywords: ["syncope", "faint", "passed out"],
      disposition: "Discharged home in stable condition after IV fluids",
      diagnosis: "Vasovagal syncope with incidental anemia (Hgb 8.2)",
      justification: `ECG normal sinus rhythm. Classic vasovagal prodrome. Orthostatics improved after 1L NS. Incidental Hgb 8.2.`,
      follow_up: "PCP in 3 days for anemia workup",
      follow_up_instructions: `See PCP within 3 days to evaluate anemia. Start iron supplementation.`,
      warning_instructions: `Return if: another fainting episode; chest pain; blood in stool; dizziness that doesn't resolve.`,
      soap_s: `${age}${sexChar}, witnessed syncope while standing. LOC ~30s. Prodrome: lightheadedness, nausea.`,
      soap_o: `VS: HR 78 BP 110/68 supine → 98/60 standing. ECG: NSR. Hgb 8.2, MCV 74.`,
      soap_a: `Vasovagal syncope. Incidental microcytic anemia.`,
      soap_p: `1L NS bolus with improvement. Iron supplementation. PCP follow-up 3 days.`,
      avs_treatment: `You fainted likely due to a vasovagal episode. Blood tests showed anemia.`,
      avs_care: `Take iron supplements as directed. Rise slowly from sitting or lying positions.`,
      work_restrictions: `May return to work/school on ${today}. Avoid driving until cleared.`,
    },
    {
      keywords: ["allergic", "swelling", "anaphylaxis"],
      disposition: "Discharged home after 4-hour observation, stable",
      diagnosis: "Anaphylaxis secondary to shellfish ingestion — resolved with epinephrine",
      justification: `Epinephrine IM ×2 with resolution. Observed 4 hours, no biphasic reaction. Stable at discharge.`,
      follow_up: "Allergist referral within 2 weeks",
      follow_up_instructions: `See an allergist within 2 weeks. Carry your EpiPen at all times.`,
      warning_instructions: `Return immediately or call 911 if: throat tightness; difficulty breathing; swelling of face/lips/tongue. Use EpiPen FIRST.`,
      soap_s: `${age}${sexChar} developed lip/tongue swelling 30 min after eating shrimp. Diffuse hives.`,
      soap_o: `VS: HR 102→78 BP 108/70→122/76. Lip edema resolving. Lungs clear. 4h obs: stable.`,
      soap_a: `Anaphylaxis — shellfish, resolved with epinephrine.`,
      soap_p: `Epi ×2, Solu-Medrol 125mg IV, diphenhydramine 50mg IV. Discharge with EpiPen 2-pack.`,
      avs_treatment: `You had a severe allergic reaction (anaphylaxis) to shellfish. Treated with epinephrine.`,
      avs_care: `Carry your EpiPen at ALL times. Complete your prednisone taper. Avoid shellfish.`,
      work_restrictions: `May return to work/school tomorrow.`,
    },
    {
      keywords: ["wrist", "foosh"],
      disposition: "Discharged home with sugar-tong splint",
      diagnosis: `Distal radius fracture (Colles type) — non-displaced`,
      justification: `X-ray confirms non-displaced distal radius fracture. Splinted. NV intact. Pain controlled.`,
      follow_up: "Orthopedics in 5–7 days for repeat imaging",
      follow_up_instructions: `See orthopedics in 5–7 days for repeat X-ray. Keep splint dry and intact.`,
      warning_instructions: `Return if: fingers become numb, tingly, cold, or blue; severe swelling; pain worsens; unable to move fingers.`,
      soap_s: `${age}${sexChar}, FOOSH injury while jogging. Immediate wrist pain and swelling 6/10.`,
      soap_o: `VS stable. Right wrist: dorsal swelling, TTP distal radius. X-ray: non-displaced distal radius fracture. Sugar-tong splint applied.`,
      soap_a: `Non-displaced distal radius fracture (Colles type).`,
      soap_p: `Sugar-tong splint. Ibuprofen 600mg TID PRN. Ortho follow-up 5–7 days.`,
      avs_treatment: `X-ray shows a broken wrist bone. The bone is in good position. A splint has been applied.`,
      avs_care: `Keep your splint dry and intact. Elevate hand above heart level. Wiggle fingers often.`,
      work_restrictions: `May return to work/school on ${today}. No use of right hand for lifting. Desk duties only.`,
    },
  ];

  const match = templates.find((t) => t.keywords.some((kw) => complaint.includes(kw)));

  if (match) {
    const soap = `S: ${match.soap_s}\nO: ${match.soap_o}\nA: ${match.soap_a}\nP: ${match.soap_p}`;
    const avs = `AFTER VISIT SUMMARY — ${name} — DOB ${dob}\nDate of Visit: ${today}\nDiagnosis: ${match.diagnosis}\nTreatment: ${match.avs_treatment}\nCare Instructions: ${match.avs_care}\nFollow-Up: ${match.follow_up}\nWhen to Return: ${match.warning_instructions}`;
    const workForm = `WORK/SCHOOL EXCUSE — Patient: ${name} — DOB: ${dob}\nDate of Visit: ${today}\nThis patient was seen in the Emergency Department on the above date for ${match.diagnosis.toLowerCase()}.\n${match.work_restrictions}\nProvider: ${attending}`;

    return {
      disposition: match.disposition,
      diagnosis: match.diagnosis,
      discharge_justification: match.justification,
      admitting_attending: attending,
      follow_up: match.follow_up,
      follow_up_instructions: match.follow_up_instructions,
      warning_instructions: match.warning_instructions,
      soap_note: soap,
      avs: avs,
      work_school_form: workForm,
    };
  }

  const genericDiag = `${p.chief_complaint ?? "Undifferentiated complaint"} — evaluated, stable for discharge`;
  return {
    disposition: "Discharged home in stable condition",
    diagnosis: genericDiag,
    discharge_justification: `Workup unremarkable for acute pathology. ${age}${sexChar} presenting with ${p.chief_complaint?.toLowerCase() ?? "chief complaint"}. Vital signs stable.`,
    admitting_attending: attending,
    follow_up: "PCP follow-up in 48–72 hours",
    follow_up_instructions: `Follow up with your primary care doctor in 48–72 hours. Take prescribed medications as directed.`,
    warning_instructions: `Return to the emergency department if symptoms worsen, new symptoms develop, or fever occurs.`,
    soap_note: `S: ${age}${sexChar} presents with ${p.chief_complaint?.toLowerCase() ?? "complaint"}. ${p.triage_notes ?? ""}\nO: Vital signs stable.\nA: ${genericDiag}.\nP: Symptomatic treatment. Discharge with PCP follow-up 48–72h.`,
    avs: `AFTER VISIT SUMMARY — ${name} — DOB ${dob}\nDate of Visit: ${today}\nDiagnosis: ${genericDiag}\nTreatment: You were evaluated in the emergency department.\nFollow-Up: See your primary care doctor in 48–72 hours.`,
    work_school_form: `WORK/SCHOOL EXCUSE — Patient: ${name} — DOB: ${dob}\nDate of Visit: ${today}\nThis patient was seen in the Emergency Department.\nMay return to work/school on ${today} with no restrictions unless otherwise noted.\nProvider: ${attending}`,
  };
}

const ESI_VARIANT: Record<number, "default" | "secondary" | "destructive" | "outline"> = {
  1: "destructive",
  2: "destructive",
  3: "default",
  4: "secondary",
  5: "outline",
};

const COLOR_BORDER: Record<string, string> = {
  grey: "border-l-gray-500",
  yellow: "border-l-yellow-500",
  green: "border-l-emerald-500",
  red: "border-l-red-500",
};

export function SidebarDoctor() {
  const { patients, updatePatient, dischargePatient, acknowledgeLab, eventLog, simState } = usePatientContext();

  const [search, setSearch] = useState("");
  const [selectedPid, setSelectedPid] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");

  const [paperDrafts, setPaperDrafts] = useState<Record<string, DischargePapers>>({});
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [doctorNote, setDoctorNote] = useState("");

  const eventTimes = useMemo(() => {
    const dischargeTimes = new Map<string, Date>();
    const redTimes = new Map<string, Date>();
    for (const entry of eventLog) {
      if (entry.event === "flagged_discharge") {
        dischargeTimes.set(entry.pid, entry.timestamp);
      }
      if (entry.event === "turned_red") {
        redTimes.set(entry.pid, entry.timestamp);
      }
    }
    return { dischargeTimes, redTimes };
  }, [eventLog]);

  const inboxItems = useMemo(() => {
    const items: InboxItem[] = [];
    for (const p of patients) {
      if (p.status !== "er_bed") continue;
      if (p.color === "green") {
        items.push({ patient: p, subject: "Ready for Discharge", subjectColor: "text-emerald-600", timestamp: eventTimes.dischargeTimes.get(p.pid) ?? new Date() });
      } else if (p.color === "red") {
        items.push({ patient: p, subject: "Surprising Lab Result", subjectColor: "text-red-600", timestamp: eventTimes.redTimes.get(p.pid) ?? new Date() });
      }
    }
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.patient.name.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q));
  }, [patients, eventTimes, search]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const inboxPids = new Set(inboxItems.map((item) => item.patient.pid));
    return patients.filter(
      (p) => p.status === "er_bed" && !inboxPids.has(p.pid) && (
        p.name.toLowerCase().includes(q) ||
        (p.chief_complaint ?? "").toLowerCase().includes(q) ||
        String(p.bed_number ?? "").includes(q)
      )
    );
  }, [patients, search, inboxItems]);

  const selectedItem = selectedPid ? inboxItems.find((item) => item.patient.pid === selectedPid) : null;
  const selectedPatient = selectedItem?.patient
    ?? searchResults.find((p) => p.pid === selectedPid)
    ?? patients.find((p) => p.pid === selectedPid)
    ?? null;

  // Deselect if patient disappears
  useEffect(() => {
    if (selectedPid && !selectedPatient) {
      setSelectedPid(null);
      setView("list");
    }
  }, [selectedPid, selectedPatient]);

  const goBack = () => {
    if (view === "review" || view === "note" || view === "reject") {
      setView("detail");
    } else {
      setSelectedPid(null);
      setView("list");
    }
  };

  const handleStartReview = (pid: string, patient: Patient) => {
    setPaperDrafts((prev) => ({ ...prev, [pid]: generateDischargePapers(patient) }));
    setView("review");
  };

  const handlePaperFieldChange = (pid: string, key: string, value: string) => {
    setPaperDrafts((prev) => ({ ...prev, [pid]: { ...prev[pid], [key]: value } }));
  };

  const handleApproveDischarge = (pid: string) => {
    const papers = paperDrafts[pid];
    if (papers) {
      const changes: Partial<Patient> = { discharge_papers: papers };
      api.updatePatient(pid, changes);
      updatePatient(pid, changes);
    }
    dischargePatient(pid);
    setSelectedPid(null);
    setView("list");
  };

  const handleConfirmNote = (pid: string) => {
    const p = patients.find((pt) => pt.pid === pid);
    if (!p) return;
    const note = doctorNote.trim();
    if (!note) return;
    const changes: Partial<Patient> = {
      doctor_notes: [...(p.doctor_notes ?? []), note],
      color: p.is_simulated === false ? "yellow" as const : "grey" as const,
    };
    api.updatePatient(pid, changes);
    updatePatient(pid, changes);
    setDoctorNote("");
    setSelectedPid(null);
    setView("list");
  };

  const handleConfirmReject = async (pid: string) => {
    const p = patients.find((pt) => pt.pid === pid);
    if (!p) return;
    const note = rejectionNote.trim();
    if (!note) return;
    setRejectLoading(true);
    const llmResult = await api.processRejection(p, note, simState.current_tick);
    const changes: Partial<Patient> = {
      color: p.is_simulated ? "grey" as const : "yellow" as const,
      rejection_notes: [...(p.rejection_notes ?? []), note],
      time_to_discharge: llmResult.time_to_discharge,
      ...(llmResult.additional_labs.length > 0 ? { lab_results: [...(p.lab_results ?? []), ...llmResult.additional_labs] } : {}),
    };
    api.updatePatient(pid, changes);
    updatePatient(pid, changes);
    setRejectLoading(false);
    setRejectionNote("");
    setSelectedPid(null);
    setView("list");
  };

  // Back button header used inside the card
  const CardHeader = ({ title, titleColor }: { title: string; titleColor?: string }) => (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
      <button onClick={goBack} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1 -ml-1">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="10 12 6 8 10 4" />
        </svg>
      </button>
      <span className="text-[14px] font-mono font-bold text-foreground/90 truncate">{selectedPatient?.name}</span>
      {title && <span className={cn("text-[10px] font-mono font-medium uppercase tracking-wider shrink-0", titleColor ?? "text-muted-foreground/50")}>{title}</span>}
    </div>
  );

  // ===== REVIEW DISCHARGE VIEW =====
  if (view === "review" && selectedPid && selectedPatient) {
    return (
      <div className="flex flex-col h-full bg-gray-50/70">
        <div className="flex flex-col flex-1 min-h-0 m-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <CardHeader title="Discharge Review" titleColor="text-emerald-600" />
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-5">
            {PAPER_FIELDS.map(({ key, label, multiline }, i) => (
              <div key={key}>
                {i > 0 && <div className="h-px bg-gray-100 mb-5" />}
                <label className="text-[10px] font-mono font-bold text-foreground/50 uppercase tracking-wider block mb-2">{label}</label>
                {multiline ? (
                  <textarea
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 text-[12px] font-mono min-h-[80px] resize-y text-foreground/90 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 leading-relaxed"
                    value={paperDrafts[selectedPid]?.[key] ?? ""}
                    onChange={(e) => handlePaperFieldChange(selectedPid, key, e.target.value)}
                  />
                ) : (
                  <input
                    className="w-full bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-[12px] text-foreground/90 outline-none font-mono focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                    value={paperDrafts[selectedPid]?.[key] ?? ""}
                    onChange={(e) => handlePaperFieldChange(selectedPid, key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 shrink-0">
            <Button className="font-mono text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 h-7 whitespace-nowrap" onClick={() => handleApproveDischarge(selectedPid)}>
              Approve &amp; Discharge
            </Button>
            <Button variant="outline" className="font-mono text-[11px] border-gray-200 text-muted-foreground hover:text-foreground h-7" onClick={goBack}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== ADD NOTE VIEW =====
  if (view === "note" && selectedPid && selectedPatient) {
    return (
      <div className="flex flex-col h-full bg-gray-50/70">
        <div className="flex flex-col flex-1 min-h-0 m-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <CardHeader title="Add Note" titleColor="text-blue-600" />
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
            {selectedPatient.doctor_notes && selectedPatient.doctor_notes.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-wider block mb-2">Previous Notes</span>
                <div className="space-y-2">
                  {selectedPatient.doctor_notes.map((note, i) => (
                    <div key={i} className="flex gap-2 text-[12px] font-mono">
                      <span className="text-blue-500 shrink-0">#{i + 1}</span>
                      <span className="text-foreground/75">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] font-mono font-bold text-blue-600/70 uppercase tracking-wider block mb-2">Note</label>
              <textarea
                autoFocus
                className="w-full rounded-md border border-blue-200 bg-blue-50/30 px-3 py-2 text-[12px] font-mono min-h-[100px] resize-y text-foreground/90 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder:text-muted-foreground/30 leading-relaxed"
                placeholder="Add a note..."
                value={doctorNote}
                onChange={(e) => setDoctorNote(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 shrink-0">
            <Button className="font-mono text-[11px] h-7 bg-blue-600 hover:bg-blue-700 text-white px-3 whitespace-nowrap" disabled={!doctorNote.trim()} onClick={() => handleConfirmNote(selectedPid)}>
              Save Note
            </Button>
            <Button variant="outline" className="font-mono text-[11px] border-gray-200 text-muted-foreground hover:text-foreground h-7" onClick={goBack}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== REJECT VIEW =====
  if (view === "reject" && selectedPid && selectedPatient) {
    return (
      <div className="flex flex-col h-full bg-gray-50/70">
        <div className="flex flex-col flex-1 min-h-0 m-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <CardHeader title="Reject" titleColor="text-red-600" />
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
            {selectedPatient.rejection_notes && selectedPatient.rejection_notes.length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3">
                <span className="text-[10px] font-mono font-bold text-yellow-600 uppercase tracking-wider block mb-2">Previous Rejections</span>
                <div className="space-y-2">
                  {selectedPatient.rejection_notes.map((note, i) => (
                    <div key={i} className="flex gap-2 text-[12px] font-mono">
                      <span className="text-yellow-500 shrink-0">#{i + 1}</span>
                      <span className="text-foreground/75">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] font-mono font-bold text-red-600/70 uppercase tracking-wider block mb-2">Rejection Note</label>
              <textarea
                autoFocus
                className="w-full rounded-md border border-red-200 bg-red-50/30 px-3 py-2 text-[12px] font-mono min-h-[100px] resize-y text-foreground/90 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 placeholder:text-muted-foreground/30 leading-relaxed"
                placeholder="Explain why this discharge is being rejected..."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 shrink-0">
            <Button variant="destructive" className="font-mono text-[11px] h-7 whitespace-nowrap" disabled={!rejectionNote.trim() || rejectLoading} onClick={() => handleConfirmReject(selectedPid)}>
              {rejectLoading ? "Processing..." : "Confirm Reject"}
            </Button>
            <Button variant="outline" className="font-mono text-[11px] border-gray-200 text-muted-foreground hover:text-foreground h-7" onClick={goBack}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== PATIENT DETAIL VIEW =====
  if (view === "detail" && selectedPid && selectedPatient) {
    return (
      <div className="flex flex-col h-full bg-gray-50/70">
        <div className="flex flex-col flex-1 min-h-0 m-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <CardHeader
            title={selectedItem?.subject ?? (selectedPatient.bed_number != null ? `Bed #${selectedPatient.bed_number}` : "")}
            titleColor={selectedItem?.subjectColor}
          />
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-5">
            {/* Demographics */}
              <div>
                <span className="text-[10px] font-mono font-bold text-foreground/50 uppercase tracking-wider block mb-3">Demographics</span>
                <div className="space-y-2 text-[12px] font-mono">
                  <div className="flex gap-3"><span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-12 shrink-0 font-medium">Age/Sex</span><span className="text-foreground/90">{selectedPatient.age ?? "—"} {selectedPatient.sex?.charAt(0).toUpperCase() ?? ""}</span></div>
                  <div className="flex gap-3"><span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-12 shrink-0 font-medium">Status</span><span className="text-emerald-600 font-medium">{selectedPatient.status.replace("_", " ")}</span></div>
                  {selectedPatient.bed_number != null && <div className="flex gap-3"><span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-12 shrink-0 font-medium">Bed</span><span className="text-emerald-600 font-medium">#{selectedPatient.bed_number}</span></div>}
                  {selectedPatient.time_to_discharge != null && <div className="flex gap-3"><span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-12 shrink-0 font-medium">TTD</span><span className="text-emerald-600">{selectedPatient.time_to_discharge} ticks</span></div>}
                </div>
              </div>

            <div className="h-px bg-gray-100" />
            <InlineSection label="Chief Complaint" value={selectedPatient.chief_complaint} />
            <div className="h-px bg-gray-100" />
            <InlineSection label="Triage Notes" value={selectedPatient.triage_notes} />
            {selectedPatient.hpi && <><div className="h-px bg-gray-100" /><InlineSection label="HPI" value={selectedPatient.hpi} /></>}
            {selectedPatient.pmh && <><div className="h-px bg-gray-100" /><InlineSection label="PMH" value={selectedPatient.pmh} /></>}
            {selectedPatient.family_social_history && <><div className="h-px bg-gray-100" /><InlineSection label="Family / Social" value={selectedPatient.family_social_history} /></>}
            {selectedPatient.review_of_systems && <><div className="h-px bg-gray-100" /><InlineSection label="Review of Systems" value={selectedPatient.review_of_systems} /></>}
            {selectedPatient.objective && <><div className="h-px bg-gray-100" /><InlineSection label="Objective" value={selectedPatient.objective} /></>}
            {selectedPatient.primary_diagnoses && <><div className="h-px bg-gray-100" /><InlineSection label="Diagnoses" value={selectedPatient.primary_diagnoses} /></>}
            {selectedPatient.plan && <><div className="h-px bg-gray-100" /><InlineSection label="Plan" value={selectedPatient.plan} /></>}
            {selectedPatient.discharge_blocked_reason && <><div className="h-px bg-gray-100" /><InlineSection label="Discharge Blocked" value={selectedPatient.discharge_blocked_reason} highlight /></>}

            {/* Lab Results */}
            <div className="h-px bg-gray-100" />
            <div>
              <span className="text-[10px] font-mono font-bold text-foreground/50 uppercase tracking-wider block mb-2">Lab Results</span>
              {selectedPatient.lab_results && selectedPatient.lab_results.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedPatient.lab_results.map((lr) => {
                    const flagged = lr.is_surprising && !lr.acknowledged;
                    return (
                      <div key={lr.test} className={cn("flex items-center gap-2 text-[12px] font-mono", flagged ? "text-red-600" : "text-foreground/75")}>
                        <span className={cn("shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px]", flagged ? "bg-red-100" : "bg-emerald-100")}>
                          {flagged ? "!" : "\u2713"}
                        </span>
                        <span className="text-muted-foreground/50">{lr.test}:</span>
                        <span className={flagged ? "font-medium" : ""}>{lr.result}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground/25 italic">Pending</p>
              )}
            </div>

            {/* Rejection notes */}
            {selectedPatient.rejection_notes && selectedPatient.rejection_notes.length > 0 && (
              <>
                <div className="h-px bg-gray-100" />
                <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3">
                  <span className="text-[10px] font-mono font-bold text-yellow-600 uppercase tracking-wider block mb-2">Rejection Notes</span>
                  <div className="space-y-2">
                    {selectedPatient.rejection_notes.map((note, i) => (
                      <div key={i} className="flex gap-2 text-[12px] font-mono"><span className="text-yellow-500 shrink-0">#{i + 1}</span><span className="text-foreground/75">{note}</span></div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Doctor Notes */}
            {selectedPatient.doctor_notes && selectedPatient.doctor_notes.length > 0 && (
              <>
                <div className="h-px bg-gray-100" />
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-wider block mb-2">Doctor Notes</span>
                  <div className="space-y-2">
                    {selectedPatient.doctor_notes.map((note, i) => (
                      <div key={i} className="flex gap-2 text-[12px] font-mono"><span className="text-blue-500 shrink-0">#{i + 1}</span><span className="text-foreground/75">{note}</span></div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Discharge Papers */}
            <div className="h-px bg-gray-100" />
            <div>
              <span className="text-[10px] font-mono font-bold text-foreground/50 uppercase tracking-wider block mb-2">Discharge Papers</span>
              {selectedPatient.discharge_papers && Object.keys(selectedPatient.discharge_papers).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(selectedPatient.discharge_papers).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-[10px] font-mono font-medium text-emerald-600/60 uppercase tracking-wider">{key.replace(/_/g, " ")}</span>
                      <p className="text-[12px] whitespace-pre-wrap text-foreground/80 mt-0.5 leading-relaxed">{val}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground/25 italic">Pending</p>
              )}
            </div>
          </div>

          {/* Footer actions — pinned */}
          <div className="flex gap-1.5 px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 shrink-0">
            {selectedPatient.status === "er_bed" && (
              <Button className="font-mono text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 h-7 whitespace-nowrap" onClick={() => handleStartReview(selectedPid, selectedPatient)}>
                Review
              </Button>
            )}
            {selectedPatient.color === "red" && !selectedPatient.lab_acknowledged && (
              <Button className="font-mono text-[11px] bg-amber-600 hover:bg-amber-700 text-white px-3 h-7 whitespace-nowrap" onClick={() => { acknowledgeLab(selectedPid); setSelectedPid(null); setView("list"); }}>
                Ack Lab
              </Button>
            )}
            {selectedPatient.status === "er_bed" && (
              <Button variant="outline" className="font-mono text-[11px] border-gray-300 text-foreground/70 hover:bg-gray-100 h-7" onClick={() => { setDoctorNote(""); setView("note"); }}>
                Note
              </Button>
            )}
            <Button variant="outline" className="font-mono text-[11px] border-gray-200 text-muted-foreground hover:text-foreground h-7" onClick={goBack}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13px] font-mono font-bold text-foreground/90 uppercase tracking-widest">Doctor Inbox</span>
          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{inboxItems.length}</span>
        </div>
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-[11px] font-mono border border-gray-200 rounded bg-gray-50 placeholder:text-muted-foreground/30"
        />
      </div>

      {/* Inbox list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {inboxItems.length === 0 && !search.trim() ? (
          <p className="text-muted-foreground/30 text-[11px] font-mono py-8 text-center">No notifications.</p>
        ) : (
          <div className="py-1 space-y-1 px-2">
            {inboxItems.map(({ patient: p, subject, subjectColor }) => (
              <button
                key={p.pid}
                type="button"
                className={cn(
                  "w-full rounded border-l-[3px] border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left px-3 py-2",
                  COLOR_BORDER[p.color] || "border-l-gray-500"
                )}
                onClick={() => { setSelectedPid(p.pid); setView("detail"); }}
              >
                <span className={cn("text-[9px] font-mono font-bold uppercase tracking-wider", subjectColor)}>{subject}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-medium font-mono text-[12px] truncate text-foreground/90">{p.name}</span>
                  <div className="flex-1" />
                  {p.esi_score != null && (
                    <Badge variant={ESI_VARIANT[p.esi_score] ?? "outline"} className="shrink-0 font-mono text-[9px] px-1.5 py-0">ESI {p.esi_score}</Badge>
                  )}
                </div>
              </button>
            ))}

            {searchResults.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">Other Beds</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                {searchResults.map((p) => (
                  <button
                    key={p.pid}
                    type="button"
                    className={cn(
                      "w-full rounded border-l-[3px] border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left px-3 py-2",
                      COLOR_BORDER[p.color] || "border-l-gray-500"
                    )}
                    onClick={() => { setSelectedPid(p.pid); setView("detail"); }}
                  >
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground/50">Bed #{p.bed_number ?? "—"}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-medium font-mono text-[12px] truncate text-foreground/90">{p.name}</span>
                      <div className="flex-1" />
                      {p.esi_score != null && (
                        <Badge variant={ESI_VARIANT[p.esi_score] ?? "outline"} className="shrink-0 font-mono text-[9px] px-1.5 py-0">ESI {p.esi_score}</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InlineSection({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <div>
      <span className="text-[10px] font-mono font-bold text-foreground/50 uppercase tracking-wider block mb-2">{label}</span>
      {value ? (
        <p className={cn("text-[12px] leading-relaxed", highlight ? "text-red-600" : "text-foreground/80")}>{value}</p>
      ) : (
        <p className="text-[12px] text-muted-foreground/25 italic">Pending</p>
      )}
    </div>
  );
}
