import { forwardRef } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-colors";

const sizes = {
  md: "h-10 sm:h-9", // 40px on phones, 36px on desktop
  lg: "h-12", // main action on a phone
};

const variants = {
  primary: "border-blue-700 bg-blue-700 text-white hover:bg-blue-800 disabled:hover:bg-blue-700",
  secondary: "border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:hover:bg-white",
  danger: "border-gray-300 bg-white text-red-700 hover:bg-red-50 disabled:hover:bg-white",
  link: "h-auto border-transparent bg-transparent px-0 text-blue-700 hover:underline",
};

/** Class string for anything that should look like a button (a label, a link). */
export function buttonClass(variant = "secondary", size = "md") {
  return `${base} ${variant === "link" ? "" : sizes[size]} ${variants[variant]}`;
}

/** variant: primary | secondary | danger | link. size: md | lg. Pass `as={Link}` or `as="a"` to render a link. */
const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", as: Tag = "button", className = "", type, ...props },
  ref
) {
  const typeProps = Tag === "button" ? { type: type ?? "button" } : {};
  return <Tag ref={ref} className={`${buttonClass(variant, size)} ${className}`} {...typeProps} {...props} />;
});

export default Button;
