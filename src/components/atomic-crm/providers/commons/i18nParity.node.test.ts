import { describe, expect, it } from "vitest";
import englishCoreMessages from "ra-language-english";
import { englishCrmMessages } from "./englishCrmMessages";
import { frenchCrmMessages } from "./frenchCrmMessages";
import { chineseCoreMessages } from "./chineseCoreMessages";
import { chineseCrmMessages } from "./chineseCrmMessages";

// Several new components shipped with keys that existed in NEITHER catalog and
// only worked because every lookup carried an inline English default. French
// users silently got English. These tests make a missing key loud instead.
function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

function keyDiff(source: unknown, target: unknown) {
  const left = new Set(flatten(source));
  const right = new Set(flatten(target));
  return {
    missing: [...left].filter((k) => !right.has(k)).sort(),
    extra: [...right].filter((k) => !left.has(k)).sort(),
  };
}

/** Flattens to key -> string value, skipping non-string leaves. */
function strings(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    strings(v, prefix ? `${prefix}.${k}` : k),
  );
}

const englishStrings = Object.fromEntries([
  ...strings(englishCrmMessages),
  ...strings(englishCoreMessages),
]);
const chineseStrings = [
  ...strings(chineseCrmMessages),
  ...strings(chineseCoreMessages),
];

describe("CRM translation catalogs", () => {
  it("define the same keys in English and French", () => {
    expect(keyDiff(englishCrmMessages, frenchCrmMessages)).toEqual({
      missing: [],
      extra: [],
    });
  });

  it("define the same keys in English and Chinese", () => {
    expect(keyDiff(englishCrmMessages, chineseCrmMessages)).toEqual({
      missing: [],
      extra: [],
    });
  });
});

describe("ra-core translation catalog", () => {
  // The Chinese core catalog is maintained in this repo rather than pulled from
  // ra-language-chinese, so nothing upstream keeps it in step with ra-core.
  // This is what notices when a ra-core upgrade adds or renames a key.
  it("covers every ra-core key in Chinese", () => {
    expect(keyDiff(englishCoreMessages, chineseCoreMessages)).toEqual({
      missing: [],
      extra: [],
    });
  });
});

describe("Chinese translations", () => {
  const placeholders = (s: string) => s.match(/%\{[a-zA-Z_]+\}/g) ?? [];

  it("invent no placeholder the English source does not define", () => {
    // Deliberately a SUBSET check, not equality. English uses distinct singular
    // and plural phrasings that can reference different variables; Chinese has
    // one form, so it cannot always carry every placeholder from both branches.
    // What must never happen is an invented placeholder, which renders raw.
    const invented = chineseStrings
      .filter(([key, zh]) => {
        const en = englishStrings[key];
        if (typeof en !== "string") return false;
        const allowed = new Set(placeholders(en));
        return placeholders(zh).some((p) => !allowed.has(p));
      })
      .map(([key]) => key);

    expect(invented).toEqual([]);
  });

  it("keep both branches of every plural form", () => {
    // Chinese has no grammatical plural, but polyglot still needs the `||||`
    // separator wherever the English source uses one, or smart_count throws.
    const broken = chineseStrings
      .filter(([key, zh]) => {
        const en = englishStrings[key];
        return (
          typeof en === "string" && en.includes("||||") !== zh.includes("||||")
        );
      })
      .map(([key]) => key);

    expect(broken).toEqual([]);
  });

  it("never drop the count from a plural's first branch", () => {
    // Polyglot resolves Chinese to ONE plural form and always takes branch 0.
    // So if branch 0 omits %{smart_count} while the English plural branch uses
    // it, the number silently disappears: "5 items selected" rendered as
    // "已选择 1 项". Both branches must therefore carry the count.
    const dropped = chineseStrings
      .filter(([key, zh]) => {
        if (!zh.includes("||||")) return false;
        const en = englishStrings[key];
        if (typeof en !== "string" || !en.includes("%{smart_count}"))
          return false;
        const [first] = zh.split("||||");
        return !first.includes("%{smart_count}");
      })
      .map(([key]) => key);

    expect(dropped).toEqual([]);
  });

  it("contain no Traditional-only characters", () => {
    // Cheap guard against Traditional text landing in a Simplified catalog.
    const TRADITIONAL_ONLY =
      /[個們這對後與為說產業務員問題擊訊網頁檔設聯絡話銷創發電腦資]/;
    const suspect = chineseStrings
      .filter(([, zh]) => TRADITIONAL_ONLY.test(zh))
      .map(([key, zh]) => `${key}: ${zh}`);

    expect(suspect).toEqual([]);
  });
});
