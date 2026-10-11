import Icon from "../Icon";

export function ChoiceGroup({ name, label, options, value, onChange, compact = false }) {
  return (
    <fieldset className={`campaign-choice-field ${compact ? "is-compact" : ""}`}>
      <legend>{label}</legend>
      <div className="campaign-choice-grid">
        {options.map((option) => (
          <label key={option.value} className={`campaign-choice ${value === option.value ? "is-selected" : ""}`}>
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={(event) => onChange(event.target.value)} />
            <span className="campaign-choice-icon"><Icon name={option.icon} size={18} /></span>
            <span className="campaign-choice-copy"><strong>{option.label}</strong><span>{option.detail}</span></span>
            <span className="campaign-choice-check" aria-hidden="true">{value === option.value ? <Icon name="check" size={12} /> : null}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewSection({ title, editLabel, onEdit, children }) {
  return (
    <section className="campaign-review-section">
      <div className="campaign-review-head"><h3>{title}</h3><button type="button" className="campaign-edit-btn" onClick={onEdit} aria-label={editLabel}>Edit <Icon name="arrow-up-right" size={12} /></button></div>
      <dl>{children}</dl>
    </section>
  );
}

export function ReviewDetail({ label, value }) {
  return value ? <div><dt>{label}</dt><dd>{value}</dd></div> : null;
}
