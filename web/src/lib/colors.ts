const CAT_VARS = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
  "var(--cat-8)",
]

const departmentColorIndex: Record<string, number> = {
  Engineering: 0,
  Design: 1,
  Sales: 2,
  Marketing: 3,
  People: 4,
  Finance: 5,
}

const leaveTypeColorIndex: Record<string, number> = {
  Annual: 0,
  Sick: 1,
  "Work From Home": 2,
  Unpaid: 6,
}

export function departmentColor(department: string) {
  return CAT_VARS[departmentColorIndex[department] ?? 7]
}

export function leaveTypeColor(type: string) {
  return CAT_VARS[leaveTypeColorIndex[type] ?? 7]
}

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

// Darker, saturated steps of the same hue family as the categorical chart
// palette, picked so white text stays legible on every one of them — the
// chart palette itself skips this (yellow/magenta are too light for text).
const AVATAR_FILLS = [
  "#7c3aed", // violet — leads, to sit in the brand family
  "#ea580c", // orange
  "#0d9488", // teal
  "#2563eb", // blue
  "#db2777", // pink
  "#16a34a", // green
  "#ca8a04", // amber
  "#dc2626", // red
]

export function avatarFill(seed: string) {
  return AVATAR_FILLS[hashString(seed) % AVATAR_FILLS.length]
}
