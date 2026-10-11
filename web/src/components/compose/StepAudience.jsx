import Icon from "../Icon";
import { ChoiceGroup } from "./FormBits";
import { AUDIENCES, GOALS } from "./constants";

export default function StepAudience({ draft, change, fieldProps, onDraftChange }) {
  const presetSelected = AUDIENCES.some((item) => item.value === draft.audience);

  return (
    <>
      <ChoiceGroup name="goal" label="What is your main goal?" options={GOALS} value={draft.goal} onChange={(value) => onDraftChange("goal", value)} />
      <ChoiceGroup
        name="audiencePreset"
        label="Who is this for?"
        options={AUDIENCES}
        value={presetSelected ? draft.audience : ""}
        onChange={(value) => onDraftChange("audience", value)}
        compact
      />
      <label className="field">
        <span>Target audience {presetSelected ? <span className="campaign-optional">Edit if needed</span> : null}</span>
        <textarea
          {...fieldProps("audience")}
          value={draft.audience}
          onChange={change("audience")}
          required
          maxLength={500}
          rows={3}
          placeholder="Pick a preset above, or describe your customers in your own words."
        />
        <span className="field-hint">Include where they are, what they care about, and what they need.</span>
      </label>
      <div className="campaign-tip">
        <Icon name="sparkles" size={17} />
        <p>A specific audience helps us create a stronger hook and a message that feels relevant.</p>
      </div>
    </>
  );
}
