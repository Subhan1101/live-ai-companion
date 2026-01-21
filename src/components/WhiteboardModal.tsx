import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, X, PenLine } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  ParsedWhiteboard,
  parseWhiteboardContent,
  parseInlineLatex,
  sanitizeLatex,
} from "@/lib/whiteboardParser";
import katex from "katex";
import "katex/dist/katex.min.css";

interface WhiteboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
}

// Render LaTeX math using KaTeX
const MathBlock = ({ latex, displayMode = true }: { latex: string; displayMode?: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && latex) {
      // Sanitize to remove any nested delimiters before rendering
      const cleanLatex = sanitizeLatex(latex);
      try {
        katex.render(cleanLatex, containerRef.current, {
          displayMode,
          throwOnError: false,
          strict: false,
        });
      } catch (e) {
        console.error("KaTeX render error:", e);
        if (containerRef.current) {
          // Show clean latex without delimiters as fallback
          containerRef.current.textContent = cleanLatex;
        }
      }
    }
  }, [latex, displayMode]);

  return <div ref={containerRef} className={displayMode ? "my-4 text-center" : "inline"} />;
};

// Render text with inline LaTeX
const TextWithMath = ({ text }: { text: string }) => {
  const segments = parseInlineLatex(text);

  return (
    <span>
      {segments.map((segment, i) =>
        segment.isLatex ? (
          <MathBlock key={i} latex={segment.text} displayMode={false} />
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </span>
  );
};

const WhiteboardModal = ({ open, onOpenChange, content }: WhiteboardModalProps) => {
  const parsed: ParsedWhiteboard = parseWhiteboardContent(content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied!",
        description: "Solution copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] h-[85vh] flex flex-col p-0 gap-0 bg-card border-border">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <PenLine className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle className="text-xl font-semibold">
                <TextWithMath text={parsed.title} />
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                <Copy className="w-4 h-4" />
                Copy
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {parsed.sections.map((section, index) => {
              switch (section.type) {
                case 'problem':
                  return (
                    <div key={index} className="p-4 rounded-lg bg-muted/50 border border-border">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Problem</h3>
                      <div className="text-foreground">
                        <TextWithMath text={section.content} />
                      </div>
                    </div>
                  );

                case 'step':
                  return (
                    <div key={index} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {section.stepNumber}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 pt-1">
                        <TextWithMath text={section.content} />
                      </div>
                    </div>
                  );

                case 'math':
                  return (
                    <div key={index} className="py-2 px-4 bg-muted/30 rounded-lg overflow-x-auto">
                      <MathBlock latex={section.content} />
                    </div>
                  );

                case 'answer':
                  return (
                    <div key={index} className="p-4 rounded-lg bg-primary/5 border-2 border-primary/20">
                      <h3 className="text-sm font-semibold text-primary mb-2">✓ Answer</h3>
                      <div className="text-lg font-medium text-foreground">
                        <TextWithMath text={section.content} />
                      </div>
                    </div>
                  );

                case 'text':
                default:
                  return (
                    <div key={index} className="text-foreground">
                      <TextWithMath text={section.content} />
                    </div>
                  );
              }
            })}

            {/* Show raw content if no sections parsed */}
            {parsed.sections.length === 0 && content && (
              <div className="whitespace-pre-wrap text-foreground">
                {content}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default WhiteboardModal;
