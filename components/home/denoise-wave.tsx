import { cn } from "@/lib/utils";

/**
 * V0.27 — DeNoise wave motif.
 *
 * Renders the ORIGINAL DeNoise brand wave asset from
 * `/public/logo/denoise-wave.svg`. The geometry of that file is the
 * authoritative wave — never reproduced or approximated in code.
 *
 * If the asset is missing we render NOTHING (an intentionally empty
 * element that keeps layout stable). Per the brand rule we do NOT
 * draw a fallback wave.
 *
 * Color adapts by tinting the container (the SVG is loaded as a
 * background-image on a masked element so we can recolor it without
 * touching the geometry). Scale adapts via width/height.
 */
export function DenoiseWave({
  variant = "ornament",
  className,
}: {
  variant?: "ornament" | "divider" | "empty-state";
  className?: string;
}) {
  const size =
    variant === "empty-state"
      ? "h-10 w-24"
      : variant === "divider"
        ? "h-4 w-full max-w-40"
        : "h-5 w-24";

  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0", size, className)}
      style={{
        // Mask the copper color with the original wave SVG. If the
        // asset is missing, `mask-image` resolves to nothing and the
        // element becomes invisible — no substitute is drawn.
        WebkitMaskImage: "url(/logo/denoise-wave.svg)",
        maskImage: "url(/logo/denoise-wave.svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        backgroundColor: "var(--denoise-copper)",
      }}
    />
  );
}
