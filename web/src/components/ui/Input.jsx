import Icon from "../Icon";

export default function Input({
  icon,
  error = false,
  size = "md",
  className = "",
  type = "text",
  id,
  ...props
}) {
  const isInvalid = Boolean(error);
  const inputClass = `ui-input ui-input-${size} ${isInvalid ? "is-invalid" : ""} ${icon ? "has-icon" : ""} ${className}`.trim();

  if (icon) {
    return (
      <div className="ui-input-wrap input-wrap">
        <span className="ui-input-icon input-icon" aria-hidden="true">
          <Icon name={icon} size={size === "sm" ? 15 : 18} />
        </span>
        <input
          type={type}
          id={id}
          className={inputClass}
          aria-invalid={isInvalid || undefined}
          {...props}
        />
      </div>
    );
  }

  return (
    <input
      type={type}
      id={id}
      className={inputClass}
      aria-invalid={isInvalid || undefined}
      {...props}
    />
  );
}
