import { writable } from "svelte/store";
import type { Language } from "./types";

// Lade gespeicherte Sprache oder verwende Standard
const savedLanguage = (typeof localStorage !== "undefined" 
  ? localStorage.getItem("language") 
  : null) as Language | null;

export const currentLanguage = writable<Language>(savedLanguage || "de");

// Speichere Sprachwahl automatisch
currentLanguage.subscribe((value) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("language", value);
  }
});

export function setLanguage(lang: Language) {
  currentLanguage.set(lang);
}
