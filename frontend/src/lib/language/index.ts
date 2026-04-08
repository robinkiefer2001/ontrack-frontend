import { derived } from "svelte/store";
import { currentLanguage } from "./languageStore";
import { de } from "./de";
import { en } from "./en";
import type { Language, Translations } from "./types";

const translations: Record<Language, Translations> = {
  de,
  en,
};

// Derived store that returns the current translations
export const t = derived(currentLanguage, ($currentLanguage) => {
  return translations[$currentLanguage];
});

// Export everything
export { currentLanguage, setLanguage } from "./languageStore";
export type { Language, Translations } from "./types";
