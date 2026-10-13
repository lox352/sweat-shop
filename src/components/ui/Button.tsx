import React from "react";
import "./Button.css";

type Variant = "primary" | "secondary" | "danger" | "quiet";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "lg";
}

/**
 * One button, four voices. Replaces the style objects that were copy-pasted
 * across every page, each with its own slightly different padding.
 */
const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}) => (
  <button
    type={type}
    className={[
      "btn",
      `btn-${variant}`,
      size === "lg" ? "btn-lg" : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ")}
    {...rest}
  />
);

export default Button;
