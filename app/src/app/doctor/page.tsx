"use client";

import { useState, useMemo } from "react";
import { Patient } from "@/lib/types";
import * as api from "@/lib/api";
import { usePatientContext } from "@/context/PatientContext";
import { ElapsedTime } from "@/components/ElapsedTime";
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
      follow_up_instructions: `Follow up with cardiology within 48 hours for stress testing consideration. Continue aspirin 81mg daily. Take prescribed nitroglycerin SL PRN for recurrent chest pain. If chest pain recurs before follow-up, return to ED immediately.`,
      warning_instructions: `Return immediately if: chest pain recurs or worsens; pain radiates to arm, jaw, or back; shortness of breath; nausea with diaphoresis; palpitations; dizziness or syncope.`,
      soap_s: `${age}${sexChar} with PMH HTN, hyperlipidemia presents with substernal chest pain 7/10, onset ${Math.floor(Math.random() * 4) + 1}h ago. Radiating to left arm. Associated diaphoresis. Denies SOB, palpitations. Takes lisinopril, atorvastatin.`,
      soap_o: `VS: T 98.4 HR 88 BP 148/88 RR 18 SpO2 98%. Heart RRR, no murmurs. Lungs CTA bilaterally. No JVD or peripheral edema. ECG: NSR, no ST changes. Troponin 0h: <0.01, 3h: <0.01.`,
      soap_a: `Non-cardiac chest pain. ACS ruled out with serial troponins and ECG. Low HEART score.`,
      soap_p: `Discharge home. ASA 81mg daily. Cardiology follow-up 48h for stress test consideration. Return precautions reviewed.`,
      avs_treatment: `Your heart was evaluated with blood tests (troponin) and an ECG. Both were normal. You do not appear to be having a heart attack.`,
      avs_care: `Take aspirin 81mg daily. Take nitroglycerin under your tongue if chest pain occurs. If pain does not improve after 1 dose, call 911.`,
      work_restrictions: `May return to work/school on ${today} with no restrictions. Avoid strenuous physical activity until cleared by cardiology.`,
    },
    {
      keywords: ["abdominal pain", "rlq", "abdomen"],
      disposition: "Admitted to general surgery for appendectomy",
      diagnosis: "Acute appendicitis — uncomplicated, CT-confirmed",
      justification: `CT abdomen/pelvis demonstrates enlarged, fluid-filled appendix with periappendiceal fat stranding. No perforation or abscess. WBC elevated at 14.2k. Surgical consult recommends laparoscopic appendectomy.`,
      follow_up: "Inpatient — surgical team to manage postoperatively",
      follow_up_instructions: `Patient will be managed by the surgical team postoperatively. Expected 23-hour observation post laparoscopic appendectomy. Diet advancement as tolerated. Discharge planning per surgical team.`,
      warning_instructions: `Inpatient monitoring. Notify surgical team for: fever >101.5, worsening abdominal pain, persistent nausea/vomiting, or signs of peritonitis.`,
      soap_s: `${age}${sexChar} with no significant PMH presents with ${Math.floor(Math.random() * 8) + 4}h of acute RLQ abdominal pain. Began periumbilically, migrated to RLQ. Associated nausea, one episode emesis, low-grade fever. LMP 2 weeks ago.`,
      soap_o: `VS: T 100.4 HR 92 BP 128/78 RR 18 SpO2 99%. Abdomen: TTP RLQ with voluntary guarding. (+) McBurney's. No rebound. BS present. WBC 14.2k. CT: enlarged appendix with fat stranding, no perforation.`,
      soap_a: `Acute uncomplicated appendicitis.`,
      soap_p: `Surgical consult. IV cefoxitin. NPO. Admit for laparoscopic appendectomy.`,
      avs_treatment: `A CT scan confirmed appendicitis. You will be admitted for surgery to remove your appendix (laparoscopic appendectomy).`,
      avs_care: `Do not eat or drink anything before surgery. The surgical team will explain the procedure and recovery.`,
      work_restrictions: `Patient is being admitted. Work/school excuse will be provided by the surgical team upon discharge.`,
    },
    {
      keywords: ["migraine", "headache"],
      disposition: "Discharged home in stable condition after treatment",
      diagnosis: "Migraine with aura — no intracranial pathology on CT",
      justification: `CT head without contrast shows no acute intracranial pathology. Patient's symptoms consistent with known migraine history with typical visual aura. Responded well to IV abortive therapy. Headache resolved to 2/10 at discharge. Neurologically intact.`,
      follow_up: "Neurology follow-up in 1 week",
      follow_up_instructions: `Follow up with neurology in 1 week to discuss migraine prophylaxis if attacks are frequent (>4/month). Take sumatriptan 50mg at onset of aura or headache. Keep a headache diary noting triggers, frequency, and duration.`,
      warning_instructions: `Return immediately if: worst headache of life recurs; fever or neck stiffness; vision changes that don't resolve; weakness or numbness; confusion or difficulty speaking; seizure.`,
      soap_s: `${age}${sexChar} with migraine history presents with severe headache 9/10, "worst headache of life." Visual scotoma preceded headache by 20 min. Photophobia. No fever, neck stiffness, or trauma. Last migraine 3 months ago.`,
      soap_o: `VS: T 98.2 HR 76 BP 122/74 RR 14 SpO2 100%. Alert, photophobic. PERRL. No papilledema. Neck supple, (-) Kernig, (-) Brudzinski. Neuro intact. CT head: no acute pathology.`,
      soap_a: `Migraine with aura. CT negative for subarachnoid hemorrhage or mass.`,
      soap_p: `IV ketorolac 30mg + metoclopramide 10mg. Headache improved to 2/10. Discharge with sumatriptan 50mg Rx. Neurology follow-up 1 week.`,
      avs_treatment: `A CT scan of your head was normal. You were treated with IV pain and anti-nausea medication. Your headache is consistent with a migraine.`,
      avs_care: `Take sumatriptan 50mg at the first sign of migraine. Rest in a dark, quiet room. Stay hydrated. Avoid known triggers.`,
      work_restrictions: `May return to work/school tomorrow. Avoid screens and bright lights for 24 hours if possible.`,
    },
    {
      keywords: ["laceration", "cut"],
      disposition: "Discharged home after wound repair",
      diagnosis: `Simple laceration, right forearm — no tendon or neurovascular involvement`,
      justification: `Wound irrigated with NS. No tendon, nerve, or vascular injury identified on exam. Repaired with 4-0 nylon interrupted sutures (12 total). Tetanus up to date. Neurovascularly intact post-repair. Patient given wound care instructions and prophylactic antibiotics.`,
      follow_up: "PCP or wound clinic in 10–14 days for suture removal",
      follow_up_instructions: `Return to your primary care doctor or a wound clinic in 10–14 days to have sutures removed. Keep wound clean and dry for 48 hours, then gentle washing with soap and water. Apply thin layer of antibiotic ointment daily. Complete full course of cephalexin.`,
      warning_instructions: `Return if: increasing redness, warmth, or swelling around the wound; pus or foul-smelling drainage; red streaking from wound; fever >100.4; numbness or inability to move fingers; bleeding that won't stop with pressure.`,
      soap_s: `${age}${sexChar} sustained 6cm laceration to volar right forearm from kitchen knife. Bleeding controlled with pressure. No numbness or weakness in hand. Tetanus current.`,
      soap_o: `VS stable. 6cm linear laceration volar right forearm, clean edges, subcutaneous depth. No tendon exposure. Radial pulse 2+, sensation intact median/ulnar/radial. Full digit ROM. Wound irrigated with 500mL NS. Repaired with 12 interrupted 4-0 nylon sutures.`,
      soap_a: `Simple forearm laceration, repaired.`,
      soap_p: `Wound care instructions given. Cephalexin 500mg QID ×7d. Suture removal 10–14 days. Return precautions reviewed.`,
      avs_treatment: `Your wound was cleaned and closed with 12 stitches. No deep structures were damaged.`,
      avs_care: `Keep the wound dry for 48 hours. Then gently wash daily with soap and water. Apply antibiotic ointment and a clean bandage. Take cephalexin 500mg four times daily with food for 7 days.`,
      work_restrictions: `May return to work/school on ${today}. Avoid heavy lifting or gripping with right hand for 1 week. No submerging wound in water for 10 days.`,
    },
    {
      keywords: ["shortness of breath", "dyspnea", "breathing"],
      disposition: "Admitted to cardiology for CHF management",
      diagnosis: "Acute decompensated heart failure (CHF exacerbation)",
      justification: `Patient with known CHF (EF 35%) presenting with volume overload — 8 lb weight gain, bilateral crackles, elevated JVP, BNP 2,450. SpO2 89% on RA improved to 94% on supplemental O2. Requires IV diuresis, telemetry monitoring, and medication optimization.`,
      follow_up: "Inpatient — cardiology team to manage",
      follow_up_instructions: `Patient will be managed inpatient by the cardiology service. Goals: aggressive diuresis, daily weights, fluid restriction 1.5L/day, medication titration. Anticipated stay 3–5 days.`,
      warning_instructions: `Inpatient monitoring. Notify cardiology team for: worsening dyspnea, chest pain, hypotension, or decreased urine output.`,
      soap_s: `${age}${sexChar} with CHF (EF 35%) presents with 3 days worsening dyspnea at rest. 8 lb weight gain. Non-compliant with fluid restriction, missed furosemide doses. Orthopnea. Denies chest pain, fever.`,
      soap_o: `VS: T 98.8 HR 110 BP 168/94 RR 28 SpO2 89%→94% on 4L NC. JVP elevated. Lungs: bilateral crackles to mid-lung. Heart: S3 gallop. 2+ LE edema. BNP 2,450. Troponin 0.08 (mildly elevated). CXR: bilateral pulmonary edema.`,
      soap_a: `Acute decompensated heart failure with volume overload.`,
      soap_p: `IV furosemide 40mg. Supplemental O2. Fluid restriction 1.5L. Admit cardiology for diuresis and regimen optimization.`,
      avs_treatment: `Your heart failure has worsened, causing fluid to build up in your lungs. You need IV medication to remove excess fluid.`,
      avs_care: `You are being admitted to the hospital for treatment. The cardiology team will manage your care.`,
      work_restrictions: `Patient is being admitted. Work/school excuse will be provided upon discharge.`,
    },
    {
      keywords: ["ankle", "sprain"],
      disposition: "Discharged home in stable condition with crutches",
      diagnosis: `Left ankle sprain, grade ${Math.random() > 0.5 ? "1" : "2"} (lateral ankle — anterior talofibular ligament)`,
      justification: `X-ray negative for fracture. Neurovascular exam intact. Patient ambulating with crutches. Pain controlled with oral ibuprofen. Educated on RICE protocol and given clear return precautions. Follow-up arranged if not improving in one week.`,
      follow_up: "Orthopedics or PCP in 1 week if not improving",
      follow_up_instructions: `Follow up with an orthopedic specialist or your primary care doctor in 1 week if symptoms are not improving. Begin gentle range-of-motion exercises once pain allows. If swelling and pain resolve, formal follow-up may not be necessary.`,
      warning_instructions: `Return immediately if: inability to feel or move toes; foot becomes cold, blue, or numb; significantly increased swelling despite elevation and ice; severe pain uncontrolled by ibuprofen; inability to bear any weight after 72 hours; or fever.`,
      soap_s: `${age}${sexChar} with inversion injury to left ankle during basketball. Immediate pain and swelling. Able to bear weight with difficulty. No prior ankle injuries. No pop or crack heard.`,
      soap_o: `VS stable. Left ankle: swelling and ecchymosis lateral malleolus. TTP over ATFL. (-) Squeeze test. Able to bear weight 4 steps with limp. X-ray: no fracture, soft tissue swelling laterally.`,
      soap_a: `Left lateral ankle sprain, grade 1–2.`,
      soap_p: `RICE protocol. Ibuprofen 600mg q6h PRN with food. Crutches NWB ×48-72h then WBAT. Ortho follow-up 1 week if not improving. Return precautions reviewed.`,
      avs_treatment: `Your ankle was examined and X-rayed. No fracture was found. You have a moderate ankle sprain.`,
      avs_care: `Rest: Use crutches for 2–3 days. Ice: 20 min every 2–3 hours for 48–72 hours. Compression: Keep ACE wrap snug. Elevation: Keep ankle above heart level. Take ibuprofen 600mg every 6 hours with food.`,
      work_restrictions: `May return to work/school on ${today} with restrictions: no prolonged standing/walking, crutches required 48–72 hours, no sports for minimum 2 weeks.`,
    },
    {
      keywords: ["syncope", "faint", "passed out"],
      disposition: "Discharged home in stable condition after IV fluids",
      diagnosis: "Vasovagal syncope with incidental anemia (Hgb 8.2) — outpatient workup recommended",
      justification: `ECG normal sinus rhythm, no arrhythmia. Single syncopal episode with classic vasovagal prodrome (lightheadedness, nausea while standing). Orthostatics mildly positive, improved after 1L NS. Incidental finding of Hgb 8.2 — requires outpatient GI workup. Patient hemodynamically stable at discharge.`,
      follow_up: "PCP in 3 days for anemia workup; GI referral likely",
      follow_up_instructions: `See your primary care doctor within 3 days to evaluate your low blood count (anemia). You will likely need a GI referral to look for sources of blood loss. Start iron supplementation: ferrous sulfate 325mg daily on empty stomach with vitamin C. Avoid driving until cleared.`,
      warning_instructions: `Return immediately if: another fainting episode; chest pain or palpitations; blood in stool (black tarry or bright red); dizziness that doesn't resolve with lying down; shortness of breath; or confusion.`,
      soap_s: `${age}${sexChar} with no known PMH, witnessed syncope while standing in grocery store. LOC ~30s, no seizure activity. Prodrome: lightheadedness, nausea. Now alert and oriented. Denies chest pain, palpitations. Normal oral intake.`,
      soap_o: `VS: T 98.4 HR 78 BP 110/68 supine → 98/60 standing. RR 16 SpO2 98%. Alert, well-appearing. Heart RRR, no murmurs. Lungs clear. Neuro intact. No tongue bite or incontinence. ECG: NSR. CBC: Hgb 8.2 (low), MCV 74 (microcytic). BMP normal.`,
      soap_a: `Vasovagal syncope. Incidental microcytic anemia (Hgb 8.2) — likely iron deficiency, needs outpatient workup.`,
      soap_p: `1L NS bolus with improvement. Iron supplementation started. PCP follow-up 3 days for anemia workup. GI referral recommended. Return precautions reviewed.`,
      avs_treatment: `You fainted likely due to a vasovagal episode (a common, non-dangerous reflex). Your heart rhythm (ECG) was normal. Blood tests showed a low blood count (anemia) that needs follow-up.`,
      avs_care: `Take iron supplements as directed. Eat iron-rich foods (red meat, spinach, beans). Rise slowly from sitting or lying positions. Stay well hydrated.`,
      work_restrictions: `May return to work/school on ${today}. Avoid driving until cleared by PCP. Avoid prolonged standing for 48 hours.`,
    },
    {
      keywords: ["allergic", "swelling", "anaphylaxis"],
      disposition: "Discharged home after 4-hour observation, stable",
      diagnosis: "Anaphylaxis secondary to shellfish ingestion — resolved with epinephrine",
      justification: `Epinephrine IM ×2 with resolution of angioedema and urticaria. Observed 4 hours in ED with no biphasic reaction. Vital signs stable. No stridor, wheezing, or hemodynamic instability at discharge. Patient prescribed EpiPen and educated on use.`,
      follow_up: "Allergist referral within 2 weeks",
      follow_up_instructions: `See an allergist within 2 weeks for formal allergy testing and anaphylaxis action plan. Carry your EpiPen at all times. Complete the 5-day prednisone taper. Strictly avoid shellfish until allergy testing completed.`,
      warning_instructions: `Return immediately or call 911 if: throat tightness or difficulty swallowing; difficulty breathing or wheezing; swelling of face, lips, or tongue; hives returning or worsening; dizziness or feeling faint; vomiting or abdominal cramping. Use your EpiPen FIRST, then call 911.`,
      soap_s: `${age}${sexChar} developed lip/tongue swelling 30 min after eating shrimp. Diffuse hives, throat tightness. EMS gave epi 0.3mg IM. Symptoms improving on arrival. Known shellfish allergy. No prior anaphylaxis. No medications.`,
      soap_o: `VS: T 98.6 HR 102→78 BP 108/70→122/76 RR 18→14 SpO2 98%. Mild lip edema (resolving). No stridor or hoarseness. Urticaria fading. Lungs clear. Oropharynx: uvular edema resolving. 4-hour obs: stable, no biphasic reaction.`,
      soap_a: `Anaphylaxis — shellfish, resolved with epinephrine.`,
      soap_p: `Epi ×2, Solu-Medrol 125mg IV, diphenhydramine 50mg IV. 4h observation unremarkable. Discharge with EpiPen 2-pack, prednisone 40mg taper ×5d, cetirizine 10mg daily ×5d. Allergist referral. Strict shellfish avoidance.`,
      avs_treatment: `You had a severe allergic reaction (anaphylaxis) to shellfish. You were treated with epinephrine, steroids, and antihistamines. You were observed for 4 hours and had no further reaction.`,
      avs_care: `Carry your EpiPen at ALL times. Know how to use it. Complete your prednisone taper as prescribed. Take cetirizine daily for 5 days. Absolutely avoid shellfish until you see an allergist.`,
      work_restrictions: `May return to work/school tomorrow. No specific restrictions. Must carry EpiPen at all times.`,
    },
    {
      keywords: ["wrist", "foosh"],
      disposition: "Discharged home with sugar-tong splint",
      diagnosis: "Distal radius fracture (Colles type) — non-displaced",
      justification: `X-ray confirms non-displaced distal radius fracture. Splinted with sugar-tong. Neurovascularly intact before and after splinting. Pain controlled with oral analgesics. Patient instructed on splint care and given orthopedic follow-up.`,
      follow_up: "Orthopedics in 5–7 days for repeat imaging",
      follow_up_instructions: `See orthopedics in 5–7 days for repeat X-ray to ensure no displacement. Keep splint dry and intact. Wiggle fingers frequently to maintain circulation. Ice over splint for 20 min every few hours for swelling.`,
      warning_instructions: `Return immediately if: fingers become numb, tingly, cold, or blue; severe swelling not relieved by elevation; pain dramatically worsens; splint feels too tight or too loose; unable to move fingers.`,
      soap_s: `${age}${sexChar}, FOOSH injury while jogging. Immediate wrist pain and swelling 6/10. Right-hand dominant. No prior fractures. No numbness or tingling.`,
      soap_o: `VS stable. Right wrist: dorsal swelling, TTP distal radius. No gross deformity. Radial pulse 2+, cap refill <2s, sensation intact. Limited ROM due to pain. X-ray: non-displaced distal radius fracture (Colles). Sugar-tong splint applied. Post-splint: NV intact.`,
      soap_a: `Non-displaced distal radius fracture (Colles type).`,
      soap_p: `Sugar-tong splint. Ibuprofen 600mg TID PRN. Ice and elevation. Ortho follow-up 5–7 days. Return precautions reviewed.`,
      avs_treatment: `X-ray shows a broken wrist bone (distal radius fracture). The bone is in good position. A splint has been applied.`,
      avs_care: `Keep your splint dry and intact. Keep your hand elevated above heart level. Ice over the splint 20 minutes every 2–3 hours. Take ibuprofen 600mg every 8 hours with food for pain. Wiggle your fingers often.`,
      work_restrictions: `May return to work/school on ${today}. No use of right hand for lifting, gripping, or writing until cleared by orthopedics. Desk duties only.`,
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
    discharge_justification: `Workup unremarkable for acute pathology. ${age}${sexChar} presenting with ${p.chief_complaint?.toLowerCase() ?? "chief complaint"}. Vital signs stable. Clinically appropriate for outpatient follow-up.`,
    admitting_attending: attending,
    follow_up: "PCP follow-up in 48–72 hours",
    follow_up_instructions: `Follow up with your primary care doctor in 48–72 hours. Take prescribed medications as directed. Return precautions reviewed with patient.`,
    warning_instructions: `Return to the emergency department if symptoms worsen, new symptoms develop, fever occurs, or you have any concerns about your condition.`,
    soap_note: `S: ${age}${sexChar} presents with ${p.chief_complaint?.toLowerCase() ?? "complaint"}. ${p.triage_notes ?? ""}\nO: Vital signs stable. Exam findings as documented.\nA: ${genericDiag}.\nP: Symptomatic treatment provided. Discharge with PCP follow-up 48–72h. Return precautions reviewed.`,
    avs: `AFTER VISIT SUMMARY — ${name} — DOB ${dob}\nDate of Visit: ${today}\nDiagnosis: ${genericDiag}\nTreatment: You were evaluated and treated in the emergency department. Your workup did not reveal an emergency condition.\nFollow-Up: See your primary care doctor in 48–72 hours.\nWhen to Return: Return if symptoms worsen, new symptoms develop, or you have concerns.`,
    work_school_form: `WORK/SCHOOL EXCUSE — Patient: ${name} — DOB: ${dob}\nDate of Visit: ${today}\nThis patient was seen in the Emergency Department on the above date.\nMay return to work/school on ${today} with no restrictions unless otherwise noted.\nProvider: ${attending}`,
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

export default function DoctorPage() {
  const { patients, updatePatient, dischargePatient, eventLog, simState } = usePatientContext();

  const [search, setSearch] = useState("");
  const [selectedPid, setSelectedPid] = useState<string | null>(null);

  // Review mode: editing discharge papers before approving
  const [reviewingPid, setReviewingPid] = useState<string | null>(null);
  const [paperDrafts, setPaperDrafts] = useState<Record<string, DischargePapers>>({});

  // Reject mode
  const [rejectingPid, setRejectingPid] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

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
        items.push({
          patient: p,
          subject: "Ready for Discharge",
          subjectColor: "text-emerald-400",
          timestamp: eventTimes.dischargeTimes.get(p.pid) ?? new Date(),
        });
      } else if (p.color === "red") {
        items.push({
          patient: p,
          subject: "Surprising Lab Result",
          subjectColor: "text-red-400",
          timestamp: eventTimes.redTimes.get(p.pid) ?? new Date(),
        });
      }
    }
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.patient.name.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q));
  }, [patients, eventTimes, search]);

  // --- Review Discharge ---
  const handleStartReview = (pid: string, patient: Patient) => {
    setReviewingPid(pid);
    setRejectingPid(null);
    setPaperDrafts((prev) => ({
      ...prev,
      [pid]: generateDischargePapers(patient),
    }));
  };

  const handlePaperFieldChange = (pid: string, key: string, value: string) => {
    setPaperDrafts((prev) => ({
      ...prev,
      [pid]: { ...prev[pid], [key]: value },
    }));
  };

  const handleApproveDischarge = (pid: string) => {
    const papers = paperDrafts[pid];
    if (papers) {
      const changes: Partial<Patient> = { discharge_papers: papers };
      api.updatePatient(pid, changes);
      updatePatient(pid, changes);
    }
    dischargePatient(pid);
    setReviewingPid(null);
    setSelectedPid(null);
  };

  // --- Reject & Note ---
  const handleStartReject = (pid: string) => {
    setRejectingPid(pid);
    setReviewingPid(null);
    setRejectionNote("");
  };

  const handleConfirmReject = async (pid: string) => {
    const p = patients.find((pt) => pt.pid === pid);
    if (!p) return;
    const note = rejectionNote.trim();
    if (!note) return;

    setRejectLoading(true);

    // Call LLM for discharge delay + additional labs
    const llmResult = await api.processRejection(p, note, simState.current_tick);

    const existingNotes = p.rejection_notes ?? [];
    const existingLabs = p.lab_results ?? [];

    const changes: Partial<Patient> = {
      color: "grey" as const,
      rejection_notes: [...existingNotes, note],
      time_to_discharge: llmResult.time_to_discharge,
      ...(llmResult.additional_labs.length > 0
        ? { lab_results: [...existingLabs, ...llmResult.additional_labs] }
        : {}),
    };

    api.updatePatient(pid, changes);
    updatePatient(pid, changes);
    setRejectLoading(false);
    setRejectingPid(null);
    setRejectionNote("");
    setSelectedPid(null);
  };

  const selectedItem = selectedPid ? inboxItems.find((item) => item.patient.pid === selectedPid) : null;
  const selectedPatient = selectedItem?.patient ?? null;

  return (
    <div className="flex flex-col min-h-[calc(100vh-52px)] grid-bg">
      <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-2 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2.5 mb-3">
          <h1 className="text-lg font-mono font-bold text-foreground/90 tracking-wide">Doctor Inbox</h1>
          <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {inboxItems.length}
          </span>
        </div>
        {inboxItems.length === 0 && (
          <p className="text-muted-foreground text-xs font-mono py-8 text-center">
            No notifications right now.
          </p>
        )}
        {inboxItems.map(({ patient: p, subject, subjectColor, timestamp }) => (
          <button
            key={p.pid}
            type="button"
            className={cn(
              "w-full rounded-md border-l-2 border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left px-4 py-3",
              COLOR_BORDER[p.color] || "border-l-gray-500"
            )}
            onClick={() => setSelectedPid(p.pid)}
          >
            <span className={cn("text-[10px] font-mono font-bold uppercase tracking-wider", subjectColor)}>
              {subject}
            </span>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-medium font-mono text-sm truncate text-foreground/90">{p.name}</span>
              {p.age != null && p.sex && (
                <span className="text-muted-foreground text-xs font-mono shrink-0">
                  {p.age}{p.sex.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-muted-foreground text-xs font-mono truncate flex-1 text-right">
                {p.chief_complaint ?? "—"}
              </span>
              {p.esi_score != null && (
                <Badge variant={ESI_VARIANT[p.esi_score] ?? "outline"} className="shrink-0 font-mono text-[10px]">
                  ESI {p.esi_score}
                </Badge>
              )}
              <ElapsedTime since={timestamp} className="text-muted-foreground/40 text-[10px] shrink-0" />
            </div>
          </button>
        ))}
      </div>

      <div className="fixed bottom-4 left-0 right-0 px-4 z-10">
        <div className="max-w-2xl mx-auto">
          <Input
            placeholder="Search inbox..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 text-sm font-mono shadow-lg border border-border/40 rounded-lg bg-[#1a1a1a]"
          />
        </div>
      </div>

      {/* ===== Patient Detail Modal ===== */}
      {selectedPid && selectedPatient && !reviewingPid && !rejectingPid && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPid(null)}>
          <div
            className="mt-8 mb-8 w-full max-w-2xl max-h-[calc(100vh-64px)] flex flex-col rounded-xl border border-border/40 bg-[oklch(0.13_0_0)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 shrink-0">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  selectedPatient.color === "green" ? "bg-emerald-500" : "bg-red-500"
                )} />
                <span className="text-sm font-mono font-bold text-white">{selectedPatient.name}</span>
                <span className={cn(
                  "text-[10px] font-mono uppercase tracking-wider",
                  selectedItem?.subjectColor
                )}>
                  {selectedItem?.subject}
                </span>
              </div>
              <button onClick={() => setSelectedPid(null)} className="text-muted-foreground/50 hover:text-white transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>

            {/* Modal body — scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {/* Demographics */}
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <span className="text-muted-foreground/50 uppercase">Age / Sex</span>
                <span className="text-foreground/80">{selectedPatient.age ?? "—"}{selectedPatient.sex?.charAt(0).toUpperCase() ?? ""}</span>
                <span className="text-muted-foreground/50 uppercase">Status</span>
                <span className="text-emerald-400">{selectedPatient.status}</span>
                {selectedPatient.bed_number != null && (
                  <>
                    <span className="text-muted-foreground/50 uppercase">Bed</span>
                    <span className="text-emerald-400">#{selectedPatient.bed_number}</span>
                  </>
                )}
                {selectedPatient.dob && (
                  <>
                    <span className="text-muted-foreground/50 uppercase">DOB</span>
                    <span className="text-foreground/80">{selectedPatient.dob}</span>
                  </>
                )}
                {selectedPatient.time_to_discharge != null && (
                  <>
                    <span className="text-muted-foreground/50 uppercase">TTD</span>
                    <span className="text-emerald-400">{selectedPatient.time_to_discharge} ticks</span>
                  </>
                )}
              </div>

              {/* Clinical sections */}
              {selectedPatient.chief_complaint && <ReadOnlySection label="Chief Complaint" value={selectedPatient.chief_complaint} />}
              {selectedPatient.triage_notes && <ReadOnlySection label="Triage Notes" value={selectedPatient.triage_notes} />}
              {selectedPatient.hpi && <ReadOnlySection label="HPI" value={selectedPatient.hpi} />}
              {selectedPatient.pmh && <ReadOnlySection label="PMH" value={selectedPatient.pmh} />}
              {selectedPatient.family_social_history && <ReadOnlySection label="Family / Social Hx" value={selectedPatient.family_social_history} />}
              {selectedPatient.review_of_systems && <ReadOnlySection label="Review of Systems" value={selectedPatient.review_of_systems} />}
              {selectedPatient.objective && <ReadOnlySection label="Objective" value={selectedPatient.objective} />}
              {selectedPatient.primary_diagnoses && <ReadOnlySection label="Diagnoses" value={selectedPatient.primary_diagnoses} />}
              {selectedPatient.justification && <ReadOnlySection label="Justification" value={selectedPatient.justification} />}
              {selectedPatient.plan && <ReadOnlySection label="Plan" value={selectedPatient.plan} />}
              {selectedPatient.discharge_blocked_reason && <ReadOnlySection label="Discharge Blocked" value={selectedPatient.discharge_blocked_reason} highlight />}

              {/* Lab Results */}
              {selectedPatient.lab_results && selectedPatient.lab_results.length > 0 && (
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">
                    Lab Results
                  </span>
                  <div className="mt-1.5 space-y-1">
                    {selectedPatient.lab_results.map((lr) => (
                      <div
                        key={lr.test}
                        className={cn(
                          "flex items-center gap-2 text-xs font-mono",
                          lr.is_surprising ? "text-red-400" : "text-foreground/70"
                        )}
                      >
                        <span className={cn(
                          "shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px]",
                          lr.is_surprising ? "bg-red-500/20" : "bg-emerald-500/15"
                        )}>
                          {lr.is_surprising ? "!" : "\u2713"}
                        </span>
                        <span className="text-muted-foreground/60">{lr.test}:</span>
                        <span className={lr.is_surprising ? "font-medium" : ""}>{lr.result}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous rejection notes */}
              {selectedPatient.rejection_notes && selectedPatient.rejection_notes.length > 0 && (
                <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-2.5">
                  <span className="text-[10px] font-mono font-semibold text-yellow-400/80 uppercase tracking-widest">
                    Previous Rejection Notes
                  </span>
                  <div className="mt-1.5 space-y-1.5">
                    {selectedPatient.rejection_notes.map((note, i) => (
                      <div key={i} className="flex gap-2 text-xs font-mono">
                        <span className="text-yellow-400/50 shrink-0">#{i + 1}</span>
                        <span className="text-foreground/70">{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discharge Papers */}
              {selectedPatient.discharge_papers && Object.keys(selectedPatient.discharge_papers).length > 0 && (
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">
                    Discharge Papers
                  </span>
                  <div className="mt-1.5 space-y-2">
                    {Object.entries(selectedPatient.discharge_papers).map(([key, val]) => (
                      <div key={key}>
                        <span className="text-[10px] font-mono font-medium text-emerald-400/70 uppercase">{key}</span>
                        <p className="text-sm whitespace-pre-wrap text-foreground/80 mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer — always visible */}
            <div className="flex gap-2 px-4 py-2.5 border-t border-border/30 bg-[oklch(0.13_0_0)] shrink-0">
              {selectedPatient.color === "green" && (
                <Button
                  size="sm"
                  className="font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleStartReview(selectedPid!, selectedPatient)}
                >
                  Review Discharge
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={() => handleStartReject(selectedPid!)}
              >
                Reject &amp; Note
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-xs border-border/40 ml-auto"
                onClick={() => setSelectedPid(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Review Discharge Modal ===== */}
      {reviewingPid && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm" onClick={() => setReviewingPid(null)}>
          <div
            className="mt-8 mb-8 w-full max-w-2xl max-h-[calc(100vh-64px)] flex flex-col rounded-xl border border-border/40 bg-[oklch(0.13_0_0)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold text-white">{selectedPatient.name}</span>
                <span className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-wider">Discharge Review</span>
              </div>
              <button onClick={() => setReviewingPid(null)} className="text-muted-foreground/50 hover:text-white transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {PAPER_FIELDS.map(({ key, label, multiline }) => (
                <div key={key} className="rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5">
                  <label className="text-[10px] font-mono font-semibold text-muted-foreground/60 uppercase tracking-widest block mb-1">
                    {label}
                  </label>
                  {multiline ? (
                    <textarea
                      className="w-full rounded-md border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[13px] font-mono min-h-[90px] resize-y text-foreground/85 outline-none focus:border-emerald-500/40 leading-relaxed"
                      value={paperDrafts[reviewingPid]?.[key] ?? ""}
                      onChange={(e) => handlePaperFieldChange(reviewingPid, key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="w-full bg-transparent border-b border-white/[0.15] text-[13px] text-foreground/85 outline-none font-mono focus:border-emerald-500/40 pb-1"
                      value={paperDrafts[reviewingPid]?.[key] ?? ""}
                      onChange={(e) => handlePaperFieldChange(reviewingPid, key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="flex gap-2 px-4 py-2.5 border-t border-border/30 bg-[oklch(0.13_0_0)] shrink-0">
              <Button
                size="sm"
                className="font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleApproveDischarge(reviewingPid)}
              >
                Approve &amp; Discharge
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-xs border-border/40"
                onClick={() => setReviewingPid(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Reject & Note Modal ===== */}
      {rejectingPid && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setRejectingPid(null); setRejectionNote(""); }}>
          <div
            className="mt-24 w-full max-w-lg rounded-xl border border-red-500/20 bg-[oklch(0.13_0_0)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-red-500/15">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold text-white">{selectedPatient.name}</span>
                <span className="text-[10px] font-mono text-red-400/80 uppercase tracking-wider">Reject</span>
              </div>
              <button onClick={() => { setRejectingPid(null); setRejectionNote(""); }} className="text-muted-foreground/50 hover:text-white transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>

            {/* Previous rejection notes */}
            {selectedPatient.rejection_notes && selectedPatient.rejection_notes.length > 0 && (
              <div className="mx-4 mt-3 rounded-md border border-yellow-500/20 bg-yellow-500/5 p-2.5">
                <span className="text-[10px] font-mono font-semibold text-yellow-400/80 uppercase tracking-widest">
                  Previous Rejection Notes
                </span>
                <div className="mt-1.5 space-y-1.5">
                  {selectedPatient.rejection_notes.map((note, i) => (
                    <div key={i} className="flex gap-2 text-xs font-mono">
                      <span className="text-yellow-400/50 shrink-0">#{i + 1}</span>
                      <span className="text-foreground/70">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal body */}
            <div className="px-4 py-3 space-y-2">
              <label className="text-[10px] font-mono font-semibold text-red-400/80 uppercase tracking-widest">
                Rejection Note
              </label>
              <textarea
                autoFocus
                className="w-full rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-sm font-mono min-h-[120px] resize-y text-foreground/90 outline-none focus:border-red-500/50 placeholder:text-muted-foreground/30"
                placeholder="Explain why this discharge is being rejected..."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
              />
            </div>

            {/* Modal footer */}
            <div className="flex gap-2 px-4 py-2.5 border-t border-border/30">
              <Button
                size="sm"
                variant="destructive"
                className="font-mono text-xs"
                disabled={!rejectionNote.trim() || rejectLoading}
                onClick={() => handleConfirmReject(rejectingPid)}
              >
                {rejectLoading ? "Processing..." : "Confirm Rejection"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-xs border-border/40"
                onClick={() => { setRejectingPid(null); setRejectionNote(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadOnlySection({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
      <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">{label}</span>
      <p className={cn("text-[13px] mt-0.5 leading-snug", highlight ? "text-red-400" : "text-foreground/80")}>{value}</p>
    </div>
  );
}
