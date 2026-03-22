import type { GeminiEventPayload, NormalizedEventDraft } from "./types";
import { CATEGORY_LABELS, isCategoryLabel } from "./types";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const HM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function isValidCalendarDate(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Construit un brouillon à partir de la sortie Gemini (valeurs par défaut si besoin). */
export function payloadToDraft(p: GeminiEventPayload): NormalizedEventDraft {
  const category: NormalizedEventDraft["category"] =
    p.category && isCategoryLabel(p.category) ? p.category : CATEGORY_LABELS[0];

  const duration =
    p.durationMinutes != null && Number.isFinite(p.durationMinutes) && p.durationMinutes > 0
      ? Math.round(p.durationMinutes)
      : 60;

  return {
    title: (p.title ?? "").trim(),
    date: (p.date ?? "").trim(),
    startTime: p.startTime?.trim() ? p.startTime.trim() : null,
    durationMinutes: duration,
    location: (p.location ?? "").trim(),
    category,
  };
}

/** Titre, date valide et heure de début requises pour création directe. */
export function isCrucialIncomplete(d: NormalizedEventDraft): boolean {
  if (!d.title) return true;
  if (!YMD_RE.test(d.date) || !isValidCalendarDate(d.date)) return true;
  if (d.startTime === null || !HM_RE.test(d.startTime)) return true;
  return false;
}

/** Combine date Y-M-D et heure H:m en Date locale. */
export function localStartDate(dateYmd: string, timeHm: string): Date {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = timeHm.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function endDateFromStart(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60_000);
}
