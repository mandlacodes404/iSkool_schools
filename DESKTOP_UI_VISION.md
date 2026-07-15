# iSkool Desktop UI Vision

## The goal, in one line

Desktop pages should operate like VS Code's Explorer: a **left panel for selecting**, a **right panel for doing the work**, connected by a single click — nothing more.

## Reference model: VS Code's Explorer + Editor

VS Code splits the screen into two roles that never blur into each other:

- **Left (Explorer):** a navigation tree. You browse and select. Folders collapse/expand. Files inside a folder are indented under it, so hierarchy is visible at a glance without reading labels.
- **Right (Editor):** the workspace. It shows exactly one thing — whatever you last clicked in the tree.

iSkool's desktop split layout (sidebar + main panel, now flat/borderless across both dashboards) already has the right *shape*. This document describes what needs to be true of that shape for it to actually *behave* like the reference model, not just look like it.

## What "left panel" means here

The left panel is for **selecting only** — never for reading content, editing, or taking action. Its job is to answer "where do I want to look," nothing else.

**Sections (folders):**
- Collapsible, defaulting to expanded — this already exists on the teacher side (`dashboard.js`'s `buildCollapsibleClassGroup` / `toggleSidebarClassGroup`) and needs to be the *only* pattern used, everywhere a sidebar has groups.
- A chevron that rotates on collapse/expand — already built, needs to be applied consistently to every collapsible section on both dashboards, not just where it currently exists.

**Items under a section (files):**
- Must sit **visibly indented** to the right of their parent section's label — not just distinguished by smaller/bold/uppercase text, but genuinely shifted right so the eye reads the hierarchy immediately. This is the main structural gap between where things stand today and the target: right now, section labels and their items share the same left padding, so they line up rather than nest.
- Clicking an item selects it and loads its content into the right panel. That's the only thing a left-panel click ever does.

## What "right panel" means here

The right panel shows **exactly one thing at a time**: whatever was last clicked on the left. No tabs, no multiple open items, no breadcrumb trail — a click on the left fully replaces what's showing on the right, the way it already works today. This part of the interaction model is *confirmed*, not something to change — it's already correct and should be preserved as everything else around it evolves.

## What this vision explicitly does NOT include

Kept out on purpose, to keep the target achievable and avoid scope creep:

- No tabs for multiple open items (VS Code lets you have several files open at once — iSkool won't)
- No breadcrumbs showing a path/location trail
- No split-screen / side-by-side panels
- No changes to how the right panel itself is laid out internally (that's a separate concern from the selecting/doing split)

## Current state vs. target state

| | Current state | Target state |
|---|---|---|
| Outer layout (flat, no card, single divider) | ✅ Done — both dashboards, all pages | ✅ Same |
| Right panel shows one selected item | ✅ Already correct | ✅ Same, unchanged |
| Collapsible sections with chevron | ✅ Exists on teacher side (`dashboard.js`) | Needs to exist everywhere, both dashboards |
| Section label vs. item indentation | ❌ Same left padding — no visual nesting | Items indented right of their section label |
| Consistency across all pages | Partial — some pages have collapsible groups, some may not | Every sidebar with sections uses the same pattern |

## Why this matters

Right now, the desktop redesign has fixed the *frame* — no more boxed cards, a clean flat divider, backgrounds and borders behaving consistently. What's described in this document is the next layer: making the *content inside that frame* behave like a real navigation tree, so the left panel reads as "a place you browse" and the right panel reads as "a place you work," the same instant, unmistakable way VS Code does.
