/**
 * ScrollableTabBar — unified, drag-enabled, auto-scrolling tab bar.
 *
 * Features:
 * • overflow-x: auto  /  scrollbar-width: thin  / -webkit-overflow-scrolling: touch
 * • Click-and-drag (desktop)
 * • Shift + Wheel (desktop)
 * • Native touch swipe (mobile / tablet)
 * • Auto-scrollIntoView when active tab changes (center)
 * • ◀ / ▶ arrow buttons that appear only when tabs overflow
 * • Supports icons as React.ElementType (Lucide) or pre-rendered ReactNode
 * • Two variants: 'underline' (default) and 'pill'
 * • mobileCompact: hide labels on small screens (icon-only)
 */

import React, { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TabBarItem {
  id: string;
  label: string;
  /** Lucide component (React.ElementType) OR pre-rendered ReactNode */
  icon?: React.ElementType | React.ReactNode;
  badge?: number;
  soon?: boolean;
  /** Short label shown on mobile when shortLabel is set */
  shortLabel?: string;
}

interface Props {
  tabs: TabBarItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** 'underline' = blue bottom-border indicator (default). 'pill' = filled pill. */
  variant?: 'underline' | 'pill';
  /** Size passed to icon when icon is a React.ElementType. Default 14. */
  iconSize?: number;
  /** On small screens hide the label and show icon only. */
  mobileCompact?: boolean;
  /** Extra classes for the root wrapper */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true for anything that can be passed to React.createElement:
 * - regular function components  (typeof === 'function')
 * - class components             (typeof === 'function')
 * - React.forwardRef wrappers    (typeof === 'object', has $$typeof + render)
 * - React.memo wrappers          (typeof === 'object', has $$typeof + type)
 *
 * Pre-rendered React elements (<Icon size={13} />) are detected by
 * React.isValidElement and are NOT element types.
 */
function isComponentType(v: unknown): v is React.ElementType {
  if (v == null) return false;
  if (React.isValidElement(v)) return false;          // already rendered
  if (typeof v === 'function') return true;           // plain function/class component
  if (typeof v === 'object' && '$$typeof' in (v as object)) return true; // forwardRef / memo
  return false;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScrollableTabBar({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline',
  iconSize = 14,
  mobileCompact = false,
  className,
}: Props) {
  const scrollRef    = useRef<HTMLDivElement>(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(false);

  // ── drag state ──────────────────────────────────────────────────────────────
  const isDragging   = useRef(false);
  const dragStartX   = useRef(0);
  const dragScrollL  = useRef(0);
  const hasDragged   = useRef(false);   // true once mouse has moved > threshold

  // ── overflow detection ──────────────────────────────────────────────────────
  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(max > 2 && el.scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkOverflow();
    el.addEventListener('scroll', checkOverflow, { passive: true });
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkOverflow);
      ro.disconnect();
    };
  }, [checkOverflow, tabs]); // re-run when tabs array changes

  // ── auto-scroll active tab into center ──────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const btn = el.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeTab)}"]`);
    if (!btn) return;
    const containerRect = el.getBoundingClientRect();
    const btnRect       = btn.getBoundingClientRect();
    const offset = btnRect.left - containerRect.left - containerRect.width / 2 + btnRect.width / 2;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  }, [activeTab]);

  // ── Shift + Wheel ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      el.scrollBy({ left: e.deltaY || e.deltaX, behavior: 'auto' });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // ── mouse drag ──────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current  = true;
    hasDragged.current  = false;
    dragStartX.current  = e.pageX - el.offsetLeft;
    dragScrollL.current = el.scrollLeft;
    el.style.cursor     = 'grabbing';
    el.style.userSelect = 'none';
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !scrollRef.current) return;
    const x     = e.pageX - scrollRef.current.offsetLeft;
    const delta = x - dragStartX.current;
    if (Math.abs(delta) > 4) hasDragged.current = true;
    scrollRef.current.scrollLeft = dragScrollL.current - delta;
  };

  const stopDrag = () => {
    if (!scrollRef.current) return;
    isDragging.current       = false;
    scrollRef.current.style.cursor     = '';
    scrollRef.current.style.userSelect = '';
  };

  // ── arrow buttons ────────────────────────────────────────────────────────────
  const scrollBy = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });
  };

  // ── render icon ──────────────────────────────────────────────────────────────
  const renderIcon = (icon: React.ElementType | React.ReactNode) => {
    if (icon === undefined || icon === null) return null;
    if (isComponentType(icon)) return createElement(icon as React.ElementType, { size: iconSize });
    return icon as React.ReactNode; // pre-rendered JSX element
  };

  // ── styles ───────────────────────────────────────────────────────────────────
  const isPill = variant === 'pill';

  const arrowBtn = cn(
    'flex-shrink-0 flex items-center justify-center w-8 transition-colors z-10',
    isPill
      ? 'bg-gray-100 text-gray-500 hover:text-gray-800'
      : 'bg-white text-gray-400 hover:text-gray-700',
  );

  return (
    <div className={cn('flex items-stretch min-w-0', className)}>
      {/* ◀ left arrow */}
      {canLeft && (
        <button
          onClick={() => scrollBy(-1)}
          className={arrowBtn}
          aria-label="Défiler à gauche"
          tabIndex={-1}
        >
          <ChevronLeft size={15} />
        </button>
      )}

      {/* scrollable strip */}
      <div
        ref={scrollRef}
        className={cn(
          'flex-1 min-w-0 flex overflow-x-auto',
          isPill ? 'gap-1 p-1 bg-gray-100 rounded-xl' : '',
        )}
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: '#e5e7eb transparent',
        } as React.CSSProperties}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        {/* inner row — min-w-max prevents wrapping */}
        <div className={cn('flex', isPill ? 'gap-1' : 'min-w-max')}>
          {tabs.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => {
                  if (hasDragged.current) return; // ignore click after drag
                  onTabChange(tab.id);
                }}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap transition-colors flex-shrink-0 select-none',
                  isPill
                    ? cn(
                        'px-4 py-2 rounded-lg text-sm font-medium',
                        isActive
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700',
                      )
                    : cn(
                        'px-4 py-2.5 text-sm border-b-2 transition-colors',
                        isActive
                          ? 'border-blue-600 text-blue-700 font-semibold'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                        tab.soon ? 'opacity-60' : '',
                      ),
                )}
              >
                {tab.icon !== undefined && renderIcon(tab.icon)}

                {/* label — responsive */}
                {tab.shortLabel ? (
                  <>
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </>
                ) : mobileCompact ? (
                  <span className="hidden sm:inline">{tab.label}</span>
                ) : (
                  <span>{tab.label}</span>
                )}

                {/* badge */}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-0.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {tab.badge}
                  </span>
                )}

                {/* soon chip */}
                {tab.soon && (
                  <span className="hidden sm:inline text-[9px] bg-amber-100 text-amber-600 px-1 rounded leading-none">
                    soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ▶ right arrow */}
      {canRight && (
        <button
          onClick={() => scrollBy(1)}
          className={arrowBtn}
          aria-label="Défiler à droite"
          tabIndex={-1}
        >
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
