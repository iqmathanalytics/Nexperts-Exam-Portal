import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/branding";
import { BrandMark } from "@/components/brand-mark";

type BrandLogoProps = {
  to?: string;
  className?: string;
  showText?: boolean;
  variant?: "default" | "sidebar" | "compact";
};

export function BrandLogo({
  to = "/",
  className,
  showText = true,
  variant = "default",
}: BrandLogoProps) {
  const markSize = variant === "compact" ? "sm" : "md";
  const textSize = variant === "sidebar" ? "text-sm" : variant === "compact" ? "text-sm" : "text-base";

  const content = (
    <>
      <BrandMark size={markSize} />
      {showText && (
        <span className={cn("font-display font-semibold tracking-tight", textSize)}>
          {variant === "compact" ? BRAND.shortName : BRAND.name}
        </span>
      )}
    </>
  );

  if (!to) {
    return <div className={cn("flex items-center gap-2.5", className)}>{content}</div>;
  }

  return (
    <Link to={to} className={cn("flex items-center gap-2.5", className)}>
      {content}
    </Link>
  );
}
