import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  to?: string;
  className?: string;
  imgClassName?: string;
  showText?: boolean;
  variant?: "default" | "sidebar" | "compact";
};

export function BrandLogo({
  to = "/",
  className,
  imgClassName,
  showText = true,
  variant = "default",
}: BrandLogoProps) {
  const imgSize =
    variant === "compact" ? "h-8 w-8" : variant === "sidebar" ? "h-9 w-auto max-w-[140px]" : "h-9 w-auto max-w-[160px]";

  const content = (
    <>
      <img
        src="/nexperts-logo.png"
        alt="NExperts Academy"
        className={cn(imgSize, "object-contain", imgClassName)}
      />
      {showText && variant === "default" && (
        <span className="sr-only">NExperts Certification Portal</span>
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
