import Icon from "../Icon";

export default function EmptyState({
  icon = "layers",
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className = "",
  ...props
}) {
  return (
    <div
      className={`ui-empty-state empty-state ${compact ? "is-compact" : ""} ${className}`.trim()}
      {...props}
    >
      <div className="empty-state-icon" aria-hidden="true">
        <Icon name={icon} size={compact ? 20 : 25} />
      </div>
      {title ? <h3 className="empty-state-title">{title}</h3> : null}
      {description ? <p className="empty-state-text">{description}</p> : null}
      {action || secondaryAction ? (
        <div className="ui-empty-state-actions">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
