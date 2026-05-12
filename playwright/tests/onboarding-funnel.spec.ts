import { expect, test } from "@playwright/test";

test.describe("landing hero", () => {
  test("has a primary 'Try it' CTA and a benefit-led H1", async ({ page }) => {
    await page.goto("/");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toContainText(/compliance|evidence|framework/i);
    await expect(h1).not.toHaveText("Graphletter");
    const primary = page.getByTestId("hero-primary-cta");
    await expect(primary).toBeVisible();
    await expect(primary).toHaveAttribute("href", "/try");
  });

  test("landing page ends with a CTA above the footer", async ({ page }) => {
    await page.goto("/");
    const closer = page.getByTestId("landing-closing-cta");
    await closer.scrollIntoViewIfNeeded();
    await expect(closer.getByRole("link", { name: /try it/i })).toHaveAttribute("href", "/try");
  });

  test("footer shows the lean link row", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Frameworks" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Research" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "GitHub" })).toBeVisible();
    await expect(footer.getByRole("link", { name: /hello@graphletter\.com/ })).toBeVisible();
  });
});

test.describe("404 page", () => {
  test("shows nav, brand, and a back-home link", async ({ page }) => {
    const res = await page.goto("/does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("nav-logo")).toBeVisible();
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /return home/i })).toHaveAttribute("href", "/");
  });
});

test.describe("frameworks list", () => {
  test("version suffix renders as 'rev5', never 'vrev5'", async ({ page }) => {
    await page.goto("/frameworks");
    const text = await page.getByTestId("framework-card-title").first().innerText();
    expect(text).not.toMatch(/vrev\d/i);
    expect(text).not.toMatch(/vv\d/);
  });
});

test.describe("auth page chrome", () => {
  test("shows the site navigation and footer", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByTestId("nav-logo")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });
});

test.describe("signup failure UX", () => {
  test("restores typed email & name and keeps user on the signup tab", async ({ page }) => {
    await page.route("**/auth", (route, req) => {
      if (req.method() !== "POST") return route.continue();
      return route.fulfill({
        status: 303,
        headers: {
          location:
            "/auth?tab=signup&error=We+could+not+create+your+account.+Please+try+again.&name=Test+User&email=tester%40example.com",
        },
      });
    });
    await page.goto("/auth?tab=signup");
    await page.getByTestId("signup-name-input").fill("Test User");
    await page.getByTestId("signup-email-input").fill("tester@example.com");
    await page.getByTestId("signup-password-input").fill("Sup3rSecret!");
    await page.getByTestId("signup-submit-button").click();
    await expect(page.getByTestId("auth-tab-signup")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("signup-name-input")).toHaveValue("Test User");
    await expect(page.getByTestId("signup-email-input")).toHaveValue("tester@example.com");
    await expect(page.getByTestId("auth-error")).toContainText(/could not/i);
  });
});

test("signup tab shows password minimum and Terms copy", async ({ page }) => {
  await page.goto("/auth?tab=signup");
  const signupPanel = page.getByRole("tabpanel", { name: "Sign Up" });
  await expect(signupPanel.getByTestId("signup-password-hint")).toContainText(/8/);
  await expect(signupPanel.getByTestId("signup-terms")).toContainText(/Terms/i);
  await expect(
    signupPanel.getByTestId("signup-terms").getByRole("link", { name: /Terms/i })
  ).toHaveAttribute("href", "/terms");
});

const demoMock = {
  success: true,
  sample: {
    id: "gov-charter",
    label: "Cybersecurity Program Charter",
    artifactName: "Cybersecurity Program Charter",
    scfControlId: "GOV-01",
  },
  assessment: {
    id: "demo-result-1",
    scf_control_id: "GOV-01",
    control_title: "Cybersecurity & Data Protection Governance Program",
    control_description: "Mock control",
    overall_result: "partial",
    overall_confidence: 0.86,
    summary: "Mock summary",
    objective_results: [
      {
        scf_ao_id: "GOV-01.A1",
        assessment_objective: "Objective 1",
        result: "pass",
        confidence: 0.9,
        reasoning: "Passed",
      },
      {
        scf_ao_id: "GOV-01.A2",
        assessment_objective: "Objective 2",
        result: "fail",
        confidence: 0.9,
        reasoning: "Failed",
      },
      {
        scf_ao_id: "GOV-01.A3",
        assessment_objective: "Objective 3",
        result: "pass",
        confidence: 0.9,
        reasoning: "Passed",
      },
      {
        scf_ao_id: "GOV-01.A4",
        assessment_objective: "Objective 4",
        result: "fail",
        confidence: 0.9,
        reasoning: "Failed",
      },
    ],
    ai_generated: true,
  },
};

test.describe("try-it-out results UI", () => {
  test("headline shows pass count before confidence", async ({ page }) => {
    await page.route("**/api/try-it-out/demo", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(demoMock),
      })
    );
    await page.goto("/try");
    await page.getByTestId("demo-sample-select").click();
    await page.getByRole("option", { name: /Cybersecurity Program Charter/ }).click();
    await page.getByTestId("demo-run-button").click();
    const headline = page.getByTestId("demo-results-headline");
    await expect(headline).toContainText("2 of 4");
    await expect(headline).toContainText("PARTIAL");
    await expect(headline).toContainText("50%");
    await expect(page.getByTestId("demo-results-confidence")).toContainText("86%");
  });

  test("renders exactly one card per control (no duplicate)", async ({ page }) => {
    await page.route("**/api/try-it-out/demo", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(demoMock),
      })
    );
    await page.goto("/try");
    await page.getByTestId("demo-sample-select").click();
    await page.getByRole("option", { name: /Cybersecurity Program Charter/ }).click();
    await page.getByTestId("demo-run-button").click();
    const cards = page.getByTestId("assessment-result-card");
    await expect(cards).toHaveCount(1);
  });
});

test.describe("try-it-out intro + quota", () => {
  test("does not render the Live Workflow block", async ({ page }) => {
    await page.goto("/try");
    await expect(page.getByRole("heading", { name: /Live Workflow/i })).toHaveCount(0);
  });

  test("runs-remaining badge appears when the server provides quota", async ({ page }) => {
    await page.route("**/api/try-it-out/demo/quota", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ remaining: 2, max: 3 }),
      })
    );
    await page.goto("/try");
    await expect(page.getByTestId("demo-runs-remaining")).toContainText("2 of 3");
  });
});

test.describe("frameworks list filter & closer", () => {
  test("family filter narrows the list", async ({ page }) => {
    await page.goto("/frameworks");
    await expect.poll(() => page.getByTestId("framework-card-title").count()).toBeGreaterThan(10);
    const initial = await page.getByTestId("framework-card-title").count();
    await page.getByTestId("family-filter-NIST").click();
    await expect(page.getByTestId("family-filter-NIST")).toHaveAttribute("data-state", "active");
    const narrowed = await page.getByTestId("framework-card-title").count();
    expect(narrowed).toBeLessThan(initial);
    expect(narrowed).toBeGreaterThan(0);
  });

  test("page ends with a 'Request a framework' CTA", async ({ page }) => {
    await page.goto("/frameworks");
    const cta = page.getByTestId("frameworks-missing-cta");
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toContainText(/don.?t see your framework/i);
    await expect(cta.getByRole("link")).toHaveAttribute(
      "href",
      "mailto:hello@graphletter.com?subject=Framework%20request"
    );
  });
});

test.describe("docs page", () => {
  test("pipeline diagram renders all 6 step labels", async ({ page }) => {
    await page.goto("/docs");
    const diagram = page.getByTestId("pipeline-diagram");
    for (const label of [
      "Upload",
      "Extract",
      "Map to SCF",
      "AI assess",
      "Graph scoring",
      "Coverage report",
    ]) {
      await expect(diagram).toContainText(label);
    }
  });
});

test.describe("research page", () => {
  test("topics use only active|planned|shipped statuses (no 'Framework')", async ({ page }) => {
    await page.goto("/research");
    const badges = await page.getByTestId("research-status-badge").allInnerTexts();
    expect(badges.length).toBeGreaterThan(0);
    for (const b of badges) {
      expect(["Active", "Planned", "Shipped"]).toContain(b);
    }
  });

  test("closes with a contact CTA", async ({ page }) => {
    await page.goto("/research");
    const cta = page.getByTestId("research-contact-cta");
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    await expect(cta.getByRole("link")).toHaveAttribute("href", /^mailto:hello@graphletter\.com/);
  });
});

test.describe("mobile nav", () => {
  test("hamburger menu exposes Sign in and Sign up free", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const trigger = page.getByTestId("nav-mobile-toggle");
    await trigger.click();
    await expect(page.getByTestId("nav-mobile-signin")).toHaveAttribute("href", "/auth");
    await expect(page.getByTestId("nav-mobile-signup")).toHaveAttribute("href", "/auth?tab=signup");
  });
});

test.describe("legal placeholder pages", () => {
  for (const path of ["/privacy", "/terms"] as const) {
    test(`${path} loads with 200 and shows draft banner`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByText(/draft/i).first()).toBeVisible();
    });
  }
});

test("per-page titles are distinct", async ({ page }) => {
  const paths = ["/", "/docs", "/research", "/try", "/auth", "/privacy", "/terms"];
  const titles: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    titles.push(await page.title());
  }
  expect(new Set(titles).size).toBe(titles.length);
});
