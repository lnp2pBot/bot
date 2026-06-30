const REPUBLISH_DAYS_DEFAULT = 10;

export const getRepublishCount = (): number => {
  const raw = parseInt(process.env.REPUBLISH_ORDER_DAYS || '');
  return Number.isInteger(raw) && raw > 0 ? raw : REPUBLISH_DAYS_DEFAULT;
};

// English day names (full and abbreviated) mapped to getUTCDay() values (0=Sun..6=Sat)
const DAY_ALIASES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

// Parses a comma/space separated list of English day names into sorted UTC
// weekday values (0-6). Returns null if any token is unrecognized.
export const parseCustomDays = (input: string): number[] | null => {
  const parts = input.toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const days = new Set<number>();
  for (const part of parts) {
    const dayNum = DAY_ALIASES[part];
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
