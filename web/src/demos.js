/** Full ready-to-run campaign presets for first-time testing. */
import { createCampaignDraft } from "./campaign.js";

export const DEMO_CAMPAIGNS = [
  {
    id: "demo_cafe",
    label: "Local café · weekend sale",
    detail: "Neighborhood coffee shop with a Saturday–Sunday offer",
    icon: "grid",
    draft: {
      kind: "shop",
      name: "Soriya Coffee",
      description:
        "A neighborhood café in BKK1 serving locally roasted coffee, iced lattes, and fresh pastries.",
      benefit: "Quiet tables for studying, friendly baristas, and beans roasted in small batches.",
      location: "Street 308, BKK1, Phnom Penh",
      website: "https://example.com/soriya-coffee",
      goal: "sales",
      audience:
        "Students and young professionals in Phnom Penh who want a calm place to work or meet friends.",
      offer: "Buy any large coffee and get a free pastry this weekend.",
      offerTiming: "Saturday and Sunday only, while supplies last",
      cta: "visit",
      destination: "Street 308, BKK1, Phnom Penh",
      style: "warm",
      language: "en",
      templateId: "weekend_sale",
      extraNotes: "Show the signature iced latte and pastry. Keep the tone cozy and local.",
      urls: "",
    },
  },
  {
    id: "demo_launch",
    label: "Product launch",
    detail: "New skincare drop with a clear buy CTA",
    icon: "sparkles",
    draft: {
      kind: "product",
      name: "Glow Ritual Serum",
      description: "A lightweight vitamin C serum for daily brightening, made for humid climates.",
      benefit: "Visible glow in two weeks without a sticky finish — built for hot weather skin.",
      location: "",
      website: "https://example.com/glow-ritual",
      goal: "launch",
      audience: "Women 20–35 in Cambodia who shop beauty online and care about simple routines.",
      offer: "Launch week: 15% off the first bottle with free shipping in Phnom Penh.",
      offerTiming: "This week only",
      cta: "buy",
      destination: "https://example.com/glow-ritual",
      style: "bold",
      language: "en",
      templateId: "product_launch",
      extraNotes: "Hero product only. Fast cuts, clean packaging shots, one clear CTA.",
      urls: "",
    },
  },
  {
    id: "demo_app",
    label: "App feature highlight",
    detail: "Mobile app that saves people time",
    icon: "activity",
    draft: {
      kind: "service",
      name: "QuickPay Cambodia",
      description:
        "A mobile payments app for sending money, paying bills, and scanning QR at shops.",
      benefit: "Pay in under 10 seconds without carrying cash or waiting in line.",
      location: "Phnom Penh",
      website: "https://example.com/quickpay",
      goal: "awareness",
      audience: "Busy city workers who pay bills and buy coffee with their phone every day.",
      offer: "",
      offerTiming: "",
      cta: "learn",
      destination: "https://example.com/quickpay",
      style: "clean",
      language: "en",
      templateId: "app_feature",
      extraNotes: "Show the problem → QR scan → done. One feature only: instant shop payments.",
      urls: "",
    },
  },
  {
    id: "demo_khmer",
    label: "Khmer video · café",
    detail: "Café promo with captions and script in Khmer",
    icon: "globe",
    draft: {
      kind: "shop",
      name: "Soriya Coffee",
      description:
        "A neighborhood café in BKK1 serving locally roasted coffee and fresh pastries.",
      benefit: "A quiet place to study, great coffee, and friendly service.",
      location: "Street 308, BKK1, Phnom Penh",
      website: "https://example.com/soriya-coffee",
      goal: "sales",
      audience:
        "Students and young people in Phnom Penh looking for a calm café to study or meet friends.",
      offer: "Free pastry with any large coffee this weekend.",
      offerTiming: "Saturday and Sunday only",
      cta: "visit",
      destination: "Street 308, BKK1, Phnom Penh",
      style: "warm",
      language: "km",
      templateId: "local_cafe",
      extraNotes: "Make the video in Khmer. Warm, inviting, local café energy.",
      urls: "",
    },
  },
  {
    id: "demo_auto",
    label: "Full auto · Gemini invents",
    detail: "Minimal business facts — Gemini invents the creative",
    icon: "bolt",
    draft: {
      kind: "shop",
      name: "Mekong Market",
      description: "A small grocery and daily-essentials shop for the neighborhood.",
      benefit: "Fresh produce, fair prices, and everything you need within walking distance.",
      location: "Toul Kork, Phnom Penh",
      website: "https://example.com/mekong-market",
      goal: "awareness",
      audience: "Families living nearby who shop for groceries a few times a week.",
      offer: "",
      offerTiming: "",
      cta: "visit",
      destination: "Toul Kork, Phnom Penh",
      style: "warm",
      language: "en",
      templateId: "auto_gemini",
      extraNotes: "Let Gemini invent the hook, caption, and video direction from these facts.",
      urls: "",
    },
  },
];

export function demoById(id) {
  return DEMO_CAMPAIGNS.find((demo) => demo.id === id) || null;
}

export function draftFromDemo(id) {
  const demo = demoById(id);
  if (!demo) return null;
  return createCampaignDraft({ ...demo.draft, promotionId: "" });
}
