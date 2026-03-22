import type { GeminiEventPayload } from "./types";
import { isCategoryLabel } from "./types";

function stripCodeFences(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence) return fence[1].trim();
  return t;
}

export function parseGeminiEventJson(raw: string): GeminiEventPayload {
  const cleaned = stripCodeFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Réponse Gemini : JSON invalide.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Réponse Gemini : le JSON doit être un objet.");
  }
  const o = parsed as Record<string, unknown>;
  const title = o.title == null ? null : String(o.title);
  const date = o.date == null ? null : String(o.date);
  const startTime = o.startTime == null ? null : String(o.startTime);
  const location = o.location == null ? null : String(o.location);
  let category: string | null = o.category == null ? null : String(o.category);
  if (category && !isCategoryLabel(category)) {
    category = null;
  }
  let durationMinutes: number | null = null;
  if (typeof o.durationMinutes === "number" && Number.isFinite(o.durationMinutes)) {
    durationMinutes = Math.round(o.durationMinutes);
  } else if (typeof o.durationMinutes === "string" && o.durationMinutes.trim() !== "") {
    const n = Number(o.durationMinutes);
    if (Number.isFinite(n)) durationMinutes = Math.round(n);
  }
  return {
    title,
    date,
    startTime,
    durationMinutes,
    location,
    category,
  };
}
