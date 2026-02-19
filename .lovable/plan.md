

## Fix Plan: Teacher Greetings and BSL Label

### Issue 1: Teachers calling themselves "buddy" instead of "teacher"

Lina's system prompt greeting says: *"Hi there! I'm Lina, your learning buddy!"*

This is unprofessional for a teaching platform. All teacher greetings need to use the word **"teacher"** instead of informal terms like "buddy".

**Changes in `src/lib/teachers.ts`:**

- **Lina** (line 134): Change greeting from *"your learning buddy"* to *"your teacher"*
  - New: `"Hi there! I'm Lina, your teacher! What shall we explore today?"`
- **Zahra** (line 153): Already professional ("I'm here to help") -- update slightly to include "teacher":
  - New: `"Hello! I'm Zahra, your teacher. Whether it's English, Arabic, or exploring big ideas in ethics -- I'm here to help. What would you like to learn?"`
- **Hank** (line 172): Says "your STEM specialist" -- update to include "teacher":
  - New: `"Hey! I'm Hank, your STEM teacher. Maths, physics, chemistry, coding -- bring it on! What are we tackling today?"`
- **Mark** (line 191): No "teacher" mention -- add it:
  - New: `"Hi! I'm Mark, your teacher for business, economics, media, and tech. I'll help you build skills that matter in the real world. What's on your agenda?"`
- **Kate** (line 210): No "teacher" mention -- add it:
  - New: `"Hey there! I'm Kate, your teacher. From history to psychology, art to wellbeing -- let's learn something amazing together. What interests you?"`

Also update each teacher's personality description to say "teacher" instead of informal terms.

### Issue 2: BSL button says "Send to Aria" instead of the teacher's name

The BSL input overlay has a hardcoded button label **"Send to Aria"** (line 155 of BSLInputOverlay.tsx). This should say "Send to Lina" or whichever teacher is active.

**Changes:**

- **`src/components/BSLInputOverlay.tsx`**: Add a `teacherName` prop and use it in the button label
- **`src/components/VideoPanel.tsx`**: Pass the teacher name down to BSLInputOverlay
- **`src/pages/Index.tsx`**: Pass `selectedTeacher.name` to VideoPanel

### Summary of files to change

| File | Change |
|------|--------|
| `src/lib/teachers.ts` | Update all 5 teacher greetings to use "teacher" |
| `src/components/BSLInputOverlay.tsx` | Add `teacherName` prop, use in button |
| `src/components/VideoPanel.tsx` | Accept and pass `teacherName` prop |
| `src/pages/Index.tsx` | Pass teacher name to VideoPanel |
