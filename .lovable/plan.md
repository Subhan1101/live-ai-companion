
# BSL Popup Overlay Integration Plan

## Overview
Transform the current 4-column layout with a separate BSL panel into a cleaner design where BSL signs appear as a popup overlay directly on the Avatar screen (similar to Instagram video overlays). This will remove the congested layout and add BSL settings (speed control, position preferences).

---

## Current Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Current Layout (BSL ON)                  │
├──────────┬──────────┬──────────┬──────────┐                 │
│  Avatar  │  Video   │Transcript│   BSL    │  ← 4 columns    │
│  Panel   │  Panel   │  Panel   │  Panel   │     (congested) │
│          │          │          │(separate)│                 │
└──────────┴──────────┴──────────┴──────────┘                 │
```

## Proposed Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     New Layout (BSL ON)                      │
├────────────────┬────────────────┬────────────────┐          │
│   Avatar Panel │   Video Panel  │  Transcript    │ ← 3 cols │
│ ┌────────────┐ │                │    Panel       │   always │
│ │ BSL Popup  │ │                │                │          │
│ │ ┌────────┐ │ │                │                │          │
│ │ │  👋    │ │ │                │                │          │
│ │ │ HELLO  │ │ │                │                │          │
│ │ │ ─────  │ │ │                │                │          │
│ │ └────────┘ │ │                │                │          │
│ └────────────┘ │                │                │          │
└────────────────┴────────────────┴────────────────┘          │
```

---

## Best Position Options for BSL Popup

After analyzing the Avatar Panel layout, here are the **recommended positions** for the BSL popup overlay:

| Position | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Bottom-Left Corner** | Doesn't block avatar's face; Near the status badge area | May overlap with name/status | **Best Option** ✓ |
| **Top-Right Corner** | Clear visibility; Away from face | Could be distracting | Good alternative |
| **Bottom-Center** | Prominent; Below the avatar | Covers gradient bar | Acceptable |
| **Top-Center** | Very visible | Blocks avatar's head | Not recommended |

**Recommendation**: **Bottom-Left Corner** (positioned above the existing status bar) - This keeps the avatar's face fully visible while the BSL signs appear as a natural extension of the communication, similar to how subtitles work.

---

## Implementation Steps

### 1. Create BSL Overlay Component
**New file: `src/components/BSLOverlay.tsx`**

A compact popup overlay component that shows:
- Current sign (emoji + label)
- Progress bar
- Settings popover (accessible via gear icon)
- Minimize/expand toggle

Features:
- Draggable position (optional)
- Configurable position (top-left, top-right, bottom-left, bottom-right)
- Compact mode for minimal distraction
- Smooth animations for sign transitions

### 2. Create BSL Settings Popover
**New file: `src/components/BSLSettings.tsx`**

A settings popover containing:
- Playback speed slider (0.5x - 2x)
- Position selector (4 corners)
- Size toggle (compact/full)
- Auto-play toggle
- Close BSL mode button

### 3. Modify Avatar Panel
**Edit: `src/components/AvatarPanel.tsx`**

Add props for BSL state:
- `isBSLEnabled: boolean`
- `bslText: string`
- `bslSettings: BSLSettings` (speed, position, etc.)
- `onBSLSettingsChange: (settings) => void`

Integrate the BSL overlay as an absolute-positioned child within the Avatar panel.

### 4. Modify Index Page
**Edit: `src/pages/Index.tsx`**

Changes:
- Remove the 4-column BSL layout logic
- Always use 3-column layout (4-4-4)
- Add BSL settings state
- Pass BSL props to AvatarPanel instead of rendering BSLPanel separately
- Remove the separate BSLPanel render block

### 5. Update Control Bar
**Edit: `src/components/ControlBar.tsx`**

- Keep the BSL toggle button
- Add a small settings gear icon next to the Hand icon (or make it a dropdown with toggle + settings)

### 6. Remove/Repurpose BSL Panel
**Optional cleanup: `src/components/BSLPanel.tsx`**

We can either:
- Keep it for reference/reuse of the sign library logic
- Extract core logic (sign parsing, playback) into a custom hook
- Delete if fully replaced

---

## Technical Details

### BSL Overlay Component Structure

```typescript
interface BSLOverlayProps {
  text: string;
  isActive: boolean;
  speed: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  isCompact: boolean;
  onSettingsClick: () => void;
  onClose: () => void;
}
```

### BSL Settings State

```typescript
interface BSLSettings {
  speed: number;       // 0.5 - 2.0
  position: string;    // corner position
  isCompact: boolean;  // compact vs full view
  autoPlay: boolean;   // auto-start on new text
}
```

### Overlay Positioning CSS

```css
/* Bottom-left positioning (recommended) */
.bsl-overlay {
  position: absolute;
  bottom: 80px;  /* Above the status bar */
  left: 16px;
  max-width: 150px;
  z-index: 20;
}
```

---

## UI Design

### Compact Mode (Default)
- Small floating card (120px x 100px)
- Shows: emoji, sign name, mini progress bar
- Gear icon for settings

### Expanded Mode
- Larger card (180px x 160px)
- Shows: emoji, sign name, full progress bar, speed indicator, word preview

### Settings Popover
- Triggered by gear icon click
- Contains speed slider, position selector, size toggle
- Matches app theme (dark card with blur backdrop)

---

## Files to Create
1. `src/components/BSLOverlay.tsx` - Main popup overlay
2. `src/components/BSLSettings.tsx` - Settings popover component

## Files to Modify
1. `src/components/AvatarPanel.tsx` - Add BSL overlay integration
2. `src/pages/Index.tsx` - Remove 4-column layout, add BSL settings state
3. `src/components/ControlBar.tsx` - Optional: add settings access

## Files to Keep (Unchanged)
1. `src/components/BSLPanel.tsx` - Keep the sign library logic (can be imported)
