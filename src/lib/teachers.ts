export interface Teacher {
  id: string;
  name: string;
  faceId: string;
  role: string;
  subjects: string[];
  languages: string[];
  adultSupport: string[];
  emoji: string;
  color: string; // tailwind gradient classes
}

export const TEACHERS: Teacher[] = [
  {
    id: "lina",
    name: "Lina",
    faceId: "b9e5fba3-071a-4e35-896e-211c4d6eaa7b",
    role: "Primary Foundations Tutor (KS1–KS2)",
    subjects: ["English (Phonics, Reading, Writing, Grammar)", "Mathematics", "Science", "History & Geography", "PSHE & Citizenship", "Study Skills & Homework Support"],
    languages: ["English (Native, EAL, ESL)", "100+ languages"],
    adultSupport: ["Functional Skills English & Maths", "Basic Literacy & Confidence Building"],
    emoji: "👩‍🏫",
    color: "from-amber-400 to-orange-500",
  },
  {
    id: "zahra",
    name: "Zahra",
    faceId: "afdb6a3e-3939-40aa-92df-01604c23101c",
    role: "English, Languages & Ethics Tutor (KS2–KS4)",
    subjects: ["English Language (KS2–GCSE)", "English Literature (KS3–GCSE)", "Religious Studies (KS3–GCSE)", "Citizenship & PSHE", "A Level", "Health & Social Care"],
    languages: ["Arabic (Beginner → Advanced)", "English (ESOL / IELTS)", "100+ languages"],
    adultSupport: ["Professional English", "Arabic for Work, Faith & Travel", "Communication Skills"],
    emoji: "👩‍💼",
    color: "from-teal-400 to-emerald-500",
  },
  {
    id: "hank",
    name: "Hank",
    faceId: "dd10cb5a-d31d-4f12-b69f-6db3383c006e",
    role: "STEM & Exam Specialist (KS3–KS4)",
    subjects: ["Mathematics (KS3–GCSE)", "Further Maths (GCSE)", "Physics (GCSE)", "Chemistry (GCSE)", "Computer Science (GCSE)"],
    languages: ["Maths & Science in 100+ languages"],
    adultSupport: ["Coding for Beginners", "Data & Technical Literacy", "STEM Career Foundations"],
    emoji: "👨‍🔬",
    color: "from-blue-400 to-indigo-500",
  },
  {
    id: "mark",
    name: "Mark",
    faceId: "804c347a-26c9-4dcf-bb49-13df4bed61e8",
    role: "Business, Computing & Media Tutor (KS4)",
    subjects: ["Business Studies (GCSE)", "Economics (GCSE)", "ICT & Computer Science (GCSE)", "Media Studies (GCSE)", "Financial Literacy", "A Level", "Health & Social Care"],
    languages: ["Business learning in 100+ languages"],
    adultSupport: ["Entrepreneurship", "Digital Productivity (Excel, Docs, AI)", "Career Planning & Interview Skills"],
    emoji: "👨‍💼",
    color: "from-violet-400 to-purple-500",
  },
  {
    id: "kate",
    name: "Kate",
    faceId: "d2a5c7c6-fed9-4f55-bcb3-062f7cd20103",
    role: "Humanities, Creative & Wellbeing Tutor (KS2–KS4)",
    subjects: ["History (KS2–GCSE)", "Geography (KS2–GCSE)", "Sociology (GCSE)", "Psychology (GCSE)", "Art & Creative Writing", "PE Theory (GCSE)", "A Levels", "Health & Social Care"],
    languages: ["Humanities & creative learning in 100+ languages"],
    adultSupport: ["Personal Development & Wellbeing", "Critical Thinking", "Lifelong Learning Skills"],
    emoji: "👩‍🎨",
    color: "from-rose-400 to-pink-500",
  },
];
