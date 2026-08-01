import { test, expect } from "./fixtures";

// Regression guard for the base:"./" bug.
//
// The app is path-routed (ra-core mounts a BrowserRouter) and the server falls
// back to index.html for unknown paths. With a RELATIVE base, index.html served
// at /contacts/123/show referenced ./assets/index-*.js, which the browser
// resolved to /contacts/123/assets/index-*.js -- another SPA fallback, so the
// browser got HTML for a module script, refused it on MIME grounds, and
// rendered a blank page. Every bookmark and every refresh was broken.
//
// These tests must fail if vite.config.ts base is ever set back to "./".
test.describe("deep links", () => {
  const DEEP_PATHS = ["/contacts", "/contacts/1/show", "/companies", "/deals"];

  for (const path of DEEP_PATHS) {
    test(`serves executable JS for a cold load of ${path}`, async ({
      page,
    }) => {
      const badMimeTypes: string[] = [];
      page.on("response", async (res) => {
        const url = new URL(res.url());
        if (!url.pathname.startsWith("/assets/")) return;
        const type = res.headers()["content-type"] ?? "";
        if (url.pathname.endsWith(".js") && !type.includes("javascript")) {
          badMimeTypes.push(`${url.pathname} -> ${type}`);
        }
      });

      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      // A cold navigation, NOT an in-app link click: this is the code path that
      // a bookmark or a refresh takes.
      await page.goto(path);

      expect(badMimeTypes, "assets must not be served as HTML").toEqual([]);
      expect(consoleErrors).toEqual([]);
      // The SPA shell mounted, rather than leaving an empty root.
      await expect(page.locator("#root")).not.toBeEmpty();
    });
  }

  test("index.html references absolute asset paths", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    const relative = refs.filter((r) => r.startsWith("./"));

    expect(
      relative,
      'relative asset refs break deep links; vite base must be "/"',
    ).toEqual([]);
  });

  test("survives a hard reload on a deep path", async ({
    page,
    signIn,
    createOrganization,
  }) => {
    const org = await createOrganization();
    await signIn(org);

    await page.goto("/contacts");
    await page.reload();

    await expect(page.locator("#root")).not.toBeEmpty();
  });
});
