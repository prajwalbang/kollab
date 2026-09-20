const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/private/tmp/kollab-landscape.png" });
  await page
    .locator(".glass-nav")
    .getByRole("button", { name: "Reviews", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search opinions" })
    .fill("late payments");
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".community .review-card").count(), 0);
  assert.ok((await page.locator(".community .frosted-gate").count()) > 0);
  console.log("PASS opinion search preserves logged-out gates");
  await page.getByLabel("Demo session").selectOption("contributor");
  await page.locator(".community .review-card").first().waitFor();
  assert.equal(await page.locator(".community .review-card").count(), 2);
  await page.getByRole("button", { name: "Clear search opinions" }).click();
  await page.waitForTimeout(300);
  await page
    .locator(".community .review-card")
    .first()
    .getByRole("button", { name: "Read the full experience" })
    .click();
  await page.getByRole("dialog", { name: "Sunday Theory" }).waitFor();
  await page.waitForTimeout(550);
  const bounds = await page.locator(".review-focus").boundingBox();
  assert.ok(Math.abs(bounds.x + bounds.width / 2 - 720) < 3);
  await page.getByRole("heading", { name: "What was delivered" }).waitFor();
  await page.screenshot({ path: "/private/tmp/kollab-expanded-desktop.png" });
  await page.keyboard.press("Escape");
  await page.locator(".review-focus").waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  await page
    .locator(".community .review-card")
    .first()
    .locator(".structured-review")
    .click();
  await page.getByRole("dialog", { name: "Sunday Theory" }).waitFor();
  await page
    .locator(".review-focus-backdrop")
    .click({ position: { x: 8, y: 8 } });
  await page.locator(".review-focus").waitFor({ state: "hidden" });
  console.log(
    "PASS centered expansion, whole-card click, backdrop close, complete details, Escape and scroll restoration",
  );
  await page
    .locator(".glass-nav")
    .getByRole("button", { name: "Discover", exact: true })
    .click();
  await page.getByRole("button", { name: "Save Nykaa", exact: true }).click();
  await page.getByRole("button", { name: "Save boAt", exact: true }).click();
  await page
    .locator(".glass-nav")
    .getByRole("button", { name: /Saved/ })
    .click();
  await page
    .getByRole("searchbox", { name: "Search saved brands" })
    .fill("nykaa");
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".brand-card").count(), 1);
  await page
    .getByRole("searchbox", { name: "Search saved brands" })
    .fill("zzzzzzzz");
  await page
    .getByRole("heading", { name: "No saved brands match your search." })
    .waitFor();
  console.log("PASS Saved search and empty state");
  await page
    .locator(".glass-nav")
    .getByRole("button", { name: "Rates", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search rates" })
    .fill("Sunday Theory");
  await page.waitForTimeout(400);
  await page.locator(".rate-table-row").waitFor();
  assert.equal(await page.locator(".rate-table-row").count(), 1);
  assert.match(await page.locator(".rate-table-row").innerText(), /Lifestyle/);
  assert.match(page.url(), /q=Sunday\+Theory/);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("searchbox", { name: "Search rates" }).waitFor();
  assert.equal(
    await page.getByRole("searchbox", { name: "Search rates" }).inputValue(),
    "Sunday Theory",
  );
  await page.getByRole("searchbox", { name: "Search rates" }).fill("zzzzzzzzz");
  await page
    .getByRole("heading", { name: "No rates match this search." })
    .waitFor();
  console.log("PASS rate search, URL persistence and empty state");
  await page
    .locator(".glass-nav")
    .getByRole("button", { name: "Rooms", exact: true })
    .click();
  await page
    .getByLabel(/Posting as/)
    .fill("How do you negotiate usage rights for six months?");
  await page.getByRole("button", { name: "Post to the room" }).click();
  await page.locator(".room-card").waitFor();
  await page
    .getByRole("searchbox", { name: "Search discussions" })
    .fill("usage rights");
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".room-card").count(), 1);
  await page
    .getByRole("searchbox", { name: "Search discussions" })
    .fill("zzzzzzz");
  await page
    .getByRole("heading", { name: "No discussions match your search." })
    .waitFor();
  console.log("PASS Rooms search");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".glass-nav")
    .getByRole("button", { name: "Reviews", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search opinions" })
    .fill("Sunday Theory");
  await page.waitForTimeout(300);
  await page
    .locator(".community .review-card")
    .first()
    .getByRole("button", { name: "Read the full experience" })
    .click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/private/tmp/kollab-expanded-mobile.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Close review" }).click();
  await page.locator(".review-focus").waitFor({ state: "hidden" });
  await page.screenshot({
    path: "/private/tmp/kollab-opinions-mobile.png",
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .locator(".community .review-card")
    .first()
    .getByRole("button", { name: "Read the full experience" })
    .click();
  await page.getByRole("dialog", { name: "Sunday Theory" }).waitFor();
  await page.keyboard.press("Escape");
  console.log("PASS mobile layout and reduced-motion expansion");
  assert.deepEqual(errors, []);
  console.log("PASS no browser errors");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
