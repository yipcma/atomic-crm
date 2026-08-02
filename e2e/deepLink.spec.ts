import { test, expect } from "./fixtures";

// The app is HASH-routed: ra-core's AdminRouter mounts a HashRouter by default,
// so location.pathname stays "/" and the route lives in the fragment. Two
// separate things therefore need guarding, and they are easy to confuse:
//
//  1. Asset resolution. With a relative vite `base`, index.html served at any
//     non-root path resolves ./assets/... against that path, gets the SPA
//     fallback's HTML back for a module script, and white-screens on a MIME
//     refusal. Hash routing hides this most of the time, which is exactly why
//     it needs a test.
//  2. Hash routes actually routing -- in particular the invite and
//     password-reset links, which carry their token in the fragment. A
//     path-based link loads the app at the dashboard and silently drops the
//     token, locking the invitee out with no error.
test.describe("asset resolution", () => {
  test("index.html references absolute asset paths", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);

    expect(
      refs.filter((r) => r.startsWith("./")),
      'relative asset refs break any non-root URL; vite base must be "/"',
    ).toEqual([]);
  });

  test("serves executable JS, never HTML, for asset requests", async ({
    page,
  }) => {
    const badMimeTypes: string[] = [];
    page.on("response", (res) => {
      const { pathname } = new URL(res.url());
      if (!pathname.startsWith("/assets/") || !pathname.endsWith(".js")) return;
      const type = res.headers()["content-type"] ?? "";
      if (!type.includes("javascript")) {
        badMimeTypes.push(`${pathname} -> ${type}`);
      }
    });

    await page.goto("/#/contacts");

    expect(badMimeTypes, "assets must not be served as HTML").toEqual([]);
    await expect(page.locator("#root")).not.toBeEmpty();
  });
});

test.describe("hash routes", () => {
  test("a cold load of a hash route renders that route, not the dashboard", async ({
    page,
    signIn,
    createOrganization,
  }) => {
    const org = await createOrganization();
    await signIn(org);

    await page.goto("/#/contacts");

    await expect(page).toHaveURL(/#\/contacts$/);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  // Guards a regression that shipped once: the invite URL was rewritten to a
  // path, which loads the app at the dashboard and discards the token.
  test("the set-password route is reachable by its shared link form", async ({
    page,
  }) => {
    await page.goto("/#/set-password?token=DUMMY");

    // Renders the password form rather than falling through to the dashboard.
    await expect(
      page.getByRole("button", { name: /set password/i }),
    ).toBeVisible();
  });

  test("the register route is reachable by its shared link form", async ({
    page,
  }) => {
    await page.goto("/#/register?token=DUMMY");

    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page).toHaveURL(/#\/register/);
  });
});
