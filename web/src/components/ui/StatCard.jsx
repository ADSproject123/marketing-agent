import Icon from "../Icon";

export default function StatCard({
  label,
  value,
  note,
  icon,
  tone = "blue",
  badge,
  onClick,
  className = "",
  ...props
}) {
  const Component = onClick ? "button" : "article";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`ui-stat-card overview-stat ${onClick ? "is-clickable" : ""} ${className}`.trim()}
      {...props}
    >
      <div className="overview-stat-head">
        <p className="overview-stat-label">{label}</p>
        <div className="ui-stat-card-trailing">
          {badge ? <span className="ui-stat-card-badge">{badge}</span> : null}
          {icon ? (
            <span className={`overview-stat-icon is-${tone}`}>
              <Icon name={icon} size={18} />
            </span>
          ) : null}
        </div>
      </div>
      <p className="overview-stat-value">{value ?? "—"}</p>
      {note ? <p className="overview-stat-note">{note}</p> : null}
    </Component>
  );
}
