import { afterEach, describe, expect, it, vi } from "vitest";
import { getInitialLocale, i18nProvider } from "./i18nProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("i18nProvider", () => {
  it("registers en, fr and zh locales", () => {
    expect(i18nProvider.getLocales?.()).toEqual([
      { locale: "en", name: "English" },
      { locale: "fr", name: "Français" },
      { locale: "zh", name: "简体中文" },
    ]);
  });

  it("translates the language key in french", async () => {
    await i18nProvider.changeLocale("fr");

    expect(i18nProvider.translate("crm.language")).toBe("Langue");
  });

  it("falls back to english for unknown locales", async () => {
    await i18nProvider.changeLocale("es");

    expect(i18nProvider.translate("crm.language")).toBe("Language");
  });

  it("translates recently added fr crm keys", async () => {
    await i18nProvider.changeLocale("fr");

    expect(i18nProvider.translate("resources.deals.empty.title")).toBe(
      "Aucune affaire trouvée",
    );
  });

  it("uses browser french locale when available", () => {
    vi.stubGlobal("navigator", {
      language: "fr-FR",
      languages: ["fr-FR", "en-US"],
    });

    expect(getInitialLocale()).toBe("fr");
  });

  it("falls back to english when browser locale is unsupported", () => {
    vi.stubGlobal("navigator", {
      language: "es-ES",
      languages: ["es-ES", "pt-BR"],
    });

    expect(getInitialLocale()).toBe("en");
  });

  it("translates core and crm keys in chinese", async () => {
    await i18nProvider.changeLocale("zh");

    expect(i18nProvider.translate("crm.language")).toBe("语言");
    expect(i18nProvider.translate("ra.action.save")).toBe("保存");
    expect(
      i18nProvider.translate("resources.deals.name", { smart_count: 1 }),
    ).toBe("商机");
  });

  it("keeps the count in a chinese plural", async () => {
    await i18nProvider.changeLocale("zh");

    // Polyglot resolves Chinese to a single plural form and always takes the
    // first branch, so a branch without %{smart_count} silently drops the
    // number: "5 items selected" once rendered as 已选择 1 项.
    expect(
      i18nProvider.translate("ra.action.bulk_actions", { smart_count: 5 }),
    ).toBe("已选择 5 项");
  });

  for (const locale of ["zh", "zh-CN", "zh-Hans", "zh-SG"]) {
    it(`uses chinese for browser locale ${locale}`, () => {
      vi.stubGlobal("navigator", { language: locale, languages: [locale] });

      expect(getInitialLocale()).toBe("zh");
    });
  }

  for (const locale of ["zh-TW", "zh-HK", "zh-Hant"]) {
    it(`falls back to english for traditional locale ${locale}`, () => {
      // The catalog is Simplified only; serving it to a Traditional reader
      // would be the wrong script rather than a partial translation.
      vi.stubGlobal("navigator", { language: locale, languages: [locale] });

      expect(getInitialLocale()).toBe("en");
    });
  }
});
