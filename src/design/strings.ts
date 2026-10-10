/** Brand and product copy. One place for names, so nothing drifts. */
export const BRAND = {
  name: 'UPDOWNLY',
  slug: 'updownly',
  tagline: 'Higher or lower. How far can you go?',
} as const;

export const MODE_LABEL = { classic: 'Classic', sprint: '60-Second Sprint', daily: 'Daily Challenge' } as const;
export const MODE_SHORT = { classic: 'Classic', sprint: 'Sprint', daily: 'Daily' } as const;
export const DIFFICULTY_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard' } as const;
export const DIFFICULTY_HINT = {
  easy: 'Big gaps between the two values.',
  normal: 'A balanced mix of comparisons.',
  hard: 'Close calls. Values sit near each other.',
} as const;
