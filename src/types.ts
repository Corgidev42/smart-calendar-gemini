export const CATEGORY_LABELS = [
  "Travail / Études",
  "Loisir / Social",
  "Sport / Santé",
  "Administratif",
  "Nous",
  "Vacances",
  "Personnel Important",
  "Projets persos / Création",
] as const;

export type CategoryLabel = (typeof CATEGORY_LABELS)[number];

/** Objet JSON attendu de Gemini (avant validation). */
export interface GeminiEventPayload {
  title: string | null;
  date: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  location: string | null;
  category: string | null;
}

/** Données prêtes pour calendrier / formulaire de confirmation. */
export interface NormalizedEventDraft {
  title: string;
  date: string;
  startTime: string | null;
  durationMinutes: number;
  location: string;
  category: CategoryLabel;
}

export function isCategoryLabel(s: string): s is CategoryLabel {
  return (CATEGORY_LABELS as readonly string[]).includes(s);
}
