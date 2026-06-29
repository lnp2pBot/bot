const REPUBLISH_DAYS_DEFAULT = 10;

export const getRepublishCount = (): number => {
  const raw = parseInt(process.env.REPUBLISH_ORDER_DAYS || '');
  return Number.isInteger(raw) && raw > 0 ? raw : REPUBLISH_DAYS_DEFAULT;
};

// Day names (Spanish, English, abbreviated) mapped to getUTCDay() values (0=Sun)
const DAY_ALIASES: Record<string, number> = {
  domingo: 0,
  sunday: 0,
  sun: 0,
  dom: 0,
  lunes: 1,
  monday: 1,
  mon: 1,
  lun: 1,
  martes: 2,
  tuesday: 2,
  tue: 2,
  mar: 2,
  miercoles: 3,
  wednesday: 3,
  wed: 3,
  mie: 3,
  jueves: 4,
  thursday: 4,
  thu: 4,
  jue: 4,
  viernes: 5,
  friday: 5,
  fri: 5,
  vie: 5,
  sabado: 6,
  saturday: 6,
  sat: 6,
  sab: 6,
};

// Parses a comma/space separated list of day names into sorted weekday numbers.
// Tolerant to accents, casing and extra whitespace. Returns null if any token
// is not a recognized day.
export const parseCustomDays = (input: string): number[] | null => {
  const parts = input
    .toLowerCase()
    .split(/[,\s]+/)
    .filter(Boolean);
  if (parts.length === 0) return null;
  const days = new Set<number>();
  for (const part of parts) {
    // strip accents so "miércoles" -> "miercoles"
    const normalized = part.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const dayNum = DAY_ALIASES[normalized];
    if (dayNum === undefined) return null;
    days.add(dayNum);
  }
  return [...days].sort((a, b) => a - b);
};

export const PRESET_DAYS: Record<string, number[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekend: [0, 6],
};
