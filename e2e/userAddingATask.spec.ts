import { expect, test } from "./fixtures";

test.describe("user adding a task", () => {
  test.beforeEach(
    async ({
      createOrganization,
      createContact,
      createCompany,
      createNotes,
      signIn,
    }) => {
      const org = await createOrganization({
        first_name: "John",
        last_name: "Doe",
        email: "john@doe.com",
      });
      await signIn(org);

      const company = await createCompany({
        name: "Smith Corp",
        token: org.accessToken,
      });

      const jane = await createContact({
        first_name: "Jane",
        last_name: "Smith",
        title: "CEO",
        company_id: company.id,
        token: org.accessToken,
      });
      await createNotes({
        contactId: jane.id,
        token: org.accessToken,
        notes: [{ text: "Met at a conference." }],
      });

      await createContact({
        first_name: "Bob",
        last_name: "Johnson",
        title: "CTO",
        company_id: company.id,
        token: org.accessToken,
      });

      await createContact({
        first_name: "Alice",
        last_name: "Williams",
        title: "CFO",
        company_id: company.id,
        token: org.accessToken,
      });
    },
  );
  test("user adding a task", async ({ page, isMobile, menu, dismissToast }) => {
    // The session is seeded in beforeEach, so no login form to drive here.
    await page.goto("/");

    await expect(page).toHaveTitle(/Leaf CRM/);
    await expect(page.getByText("Latest Activity")).toBeVisible();

    await menu.goToContacts();
    await page.waitForLoadState("networkidle");

    await page.getByText("Jane Smith").click();
    await page.waitForLoadState("networkidle");

    if (isMobile) {
      await page.getByRole("button", { name: "Create" }).click();
      await page.getByRole("menuitem", { name: "Task" }).click();
    } else {
      await page.getByRole("button", { name: "Add Task" }).click();
    }
    await page.getByLabel("Description *").fill("Follow up with Jane");
    await page.getByLabel("Due date").fill("2026-04-11T21:00");
    await page.getByLabel("Type").click();
    await page.getByRole("option", { name: "Call" }).click();

    await page.getByRole("button", { name: "Save" }).click();

    await dismissToast("Task added");

    if (isMobile) {
      await expect(page.getByText("1 task")).toBeVisible();
      await page.getByText("1 task").click();

      await expect(page.getByText("Follow up with Jane")).toBeVisible();
      await expect(page.getByText("due 4/11/2026, 9:00:00 PM")).toBeVisible();
    } else {
      await expect(page.getByText("Tasks")).toBeVisible();

      await expect(page.getByText("Tasks").locator("..")).toHaveText(
        /Follow up with Jane/,
      );
      await menu.goToDashboard();

      await expect(page.getByText("Upcoming Tasks")).toBeVisible();
      await expect(
        page.getByText("Upcoming Tasks").locator("../.."),
      ).toHaveText(/Follow up with Jane/);
      await expect(
        page.getByText("Follow up with Jane").locator(".."),
      ).toHaveText(
        "Call Follow up with Janedue 4/11/2026, 9:00:00 PM (Re: Jane Smith)",
      );
    }
  });
});
