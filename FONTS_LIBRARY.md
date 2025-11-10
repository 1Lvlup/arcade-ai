# Fonts Library

This file tracks all the custom fonts added to the project for easy reference and switching.

## Adobe Typekit Fonts

### Kallisto (Currently Active - Hero)
```html
<link rel="stylesheet" href="https://use.typekit.net/gwt3dkm.css">
```
- Font family: `Kallisto`
- Usage: Hero heading
- Tailwind class: `font-hero`

### PF Fuel Decay (Available)
```html
<link rel="stylesheet" href="https://use.typekit.net/xpc3lfu.css">
```
- Font family: `pf-fuel-decay` or `PF Fuel Decay`
- Usage: Available for use
- Tailwind class: Currently fallback in `font-hero`

## How to Add New Fonts

1. Add the font link to `index.html` (lines 15-16 area)
2. Add font family to `tailwind.config.ts` under `fontFamily`
3. Document the font here for future reference
4. Apply using Tailwind classes (e.g., `font-hero`, `font-display`, etc.)
