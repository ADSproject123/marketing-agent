import Icon from "../Icon";

export default function Badge({
  children,
  variant = "neutral",
  size = "sm",
  dot = false,
  dotPulse = false,
  icon,
  iconSize = 12,
  className = "",
  ...props
}) {
  return (
    <span
      className={`ui-badge ui-badge-${variant} ui-badge-${size} ${className}`.trim()}
      {...props}
    >
      {dot ? (
        <span
          className={`ui-badge-dot ${dotPulse ? "is-pulsing" : ""}`}
          aria-hidden="true"
        />
      ) : null}
      {icon ? <Icon name={icon} size={iconSize} className="ui-badge-icon" /> : null}
      {children}
    </span>
  );
}
