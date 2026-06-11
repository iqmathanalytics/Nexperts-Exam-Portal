import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "h-8 w-8 rounded-md text-[11px]",
  md: "h-9 w-9 rounded-lg text-xs",
  lg: "h-11 w-11 rounded-xl text-sm",
} as const;

/** Ventrix Global monogram — "VG" */
export function BrandMark({ className, size = "md" }: BrandMarkProps) {
  return (
    <div
      className={cn(
        sizeClass[size],
        "flex shrink-0 items-center justify-center bg-gradient-hero font-display font-bold tracking-tight text-white shadow-sm ring-1 ring-white/10",
        className,
      )}
      aria-hidden
    >
      VG
    </div>
  );
}
