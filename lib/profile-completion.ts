/**
 * V0.12 — Profile completion percentage.
 *
 * Each weighted field contributes to a 0-100 score. The banner in the
 * app shell shows when the score is below 100 AND the user has not
 * explicitly dismissed it (User.profileSkippedAt). The same shape is
 * shared between server and client; no DB lookup inside this helper.
 */

export interface ProfileFields {
  profileImage: string | null;
  primaryRole: string | null;
  additionalRoles: string[];
  experienceLevel: string | null;
  location: string | null;
  languages: string[];
  contactPhone: string | null;
  contactWebsite: string | null;
  portfolioLinks: unknown; // JSON
}

interface Slot {
  key: keyof ProfileFields;
  weight: number;
  filled: (p: ProfileFields) => boolean;
  label: string;
}

const SLOTS: Slot[] = [
  { key: "profileImage",    weight: 10, label: "Profile picture",  filled: (p) => !!p.profileImage },
  { key: "primaryRole",     weight: 20, label: "Primary role",     filled: (p) => !!p.primaryRole },
  { key: "additionalRoles", weight: 10, label: "Additional roles", filled: (p) => p.additionalRoles.length > 0 },
  { key: "experienceLevel", weight: 10, label: "Experience level", filled: (p) => !!p.experienceLevel },
  { key: "location",        weight: 10, label: "Location",         filled: (p) => !!p.location },
  { key: "languages",       weight: 10, label: "Languages",        filled: (p) => p.languages.length > 0 },
  { key: "contactPhone",    weight: 10, label: "Phone",            filled: (p) => !!p.contactPhone },
  { key: "contactWebsite",  weight: 10, label: "Website",          filled: (p) => !!p.contactWebsite },
  { key: "portfolioLinks",  weight: 10, label: "Portfolio",        filled: (p) => Array.isArray(p.portfolioLinks) && (p.portfolioLinks as unknown[]).length > 0 },
];

export interface ProfileCompletion {
  percent: number;
  filled: string[];   // labels of filled slots
  missing: string[];  // labels of missing slots
}

export function computeProfileCompletion(p: ProfileFields): ProfileCompletion {
  let total = 0;
  let earned = 0;
  const filled: string[] = [];
  const missing: string[] = [];
  for (const slot of SLOTS) {
    total += slot.weight;
    if (slot.filled(p)) {
      earned += slot.weight;
      filled.push(slot.label);
    } else {
      missing.push(slot.label);
    }
  }
  return {
    percent: Math.round((earned / total) * 100),
    filled,
    missing,
  };
}

export const EXPERIENCE_LEVELS = [
  { value: "junior", label: "Junior (0-2 years)" },
  { value: "mid",    label: "Mid (3-5 years)" },
  { value: "senior", label: "Senior (6-10 years)" },
  { value: "lead",   label: "Lead (10+ years)" },
] as const;
export const EXPERIENCE_LEVEL_VALUES = EXPERIENCE_LEVELS.map((e) => e.value) as readonly string[];

export const COMMON_LANGUAGES = [
  { value: "ar", label: "Arabic" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "ur", label: "Urdu" },
  { value: "hi", label: "Hindi" },
  { value: "tr", label: "Turkish" },
  { value: "de", label: "German" },
];
