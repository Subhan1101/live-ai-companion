

# BSL Speed & Text Input Fix Plan

## Issues Identified

### 1. BSL Speed Too Fast
The current timing at 1x speed is 800ms per sign, which is too fast for users to follow.

**Root cause**: Line 118 in `BSLOverlay.tsx`:
```typescript
const delay = signs[currentSignIndex] === ' ' ? 300 : 800 / settings.speed;
```

At 1x speed: 800ms per sign (too fast)
At 0.5x speed: 1600ms per sign
At 2x speed: 400ms per sign (extremely fast)

### 2. Speed Settings Not Working Properly
The speed control exists but the formula makes "slower" settings show signs faster and "faster" settings show signs slower - which is backwards!

**Fix needed**: Invert the speed calculation logic - higher speed = shorter delay.

### 3. Text Input Disabled
The text input in `TranscriptPanel.tsx` has `disabled` attribute hardcoded, preventing users from typing.

---

## Solution

### Part 1: Fix BSL Speed Timing

**File: `src/components/BSLOverlay.tsx`**

Changes:
- Increase base delay from 800ms to 2000ms for comfortable viewing
- Fix speed calculation: `baseDelay / speed` means 1x = 2000ms, 0.5x = 4000ms (slower), 2x = 1000ms (faster)
- Increase pause between words from 300ms to 800ms

**Updated formula**:
```typescript
// Base delay of 2000ms at 1x speed
// 0.25x = 8000ms (very slow)
// 0.5x = 4000ms (slow) 
// 1x = 2000ms (normal)
// 1.5x = 1333ms (faster)
// 2x = 1000ms (fast)
const delay = signs[currentSignIndex] === ' ' ? 800 : 2000 / settings.speed;
```

### Part 2: Expand Speed Options

**File: `src/components/BSLSettings.tsx`**

Changes:
- Extend speed range from 0.25x to 2.5x (currently 0.5x to 2x)
- Add finer step size of 0.1 (currently 0.25)
- Add preset speed buttons (Slow, Normal, Fast)

### Part 3: Enable Text Input

**File: `src/components/TranscriptPanel.tsx`**

Changes:
- Add state for text input value
- Add `onSendText` callback prop
- Remove `disabled` from input
- Enable send button when text is entered
- Add keyboard handler for Enter key

**File: `src/pages/Index.tsx`**

Changes:
- Add `handleSendText` function that uses `sendTextContent`
- Pass handler to TranscriptPanel

---

## Technical Details

### BSLOverlay.tsx Changes

```typescript
// Line 118 - Update timing calculation
const delay = signs[currentSignIndex] === ' ' ? 800 : 2000 / settings.speed;
```

### BSLSettings.tsx Changes

```typescript
// Update slider range and add preset buttons
<Slider
  value={[settings.speed]}
  onValueChange={([value]) => updateSetting('speed', value)}
  min={0.25}  // Changed from 0.5
  max={2.5}   // Changed from 2
  step={0.1}  // Changed from 0.25
  className="h-4"
/>

// Add preset buttons
<div className="flex gap-1 mt-1">
  <Button size="sm" onClick={() => updateSetting('speed', 0.5)}>Slow</Button>
  <Button size="sm" onClick={() => updateSetting('speed', 1)}>Normal</Button>
  <Button size="sm" onClick={() => updateSetting('speed', 2)}>Fast</Button>
</div>
```

### TranscriptPanel.tsx Changes

```typescript
// Add props
interface TranscriptPanelProps {
  // ... existing props
  onSendText?: (text: string) => void;
}

// Add state
const [inputText, setInputText] = useState('');

// Update input element
<input
  type="text"
  value={inputText}
  onChange={(e) => setInputText(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' && inputText.trim() && onSendText) {
      onSendText(inputText.trim());
      setInputText('');
    }
  }}
  placeholder="Type a message to Aria..."
  className="flex-1 bg-transparent text-sm outline-none"
/>

// Update send button
<button 
  onClick={() => {
    if (inputText.trim() && onSendText) {
      onSendText(inputText.trim());
      setInputText('');
    }
  }}
  disabled={!inputText.trim()}
  className={cn(
    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
    inputText.trim() 
      ? "bg-status-speaking text-white cursor-pointer hover:bg-status-speaking/80" 
      : "bg-status-speaking text-white opacity-50 cursor-not-allowed"
  )}
>
  <Send className="w-5 h-5" />
</button>
```

### Index.tsx Changes

```typescript
// Add handler
const handleSendText = useCallback((text: string) => {
  if (!isConnected || !text.trim()) return;
  sendTextContent(text, "Text Message");
  toast({
    title: "Message sent",
    description: `Sent: "${text}"`,
  });
}, [isConnected, sendTextContent]);

// Pass to TranscriptPanel
<TranscriptPanel
  // ... existing props
  onSendText={handleSendText}
/>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/BSLOverlay.tsx` | Update delay from 800ms to 2000ms base |
| `src/components/BSLSettings.tsx` | Expand speed range (0.25-2.5), finer steps, add presets |
| `src/components/TranscriptPanel.tsx` | Enable text input, add state and handlers |
| `src/pages/Index.tsx` | Add `handleSendText` and pass to TranscriptPanel |

---

## Expected Behavior After Fix

### BSL Speed
- **0.25x**: 8 seconds per sign (very slow, for learning)
- **0.5x**: 4 seconds per sign (slow)
- **1x**: 2 seconds per sign (comfortable default)
- **1.5x**: 1.3 seconds per sign (faster)
- **2x**: 1 second per sign (fast)
- **2.5x**: 0.8 seconds per sign (very fast)

### Text Input
- Users can type in the text box
- Press Enter or click Send to send message
- Message appears in chat and Aria responds

