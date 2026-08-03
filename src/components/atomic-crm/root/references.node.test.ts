import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// A `reference="X"` naming a resource the app does not register fails at
// RUNTIME, not build time: the request 404s and the input silently shows
// nothing. That is what broke contact selection in the task form, where four
// components referenced "contacts_summary" -- the name of the database VIEW the
// server reads from, not of the API resource, which is "contacts".
//
// activity_log is served by the API and used directly via useGetList rather
// than being registered as a <Resource>, so it is allowed as a reference too.
const EXTRA_VALID_REFERENCES = ["activity_log"];

const CRM_ROOT = join(process.cwd(), "src/components/atomic-crm");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

function registeredResources(): string[] {
  const crm = readFileSync(join(CRM_ROOT, "root/CRM.tsx"), "utf8");
  return [...crm.matchAll(/<Resource\s[^>]*name="([a-z_]+)"/g)].map(
    (m) => m[1],
  );
}

describe("resource references", () => {
  const valid = new Set([...registeredResources(), ...EXTRA_VALID_REFERENCES]);

  it("registers the resources the app is built around", () => {
    // Guards against the regex above silently matching nothing.
    expect(valid.has("contacts")).toBe(true);
    expect(valid.size).toBeGreaterThan(5);
  });

  it("every reference= names a registered resource", () => {
    const offenders: string[] = [];

    for (const file of walk(CRM_ROOT)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/reference="([a-z_]+)"/g)) {
        if (!valid.has(match[1])) {
          offenders.push(
            `${file.replace(process.cwd() + "/", "")}: ${match[1]}`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("every reference= is backed by a full-text search config or needs none", () => {
    // A ReferenceInput's autocomplete sends { q } by default. The provider only
    // rewrites `q` into an @or ILIKE for resources listed in SEARCH_COLUMNS;
    // anything else forwards `q` verbatim and the server rejects it with
    // "Unknown filter column: q". So a searchable reference must be listed.
    const provider = readFileSync(
      join(CRM_ROOT, "providers/railway/dataProvider.ts"),
      "utf8",
    );
    const block = provider.slice(
      provider.indexOf("const SEARCH_COLUMNS"),
      provider.indexOf("function applyFullTextSearch"),
    );
    const searchable = new Set(
      [...block.matchAll(/^\s{2}([a-z_]+):\s*\[/gm)].map((m) => m[1]),
    );

    // Resources used behind an AutocompleteInput, which is what sends `q`.
    for (const resource of ["contacts", "companies", "deals"]) {
      expect(
        searchable.has(resource),
        `${resource} is used in a searchable reference but has no SEARCH_COLUMNS entry`,
      ).toBe(true);
    }
  });
});
