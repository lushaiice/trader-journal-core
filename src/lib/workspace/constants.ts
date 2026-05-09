/** Pre-market checklist questions with scoring weights. */
export interface ChecklistItem {
  id: string;
  question: string;
  /** If true, "yes/checked" is the healthy answer. If false, "no/unchecked" is healthy. */
  positive: boolean;
  weight: number;
}

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: "sleep", question: "Did you sleep properly?", positive: true, weight: 1 },
  { id: "risk", question: "Is your risk defined?", positive: true, weight: 1.5 },
  { id: "calm", question: "Are you emotionally calm?", positive: true, weight: 1.25 },
  { id: "setup", question: "Are you trading your setup?", positive: true, weight: 1.25 },
  { id: "max_loss", question: "Have you defined max daily loss?", positive: true, weight: 1.5 },
  { id: "revenge", question: "Are you revenge trading?", positive: false, weight: 1 },
  { id: "forcing", question: "Are you forcing trades?", positive: false, weight: 1 },
];

export type ChecklistResponses = Record<string, boolean>;

export function readinessScore(items: ChecklistResponses): number {
  let earned = 0;
  let max = 0;
  for (const item of CHECKLIST_ITEMS) {
    max += item.weight;
    const v = items[item.id];
    if (v === undefined) continue;
    const healthy = item.positive ? v === true : v === false;
    if (healthy) earned += item.weight;
  }
  return max ? Math.round((earned / max) * 100) : 0;
}

export function checklistCompletion(items: ChecklistResponses): number {
  const total = CHECKLIST_ITEMS.length;
  const answered = CHECKLIST_ITEMS.filter((i) => items[i.id] !== undefined).length;
  return total ? Math.round((answered / total) * 100) : 0;
}

export const SESSION_NOTE_CATEGORIES = [
  { value: "observation", label: "Market observation" },
  { value: "emotion", label: "Emotional state" },
  { value: "setup", label: "Setup observation" },
  { value: "idea", label: "Trade idea" },
  { value: "lesson", label: "Lesson" },
] as const;
