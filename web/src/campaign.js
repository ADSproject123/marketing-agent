import { TEMPLATES, templateById } from "./templates.js";

export const CAMPAIGN_FIELD_LIMITS = Object.freeze({
  name: 120,
  description: 1000,
  benefit: 500,
  location: 300,
  website: 500,
  audience: 500,
  offer: 700,
  offerTiming: 200,
  destination: 1000,
  telegramUsername: 32,
  extraNotes: 500,
  urls: 5000,
});

export const CAMPAIGN_ASSET_LIMITS = Object.freeze({
  maxFiles: 5,
  maxBytes: 5 * 1024 * 1024,
  accept: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
  extensions: [".png", ".jpg", ".jpeg", ".webp"],
});

const DEFAULT_DRAFT = {
  promotionId: "", kind: "shop", name: "", description: "", benefit: "",
  location: "", website: "", goal: "sales", audience: "", offer: "",
  offerTiming: "", cta: "visit", destination: "", telegramUsername: "",
  style: "warm", videoLength: "30", extraNotes: "", urls: "", templateId: "", language: "en",
  assets: [], khqrFile: null,
};

const CHOICES = {
  kind: ["shop", "product", "service", "other"],
  goal: ["sales", "awareness", "launch"],
  cta: ["visit", "message", "buy", "learn"],
  style: ["warm", "bold", "clean"],
  videoLength: ["15", "30", "45"],
  language: ["en", "km"],
};

const COPY = {
  en: {
    heading: "BUSINESS CAMPAIGN BRIEF",
    labels: {
      kind: "Promotion type", name: "Name", description: "What it offers",
      benefit: "Main customer benefit", location: "Location", website: "Website",
      goal: "Campaign goal", audience: "Target audience", offer: "Offer",
      offerTiming: "Offer timing", cta: "Call to action", destination: "Action destination",
      telegramUsername: "Telegram",
    },
    kind: { shop: "Shop or business", product: "Product", service: "Service", other: "Other" },
    goal: { sales: "Drive sales", awareness: "Build awareness", launch: "Introduce something new" },
    cta: { visit: "Visit in person", message: "Send a message", buy: "Buy or order", learn: "Learn more" },
    style: { warm: "Warm and friendly", bold: "Bold and energetic", clean: "Clean and professional" },
    videoLength: { "15": "about 15 seconds", "30": "about 30 seconds", "45": "about 45 seconds" },
    noOffer: "No special offer supplied. Focus on the stated customer benefit; do not invent a promotion.",
    rules: "Use only the supplied business facts and selected call to action. Do not invent prices, discounts, deadlines, addresses, testimonials, or product claims. Creative suggestions must never override these facts.",
    styleLabel: "Video style", videoLengthLabel: "Target video length", notesLabel: "Additional creative direction", templateLabel: "Creative inspiration",
    video: "Create a short vertical 9:16 marketing video with a clear hook in the first 3 seconds and one clear call to action.",
    language: "Generate the caption, script, narration, and on-screen text in English.",
  },
  km: {
    heading: "សេចក្តីសង្ខេបយុទ្ធនាការអាជីវកម្ម",
    labels: {
      kind: "ប្រភេទដែលត្រូវផ្សព្វផ្សាយ", name: "ឈ្មោះ", description: "អ្វីដែលផ្ដល់ជូន",
      benefit: "អត្ថប្រយោជន៍សំខាន់សម្រាប់អតិថិជន", location: "ទីតាំង", website: "គេហទំព័រ",
      goal: "គោលដៅយុទ្ធនាការ", audience: "អតិថិជនគោលដៅ", offer: "ការផ្ដល់ជូន",
      offerTiming: "រយៈពេលនៃការផ្ដល់ជូន", cta: "ការអំពាវនាវឱ្យធ្វើសកម្មភាព", destination: "កន្លែងធ្វើសកម្មភាព",
      telegramUsername: "តេលេក្រាម",
    },
    kind: { shop: "ហាង ឬអាជីវកម្ម", product: "ផលិតផល", service: "សេវាកម្ម", other: "ផ្សេងទៀត" },
    goal: { sales: "ជំរុញការលក់", awareness: "បង្កើនការស្គាល់", launch: "ណែនាំអ្វីដែលថ្មី" },
    cta: { visit: "អញ្ជើញមកផ្ទាល់", message: "ផ្ញើសារ", buy: "ទិញ ឬបញ្ជាទិញ", learn: "ស្វែងយល់បន្ថែម" },
    style: { warm: "កក់ក្ដៅ និងរួសរាយ", bold: "ជឿជាក់ និងមានថាមពល", clean: "សាមញ្ញ និងមានវិជ្ជាជីវៈ" },
    videoLength: { "15": "about 15 seconds", "30": "about 30 seconds", "45": "about 45 seconds" },
    noOffer: "មិនមានការផ្ដល់ជូនពិសេសទេ។ ផ្ដោតលើអត្ថប្រយោជន៍ដែលបានផ្ដល់ និងកុំបង្កើតកម្មវិធីផ្សព្វផ្សាយថ្មី។",
    rules: "ប្រើតែព័ត៌មានអាជីវកម្ម និងការអំពាវនាវដែលអ្នកប្រើប្រាស់បានផ្ដល់។ កុំបង្កើតតម្លៃ ការបញ្ចុះតម្លៃ កាលកំណត់ អាសយដ្ឋាន សក្ខីកម្មអតិថិជន ឬការអះអាងអំពីផលិតផល។ គំនិតច្នៃប្រឌិតត្រូវគោរពព័ត៌មានទាំងនេះ។",
    styleLabel: "រចនាប័ទ្មវីដេអូ", videoLengthLabel: "Target video length", notesLabel: "ការណែនាំច្នៃប្រឌិតបន្ថែម", templateLabel: "គំនិតច្នៃប្រឌិត",
    video: "បង្កើតវីដេអូផ្សព្វផ្សាយខ្លីបញ្ឈរ 9:16។ ទាក់ទាញចំណាប់អារម្មណ៍ក្នុង 3 វិនាទីដំបូង និងបញ្ចប់ដោយការអំពាវនាវច្បាស់លាស់មួយ។",
    language: "បង្កើតសារផ្សព្វផ្សាយ ស្គ្រីប ការនិយាយ និងអត្ថបទក្នុងវីដេអូជាភាសាខ្មែរ។\nMake the video in Khmer language.",
  },
};

export function createCampaignDraft(overrides = {}) {
  const { assets, khqrFile, ...rest } = overrides;
  return {
    ...DEFAULT_DRAFT,
    ...rest,
    assets: Array.isArray(assets) ? assets : [],
    khqrFile: khqrFile instanceof File ? khqrFile : null,
  };
}

function normalizedDraft(draft) {
  const base = createCampaignDraft(draft);
  const assets = Array.isArray(draft?.assets) ? draft.assets : [];
  const khqrFile = draft?.khqrFile instanceof File ? draft.khqrFile : null;
  const normalized = Object.fromEntries(
    Object.entries(base)
      .filter(([key]) => key !== "assets" && key !== "khqrFile")
      .map(([key, value]) => [key, String(value ?? "").trim()])
  );
  return { ...normalized, assets, khqrFile };
}

function normalizeTelegramUsername(value) {
  return String(value || "").trim().replace(/^@+/, "");
}

function assetExtension(file) {
  const name = String(file?.name || "").toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot) : "";
}

function isAllowedAsset(file) {
  const type = String(file?.type || "").toLowerCase();
  if (CAMPAIGN_ASSET_LIMITS.accept.includes(type)) return true;
  return CAMPAIGN_ASSET_LIMITS.extensions.includes(assetExtension(file));
}

function validWebUrl(value) {
  if (/\s/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function requestFromDraft(draft) {
  const copy = COPY[draft.language] || COPY.en;
  const lines = [copy.heading];
  for (const field of Object.keys(copy.labels)) {
    // Keep long contact details in notes so every allowed answer fits the API limits.
    if (["website", "destination"].includes(field)) continue;
    if (!draft[field]) continue;
    const value = field === "telegramUsername"
      ? normalizeTelegramUsername(draft[field])
      : (copy[field]?.[draft[field]] || draft[field]);
    if (!value) continue;
    lines.push(`${copy.labels[field]}: ${value}`);
  }
  if (!draft.offer) lines.push(copy.noOffer);
  const brief = lines.join("\n");
  const template = draft.templateId && draft.templateId !== "auto_gemini"
    ? templateById(draft.templateId, draft.language)
    : null;
  const notes = [
    copy.rules,
    draft.website ? `${copy.labels.website}: ${draft.website}` : "",
    draft.destination ? `${copy.labels.destination}: ${draft.destination}` : "",
    draft.extraNotes ? `${copy.notesLabel}: ${draft.extraNotes}` : "",
    `${copy.styleLabel}: ${copy.style[draft.style] || draft.style}`,
    `${copy.videoLengthLabel}: ${copy.videoLength[draft.videoLength] || copy.videoLength["30"]}`,
    `Target video length: ${Number(draft.videoLength) || 30} seconds`,
    template?.notes ? `${copy.templateLabel}: ${template.notes}` : "",
    `${copy.video} Aim for a total runtime of about ${Number(draft.videoLength) || 30} seconds (allowed 10–60). Scene durations must add up near that target.`,
    copy.language,
  ].filter(Boolean).join("\n\n");
  const urls = [];
  const seen = new Set();
  for (const url of [draft.website, ...draft.urls.split(/\r?\n/)].map(value => value.trim()).filter(Boolean)) {
    const key = validWebUrl(url) ? new URL(url).href : url;
    if (!seen.has(key)) { seen.add(key); urls.push(url); }
  }
  const assets = Array.isArray(draft.assets) ? [...draft.assets] : [];
  if (draft.khqrFile instanceof File) {
    const extension = assetExtension(draft.khqrFile) || ".png";
    const renamed = new File([draft.khqrFile], `khqr${extension}`, {
      type: draft.khqrFile.type || "image/png",
      lastModified: draft.khqrFile.lastModified,
    });
    assets.unshift(renamed);
  }
  // Send the chosen predefined template id so the API can tag the job.
  return {
    brief,
    notes,
    urls,
    template: draft.templateId || "",
    language: draft.language,
    assets,
  };
}

export function validateCampaignStep(input, step) {
  const draft = normalizedDraft(input);
  const errors = {};
  const check = index => step === index || step === 4;
  const fieldsByStep = {
    0: ["name", "description", "benefit", "location", "website"],
    1: ["audience"],
    2: ["offer", "offerTiming", "destination", "telegramUsername"],
    3: ["extraNotes", "urls", "assets"],
  };
  for (const [index, fields] of Object.entries(fieldsByStep)) {
    if (!check(Number(index))) continue;
    for (const field of fields) {
      if (draft[field].length > CAMPAIGN_FIELD_LIMITS[field]) errors[field] = `Use ${CAMPAIGN_FIELD_LIMITS[field]} characters or fewer.`;
    }
  }
  if (check(0)) {
    for (const field of ["name", "description", "benefit"]) {
      if (!draft[field]) errors[field] = { name: "Add a name.", description: "Describe what you want to promote.", benefit: "Tell us the main benefit for your customers." }[field];
    }
    if (!CHOICES.kind.includes(draft.kind)) errors.kind = "Choose what you want to promote.";
    if (draft.website && !validWebUrl(draft.website)) errors.website = "Enter a complete http:// or https:// website address.";
  }
  if (check(1)) {
    if (!draft.audience) errors.audience = "Describe the customers you want to reach.";
    if (!CHOICES.goal.includes(draft.goal)) errors.goal = "Choose a campaign goal.";
  }
  if (check(2)) {
    if (!CHOICES.cta.includes(draft.cta)) errors.cta = "Choose a customer action.";
    else if (draft.cta === "visit" && !draft.location && !draft.destination) errors.destination = "Add a location or destination so customers know where to visit.";
    else if (draft.cta !== "visit" && !draft.destination && !draft.website) errors.destination = "Add a website, contact, or destination for this action.";
    if (draft.offerTiming && !draft.offer) errors.offerTiming = "Add the offer this timing applies to, or leave the timing blank.";
    const telegram = normalizeTelegramUsername(draft.telegramUsername);
    if (telegram && !/^[A-Za-z0-9_]{5,32}$/.test(telegram)) {
      errors.telegramUsername = "Use a Telegram username with 5–32 letters, numbers, or underscores.";
    }
    if (draft.khqrFile) {
      if (!isAllowedAsset(draft.khqrFile)) errors.khqrFile = "Use a PNG, JPG, or WEBP KHQR image.";
      else if (Number(draft.khqrFile.size || 0) > CAMPAIGN_ASSET_LIMITS.maxBytes) errors.khqrFile = "KHQR image must be 5 MB or smaller.";
      else if (Number(draft.khqrFile.size || 0) <= 0) errors.khqrFile = "The KHQR image is empty. Choose another file.";
    }
  }
  if (check(3)) {
    if (!CHOICES.language.includes(draft.language)) errors.language = "Choose English or Khmer.";
    if (!CHOICES.style.includes(draft.style)) errors.style = "Choose a video style.";
    if (!CHOICES.videoLength.includes(draft.videoLength)) errors.videoLength = "Choose how long the video should be.";
    const links = draft.urls.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (links.length > 10) errors.urls = "Add up to 10 source links.";
    else if (links.some(url => url.length > 500 || !validWebUrl(url))) errors.urls = "Enter one complete http:// or https:// link per line (up to 500 characters each).";
    if (draft.templateId && !TEMPLATES.some((template) => template.id === draft.templateId)) {
      errors.templateId = "Choose a creative template or start without one.";
    }
    const assets = Array.isArray(draft.assets) ? draft.assets : [];
    const totalAssets = assets.length + (draft.khqrFile ? 1 : 0);
    if (totalAssets > CAMPAIGN_ASSET_LIMITS.maxFiles) {
      errors.assets = `Add up to ${CAMPAIGN_ASSET_LIMITS.maxFiles} images including your KHQR code.`;
    } else if (assets.some((file) => !isAllowedAsset(file))) {
      errors.assets = "Use PNG, JPG, or WEBP images only.";
    } else if (assets.some((file) => Number(file?.size || 0) > CAMPAIGN_ASSET_LIMITS.maxBytes)) {
      errors.assets = "Each image must be 5 MB or smaller.";
    } else if (assets.some((file) => Number(file?.size || 0) <= 0)) {
      errors.assets = "One of the selected images is empty. Choose another file.";
    }
  }
  if (step === 4) {
    const request = requestFromDraft(draft);
    if (request.brief.length > 4000) errors.description = "Your campaign details are too long. Shorten the description or other details before generating.";
    if (request.notes.length > 4000) errors.extraNotes = "Your creative direction is too long. Shorten it before generating.";
  }
  return errors;
}

export function buildCampaignRequest(input) {
  const errors = validateCampaignStep(input, 4);
  if (Object.keys(errors).length) {
    const error = new Error(Object.values(errors)[0]);
    error.errors = errors;
    throw error;
  }
  return requestFromDraft(normalizedDraft(input));
}

/** Append a weekly-plan post's deltas onto a campaign draft request. */
export function applyWeeklyPostToRequest(request, post) {
  const day = String(post?.day || "").trim();
  const role = String(post?.role || "").trim();
  const title = String(post?.title || "").trim();
  const briefDelta = String(post?.brief_delta || "").trim();
  const notesDelta = String(post?.notes_delta || "").trim();
  const header = [
    "WEEKLY SERIES POST",
    day ? `Day: ${day}` : "",
    role ? `Role: ${role}` : "",
    title ? `Title: ${title}` : "",
  ].filter(Boolean).join("\n");
  const brief = [request.brief, header, briefDelta].filter(Boolean).join("\n\n").slice(0, 4000);
  const notes = [request.notes, notesDelta].filter(Boolean).join("\n\n").slice(0, 4000);
  return { ...request, brief, notes };
}
