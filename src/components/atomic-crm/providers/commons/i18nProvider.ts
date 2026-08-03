import { mergeTranslations } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import frenchMessages from "ra-language-french";
import { englishCrmMessages } from "./englishCrmMessages";
import { frenchCrmMessages } from "./frenchCrmMessages";
import { chineseCoreMessages } from "./chineseCoreMessages";
import { chineseCrmMessages } from "./chineseCrmMessages";

const englishCatalog = mergeTranslations(englishMessages, englishCrmMessages);

const frenchCatalog = mergeTranslations(
  englishCatalog,
  frenchMessages,
  frenchCrmMessages,
);

// Layered over English so a key added later still renders (in English) instead
// of surfacing a raw translation key.
const chineseCatalog = mergeTranslations(
  englishCatalog,
  chineseCoreMessages,
  chineseCrmMessages,
);

export type SupportedLocale = "en" | "fr" | "zh";

export const getInitialLocale = (): SupportedLocale => {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const browserLocale = (
    navigator.languages?.[0] ??
    navigator.language ??
    ""
  ).toLowerCase();

  // Matches zh, zh-CN, zh-Hans, zh-SG. The catalog is Simplified, so
  // Traditional locales fall through to English rather than being served the
  // wrong script.
  if (browserLocale.startsWith("zh")) {
    const isTraditional = ["hant", "tw", "hk", "mo"].some((tag) =>
      browserLocale.includes(tag),
    );
    if (!isTraditional) {
      return "zh";
    }
  }

  if (browserLocale.startsWith("fr")) {
    return "fr";
  }

  return "en";
};

export const i18nProvider = polyglotI18nProvider(
  (locale) => {
    if (locale === "fr") {
      return frenchCatalog;
    }
    if (locale === "zh") {
      return chineseCatalog;
    }
    return englishCatalog;
  },
  getInitialLocale(),
  [
    { locale: "en", name: "English" },
    { locale: "fr", name: "Français" },
    // Endonym, matching the other entries: this is what a Chinese user scans
    // for in a language menu.
    { locale: "zh", name: "简体中文" },
  ],
  { allowMissing: true },
);

export const testI18nProvider = polyglotI18nProvider(
  () => englishCatalog,
  "en",
  [{ locale: "en", name: "English" }],
  { allowMissing: true },
);
