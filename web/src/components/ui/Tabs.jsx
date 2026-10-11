import Icon from "../Icon";

export default function Tabs({
  items = [],
  activeId,
  onChange,
  size = "sm",
  className = "",
  ariaLabel = "Navigation tabs",
  ...props
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`ui-tabs ui-tabs-${size} ${className}`.trim()}
      {...props}
    >
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            className={`ui-tab-btn ${isActive ? "is-active" : ""}`}
            onClick={() => onChange && onChange(item.id)}
          >
            {item.icon ? (
              <Icon name={item.icon} size={size === "sm" ? 14 : 16} className="ui-tab-icon" />
            ) : null}
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge !== null ? (
              <span className="ui-tab-badge">{item.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
