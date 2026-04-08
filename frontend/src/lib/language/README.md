# Mehrsprachiges System (i18n)

## Übersicht

OnTrack unterstützt jetzt mehrere Sprachen (Deutsch und Englisch). Das System speichert die Sprachwahl automatisch im localStorage.

## Verfügbare Sprachen

- 🇩🇪 **Deutsch** (Standard)
- 🇬🇧 **English**

## Sprachwahl

Die Sprache kann in den **Einstellungen** geändert werden:
1. Navigiere zu **Einstellungen**
2. Wähle die gewünschte Sprache unter "Spracheinstellungen"
3. Die Sprachwahl wird automatisch gespeichert und bei jedem Besuch angewendet

## Verwendung in Komponenten

```typescript
<script lang="ts">
  import { t } from "$lib/language";
</script>

<!-- Text wird automatisch übersetzt -->
<h1>{$t.projects.title}</h1>
<button>{$t.common.save}</button>
```

## Struktur

```
src/lib/language/
├── index.ts            # Hauptexport
├── languageStore.ts    # Svelte Store für aktuelle Sprache
├── types.ts            # TypeScript Interfaces
├── de.ts               # Deutsche Übersetzungen
└── en.ts               # Englische Übersetzungen
```

## Neue Übersetzungen hinzufügen

1. **Type in `types.ts` erweitern:**
```typescript
export interface Translations {
  mySection: {
    myKey: string;
  };
}
```

2. **Deutsche Übersetzung in `de.ts` hinzufügen:**
```typescript
export const de: Translations = {
  mySection: {
    myKey: "Mein deutscher Text",
  },
};
```

3. **Englische Übersetzung in `en.ts` hinzufügen:**
```typescript
export const en: Translations = {
  mySection: {
    myKey: "My english text",
  },
};
```

4. **In Komponenten verwenden:**
```svelte
{$t.mySection.myKey}
```

## Dynamische Platzhalter

Für Texte mit Variablen verwenden Sie `.replace()`:

```svelte
{$t.projects.exceedMessage.replace('{hours}', hours.toFixed(1))}
```

## Bereits übersetzte Bereiche

✅ Navigation
✅ Common UI (Buttons, Actions, etc.)
✅ Settings Page
✅ Projects (teilweise)
✅ Customers
✅ Task & Project Status

## TypeScript Unterstützung

Das System ist vollständig typisiert. IntelliSense zeigt automatisch alle verfügbaren Übersetzungskeys an.

## Persistenz

Die Sprachwahl wird im `localStorage` unter dem Key "language" gespeichert und automatisch beim nächsten Besuch geladen.
