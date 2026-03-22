import { Action, ActionPanel, Form, getPreferenceValues, showHUD, showToast, Toast } from "@raycast/api";
import fs from "fs";
import path from "path";
import { useCallback, useState } from "react";
import { createMacCalendarEvent, getMacCalendarNames } from "./calendar";
import { endDateFromStart, isCrucialIncomplete, localStartDate, payloadToDraft } from "./event-draft";
import { extractEventWithGemini } from "./gemini";
import { CATEGORY_LABELS, type NormalizedEventDraft } from "./types";

type Phase = "capture" | "confirm";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"]);

function pickImageFile(paths: string[] | undefined): string | undefined {
  if (!paths?.length) return undefined;
  for (const p of paths) {
    if (!fs.existsSync(p) || !fs.lstatSync(p).isFile()) continue;
    if (IMAGE_EXT.has(path.extname(p).toLowerCase())) return p;
  }
  return undefined;
}

function buildEventNotes(sourceText: string): string {
  const base = "Créé avec Smart Calendar Gemini.";
  if (!sourceText.trim()) return base;
  const max = 1800;
  const snippet = sourceText.length > max ? `${sourceText.slice(0, max)}…` : sourceText;
  return `${base}\n\nSource :\n${snippet}`;
}

export default function Command() {
  const [phase, setPhase] = useState<Phase>("capture");
  const [draft, setDraft] = useState<NormalizedEventDraft | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [formEpoch, setFormEpoch] = useState(0);

  const resetCapture = useCallback(() => {
    setPhase("capture");
    setDraft(null);
    setSourceText("");
    setFormEpoch((n) => n + 1);
  }, []);

  const createFromDraft = useCallback(
    async (d: NormalizedEventDraft, notes: string) => {
      const HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
      const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
      if (!d.title.trim()) {
        await showToast({ style: Toast.Style.Failure, title: "Titre requis." });
        return;
      }
      if (!YMD_RE.test(d.date)) {
        await showToast({ style: Toast.Style.Failure, title: "Date invalide (attendu AAAA-MM-JJ)." });
        return;
      }
      if (d.startTime === null || !HM_RE.test(d.startTime)) {
        await showToast({ style: Toast.Style.Failure, title: "Heure invalide (attendu HH:mm)." });
        return;
      }
      if (!CATEGORY_LABELS.includes(d.category)) {
        await showToast({ style: Toast.Style.Failure, title: "Catégorie invalide." });
        return;
      }

      await showHUD("Création de l’événement…");
      try {
        const names = await getMacCalendarNames();
        if (!names.includes(d.category)) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Calendrier introuvable",
            message: `Aucun calendrier nommé exactement « ${d.category} ». Crée ce calendrier dans l’app Calendrier.`,
          });
          return;
        }
        const start = localStartDate(d.date, d.startTime);
        const end = endDateFromStart(start, d.durationMinutes);
        await createMacCalendarEvent(
          {
            calendarName: d.category,
            title: d.title.trim(),
            start,
            end,
            location: d.location.trim(),
            notes: buildEventNotes(notes),
          },
          { knownCalendarNames: names },
        );
        await showToast({
          style: Toast.Style.Success,
          title: "Événement créé",
          message: `Calendrier : ${d.category}`,
        });
        resetCapture();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        await showToast({
          style: Toast.Style.Failure,
          title: "Échec création calendrier",
          message: msg.length > 280 ? `${msg.slice(0, 277)}…` : msg,
        });
      }
    },
    [resetCapture],
  );

  const onSubmitCapture = async (values: { rawText: string; ticketImage: string[] | undefined }) => {
    const prefs = getPreferenceValues<{ geminiApiKey: string }>();
    const apiKey = prefs.geminiApiKey?.trim();
    if (!apiKey) {
      await showToast({ style: Toast.Style.Failure, title: "Clé API Gemini manquante." });
      return;
    }

    const text = values.rawText?.trim() ?? "";
    const imagePath = pickImageFile(values.ticketImage);
    if (values.ticketImage?.length && !imagePath) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Image non prise en charge",
        message: "Utilise JPG, PNG, GIF, WebP ou HEIC.",
      });
      return;
    }
    if (!text && !imagePath) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Saisie requise",
        message: "Ajoute du texte ou choisis une image de billet.",
      });
      return;
    }

    await showHUD("Analyse Gemini…");
    try {
      const payload = await extractEventWithGemini(apiKey, {
        text: text || undefined,
        imagePath,
      });
      const nextDraft = payloadToDraft(payload);
      setSourceText(text);

      const incomplete = isCrucialIncomplete(nextDraft);
      const categoryUnknown = payload.category == null;
      if (incomplete || categoryUnknown) {
        let message = "Vérifie le formulaire ci-dessous.";
        if (incomplete && categoryUnknown) {
          message = "Complète titre, date, heure et choisis la catégorie / calendrier.";
        } else if (incomplete) {
          message = "Complète titre, date (AAAA-MM-JJ) ou heure (HH:mm).";
        } else {
          message = "Choisis la catégorie correspondant au calendrier macOS (nom exact).";
        }
        await showToast({
          style: Toast.Style.Failure,
          title: "Vérification nécessaire",
          message,
        });
        setDraft(nextDraft);
        setPhase("confirm");
      } else {
        await createFromDraft(nextDraft, text);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await showToast({ style: Toast.Style.Failure, title: "Analyse impossible", message: msg });
    }
  };

  const onSubmitConfirm = async (values: {
    title: string;
    date: string;
    startTime: string;
    durationMinutes: string;
    location: string;
    category: string;
  }) => {
    const dur = Number.parseInt(values.durationMinutes.trim(), 10);
    const durationMinutes = Number.isFinite(dur) && dur > 0 ? dur : 60;
    const next: NormalizedEventDraft = {
      title: values.title.trim(),
      date: values.date.trim(),
      startTime: values.startTime.trim() || null,
      durationMinutes,
      location: values.location.trim(),
      category: values.category as NormalizedEventDraft["category"],
    };

    if (isCrucialIncomplete(next)) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Champs requis",
        message: "Titre, date (AAAA-MM-JJ) et heure (HH:mm) sont obligatoires.",
      });
      return;
    }

    await createFromDraft(next, sourceText);
  };

  if (phase === "confirm" && draft) {
    return (
      <Form
        key={`confirm-${formEpoch}`}
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Créer L’événement" onSubmit={onSubmitConfirm} />
            <Action title="Retour" onAction={resetCapture} />
          </ActionPanel>
        }
      >
        <Form.Description text="Vérifie ou complète les champs, puis valide pour créer l’événement." />
        <Form.TextField id="title" title="Titre" defaultValue={draft.title} />
        <Form.TextField id="date" title="Date" placeholder="AAAA-MM-JJ" defaultValue={draft.date} />
        <Form.TextField id="startTime" title="Heure" placeholder="HH:mm" defaultValue={draft.startTime ?? ""} />
        <Form.TextField id="durationMinutes" title="Durée (minutes)" defaultValue={String(draft.durationMinutes)} />
        <Form.TextField id="location" title="Lieu" defaultValue={draft.location} />
        <Form.Dropdown id="category" title="Catégorie / calendrier" defaultValue={draft.category}>
          {CATEGORY_LABELS.map((c) => (
            <Form.Dropdown.Item key={c} value={c} title={c} />
          ))}
        </Form.Dropdown>
      </Form>
    );
  }

  return (
    <Form
      key={`capture-${formEpoch}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Analyser Et Créer" onSubmit={onSubmitCapture} />
        </ActionPanel>
      }
    >
      <Form.Description text="Colle un texte (mail, message) et/ou choisis une image de billet. Le calendrier cible doit porter exactement le nom de la catégorie." />
      <Form.TextArea id="rawText" title="Texte" placeholder="Ex. RDV dentiste mardi 15h chez Docteur Martin…" />
      <Form.FilePicker id="ticketImage" title="Image (billet)" allowMultipleSelection={false} />
    </Form>
  );
}
