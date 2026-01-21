export interface WhiteboardSection {
  type: 'title' | 'step' | 'math' | 'answer' | 'text' | 'problem';
  content: string;
  stepNumber?: number;
}

export interface ParsedWhiteboard {
  title: string;
  sections: WhiteboardSection[];
  rawContent: string;
}

/**
 * Checks if text contains whiteboard content markers or math expressions
 */
export function hasWhiteboardContent(text: string): boolean {
  const startMarker = '[WHITEBOARD_START]';
  
  // Check for explicit markers
  if (text.includes(startMarker)) {
    return true;
  }
  
  // Also check for math expressions that could benefit from whiteboard display
  // Look for LaTeX patterns: $...$, $$...$$, \(...\), \[...\]
  const hasMath = /\$[^$]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/.test(text);
  const hasSteps = /\*\*Step\s*\d+:?\*\*/i.test(text) || /^Step\s*\d+:/im.test(text);
  
  return hasMath && hasSteps;
}

/**
 * Extracts whiteboard content from between [WHITEBOARD_START] and [WHITEBOARD_END] markers
 */
export function extractWhiteboardContent(text: string): { content: string; hasWhiteboard: boolean } {
  const startMarker = '[WHITEBOARD_START]';
  const endMarker = '[WHITEBOARD_END]';
  
  const startIndex = text.indexOf(startMarker);
  const endIndex = text.indexOf(endMarker);
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const content = text.slice(startIndex + startMarker.length, endIndex).trim();
    return { content, hasWhiteboard: true };
  }
  
  // Check if whiteboard is still being written (has start but no end yet)
  if (startIndex !== -1 && endIndex === -1) {
    const content = text.slice(startIndex + startMarker.length).trim();
    return { content, hasWhiteboard: true };
  }
  
  // If no markers but has math content, return the full text as whiteboard content
  if (hasWhiteboardContent(text)) {
    return { content: text, hasWhiteboard: true };
  }
  
  return { content: '', hasWhiteboard: false };
}

/**
 * Removes whiteboard markers from text for display in chat
 */
export function removeWhiteboardMarkers(text: string): string {
  const startMarker = '[WHITEBOARD_START]';
  const endMarker = '[WHITEBOARD_END]';
  
  let result = text;
  const startIndex = result.indexOf(startMarker);
  const endIndex = result.indexOf(endMarker);
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    // Remove the entire whiteboard content from chat
    result = result.slice(0, startIndex) + result.slice(endIndex + endMarker.length);
  } else if (startIndex !== -1 && endIndex === -1) {
    // Still writing, remove from start marker onward
    result = result.slice(0, startIndex);
  }
  
  return result.trim();
}

/**
 * Converts various LaTeX delimiters to a standard format
 * Handles: \(...\), \[...\], $$...$$, $...$
 */
function normalizeLatexDelimiters(text: string): string {
  // Convert \[...\] (display) to $$...$$
  let result = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$');
  
  // Convert \(...\) (inline) to $...$
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  
  return result;
}

/**
 * Parses whiteboard content into structured sections
 */
export function parseWhiteboardContent(content: string): ParsedWhiteboard {
  // First normalize all LaTeX delimiters
  const normalizedContent = normalizeLatexDelimiters(content);
  const lines = normalizedContent.split('\n');
  const sections: WhiteboardSection[] = [];
  let title = '';
  let currentSection: WhiteboardSection | null = null;
  let stepCounter = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      if (currentSection && currentSection.content) {
        sections.push(currentSection);
        currentSection = null;
      }
      continue;
    }
    
    // Title detection (## Title: or # Title or ## Problem Title)
    if (line.match(/^##?\s*Title:/i)) {
      title = line.replace(/^##?\s*Title:\s*/i, '').trim();
      continue;
    }
    
    // Main header (# Something)
    if (line.match(/^#\s+/) && !title) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }
    
    // Problem section
    if (line.match(/^###?\s*Problem/i)) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: 'problem', content: '' };
      continue;
    }
    
    // Solution header (skip, just continue to steps)
    if (line.match(/^###?\s*Solution/i)) {
      if (currentSection) sections.push(currentSection);
      currentSection = null;
      continue;
    }
    
    // Answer section
    if (line.match(/^###?\s*Answer/i) || line.match(/^\*\*Answer:?\*\*/i)) {
      if (currentSection) sections.push(currentSection);
      const answerContent = line.replace(/^###?\s*Answer:?\s*/i, '').replace(/^\*\*Answer:?\*\*\s*/i, '').trim();
      currentSection = { type: 'answer', content: answerContent };
      continue;
    }
    
    // Step detection (**Step N:** or Step N:)
    const stepMatch = line.match(/^\*?\*?Step\s*(\d+):?\*?\*?:?\s*(.*)/i);
    if (stepMatch) {
      if (currentSection) sections.push(currentSection);
      stepCounter = parseInt(stepMatch[1], 10);
      currentSection = { 
        type: 'step', 
        content: stepMatch[2] || '', 
        stepNumber: stepCounter 
      };
      continue;
    }
    
    // Math block ($$...$$)
    if (line.startsWith('$$') && line.endsWith('$$') && line.length > 4) {
      if (currentSection) sections.push(currentSection);
      sections.push({ 
        type: 'math', 
        content: line.slice(2, -2).trim() 
      });
      currentSection = null;
      continue;
    }
    
    // Multi-line math block start
    if (line === '$$') {
      if (currentSection) sections.push(currentSection);
      let mathContent = '';
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathContent += lines[i].trim() + ' ';
        i++;
      }
      sections.push({ type: 'math', content: mathContent.trim() });
      currentSection = null;
      continue;
    }
    
    // Inline math in current section
    if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    } else {
      currentSection = { type: 'text', content: line };
    }
  }
  
  // Push any remaining section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return {
    title: title || 'Solution',
    sections,
    rawContent: content
  };
}

/**
 * Extracts inline LaTeX expressions from text
 * Returns array of {text, isLatex} segments
 * Handles both $...$ and \(...\) delimiters
 */
export function parseInlineLatex(text: string): Array<{ text: string; isLatex: boolean }> {
  // First normalize any remaining \(...\) to $...$
  const normalizedText = normalizeLatexDelimiters(text);
  
  const segments: Array<{ text: string; isLatex: boolean }> = [];
  // Match both single $ inline and $$ display math
  const regex = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(normalizedText)) !== null) {
    // Text before the math
    if (match.index > lastIndex) {
      segments.push({ text: normalizedText.slice(lastIndex, match.index), isLatex: false });
    }
    // The math expression (match[1] for $$, match[2] for $)
    const latex = match[1] || match[2];
    segments.push({ text: latex, isLatex: true });
    lastIndex = regex.lastIndex;
  }
  
  // Remaining text after last match
  if (lastIndex < normalizedText.length) {
    segments.push({ text: normalizedText.slice(lastIndex), isLatex: false });
  }
  
  return segments.length > 0 ? segments : [{ text: normalizedText, isLatex: false }];
}
