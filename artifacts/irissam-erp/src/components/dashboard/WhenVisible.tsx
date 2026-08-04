import type { ReactNode } from "react";
import { useInView } from "@/hooks/useInView";

interface WhenVisibleProps {
  /** Rendered once the container scrolls into view (one-shot, never unmounts). */
  children: ReactNode;
  /** Placeholder shown until the container is visible. */
  fallback: ReactNode;
  /** IntersectionObserver rootMargin — how far ahead to trigger (default 100px). */
  rootMargin?: string;
  /** CSS class applied to the outer sentinel div. Should match the chart slot height. */
  className?: string;
}

/**
 * Defers rendering `children` until the wrapper element enters the viewport.
 * Uses a one-shot IntersectionObserver so the widget never unmounts once loaded.
 * Combine with React.lazy() + Suspense for full chunk + render deferral.
 */
export function WhenVisible({
  children,
  fallback,
  rootMargin = "100px",
  className,
}: WhenVisibleProps) {
  const { ref, inView } = useInView(rootMargin);

  return (
    <div ref={ref} className={className ?? "h-full"}>
      {inView ? children : fallback}
    </div>
  );
}
