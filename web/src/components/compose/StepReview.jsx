import { ReviewDetail, ReviewSection } from "./FormBits";
import { CTA_LABELS, GOALS, KINDS, STYLES, VIDEO_LENGTHS } from "./constants";

export default function StepReview({ draft, template, assets, onEditStep }) {
  const lengthLabel = VIDEO_LENGTHS.find((item) => item.value === (draft.videoLength || "30"))?.label;

  return (
    <div className="campaign-review">
      <ReviewSection title="Your business" editLabel="Edit business" onEdit={() => onEditStep(0)}>
        <ReviewDetail label="Name" value={draft.name} /><ReviewDetail label="Promoting" value={KINDS.find((item) => item.value === draft.kind)?.label} /><ReviewDetail label="What you offer" value={draft.description} /><ReviewDetail label="Why choose you" value={draft.benefit} /><ReviewDetail label="Location" value={draft.location} /><ReviewDetail label="Website" value={draft.website} />
      </ReviewSection>
      <ReviewSection title="Audience & goal" editLabel="Edit audience and goal" onEdit={() => onEditStep(1)}>
        <ReviewDetail label="Goal" value={GOALS.find((item) => item.value === draft.goal)?.label} /><ReviewDetail label="Audience" value={draft.audience} />
      </ReviewSection>
      <ReviewSection title="Offer & action" editLabel="Edit offer and action" onEdit={() => onEditStep(2)}>
        <ReviewDetail label="Offer" value={draft.offer || "No special offer"} /><ReviewDetail label="Available" value={draft.offerTiming} /><ReviewDetail label="Viewer action" value={CTA_LABELS[draft.cta]} /><ReviewDetail label="Destination" value={draft.destination || (draft.cta === "visit" ? draft.location : draft.website)} /><ReviewDetail label="Telegram" value={draft.telegramUsername ? `@${String(draft.telegramUsername).replace(/^@+/, "")}` : ""} /><ReviewDetail label="KHQR" value={draft.khqrFile?.name || ""} />
      </ReviewSection>
      <ReviewSection title="Video direction" editLabel="Edit video direction" onEdit={() => onEditStep(3)}>
        <ReviewDetail label="Personality" value={STYLES.find((item) => item.value === draft.style)?.label} /><ReviewDetail label="Video length" value={lengthLabel} /><ReviewDetail label="Language" value={draft.language === "km" ? "Khmer · ខ្មែរ" : "English"} /><ReviewDetail label="Creative angle" value={template?.label || "Chosen for your campaign"} /><ReviewDetail label="Extra direction" value={draft.extraNotes} /><ReviewDetail label="Source links" value={draft.urls} /><ReviewDetail label="Brand images" value={assets.length ? assets.map((file) => file.name).join(", ") : ""} />
      </ReviewSection>
    </div>
  );
}
