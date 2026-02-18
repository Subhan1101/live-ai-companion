

## Two Fixes

### 1. Remove emoji from AvatarPanel loading state
The loading overlay in `AvatarPanel.tsx` shows a "teacher" emoji and an error "robot" emoji. Both will be removed -- replaced with a simple loading spinner or just the text.

**File: `src/components/AvatarPanel.tsx`**
- Line 245: Remove the `<div className="text-6xl mb-4">🤖</div>` (error state emoji)
- Line 250: Remove the `<div className="text-6xl mb-4 animate-pulse">👩‍🏫</div>` (loading state emoji)
- Replace both with a simple spinning circle animation

### 2. Show selected teacher's name instead of "Aria" in TranscriptPanel
The chat panel header always says "Aria" regardless of which teacher is selected. It needs to show the actual teacher's name (Lina, Zahra, Hank, Mark, or Kate).

**File: `src/components/TranscriptPanel.tsx`**
- Add a `teacherName` prop (string, optional with default "Aria" for backward compatibility)
- Line 45: Replace hardcoded "Aria" with `{teacherName}`
- Line 166: Replace `"Type a message to Aria..."` with `"Type a message to {teacherName}..."`
- Line 172: Replace `"Upload a file for Aria to analyze"` with `"Upload a file for {teacherName} to analyze"`

**File: `src/pages/Index.tsx`**
- Pass `teacherName={selectedTeacher.name}` to the `TranscriptPanel` component

