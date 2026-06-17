import { BRAND } from "@/lib/branding";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const heightClass = {
  sm: "h-8",
  md: "h-9",
  lg: "h-11",
} as const;

export function BrandMark({ className, size = "md" }: BrandMarkProps) {
  return (
    <img
      src={BRAND.logoPath}
      alt={BRAND.name}
      className={cn(heightClass[size], "w-auto shrink-0 object-contain", className)}
    />
  );
}
