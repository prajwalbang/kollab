const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const localRequire = (id) => {
    if (id.startsWith("@/"))
      return id.endsWith(".json")
        ? require(path.join(root, id.slice(2)))
        : load(path.join(root, id.slice(2) + ".ts"));
    if (id.startsWith("."))
      return load(path.resolve(path.dirname(file), id + ".ts"));
    return require(id);
  };
  new Function("require", "module", "exports", source)(
    localRequire,
    module,
    module.exports,
  );
  cache.set(file, module.exports);
  return module.exports;
}
const storage = new Map();
global.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, v),
  removeItem: (k) => storage.delete(k),
};
global.window = new EventTarget();
const { mockRepo: repo } = load(path.join(root, "lib/data/mock-repo.ts"));
const fixture = require("../data/reviews.json");
const input = (month = "2026-06") => {
  const {
    user_id,
    id,
    proof_status,
    visibility,
    trust_score,
    helpful_count,
    created_at,
    edited_at,
    removed_reason,
    follower_band,
    category,
    region,
    reply,
    demo,
    ...draft
  } = fixture[0];
  return { ...draft, brand_id: "demo-2", collab_month: month };
};
test("real brand fixtures have no reviews; search normalizes punctuation and handles", async () => {
  await repo.reset();
  const brands = await repo.searchBrands("");
  assert.equal(brands.filter((b) => !b.demo).length, 40);
  assert.ok(brands.filter((b) => !b.demo).every((b) => b.review_count === 0));
  for (const query of ["mamaearth", "Mama Earth", "@mamaearth"])
    assert.equal((await repo.searchBrands(query))[0].name, "Mamaearth");
  assert.ok(
    (await repo.findSimilarBrands("Mama Earth", "mamaearth.in")).length,
  );
});
test("public records strip identity and exact dates at the repository boundary", async () => {
  for (const review of await repo.listReviews()) {
    for (const key of [
      "user_id",
      "created_at",
      "edited_at",
      "handle",
      "handle_encrypted",
      "storage_path",
      "instagram_user_id",
      "creator_city",
    ])
      assert.ok(!(key in review), key);
    assert.match(review.collab_month, /^\d{4}-\d{2}$/);
  }
  for (const brand of await repo.searchBrands(""))
    assert.ok(
      !("created_by_user_id" in brand) && !("claimed_by_user_id" in brand),
    );
});
test("weighted aggregate suppression and three-review transition", async () => {
  await repo.reset();
  const before = await repo.getBrandAggregates("demo-2");
  assert.equal(before.count, 1);
  assert.equal(before.would_work_again, null);
  await repo.setSession("new");
  await repo.createReview(input("2026-06"));
  assert.equal(
    (await repo.getBrandAggregates("demo-2")).would_work_again,
    null,
  );
  await repo.createReview(input("2026-07"));
  const after = await repo.getBrandAggregates("demo-2");
  assert.equal(after.count, 3);
  assert.equal(after.would_work_again, 50);
  assert.equal(after.median_days_to_payment, 15);
  assert.equal((await repo.getSession()).contributions, 2);
  const rates = await repo.getRates({ category: "Beauty", band: "10k_25k" });
  assert.equal(rates[0].count, 3);
  assert.notEqual(rates[0].median, null);
  assert.equal(
    (await repo.getRates({ category: "Beauty", band: "1k_5k" }))[0].median,
    null,
  );
});
test("duplicate reviews and contact details are blocked", async () => {
  await assert.rejects(
    () => repo.createReview(input("2026-07")),
    /already shared/,
  );
  await assert.rejects(
    () =>
      repo.createReview({
        ...input("2026-05"),
        body: "Please contact somebody@example.com",
      }),
    /contact details/,
  );
});
test("watchlist and notifications persist under the namespaced key", async () => {
  await repo.toggleWatchlist("demo-2");
  await repo.createReview(input("2026-04"));
  assert.equal((await repo.getWatchlist())[0].id, "demo-2");
  assert.equal((await repo.getNotifications()).length, 1);
  assert.ok(localStorage.getItem("kollab:demo:v2"));
  await repo.markNotificationsRead();
  assert.equal((await repo.getNotifications())[0].read, true);
});
test("brand creation, rooms, votes, comments, reports and reset", async () => {
  const b = await repo.createBrand({
    name: "Fictional testing brand",
    instagram_handle: "fictionaltesting",
    category: "Beauty",
    website: null,
    entity_type: "brand",
  });
  assert.equal(b.status, "pending_review");
  assert.equal((await repo.getBrand(b.slug)).id, b.id);
  const p = await repo.createPost(
    "Beauty",
    "How should I price usage rights for a new collaboration?",
  );
  await repo.comment(
    p.id,
    "Discuss the duration and platforms before agreeing.",
  );
  await repo.vote(p.id);
  assert.equal((await repo.listPosts("Beauty"))[0].helpful_count, 1);
  assert.equal((await repo.listPosts("Beauty"))[0].comments.length, 1);
  await repo.report(p.id, "Personal information");
  await repo.reset();
  assert.equal(await repo.getSession(), null);
  assert.equal((await repo.listReviews()).length, 4);
  assert.equal((await repo.getWatchlist()).length, 0);
});

test("opinion search does not confuse late payments with payment dates", () => {
  const { searchItems } = load(path.join(root, "lib/data/search.ts"));
  const records = [
    { text: "Payment date agreed in writing" },
    { text: "Late payment after extra revisions" },
    { text: "Paid on time with creative freedom" },
  ];
  assert.deepEqual(
    searchItems(records, "late payments", (r) => r.text),
    [records[1]],
  );
  assert.deepEqual(
    searchItems(records, "creativ freedom", (r) => r.text),
    [records[2]],
  );
});
test("rate search scopes samples before aggregation and preserves suppression", async () => {
  await repo.reset();
  const sunday = await repo.getRates({ q: "Sunday Theory" });
  assert.equal(sunday.length, 1);
  assert.equal(sunday[0].count, 3);
  assert.notEqual(sunday[0].median, null);
  const peach = await repo.getRates({ q: "Peach Club" });
  assert.equal(peach.length, 1);
  assert.equal(peach[0].count, 1);
  assert.equal(peach[0].median, null);
  assert.deepEqual(await repo.getRates({ q: "no-such-brand-zzzzzz" }), []);
});
