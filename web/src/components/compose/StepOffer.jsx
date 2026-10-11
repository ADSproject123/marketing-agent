import { CAMPAIGN_ASSET_LIMITS } from "../../campaign";
import { CTA_LABELS } from "./constants";

export default function StepOffer({
  draft, change, fieldProps, onDraftChange, destinationCopy, destinationRequired, khqrPreview,
}) {
  return (
    <>
      <label className="field"><span>Special offer <span className="campaign-optional">Optional</span></span><textarea {...fieldProps("offer")} value={draft.offer} onChange={change("offer")} maxLength={400} rows={3} placeholder="For example: A free pastry with every large coffee this weekend." /><span className="field-hint">Leave this blank if you’re promoting your business without a special offer.</span></label>
      <label className="field"><span>When is the offer available? <span className="campaign-optional">Optional</span></span><input {...fieldProps("offerTiming")} value={draft.offerTiming} onChange={change("offerTiming")} maxLength={200} placeholder="For example: October 12–14, while supplies last" /></label>
      <label className="field"><span>What should viewers do?</span><select {...fieldProps("cta")} value={draft.cta} onChange={change("cta")}>{Object.entries(CTA_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="field"><span>{destinationCopy[0]} {!destinationRequired ? <span className="campaign-optional">Optional</span> : null}</span><input {...fieldProps("destination")} value={draft.destination} onChange={change("destination")} maxLength={400} required={destinationRequired} placeholder={destinationCopy[1]} /><span className="field-hint">{draft.cta === "visit" && draft.location.trim() ? "We can use your saved location, or include the address you add here." : draft.cta !== "visit" && draft.website.trim() ? "We can use your website, or include the contact or link you add here." : "Add a contact, link, or address so viewers can take the next step."}</span></label>
      <div className="campaign-field-pair">
        <label className="field">
          <span>Telegram username <span className="campaign-optional">Optional</span></span>
          <input
            {...fieldProps("telegramUsername")}
            value={draft.telegramUsername || ""}
            onChange={change("telegramUsername")}
            maxLength={32}
            placeholder="@yourshop"
            autoComplete="off"
          />
          <span className="field-hint">Adds a scan-to-message QR on the video end card.</span>
        </label>
        <label className="field">
          <span>KHQR / Bakong image <span className="campaign-optional">Optional</span></span>
          <input
            {...fieldProps("khqrFile")}
            type="file"
            accept={CAMPAIGN_ASSET_LIMITS.accept.join(",")}
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              onDraftChange("khqrFile", file);
              event.target.value = "";
            }}
          />
          <span className="field-hint">Upload your payment QR to show it on the closing card.</span>
          {draft.khqrFile ? (
            <div className="campaign-khqr-preview">
              {khqrPreview ? <img src={khqrPreview} alt="Uploaded KHQR" /> : null}
              <span>{draft.khqrFile.name}</span>
              <button type="button" className="ghost-btn campaign-assets-remove" onClick={() => onDraftChange("khqrFile", null)}>Remove</button>
            </div>
          ) : null}
        </label>
      </div>
    </>
  );
}
