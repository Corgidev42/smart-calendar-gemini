import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIResponseError,
} from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import { buildGeminiSystemInstruction } from "./prompt";
import { parseGeminiEventJson } from "./parse-json";
import type { GeminiEventPayload } from "./types";

/** Modèle Flash récent (l’API Google évolue ; les anciens id ex. gemini-2.0-flash peuvent être retirés). */
const MODEL_ID = "gemini-2.5-flash";

const IMAGE_EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

function mimeForImage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXT_MIME[ext] ?? "image/jpeg";
}

function formatGeminiFailure(e: unknown): string {
  if (e instanceof GoogleGenerativeAIFetchError) {
    const parts = [e.message];
    if (e.status != null) parts.push(`HTTP ${e.status}${e.statusText ? ` ${e.statusText}` : ""}`);
    if (e.errorDetails?.length) {
      try {
        parts.push(JSON.stringify(e.errorDetails).slice(0, 500));
      } catch {
        /* ignore */
      }
    }
    if (e.status === 400 || e.status === 404) {
      parts.push(
        "Vérifie que la clé API est une clé « Google AI Studio » valide et que le modèle est disponible pour ton compte.",
      );
    }
    return parts.join(" — ");
  }
  if (e instanceof GoogleGenerativeAIResponseError) {
    let s = e.message;
    if (/block|safety|SAFETY|filtered/i.test(s)) {
      s +=
        " (Le contenu a peut-être été bloqué par les filtres de sécurité ; essaie un autre texte ou une autre image.)";
    }
    return s;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export async function extractEventWithGemini(
  apiKey: string,
  options: { text?: string; imagePath?: string },
): Promise<GeminiEventPayload> {
  const trimmed = options.text?.trim() ?? "";
  const hasText = trimmed.length > 0;
  const hasImage = Boolean(options.imagePath);

  if (!hasText && !hasImage) {
    throw new Error("Fournis au moins du texte ou une image.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: buildGeminiSystemInstruction(new Date().toLocaleDateString("fr-FR")),
  });

  const userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  userParts.push({
    text: hasText
      ? `Contenu texte utilisateur :\n${trimmed}`
      : "Aucun texte : déduis l'événement uniquement à partir de l'image jointe.",
  });

  if (hasImage && options.imagePath) {
    const buf = await fs.readFile(options.imagePath);
    const mimeType = mimeForImage(options.imagePath);
    userParts.push({
      inlineData: {
        mimeType,
        data: buf.toString("base64"),
      },
    });
  }

  let textOut: string;
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: userParts }],
    });
    const r = result.response;
    textOut = r.text();
  } catch (e: unknown) {
    const detail = formatGeminiFailure(e);
    if (/API key|API_KEY|401|403|PERMISSION_DENIED/i.test(detail)) {
      throw new Error("Clé API refusée ou sans accès à ce modèle. Régénère une clé sur Google AI Studio.");
    }
    if (/fetch|network|ECONNREFUSED|ENOTFOUND|Failed to fetch/i.test(detail)) {
      throw new Error("Réseau indisponible ou impossible de joindre les serveurs Google.");
    }
    throw new Error(detail);
  }

  if (!textOut?.trim()) {
    throw new Error(
      "Réponse vide du modèle (souvent : prompt bloqué ou quota). Regarde le message d’erreur précédent ou réessaie sans image.",
    );
  }

  return parseGeminiEventJson(textOut);
}
