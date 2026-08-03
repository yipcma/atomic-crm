import { test, expect, api } from "./fixtures";

// The server-side tenancy suite (server/src/rest/tenancy.test.ts) covers the
// boundary exhaustively. This spec checks the same guarantee end-to-end through
// the deployed topology -- Caddy, the reverse proxy and the real bearer token --
// so a misconfigured proxy or a client-side leak cannot slip past.
test.describe("tenant isolation", () => {
  test("one organization's data is invisible to another, in the UI and over the API", async ({
    page,
    signIn,
    createOrganization,
    createCompany,
    createContact,
  }) => {
    const alpha = await createOrganization({
      name: "Alpha Inc",
      email: "admin@alpha.test",
    });
    const bravo = await createOrganization({
      name: "Bravo Ltd",
      email: "admin@bravo.test",
    });

    await createCompany({
      name: "Alpha Secret Corp",
      token: alpha.accessToken,
    });
    const bravoCompany = await createCompany({
      name: "Bravo Only Corp",
      token: bravo.accessToken,
    });

    await createContact({
      first_name: "Alpha",
      last_name: "Secretson",
      token: alpha.accessToken,
    });
    await createContact({
      first_name: "Bravo",
      last_name: "Onlyson",
      token: bravo.accessToken,
    });

    // Over the API, with Bravo's real token.
    const visible = await api<Array<{ name: string }>>("/companies", {
      token: bravo.accessToken,
    });
    expect(visible.map((c) => c.name)).toEqual(["Bravo Only Corp"]);

    // Fetching Alpha's record by id must 404 rather than 403: a 403 would
    // confirm the record exists, which is itself a disclosure.
    await expect(
      api(`/companies/${bravoCompany.id + 1000}`, { token: bravo.accessToken }),
    ).rejects.toThrow(/404/);

    // And in the UI. Contacts rather than companies: the mobile tree registers
    // companies with `show` only, so /#/companies has no list route there and
    // the assertion could never pass on a phone viewport. Contacts have a list
    // on both, so this runs on every project.
    await signIn(bravo);
    // Hash route, not a path: the app is hash-routed, so "/contacts" would hit
    // the SPA fallback and boot the app at the dashboard instead.
    await page.goto("/#/contacts");
    await expect(page.getByText("Bravo Onlyson")).toBeVisible();
    await expect(page.getByText("Alpha Secretson")).toHaveCount(0);
  });

  test("a contact cannot be attached to another tenant's company", async ({
    createOrganization,
    createCompany,
    createContact,
  }) => {
    const alpha = await createOrganization({
      name: "Alpha Inc",
      email: "admin@alpha.test",
    });
    const bravo = await createOrganization({
      name: "Bravo Ltd",
      email: "admin@bravo.test",
    });
    const alphaCompany = await createCompany({
      name: "Alpha Secret Corp",
      token: alpha.accessToken,
    });

    // This is the write that used to make contacts_summary leak Alpha's
    // company name back to Bravo.
    await expect(
      createContact({
        first_name: "Mallory",
        last_name: "Probe",
        company_id: alphaCompany.id,
        token: bravo.accessToken,
      }),
    ).rejects.toThrow();
  });
});
