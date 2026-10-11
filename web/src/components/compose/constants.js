export const STEPS = ["Business", "Audience", "Offer & action", "Video style", "Review"];
export const STEP_COPY = [
  ["What would you like to promote?", "Start with your shop, product, or service. We’ll save these details so your next campaign is easier."],
  ["Who should this campaign reach?", "Pick a common audience or describe your customers, then choose what this video should achieve."],
  ["What should viewers do next?", "Give your campaign one clear action. Add an offer if you have one."],
  ["How should your video feel?", "Choose length, language, and personality that fit your brand."],
  ["Review your campaign", "Check the details below. Write one script, or plan three posts for the week and create drafts for the ones you want."],
];
export const FORM_COPY = [
  "Business details",
  "Tell us about the shop, product, or service you want to promote.",
];
export const KINDS = [
  { value: "shop", label: "Shop", detail: "A place people visit", icon: "grid" },
  { value: "product", label: "Product", detail: "Something you sell", icon: "layers" },
  { value: "service", label: "Service", detail: "Something you do", icon: "user" },
  { value: "other", label: "Something else", detail: "An idea, event, or project", icon: "sparkles" },
];
export const GOALS = [
  { value: "awareness", label: "Get discovered", detail: "Introduce your business to more people", icon: "globe" },
  { value: "sales", label: "Drive sales", detail: "Turn interest into visits or purchases", icon: "bolt" },
  { value: "launch", label: "Launch something new", detail: "Build excitement for a new offering", icon: "sparkles" },
];
export const AUDIENCES = [
  {
    value: "Students and young professionals in Phnom Penh who want a calm place to study, work, or meet friends.",
    label: "Students & young pros",
    detail: "Study, work, and meet-up spots",
    icon: "user",
  },
  {
    value: "Busy city workers who want a quick, reliable stop near home or the office.",
    label: "Busy city workers",
    detail: "Fast, convenient daily routines",
    icon: "bolt",
  },
  {
    value: "Families living nearby who shop for everyday needs a few times a week.",
    label: "Nearby families",
    detail: "Local household shoppers",
    icon: "grid",
  },
  {
    value: "Women 20–35 in Cambodia who shop online and care about simple, quality routines.",
    label: "Online beauty & lifestyle",
    detail: "Digital-first shoppers",
    icon: "sparkles",
  },
  {
    value: "Tourists and visitors looking for a trusted local place to try while in town.",
    label: "Visitors & tourists",
    detail: "People discovering the area",
    icon: "globe",
  },
  {
    value: "Small business owners and creators who need practical tools that save time.",
    label: "Owners & creators",
    detail: "Practical, time-saving tools",
    icon: "layers",
  },
];
export const STYLES = [
  { value: "warm", label: "Warm & friendly", detail: "Personal, welcoming, and natural", icon: "user" },
  { value: "bold", label: "Bold & energetic", detail: "A strong hook and lively pacing", icon: "bolt" },
  { value: "clean", label: "Clean & modern", detail: "Clear, polished, and focused", icon: "layers" },
];
export const VIDEO_LENGTHS = [
  { value: "15", label: "Quick · ~15s", detail: "Punchy hook and one clear CTA", icon: "bolt" },
  { value: "30", label: "Standard · ~30s", detail: "Balanced story for most campaigns", icon: "layers" },
  { value: "45", label: "Longer · ~45s", detail: "More room for product and proof", icon: "globe" },
];
export const CTA_LABELS = { visit: "Visit the shop", message: "Send a message", buy: "Buy or order", learn: "Learn more" };
export const DESTINATION_COPY = {
  visit: ["Where should people visit?", "Shop address or directions"],
  message: ["Where should people message you?", "Phone number, Telegram, or Facebook Page"],
  buy: ["Where should people buy or order?", "Shop link, order number, or address"],
  learn: ["Where can people learn more?", "Website or social media link"],
};
export const TEMPLATE_ICONS = {
  "": "layers",
  weekend_sale: "bolt",
  product_launch: "sparkles",
  local_cafe: "grid",
  app_feature: "activity",
  seasonal: "globe",
  auto_gemini: "sparkles",
};
