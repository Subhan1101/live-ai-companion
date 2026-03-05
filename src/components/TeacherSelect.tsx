import { useState, useEffect, useRef, useCallback } from "react";
import { TEACHERS, type Teacher } from "@/lib/teachers";
import { BookOpen, GraduationCap, Globe, Mic, MicOff } from "lucide-react";
import { useVoiceNavigation } from "@/hooks/useVoiceNavigation";

import linaImg from "@/assets/teachers/lina.png";
import zahraImg from "@/assets/teachers/zahra.png";
import hankImg from "@/assets/teachers/hank.png";
import markImg from "@/assets/teachers/mark.png";
import kateImg from "@/assets/teachers/kate.png";

const teacherImages: Record<string, string> = {
  lina: linaImg,
  zahra: zahraImg,
  hank: hankImg,
  mark: markImg,
  kate: kateImg,
};

const TEACHER_DESCRIPTIONS: Record<string, string> = {
  lina: "Lina, for primary foundations",
  zahra: "Zahra, for English and ethics",
  hank: "Hank, for STEM subjects",
  mark: "Mark, for business and tech",
  kate: "Kate, for humanities and creative arts",
};

interface TeacherSelectProps {
  onSelect: (teacher: Teacher) => void;
}

const TeacherSelect = ({ onSelect }: TeacherSelectProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceHighlight, setVoiceHighlight] = useState<string | null>(null);
  const hasAnnouncedRef = useRef(false);

  const handleSelect = useCallback((teacher: Teacher) => {
    setSelected(teacher.id);
    setTimeout(() => onSelect(teacher), 350);
  }, [onSelect]);

  const handleVoiceMatch = useCallback((keyword: string) => {
    const teacher = TEACHERS.find(
      (t) => t.name.toLowerCase() === keyword.toLowerCase()
    );
    if (teacher) {
      setVoiceHighlight(teacher.id);
      setTimeout(() => handleSelect(teacher), 800);
    }
  }, [handleSelect]);

  const { isListening, transcript, isSupported } = useVoiceNavigation({
    keywords: TEACHERS.map((t) => t.name),
    enabled: voiceEnabled,
    onMatch: handleVoiceMatch,
  });

  // TTS announcement on voice enable
  useEffect(() => {
    if (voiceEnabled && !hasAnnouncedRef.current && "speechSynthesis" in window) {
      hasAnnouncedRef.current = true;
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const descriptions = TEACHERS.map((t) => TEACHER_DESCRIPTIONS[t.id]).join(", ");
      const utterance = new SpeechSynthesisUtterance(
        `Welcome. You can choose a teacher by saying their name. Available teachers are: ${descriptions}. Which teacher would you like?`
      );
      utterance.rate = 0.95;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
    if (!voiceEnabled) {
      hasAnnouncedRef.current = false;
      window.speechSynthesis?.cancel();
    }
  }, [voiceEnabled]);

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center p-4 overflow-auto">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
            Choose Your Teacher
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Select a tutor to start your learning session
          </p>

          {/* Voice control toggle */}
          {isSupported && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={() => setVoiceEnabled((v) => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                  ${voiceEnabled
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                aria-label={voiceEnabled ? "Disable voice control" : "Enable voice control"}
              >
                {voiceEnabled ? (
                  <Mic className="w-4 h-4 animate-pulse" />
                ) : (
                  <MicOff className="w-4 h-4" />
                )}
                {voiceEnabled ? "Listening... say a teacher's name" : "Enable voice control"}
              </button>
              {isListening && transcript && (
                <p className="text-xs text-muted-foreground animate-in fade-in">
                  Heard: "<span className="text-foreground font-medium">{transcript}</span>"
                </p>
              )}
            </div>
          )}
        </div>

        {/* Teacher grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEACHERS.map((teacher) => {
            const isSelected = selected === teacher.id;
            const isVoiceHighlighted = voiceHighlight === teacher.id;
            const isExpanded = expanded === teacher.id;

            return (
              <button
                key={teacher.id}
                onClick={() => handleSelect(teacher)}
                onMouseEnter={() => setExpanded(teacher.id)}
                onMouseLeave={() => setExpanded(null)}
                className={`relative rounded-2xl p-5 text-left transition-all duration-300 border-2 group
                  ${isSelected || isVoiceHighlighted
                    ? "border-primary scale-[1.03] shadow-lg ring-2 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:shadow-md"
                  } bg-card`}
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm shrink-0">
                    <img src={teacherImages[teacher.id]} alt={teacher.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-lg text-foreground truncate">
                      {teacher.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {teacher.role}
                    </p>
                  </div>
                </div>

                {/* Subjects preview */}
                <div className="flex items-start gap-1.5 mb-2">
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {teacher.subjects.slice(0, 3).join(" · ")}
                    {teacher.subjects.length > 3 && ` +${teacher.subjects.length - 3} more`}
                  </p>
                </div>

                {/* Languages */}
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">
                    {teacher.languages[0]}
                  </p>
                </div>

                {/* Expanded details on hover */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border animate-in fade-in duration-200">
                    <div className="flex items-start gap-1.5 mb-1">
                      <GraduationCap className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-foreground mb-0.5">Adult Support</p>
                        <p className="text-xs text-muted-foreground">
                          {teacher.adultSupport.join(" · ")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Selection indicator */}
                {(isSelected || isVoiceHighlighted) && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TeacherSelect;
