import { describe, it, expect } from 'vitest';
import {
  sanitizeLatex,
  parseInlineLatex,
  parseWhiteboardContent,
  hasWhiteboardContent,
  extractWhiteboardContent,
} from '@/lib/whiteboardParser';

describe('sanitizeLatex', () => {
  it('strips single outer $ delimiters', () => {
    expect(sanitizeLatex('$x^2$')).toBe('x^2');
  });

  it('strips single outer $$ delimiters', () => {
    expect(sanitizeLatex('$$x^2$$')).toBe('x^2');
  });

  it('strips nested $$$ delimiters', () => {
    expect(sanitizeLatex('$$$x^2$$$')).toBe('x^2');
  });

  it('strips deeply nested delimiters', () => {
    expect(sanitizeLatex('$$$$x^2$$$$')).toBe('x^2');
  });

  it('handles $1 pattern (common artifact)', () => {
    expect(sanitizeLatex('$1$')).toBe('1');
  });

  it('handles mixed nesting', () => {
    expect(sanitizeLatex('$$$x^2 - x + 9$$$')).toBe('x^2 - x + 9');
  });

  it('preserves clean latex without delimiters', () => {
    expect(sanitizeLatex('x^2 + 1')).toBe('x^2 + 1');
  });

  it('handles empty string', () => {
    expect(sanitizeLatex('')).toBe('');
  });

  it('handles whitespace', () => {
    expect(sanitizeLatex('  $x$  ')).toBe('x');
  });
});

describe('parseInlineLatex', () => {
  it('parses simple inline math', () => {
    const result = parseInlineLatex('The equation $x^2$ is quadratic');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ text: 'The equation ', isLatex: false });
    expect(result[1]).toEqual({ text: 'x^2', isLatex: true });
    expect(result[2]).toEqual({ text: ' is quadratic', isLatex: false });
  });

  it('parses display math $$...$$', () => {
    const result = parseInlineLatex('Result: $$x^2 + 1$$');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ text: 'Result: ', isLatex: false });
    expect(result[1]).toEqual({ text: 'x^2 + 1', isLatex: true });
  });

  it('sanitizes nested delimiters in inline math', () => {
    const result = parseInlineLatex('Equation: $$$x^2$$$');
    const latexSegment = result.find(s => s.isLatex);
    expect(latexSegment?.text).toBe('x^2');
  });

  it('handles text without math', () => {
    const result = parseInlineLatex('Just plain text');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ text: 'Just plain text', isLatex: false });
  });
});

describe('parseWhiteboardContent', () => {
  it('parses title correctly', () => {
    const content = '## Title: Solving Quadratic\n\n### Problem\nx^2 = 0';
    const result = parseWhiteboardContent(content);
    expect(result.title).toBe('Solving Quadratic');
  });

  it('parses math blocks with sanitization', () => {
    const content = '## Title: Test\n\n$$x^2 + 1$$';
    const result = parseWhiteboardContent(content);
    const mathSection = result.sections.find(s => s.type === 'math');
    expect(mathSection?.content).toBe('x^2 + 1');
  });

  it('handles nested delimiters in math blocks', () => {
    const content = '## Title: Test\n\n$$$x^2 - x + 9$$$';
    const result = parseWhiteboardContent(content);
    // The parser should handle this gracefully
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('parses steps correctly', () => {
    const content = '## Title: Test\n\n**Step 1:** First step\n\n**Step 2:** Second step';
    const result = parseWhiteboardContent(content);
    const steps = result.sections.filter(s => s.type === 'step');
    expect(steps).toHaveLength(2);
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[1].stepNumber).toBe(2);
  });

  it('parses answer section', () => {
    const content = '## Title: Test\n\n### Answer\nx = 5';
    const result = parseWhiteboardContent(content);
    const answer = result.sections.find(s => s.type === 'answer');
    expect(answer?.type).toBe('answer');
  });
});

describe('hasWhiteboardContent', () => {
  it('detects WHITEBOARD_START marker', () => {
    expect(hasWhiteboardContent('[WHITEBOARD_START]content[WHITEBOARD_END]')).toBe(true);
  });

  it('detects math + steps pattern', () => {
    expect(hasWhiteboardContent('$x^2$\n**Step 1:** do something')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(hasWhiteboardContent('Just regular text')).toBe(false);
  });
});

describe('extractWhiteboardContent', () => {
  it('extracts content between markers', () => {
    const text = 'Before [WHITEBOARD_START]The content[WHITEBOARD_END] After';
    const result = extractWhiteboardContent(text);
    expect(result.hasWhiteboard).toBe(true);
    expect(result.content).toBe('The content');
  });

  it('handles incomplete whiteboard (no end marker)', () => {
    const text = 'Before [WHITEBOARD_START]Still writing...';
    const result = extractWhiteboardContent(text);
    expect(result.hasWhiteboard).toBe(true);
    expect(result.content).toBe('Still writing...');
  });
});
