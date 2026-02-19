import { useState } from "react";
import { TEACHERS, type Teacher } from "@/lib/teachers";
import { BookOpen, GraduationCap, Globe } from "lucide-react";

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

interface TeacherSelectProps {
  onSelect: (teacher: Teacher) => void;
}

const TeacherSelect = ({ onSelect }: TeacherSelectProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleSelect = (teacher: Teacher) => {
    setSelected(teacher.id);
    // Small delay so the user sees the selection highlight
    setTimeout(() => onSelect(teacher), 350);
  };

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
        </div>

        {/* Teacher grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEACHERS.map((teacher) => {
            const isSelected = selected === teacher.id;
            const isExpanded = expanded === teacher.id;

            return (
              <button
                key={teacher.id}
                onClick={() => handleSelect(teacher)}
                onMouseEnter={() => setExpanded(teacher.id)}
                onMouseLeave={() => setExpanded(null)}
                className={`relative rounded-2xl p-5 text-left transition-all duration-300 border-2 group
                  ${isSelected
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
                {isSelected && (
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
