import { Link } from "react-router-dom";
import Icon from "../Icon";
import Spinner from "./Spinner";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "start",
  iconSize,
  loading = false,
  loadingText,
  disabled = false,
  as: Component,
  to,
  href,
  className = "",
  type = "button",
  ...props
}) {
  const isActionDisabled = disabled || loading;
  
  // Choose default size for icon based on button size
  const defaultIconSize = size === "xs" ? 12 : size === "sm" ? 14 : size === "lg" ? 16 : 15;
  const resolvedIconSize = iconSize || defaultIconSize;

  const variantClass = variant === "primary" ? "ui-btn-primary primary-btn" : variant === "ghost" ? "ui-btn-ghost ghost-btn" : `ui-btn-${variant}`;
  const baseClass = `ui-btn ${variantClass} ui-btn-${size} ${loading ? "is-loading" : ""} ${className}`.trim();

  const iconElement = icon ? (
    <Icon name={icon} size={resolvedIconSize} className="ui-btn-icon" />
  ) : null;

  const spinnerElement = (
    <Spinner size={resolvedIconSize} className="ui-btn-spinner" />
  );

  const content = (
    <>
      {loading ? spinnerElement : iconPosition === "start" ? iconElement : null}
      {loading && loadingText ? (
        <span>{loadingText}</span>
      ) : children ? (
        <span className="ui-btn-label">{children}</span>
      ) : null}
      {!loading && iconPosition === "end" ? iconElement : null}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={`${baseClass} ${isActionDisabled ? "is-disabled" : ""}`}
        aria-disabled={isActionDisabled || undefined}
        tabIndex={isActionDisabled ? -1 : undefined}
        {...props}
      >
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        className={`${baseClass} ${isActionDisabled ? "is-disabled" : ""}`}
        aria-disabled={isActionDisabled || undefined}
        tabIndex={isActionDisabled ? -1 : undefined}
        {...props}
      >
        {content}
      </a>
    );
  }

  const RenderTag = Component || "button";

  return (
    <RenderTag
      type={RenderTag === "button" ? type : undefined}
      className={baseClass}
      disabled={isActionDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </RenderTag>
  );
}
