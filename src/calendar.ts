import { runAppleScript } from "@raycast/utils";

export interface CreateMacCalendarEventInput {
  calendarName: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  notes: string;
}

/** Noms des calendriers visibles dans l’app Calendrier (ordre non garanti). */
export async function getMacCalendarNames(): Promise<string[]> {
  const script = `
function run() {
  const app = Application('Calendar');
  const cals = app.calendars();
  const names = [];
  for (let i = 0; i < cals.length; i++) {
    names.push(cals[i].name());
  }
  return JSON.stringify(names);
}
`;
  const raw = await runAppleScript(script, { language: "JavaScript" });
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Impossible de lire la liste des calendriers.");
  }
  return parsed.map(String);
}

/**
 * Crée un événement dans le calendrier dont le nom correspond exactement à \`calendarName\`.
 * S’appuie sur Calendar.app (JXA), aligné avec la permission « Calendar » du manifeste.
 */
export async function createMacCalendarEvent(
  input: CreateMacCalendarEventInput,
  options?: { knownCalendarNames?: string[] },
): Promise<void> {
  const known = options?.knownCalendarNames ?? (await getMacCalendarNames());
  if (!known.includes(input.calendarName)) {
    throw new Error(`Aucun calendrier nommé exactement « ${input.calendarName} ».`);
  }

  const payload = {
    calendarName: input.calendarName,
    title: input.title,
    startISO: input.start.toISOString(),
    endISO: input.end.toISOString(),
    location: input.location,
    notes: input.notes,
  };

  const script = `
function run() {
  const p = ${JSON.stringify(payload)};
  const app = Application('Calendar');
  app.activate();
  const cals = app.calendars();
  let cal = null;
  for (let i = 0; i < cals.length; i++) {
    if (cals[i].name() === p.calendarName) {
      cal = cals[i];
      break;
    }
  }
  if (cal == null) {
    throw new Error('Calendrier introuvable : ' + p.calendarName);
  }
  const start = new Date(p.startISO);
  const end = new Date(p.endISO);
  const ev = app.Event({
    summary: p.title,
    startDate: start,
    endDate: end,
    location: p.location || '',
    description: p.notes || ''
  });
  cal.events.push(ev);
  return 'ok';
}
`;

  try {
    await runAppleScript(script, { language: "JavaScript" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not authorized|privilege|permission|not allowed to send|Calendars?/i.test(msg)) {
      throw new Error(
        "Accès au Calendrier refusé. Réglages Système → Confidentialité et sécurité → Calendrier : autoriser Raycast.",
      );
    }
    if (/Application.*not running|Can.?t get application/i.test(msg)) {
      throw new Error("Ouvre l’app Calendrier une fois, puis réessaie.");
    }
    throw new Error(msg);
  }
}
