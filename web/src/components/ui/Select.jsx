export default function Select({
  error = false,
  className = "",
  id,
  children,
  ...props
}) {
  const isInvalid = Boolean(error);
  return (
    <div className="ui-select-wrap">
      <select
        id={id}
        className={`ui-select ${isInvalid ? "is-invalid" : ""} ${className}`.trim()}
        aria-invalid={isInvalid || undefined}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
