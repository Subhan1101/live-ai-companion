

## Plan: Wait for Actual Video Frames Before Triggering Greeting

### Root Cause

The `onSimliReady` callback fires right after `simliClient.start()` resolves. But at that point, the WebRTC connection is just established -- the video element hasn't received or rendered any frames yet. So the greeting fires while the yellow "Teacher is coming..." screen is still visible.

### Fix

In `AvatarPanel.tsx`, instead of calling `onSimliReady` immediately after `simliClient.start()`, wait for the video element to actually start playing (i.e., it has received video frames and is rendering).

### Changes

**File: `src/components/AvatarPanel.tsx`**

After `simliClient.start()` resolves (line 158), instead of immediately setting `isSimliReady` and calling `onSimliReady`:

1. Add a listener on `videoRef.current` for the `"playing"` event (fires when the video has enough data and has started playing)
2. Also add a fallback timeout (e.g., 5 seconds) in case the event doesn't fire reliably
3. Only call `setIsSimliReady(true)` and `onSimliReady(...)` once the video is actually playing

The code will look like:

```text
await simliClient.start();

// Wait for actual video frames before signaling ready
const video = videoRef.current;
const signalReady = () => {
  if (!isMounted) return;
  setIsSimliReady(true);
  setSimliError(null);
  if (onSimliReady) {
    onSimliReady(sendAudio, clearBuffer);
  }
};

// If video is already playing, signal immediately
if (video && video.readyState >= 3) {
  signalReady();
} else if (video) {
  // Wait for the playing event
  const onPlaying = () => {
    video.removeEventListener("playing", onPlaying);
    clearTimeout(fallback);
    signalReady();
  };
  video.addEventListener("playing", onPlaying);
  // Fallback timeout in case event doesn't fire
  const fallback = setTimeout(() => {
    video.removeEventListener("playing", onPlaying);
    signalReady();
  }, 5000);
}
```

### Files to Change

| File | Change |
|------|--------|
| `src/components/AvatarPanel.tsx` | Defer `onSimliReady` until the video element fires `"playing"` event |

No other files need changes -- the greeting and mic gating logic in `Index.tsx` and `useRealtimeChat.ts` already depend on `onSimliReady`, so once that fires at the right time, everything else works.

