export default function ControlButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  type = "button"
}) {
  return (
    <button
      className={`control-button ${variant}`}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </button>
  );
}
