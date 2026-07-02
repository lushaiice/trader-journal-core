
## Goal
Let users switch between light, dark, and system themes. Currently the app is hard-coded dark (`<html className="dark">` in `__root.tsx`, and `:root` in `src/styles.css` duplicates the dark palette).

## Changes

### 1. Design tokens — `src/styles.css`
- Replace `:root` block with a true **light** palette (calm, premium, minimal — matching the Traders' OS aesthetic): near-white background, dark slate foreground, same primary blue, success/warning/destructive tuned for light surfaces, lighter sidebar, adjusted chart colors for legibility.
- Keep the existing dark palette under `.dark` (already correct).
- Remove `color-scheme: dark` hard-coding from `html`; instead set `color-scheme: light dark` and let the `.dark` class drive it via a `.dark { color-scheme: dark }` rule.

### 2. Theme provider — new `src/lib/theme-context.tsx`
- `ThemeProvider` with `theme: "light" | "dark" | "system"`, `resolvedTheme: "light" | "dark"`.
- Persist choice in `localStorage` under `trader-os:theme`.
- On mount and on change, toggle `.dark` class on `document.documentElement`.
- Listen to `matchMedia("(prefers-color-scheme: dark)")` when in `system` mode.
- SSR-safe: default to `system`, no window access at module scope.
- Inline `<script>` injected via root `head` to set the class before hydration (prevents flash of wrong theme).

### 3. Wire provider — `src/routes/__root.tsx`
- Remove `className="dark"` from `<html>`.
- Add the anti-flash inline script in the shell `<head>`.
- Wrap `<Outlet />` tree in `<ThemeProvider>` inside `RootComponent`.

### 4. Theme toggle UI — new `src/components/theme-toggle.tsx`
- Dropdown menu (shadcn `DropdownMenu`) with Sun/Moon/Monitor icons and Light / Dark / System options.
- Icon button suitable for both desktop sidebar footer and mobile header.

### 5. Surface the toggle — `src/components/app-shell.tsx`
- Place `<ThemeToggle />` in the desktop sidebar footer (next to logout) and in the mobile header (next to logout).

### 6. Settings page — `src/routes/_app.settings.tsx`
- Add an "Appearance" section with the same three-way control (radio group or segmented buttons) bound to the theme context, so users can change it from settings as well.

## Out of scope
- No business-logic, route, or data changes.
- Chart palette stays the same token names; only the values shift between themes via CSS variables, so charts adapt automatically.
- No tests added/changed; no e2e changes (smoke title assertion still passes).

## Verification
- Toggle in sidebar flips palette instantly; refresh preserves choice; "System" follows OS preference.
- No flash of dark theme on initial load when light is selected.
- `bunx tsc --noEmit` clean.
