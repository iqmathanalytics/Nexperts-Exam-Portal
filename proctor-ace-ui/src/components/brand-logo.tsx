import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/branding";

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
  const iconSize = variant === "compact" ? "h-8 w-8" : "h-9 w-9";
  const textSize = variant === "sidebar" ? "text-sm" : "text-base";

  const content = (
    <>
      <div
        className={cn(
          iconSize,
          "flex shrink-0 items-center justify-center rounded-lg bg-gradient-emerald text-white shadow-sm",
        )}
      >
        <GraduationCap className={variant === "compact" ? "h-4 w-4" : "h-5 w-5"} />
      </div>
      {showText && (
        <span className={cn("font-display font-semibold tracking-tight", textSize)}>
          {BRAND.name}
        </span>
      )}
    </>
  );

  if (!to) {
    return <div className={cn("flex items-center gap-2", className)}>{content}</div>;
  }

  return (
    <Link to={to} className={cn("flex items-center gap-2", className)}>
      {content}
    </Link>
  );
}
