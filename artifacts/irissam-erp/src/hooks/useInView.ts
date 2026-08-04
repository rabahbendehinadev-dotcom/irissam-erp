import { useEffect, useRef, useState } from "react";

/**
 * Returns `true` once the attached ref element first enters the viewport.
 * After that it stays `true` (one-shot) so the widget never unmounts.
 *
 * @param rootMargin - Passed to IntersectionObserver; extend to pre-load
 *   slightly before the element is visible (e.g. "200px").
 */
export function useInView(rootMargin = "100px"): {
  ref: React.RefObject<HTMLDivElement | null>;
  inView: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Already in view on mount (above the fold) — skip observer
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}
