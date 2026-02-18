

## Fix BSL Hand Tracking - Final Solution

### Root Cause
The `@mediapipe/hands` npm package is not a proper ES module. It's designed to be loaded as a global script via `<script>` tag. Every attempt to `import()` it through Vite fails because the bundler can't resolve the `Hands` constructor properly, producing "constructor not found" or "z is not a constructor" errors.

### Solution: Load MediaPipe via Script Tag

Instead of using `import('@mediapipe/hands')`, load the library by injecting a `<script>` tag that puts `window.Hands` on the global scope, which is how Google designed MediaPipe to work.

### Changes

**File: `src/hooks/useBSLRecognition.ts`**

Replace the `loadMediaPipe` function:

1. Remove the `import('@mediapipe/hands')` dynamic import entirely
2. Add a helper function `loadScript(src)` that creates a `<script>` tag, appends it to `document.head`, and returns a Promise that resolves on `load` and rejects on `error`
3. In `loadMediaPipe`, load the script from the first working CDN:
   - `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js`
   - `https://unpkg.com/@mediapipe/hands@0.4.1675469240/hands.js`
4. After script loads, get `Hands` from `window.Hands` (the global the script defines)
5. Create the `Hands` instance using `locateFile` pointing to the same CDN base
6. Initialize with a 30-second timeout, then set up the `onResults` callback

**File: `vite.config.ts`**

Add `dedupe` for React packages to prevent duplicate instance issues:

```
resolve: {
  alias: { "@": path.resolve(__dirname, "./src") },
  dedupe: ["react", "react-dom"],
},
```

### Technical Details

The key change in pseudocode:

```text
OLD (broken):
  const mpHands = await import('@mediapipe/hands')  // fails - not a real ESM module
  const Hands = mpHands.Hands                        // undefined

NEW (correct):
  await loadScript('https://cdn.jsdelivr.net/.../hands.js')  // adds window.Hands
  const Hands = (window as any).Hands                         // works - this is how MediaPipe is designed
  const hands = new Hands({ locateFile: ... })                // success
```

This approach matches Google's own MediaPipe documentation and will work reliably across all browsers.

