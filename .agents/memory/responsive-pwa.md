---
name: Responsive PWA Architecture
description: Mobile layout patterns, PWA setup, modal conventions for IRISSAM ERP
---

## Layout — Mobile Drawer

`DashboardLayout` passes `mobileOpen`/`onMobileClose` to `Sidebar` and `onMobileMenuToggle` to `Topbar`.
- Overlay `bg-black/50` at z-30 covers content; sidebar is z-40
- Body scroll locked when mobile sidebar is open (useEffect on `mobileSidebarOpen`)
- `main` has NO margin on mobile — only `lg:ml-[220px]` / `lg:mr-[220px]`

## Sidebar — Mobile Translate

Uses explicit Tailwind classes (not style prop) for translate:
```
mobileOpen ? "translate-x-0" : isRTL ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0"
```
Closes on route change via `useEffect` on `location`.

## Topbar — Mobile Layout

- Hamburger `lg:hidden` calls `onMobileMenuToggle`
- Search icon → full-screen overlay (z-60) on mobile
- Filters icon → bottom sheet (z-60) on mobile
- Install button (`canInstall && !isStandalone`): visible desktop as blue button, mobile inside user menu
- Language switcher: desktop = hover group, mobile = inside user profile dropdown

## PWA

- `public/manifest.webmanifest`: name="IRISSAM HOSPITAL ERP", short_name="IRISSAM ERP", display=standalone, theme_color=#1B2A4A
- `public/sw.js`: API = network-first (never cached), static = cache-first, navigation = network → fallback index.html
- Icons: `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`
- SW registered via inline `<script>` in `index.html` (not main.tsx) for reliability
- `index.html` has all Apple meta tags (apple-mobile-web-app-capable, status-bar-style, title)

## iOS Install Banner

`src/components/pwa/IOSInstallBanner.tsx`:
- Detects iOS + not standalone → shows after 2s delay
- Dismiss stored in `localStorage` key `pwa_ios_banner_dismissed`, TTL = 7 days
- `IOSInstallInstructions` exported separately for Settings page

## Offline Banner

`src/components/pwa/OfflineBanner.tsx`:
- Listens to `window.offline`/`window.online` events
- "Back online" confirmation auto-hides after 3s

## Modal Mobile Convention

All modals use bottom-sheet pattern on mobile:
```
"fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
inner: "rounded-t-2xl sm:rounded-2xl max-h-[95dvh]"
```
Files updated: InvoiceWizard, PaymentModal, PatientDocumentsV2, ConsultationSummaryModal, VitalsEntryModal, ConsultationForm

## CSS Utilities (in index.css)

`.scrollbar-hide`, `.touch-target` (44×44px min), `.safe-top`, `.safe-bottom`, `.pb-safe`, `.table-responsive`, `.chart-container`, `.tabs-scroll`, `.cards-grid`, `.form-grid-2/3`

**Why:** Global input font-size ≥ 16px rule prevents iOS auto-zoom on focus.
