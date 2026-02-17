

# Auto-Capture and Keyboard Shortcut for Screen Sharing

## The Problem
When screen sharing is active and you switch to another browser tab (e.g., to show a math problem or a document), the "Capture" button is on the app's tab -- you can't click it without switching back, which defeats the purpose.

## Solution: Two Approaches Combined

### 1. Auto-Capture (Primary)
When screen sharing is active, the app will **automatically capture and send a screenshot every 15 seconds** to the teacher. This means you can just switch tabs, talk, and the teacher will keep seeing your screen without you doing anything.

- A small banner will say "Screen sharing active - auto-capturing every 15s"
- No manual action needed from you

### 2. Keyboard Shortcut (Backup)
Press **Ctrl+Shift+S** (or Cmd+Shift+S on Mac) at any time to instantly capture and send the current screen. This works even when the app tab is in the background, since keyboard shortcuts are global to the browser window.

## What Changes

### File: `src/pages/Index.tsx`
- Add a `useEffect` that starts a 15-second auto-capture interval when screen sharing begins
- Clears the interval when screen sharing stops
- Add a `useEffect` that listens for the Ctrl+Shift+S keyboard shortcut globally

### File: `src/components/ControlBar.tsx`  
- Update the "Capture" button label to show "Auto" indicator when screen sharing is active
- Add a small tooltip mentioning the keyboard shortcut

## Technical Details

- The auto-capture reuses the existing `captureScreenshot()` and `sendImage()` functions
- The `useScreenShare` hook already captures from a hidden video element, so it works even when the app tab is not visible
- The keyboard event listener is attached to `window`, so it fires regardless of which tab has focus within the same browser window

**Note:** The keyboard shortcut only works if the browser window itself is focused. If the user switches to a completely different application (not just another browser tab), they would need to rely on auto-capture.
