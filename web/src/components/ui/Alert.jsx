import Icon from "../Icon";

const DEFAULT_ICONS = {
  info: "activity",
  success: "circle-check",
  warning: "alert",
  danger: "alert",
};

export default function Alert({
  tone = "danger",
  title,
  children,
  icon,
  action,
  onDismiss,
  className = "",
  ...props
}) {
  const resolvedIcon = icon || DEFAULT_ICONS[tone] || "alert";

  return (
    <div
      role="alert"
      className={`ui-alert ui-alert-${tone} ${className}`.trim()}
      {...props}
    >
      <div className="ui-alert-icon" aria-hidden="true">
        <Icon name={resolvedIcon} size={18} />
      </div>
      <div className="ui-alert-body">
        {title ? <strong className="ui-alert-title">{title}</strong> : null}
        <div className="ui-alert-message">{children}</div>
      </div>
      {action ? <div className="ui-alert-action">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="ui-alert-dismiss icon-btn"
          aria-label="Dismiss alert"
        >
          <Icon name="x" size={15} />
        </button>
      ) : null}
    </div>
  );
}
