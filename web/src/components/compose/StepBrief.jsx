import StepAudience from "./StepAudience";
import StepOffer from "./StepOffer";
import StepStyle from "./StepStyle";

/** Single brief screen: goal, audience, offer/CTA, language, length, optional extras. */
export default function StepBrief(props) {
  return (
    <>
      <StepAudience
        draft={props.draft}
        change={props.change}
        fieldProps={props.fieldProps}
        onDraftChange={props.onDraftChange}
      />
      <StepOffer
        draft={props.draft}
        change={props.change}
        fieldProps={props.fieldProps}
        onDraftChange={props.onDraftChange}
        destinationCopy={props.destinationCopy}
        destinationRequired={props.destinationRequired}
        khqrPreview={props.khqrPreview}
      />
      <StepStyle
        draft={props.draft}
        change={props.change}
        fieldProps={props.fieldProps}
        onDraftChange={props.onDraftChange}
        errors={props.errors}
        assets={props.assets}
        assetPreviews={props.assetPreviews}
        busy={props.busy}
      />
    </>
  );
}
