# AnimatedLogo Scaling - Troubleshooting Notes

## The Problem

The OskiHub animated logo (`AnimatedLogo.tsx`) can silently shrink or scale down due to CSS cascade conflicts. It uses a `<video>` element (with an `<Image>` fallback) at fixed dimensions (`width={80} height={36}`, class `h-9 w-auto`), positioned absolutely inside a fixed-size container.

## Root Cause (Feb 2026)

Tailwind v4's **preflight** includes:

```css
img, video { max-width: 100%; height: auto; }
```

This rule lives inside `@layer base`. Previously, an unlayered global CSS rule was masking it:

```css
/* globals.css - old rule (REMOVED) */
* { max-width: 100vw; }
```

Unlayered CSS always beats layered CSS in the cascade. So when we removed the wildcard `* { max-width: 100vw }` (to fix main page width limiting), the preflight `max-width: 100%` and `height: auto` kicked in on the logo's `<img>` and `<video>`, overriding their explicit dimensions and shrinking them.

## The Fix

Added a targeted override in `globals.css`:

```css
.logo-fixed-size img,
.logo-fixed-size video {
  max-width: none;
  height: inherit;
}
```

Applied `className="logo-fixed-size"` to the AnimatedLogo container div in `AnimatedLogo.tsx`.

## Key Files

- `app/components/AnimatedLogo.tsx` — Logo component (container div has `logo-fixed-size` class)
- `app/components/ClientDashboard.tsx` — Where AnimatedLogo is rendered (inside fixed header)
- `app/globals.css` — Contains the `.logo-fixed-size` override rule

## Things That Can Break the Logo

1. **Removing `.logo-fixed-size` rule from globals.css** — Logo will shrink due to Tailwind preflight
2. **CSS resets or wildcard rules** — Any `* { max-width: ... }` or `img { height: auto !important }` can interfere
3. **Changing the header's `max-w-[1740px]`** — Header inner content uses this to align with main content; removing it makes the header contents float to viewport edges
4. **Cascade layer changes** — If globals.css rules get wrapped in `@layer`, they may lose specificity against preflight
5. **Next.js `<Image>` optimizations** — The `Image` component adds its own inline styles; the `logo-fixed-size` override ensures they don't conflict

## Logo Dimensions Reference

| Prop | Value | Notes |
|------|-------|-------|
| `width` | 80 | Container + media element width |
| `height` | 36 | Container + media element height |
| `className` | `h-9 w-auto object-contain` | Tailwind sizing on img/video |
| Header height | `h-10 sm:h-12` | Logo sits inside this flex row |
