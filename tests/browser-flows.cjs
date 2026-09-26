const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
  await page
    .getByRole("textbox", { name: "Search brands and agencies" })
    .fill("@Mama Earth");
  await page.getByRole("button", { name: /Mamaearth Beauty/ }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Can’t find it? Add a brand" })
      .count(),
    1,
  );
  await page.getByRole("button", { name: /Mamaearth Beauty/ }).click();
  await page.getByRole("heading", { name: "Mamaearth", exact: true }).waitFor();
  assert.ok(
    await page.getByText("Not enough data yet", { exact: true }).count(),
  );
  console.log("PASS normalized search and empty brand");
  await page
    .getByRole("button", { name: "Post your collab", exact: true })
    .first()
    .click();
  await page.getByLabel("Instagram handle").fill("private_creator");
  await page.getByLabel("Fail auth").evaluate((el) => el.click());
  await page.getByRole("button", { name: "Continue with Instagram" }).click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: /Having trouble/ }).click();
  await page.getByText("KOLLAB-CREATOR-26").waitFor();
  await page.getByLabel("Fail auth").evaluate((el) => el.click());
  await page.getByRole("button", { name: "Verify my bio" }).click();
  await page.getByRole("heading", { name: "Make yourself at home." }).waitFor();
  await page.getByLabel("Choose an alias").fill("Silent Cedar");
  await page
    .getByRole("button", { name: "Continue to your first collab" })
    .click();
  await page
    .getByRole("heading", { name: "Who was the collab with?" })
    .waitFor();
  console.log("PASS forced failure, bio fallback, onboarding");
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByLabel("Find brand").fill("Cloud Test Studio");
  await page.getByRole("button", { name: /Can’t find it/ }).click();
  await page.getByLabel("Brand or agency name").fill("Cloud Test Studio");
  await page.getByLabel("Instagram handle").fill("cloudteststudio");
  await page
    .getByRole("button", { name: "Add brand & write a review" })
    .click();
  await page
    .getByRole("heading", { name: "Who was the collab with?" })
    .waitFor();
  await page.getByText("Cloud Test Studio", { exact: true }).waitFor();
  console.log("PASS inline brand creation and preserved composer");
  async function complete(month) {
    if (month) await page.getByLabel("Collaboration month").fill(month);
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page.getByLabel("Final agreed cash (₹)").fill("12000");
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page
      .getByLabel("A note for other creators")
      .fill("The project had a clear brief and payment was received on time.");
    await page.getByLabel("I haven’t named").check();
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page
      .getByRole("heading", { name: "Exactly what others will see." })
      .waitFor();
    assert.equal(
      await page
        .locator(".modal .review-card")
        .getByText("private_creator")
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "Post your collab", exact: true })
      .last()
      .click();
    await page.locator(".modal").waitFor({ state: "hidden" });
  }
  await complete("2026-09");
  await page
    .getByRole("heading", { name: "Cloud Test Studio", exact: true })
    .waitFor();
  await page.getByText("1 collaborations · weighted by review trust").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Cloud Test Studio", exact: true })
    .waitFor();
  await page.getByText("1 collaborations · weighted by review trust").waitFor();
  console.log("PASS publish, anonymity preview, persistence");
  await page.getByRole("button", { name: "Save brand", exact: true }).click();
  await page
    .getByRole("button", { name: "Saved", exact: true })
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Share scorecard" }).click();
  await page.locator(".share-card").waitFor();
  await page.screenshot({ path: "/private/tmp/kollab-share-mobile.png" });
  await page.getByRole("button", { name: "Close dialog" }).click();
  console.log("PASS watchlist and share card");
  await page.goto("http://127.0.0.1:3000/brand/peach-club", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("heading", { name: "Peach Club", exact: true })
    .waitFor();
  for (const month of ["2026-07", "2026-06"]) {
    await page
      .getByRole("button", { name: "Post your collab", exact: true })
      .first()
      .click();
    await complete(month);
  }
  await page.getByText("3 collaborations · weighted by review trust").waitFor();
  assert.notEqual(
    await page.locator(".scorecard-lead strong").innerText(),
    "Not enough data yet",
  );
  await page.screenshot({
    path: "/private/tmp/kollab-brand-mobile.png",
    fullPage: true,
  });
  console.log("PASS aggregate n=3 threshold");
  await page
    .getByRole("button", { name: "Rates", exact: true })
    .first()
    .click();
  await page.locator(".rate-table").waitFor();
  await page
    .getByLabel("Follower band", { exact: true })
    .selectOption("10k_25k");
  assert.ok(page.url().includes("band=10k_25k"));
  console.log("PASS rates filtering and share URL");
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Rooms", exact: true })
    .click();
  await page
    .getByLabel('Your experience', { exact: true })
    .fill("How do you agree to a reasonable number of revision rounds?");
  await page.getByRole("button", { name: "Post to the room" }).click();
  await page.locator(".room-card").waitFor();
  await page
    .getByLabel("Write a comment")
    .fill("I write the revision limit into the brief before starting.");
  await page.getByRole("button", { name: "Reply →" }).click();
  await page
    .getByText("I write the revision limit into the brief before starting.")
    .waitFor();
  await page.getByRole("button", { name: /Helpful ·/ }).click();
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await page.getByRole("button", { name: "Send report" }).click();
  await page.getByRole("heading", { name: "Report saved" }).waitFor();
  console.log("PASS rooms, comments, helpful votes, reporting");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.screenshot({ path: "/private/tmp/kollab-light-mobile.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  console.log("PASS permanent light mode and 390px overflow");
  assert.deepEqual(errors, []);
  console.log("PASS no browser errors");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
