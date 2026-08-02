import { describe, expect, it } from "vitest";
import { englishCrmMessages } from "./englishCrmMessages";
import { frenchCrmMessages } from "./frenchCrmMessages";

// Several new components shipped with keys that existed in NEITHER catalog and
// only worked because every lookup carried an inline English default. French
// users silently got English. This test makes a missing key loud instead.
function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("translation catalogs", () => {
  it("define the same keys in English and French", () => {
    const en = new Set(flatten(englishCrmMessages));
    const fr = new Set(flatten(frenchCrmMessages));

    const missingInFrench = [...en].filter((k) => !fr.has(k)).sort();
    const missingInEnglish = [...fr].filter((k) => !en.has(k)).sort();

    expect({ missingInFrench, missingInEnglish }).toEqual({
      missingInFrench: [],
      missingInEnglish: [],
    });
  });
});
