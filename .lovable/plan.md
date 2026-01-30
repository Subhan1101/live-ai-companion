
# Plan: Brief Answers First with Optional Detailed Whiteboard Explanations

## What You Want

You want EduGuide to:
1. **Give a short, simple answer first** when you ask any question
2. **Ask at the end**: "Would you like me to explain this in more detail on the whiteboard?"
3. **Only show the whiteboard** when you specifically ask for a detailed explanation

This makes conversations faster and gives you control over how much detail you receive.

---

## How It Works Now vs. How It Will Work

| Current Behavior | New Behavior |
|-----------------|--------------|
| Any educational question shows detailed whiteboard immediately | Gives brief answer first |
| No choice - always get full explanation | Asks if you want more detail |
| Whiteboard pops up automatically | Whiteboard only appears when you ask for explanation |

---

## What Will Change

### File: `src/hooks/useRealtimeChat.ts`

I will update the AI teacher's instructions (the system prompt) to:

**1. New Response Flow:**
- First: Give a brief, direct answer (2-4 sentences max)
- Then: Ask "Would you like me to explain this in detail on the whiteboard?"
- Only use `[WHITEBOARD_START]...[WHITEBOARD_END]` when:
  - User says "yes", "explain", "more detail", "show me on whiteboard", etc.
  - User specifically requests step-by-step or detailed explanation

**2. Updated Instructions:**
```text
RESPONSE FLOW (CRITICAL):

1. BRIEF ANSWER FIRST:
   - For ANY question, give a short, direct answer first (2-4 sentences maximum)
   - Get straight to the point - what's the answer/concept?
   
2. OFFER DETAILED EXPLANATION:
   - After the brief answer, ALWAYS ask: "Would you like me to explain this 
     in detail on the whiteboard?"
   
3. WHITEBOARD ONLY ON REQUEST:
   - ONLY use [WHITEBOARD_START]...[WHITEBOARD_END] markers when the user:
     - Says "yes", "explain", "more detail", "show me", "break it down"
     - Explicitly asks for step-by-step explanation
     - Requests to see it on the whiteboard
   
4. SIMPLE GREETINGS:
   - For "hello", "hi", etc. - just respond warmly without offering whiteboard
```

**3. Example Conversations:**

**Example 1 - Brief Answer:**
```
User: "Tell me about artificial intelligence"
AI: "Artificial intelligence (AI) is technology that enables computers to 
    learn and make decisions like humans. It's used in things like voice 
    assistants, self-driving cars, and recommendation systems.
    
    Would you like me to explain this in more detail on the whiteboard?"
```

**Example 2 - User Asks for More:**
```
User: "Yes, explain more"
AI: [WHITEBOARD_START]
    ## Title: Understanding Artificial Intelligence
    ### Overview
    ... detailed explanation ...
    [WHITEBOARD_END]
```

**Example 3 - Math Problem:**
```
User: "Solve x^2 - 5x + 6 = 0"
AI: "The solutions are x = 2 and x = 3. These are the two values that 
    make the equation equal zero.
    
    Would you like me to show you the step-by-step solution on the 
    whiteboard?"
```

---

## Technical Changes Summary

| File | Change |
|------|--------|
| `src/hooks/useRealtimeChat.ts` | Update system prompt with new "brief first, then offer detail" instructions |

---

## Expected Behavior After Changes

1. You ask a question → Get a quick, short answer
2. AI asks if you want more detail
3. You say "yes" or "explain" → Full whiteboard explanation appears
4. You say nothing or move on → No whiteboard, continue with other questions

This gives you complete control over the depth of each answer!
