import { forwardRef } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium " +
  "h-10 sm:h-9 disabled:cursor-not-allowed disabled:opacity-50 transition-colors";

const variants = {
  primary: "border-blue-700 bg-blue-700 text-white hover:bg-blue-800 disabled:hover:bg-blue-700",
  secondary: "border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:hover:bg-white",
  danger: "border-gray-300 bg-white text-red-700 hover:bg-red-50 disabled:hover:bg-white",
  link: "h-auto border-transparent bg-transparent px-0 text-blue-700 hover:underline sm:h-auto",
};

/** variant: primary | secondary | danger | link. Pass `as={Link}` or `as="a"` to render a link. */
const Button = forwardRef(function Button(
  { variant = "secondary", as: Tag = "button", className = "", type, ...props },
  ref
) {
  const typeProps = Tag === "button" ? { type: type ?? "button" } : {};
  return <Tag ref={ref} className={`${base} ${variants[variant]} ${className}`} {...typeProps} {...props} />;
});

export default Button;
