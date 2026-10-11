export default function FormField({
  label,
  optional = false,
  hint,
  error,
  id,
  htmlFor,
  required = false,
  className = "",
  children,
  ...props
}) {
  const targetId = htmlFor || id;

  return (
    <div
      className={`ui-field field ${error ? "has-error" : ""} ${className}`.trim()}
      {...props}
    >
      {label ? (
        <label htmlFor={targetId} className="ui-field-label">
          <span>{label}</span>
          {required ? <span className="ui-field-required" aria-hidden="true">*</span> : null}
          {optional ? (
            <span className="ui-field-optional">
              {typeof optional === "string" ? optional : "(optional)"}
            </span>
          ) : null}
        </label>
      ) : null}
      
      <div className="ui-field-control">{children}</div>

      {hint && !error ? <p className="ui-field-hint">{hint}</p> : null}
      {error ? (
        <p className="ui-field-error" role="alert" id={id ? `${id}-error` : undefined}>
          {typeof error === "string" ? error : "Please check this field."}
        </p>
      ) : null}
    </div>
  );
}
