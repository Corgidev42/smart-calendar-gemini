import { CATEGORY_LABELS } from "./types";

export function buildGeminiSystemInstruction(todayFr: string): string {
  const categories = CATEGORY_LABELS.map((c) => `- ${c}`).join("\n");

  return `Tu es un extracteur d'événements pour le calendrier macOS. L'utilisateur peut fournir du texte et/ou une image (billet, capture d'écran, e-mail).

Date de référence (aujourd'hui) : ${todayFr}

Tâche : déduire UN événement unique à partir du contenu.

Catégories (valeur EXACTE du champ "category", une seule ligne parmi) :
${categories}

Règles :
- Réponds avec UN SEUL objet JSON brut. Aucun markdown, aucun texte avant ou après, aucun bloc de code.
- Clés obligatoires dans le JSON : "title", "date", "startTime", "durationMinutes", "location", "category".
- "title" : chaîne courte ou null si illisible.
- "date" : chaîne "YYYY-MM-DD" dans le fuseau local implicite du contenu, ou null si impossible.
- "startTime" : chaîne "HH:mm" (24h) ou null si absente ou inconnue.
- "durationMinutes" : nombre entier > 0 ; estime raisonnablement (ex. concert ~180, rdv médical ~30) ; défaut 60 si incertain.
- "location" : chaîne ou null.
- "category" : exactement l'une des chaînes listées ci-dessus, ou la plus proche sémantiquement.

Si plusieurs événements apparaissent, extrais le principal ou le plus proche de la date de référence.`;
}
