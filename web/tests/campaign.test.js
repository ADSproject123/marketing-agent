import assert from "node:assert/strict";
import test from "node:test";
import { buildCampaignRequest, CAMPAIGN_FIELD_LIMITS, createCampaignDraft, validateCampaignStep } from "../src/campaign.js";

function completeDraft(overrides = {}) {
  return createCampaignDraft({
    name: "Lotus Bakery", description: "A neighborhood bakery selling fresh bread.",
    benefit: "Bread baked fresh every morning.", location: "Phnom Penh",
    audience: "Families looking for fresh breakfast bread.", ...overrides,
  });
}

test("steps require the business, audience, and an actionable customer destination", () => {
  assert.deepEqual(Object.keys(validateCampaignStep(createCampaignDraft(), 0)), ["name", "description", "benefit"]);
  assert.ok(validateCampaignStep(completeDraft({ audience: "  " }), 1).audience);
  assert.ok(validateCampaignStep(completeDraft({ location: "", cta: "visit" }), 2).destination);
  assert.ok(validateCampaignStep(completeDraft({ cta: "buy", location: "Store address" }), 2).destination);
  assert.deepEqual(validateCampaignStep(completeDraft({ cta: "message", destination: "Telegram @lotus" }), 2), {});
});

test("business facts and supplied offer are kept without borrowing a template campaign", () => {
  const request = buildCampaignRequest(completeDraft({ templateId: "weekend_sale" }));
  assert.match(request.brief, /Lotus Bakery/);
  assert.match(request.brief, /No special offer supplied/);
  assert.doesNotMatch(`${request.brief}\n${request.notes}`, /20% off everything|every latte|Weekend Latte Lift/);
  assert.equal(request.template, "weekend_sale");
  const offered = buildCampaignRequest(completeDraft({ offer: "Free delivery on orders over $15", offerTiming: "Until 12 October" }));
  assert.match(offered.brief, /Free delivery on orders over \$15/);
  assert.match(offered.brief, /Until 12 October/);
});

test("Khmer uses native labels and ends its instructions with the video language note", () => {
  const request = buildCampaignRequest(completeDraft({ language: "km", templateId: "local_cafe", style: "bold" }));
  assert.match(request.brief, /^សេចក្តីសង្ខេបយុទ្ធនាការអាជីវកម្ម/);
  assert.match(request.brief, /ឈ្មោះ: Lotus Bakery/);
  assert.match(request.notes, /ជឿជាក់ និងមានថាមពល/);
  assert.ok(request.notes.endsWith("Make the video in Khmer language."));
  assert.equal(request.language, "km");
});

test("automatic creative angle keeps the user's business facts and no-offer constraints", () => {
  const request = buildCampaignRequest(completeDraft({ templateId: "auto_gemini" }));
  assert.equal(request.template, "auto_gemini");
  assert.match(request.brief, /^BUSINESS CAMPAIGN BRIEF/);
  assert.match(request.brief, /Lotus Bakery/);
  assert.match(request.brief, /No special offer supplied/);
  assert.match(request.notes, /Use only the supplied business facts/);
  assert.doesNotMatch(request.notes, /invent a fresh short-form campaign from scratch/);
});

test("website and source URLs are validated and deduplicated", () => {
  const request = buildCampaignRequest(completeDraft({ website: "https://lotus.example", urls: "https://lotus.example/\n\nhttps://lotus.example/menu" }));
  assert.deepEqual(request.urls, ["https://lotus.example", "https://lotus.example/menu"]);
  assert.match(request.notes, /Website: https:\/\/lotus.example/);
  assert.ok(validateCampaignStep(completeDraft({ website: "javascript:alert(1)" }), 0).website);
  assert.ok(validateCampaignStep(completeDraft({ website: "https://lotus.example/space here" }), 0).website);
  assert.ok(validateCampaignStep(completeDraft({ urls: "not a source URL" }), 3).urls);
  assert.ok(validateCampaignStep(completeDraft({ urls: Array(11).fill("https://lotus.example").join("\n") }), 3).urls);
});

test("every maximum-size answer fits both API prompt limits in each language", () => {
  const details = Object.fromEntries(Object.entries(CAMPAIGN_FIELD_LIMITS)
    .filter(([field]) => !["website", "urls"].includes(field))
    .map(([field, limit]) => [field, "ក".repeat(limit)]));
  details.website = "https://lotus.example/" + "a".repeat(470);
  details.telegramUsername = "a".repeat(CAMPAIGN_FIELD_LIMITS.telegramUsername);
  for (const language of ["en", "km"]) {
    const request = buildCampaignRequest(completeDraft({ ...details, language, templateId: "weekend_sale" }));
    assert.ok(request.brief.length <= 4000);
    assert.ok(request.notes.length <= 4000);
    assert.match(request.notes, /https:\/\/lotus.example/);
    assert.ok(request.brief.includes(details.description));
    assert.ok(request.notes.includes(details.destination));
  }
});

test("unknown language, oversized answers, and unknown templates cannot be submitted", () => {
  for (const changes of [
    { language: "fr" }, { templateId: "unknown-template" },
    { description: "a".repeat(CAMPAIGN_FIELD_LIMITS.description + 1) },
    { offerTiming: "This weekend", offer: "" },
  ]) assert.throws(() => buildCampaignRequest(completeDraft(changes)), error => Boolean(error.errors));
});
