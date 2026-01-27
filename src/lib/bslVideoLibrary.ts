/**
 * BSL Video Library
 * 
 * Static mapping of BSL signs to video resources.
 * Uses multiple sources:
 * 1. BSL SignBank (UCL) - Primary source for authentic BSL videos
 * 2. Fallback to animated emojis/GIFs
 * 
 * Note: Some URLs may require CORS proxy for cross-origin access.
 * The edge function bsl-video-proxy handles this.
 */

export interface BSLVideoEntry {
  sign: string;
  videoUrl: string | null;
  fallbackEmoji: string;
  category: 'alphabet' | 'number' | 'greeting' | 'common' | 'education' | 'question' | 'pronoun';
  description?: string;
}

// BSL SignBank base URL (UCL)
const SIGNBANK_BASE = 'https://media.bslsignbank.ucl.ac.uk/signs/BSL';

// Alphabet videos - fingerspelling
const alphabetVideos: BSLVideoEntry[] = [
  { sign: 'A', videoUrl: `${SIGNBANK_BASE}/A.mp4`, fallbackEmoji: '👊', category: 'alphabet' },
  { sign: 'B', videoUrl: `${SIGNBANK_BASE}/B.mp4`, fallbackEmoji: '🖐️', category: 'alphabet' },
  { sign: 'C', videoUrl: `${SIGNBANK_BASE}/C.mp4`, fallbackEmoji: '🤲', category: 'alphabet' },
  { sign: 'D', videoUrl: `${SIGNBANK_BASE}/D.mp4`, fallbackEmoji: '👆', category: 'alphabet' },
  { sign: 'E', videoUrl: `${SIGNBANK_BASE}/E.mp4`, fallbackEmoji: '✊', category: 'alphabet' },
  { sign: 'F', videoUrl: `${SIGNBANK_BASE}/F.mp4`, fallbackEmoji: '👌', category: 'alphabet' },
  { sign: 'G', videoUrl: `${SIGNBANK_BASE}/G.mp4`, fallbackEmoji: '🤙', category: 'alphabet' },
  { sign: 'H', videoUrl: `${SIGNBANK_BASE}/H.mp4`, fallbackEmoji: '✌️', category: 'alphabet' },
  { sign: 'I', videoUrl: `${SIGNBANK_BASE}/I.mp4`, fallbackEmoji: '🤙', category: 'alphabet' },
  { sign: 'J', videoUrl: `${SIGNBANK_BASE}/J.mp4`, fallbackEmoji: '🤙', category: 'alphabet' },
  { sign: 'K', videoUrl: `${SIGNBANK_BASE}/K.mp4`, fallbackEmoji: '✌️', category: 'alphabet' },
  { sign: 'L', videoUrl: `${SIGNBANK_BASE}/L.mp4`, fallbackEmoji: '🤟', category: 'alphabet' },
  { sign: 'M', videoUrl: `${SIGNBANK_BASE}/M.mp4`, fallbackEmoji: '✊', category: 'alphabet' },
  { sign: 'N', videoUrl: `${SIGNBANK_BASE}/N.mp4`, fallbackEmoji: '✊', category: 'alphabet' },
  { sign: 'O', videoUrl: `${SIGNBANK_BASE}/O.mp4`, fallbackEmoji: '👌', category: 'alphabet' },
  { sign: 'P', videoUrl: `${SIGNBANK_BASE}/P.mp4`, fallbackEmoji: '👇', category: 'alphabet' },
  { sign: 'Q', videoUrl: `${SIGNBANK_BASE}/Q.mp4`, fallbackEmoji: '👇', category: 'alphabet' },
  { sign: 'R', videoUrl: `${SIGNBANK_BASE}/R.mp4`, fallbackEmoji: '✌️', category: 'alphabet' },
  { sign: 'S', videoUrl: `${SIGNBANK_BASE}/S.mp4`, fallbackEmoji: '✊', category: 'alphabet' },
  { sign: 'T', videoUrl: `${SIGNBANK_BASE}/T.mp4`, fallbackEmoji: '✊', category: 'alphabet' },
  { sign: 'U', videoUrl: `${SIGNBANK_BASE}/U.mp4`, fallbackEmoji: '✌️', category: 'alphabet' },
  { sign: 'V', videoUrl: `${SIGNBANK_BASE}/V.mp4`, fallbackEmoji: '✌️', category: 'alphabet' },
  { sign: 'W', videoUrl: `${SIGNBANK_BASE}/W.mp4`, fallbackEmoji: '🤟', category: 'alphabet' },
  { sign: 'X', videoUrl: `${SIGNBANK_BASE}/X.mp4`, fallbackEmoji: '👆', category: 'alphabet' },
  { sign: 'Y', videoUrl: `${SIGNBANK_BASE}/Y.mp4`, fallbackEmoji: '🤙', category: 'alphabet' },
  { sign: 'Z', videoUrl: `${SIGNBANK_BASE}/Z.mp4`, fallbackEmoji: '👆', category: 'alphabet' },
];

// Number videos
const numberVideos: BSLVideoEntry[] = [
  { sign: '0', videoUrl: `${SIGNBANK_BASE}/0.mp4`, fallbackEmoji: '👌', category: 'number' },
  { sign: '1', videoUrl: `${SIGNBANK_BASE}/1.mp4`, fallbackEmoji: '☝️', category: 'number' },
  { sign: '2', videoUrl: `${SIGNBANK_BASE}/2.mp4`, fallbackEmoji: '✌️', category: 'number' },
  { sign: '3', videoUrl: `${SIGNBANK_BASE}/3.mp4`, fallbackEmoji: '🤟', category: 'number' },
  { sign: '4', videoUrl: `${SIGNBANK_BASE}/4.mp4`, fallbackEmoji: '🖐️', category: 'number' },
  { sign: '5', videoUrl: `${SIGNBANK_BASE}/5.mp4`, fallbackEmoji: '🖐️', category: 'number' },
  { sign: '6', videoUrl: `${SIGNBANK_BASE}/6.mp4`, fallbackEmoji: '🤙', category: 'number' },
  { sign: '7', videoUrl: `${SIGNBANK_BASE}/7.mp4`, fallbackEmoji: '🤟', category: 'number' },
  { sign: '8', videoUrl: `${SIGNBANK_BASE}/8.mp4`, fallbackEmoji: '🤘', category: 'number' },
  { sign: '9', videoUrl: `${SIGNBANK_BASE}/9.mp4`, fallbackEmoji: '👆', category: 'number' },
];

// Greeting videos
const greetingVideos: BSLVideoEntry[] = [
  { sign: 'HELLO', videoUrl: `${SIGNBANK_BASE}/hello.mp4`, fallbackEmoji: '👋', category: 'greeting', description: 'Wave hand' },
  { sign: 'HI', videoUrl: `${SIGNBANK_BASE}/hi.mp4`, fallbackEmoji: '👋', category: 'greeting' },
  { sign: 'GOODBYE', videoUrl: `${SIGNBANK_BASE}/goodbye.mp4`, fallbackEmoji: '👋', category: 'greeting' },
  { sign: 'BYE', videoUrl: `${SIGNBANK_BASE}/bye.mp4`, fallbackEmoji: '👋', category: 'greeting' },
  { sign: 'THANK', videoUrl: `${SIGNBANK_BASE}/thank.mp4`, fallbackEmoji: '🙏', category: 'greeting' },
  { sign: 'THANKS', videoUrl: `${SIGNBANK_BASE}/thanks.mp4`, fallbackEmoji: '🙏', category: 'greeting' },
  { sign: 'PLEASE', videoUrl: `${SIGNBANK_BASE}/please.mp4`, fallbackEmoji: '🙏', category: 'greeting' },
  { sign: 'SORRY', videoUrl: `${SIGNBANK_BASE}/sorry.mp4`, fallbackEmoji: '✊', category: 'greeting' },
  { sign: 'YES', videoUrl: `${SIGNBANK_BASE}/yes.mp4`, fallbackEmoji: '👍', category: 'greeting' },
  { sign: 'NO', videoUrl: `${SIGNBANK_BASE}/no.mp4`, fallbackEmoji: '👎', category: 'greeting' },
  { sign: 'WELCOME', videoUrl: `${SIGNBANK_BASE}/welcome.mp4`, fallbackEmoji: '🤗', category: 'greeting' },
];

// Common words videos
const commonVideos: BSLVideoEntry[] = [
  { sign: 'GOOD', videoUrl: `${SIGNBANK_BASE}/good.mp4`, fallbackEmoji: '👍', category: 'common' },
  { sign: 'BAD', videoUrl: `${SIGNBANK_BASE}/bad.mp4`, fallbackEmoji: '👎', category: 'common' },
  { sign: 'HELP', videoUrl: `${SIGNBANK_BASE}/help.mp4`, fallbackEmoji: '👍', category: 'common' },
  { sign: 'STOP', videoUrl: `${SIGNBANK_BASE}/stop.mp4`, fallbackEmoji: '✋', category: 'common' },
  { sign: 'WANT', videoUrl: `${SIGNBANK_BASE}/want.mp4`, fallbackEmoji: '👈', category: 'common' },
  { sign: 'NEED', videoUrl: `${SIGNBANK_BASE}/need.mp4`, fallbackEmoji: '👐', category: 'common' },
  { sign: 'LIKE', videoUrl: `${SIGNBANK_BASE}/like.mp4`, fallbackEmoji: '👍', category: 'common' },
  { sign: 'LOVE', videoUrl: `${SIGNBANK_BASE}/love.mp4`, fallbackEmoji: '🤟', category: 'common' },
  { sign: 'KNOW', videoUrl: `${SIGNBANK_BASE}/know.mp4`, fallbackEmoji: '💡', category: 'common' },
  { sign: 'THINK', videoUrl: `${SIGNBANK_BASE}/think.mp4`, fallbackEmoji: '🤔', category: 'common' },
  { sign: 'UNDERSTAND', videoUrl: `${SIGNBANK_BASE}/understand.mp4`, fallbackEmoji: '💡', category: 'common' },
  { sign: 'REMEMBER', videoUrl: `${SIGNBANK_BASE}/remember.mp4`, fallbackEmoji: '🧠', category: 'common' },
  { sign: 'FORGET', videoUrl: `${SIGNBANK_BASE}/forget.mp4`, fallbackEmoji: '❓', category: 'common' },
  { sign: 'SEE', videoUrl: `${SIGNBANK_BASE}/see.mp4`, fallbackEmoji: '👀', category: 'common' },
  { sign: 'LOOK', videoUrl: `${SIGNBANK_BASE}/look.mp4`, fallbackEmoji: '👁️', category: 'common' },
  { sign: 'WATCH', videoUrl: `${SIGNBANK_BASE}/watch.mp4`, fallbackEmoji: '👀', category: 'common' },
  { sign: 'LISTEN', videoUrl: `${SIGNBANK_BASE}/listen.mp4`, fallbackEmoji: '👂', category: 'common' },
  { sign: 'SPEAK', videoUrl: `${SIGNBANK_BASE}/speak.mp4`, fallbackEmoji: '🗣️', category: 'common' },
  { sign: 'READ', videoUrl: `${SIGNBANK_BASE}/read.mp4`, fallbackEmoji: '📖', category: 'common' },
  { sign: 'WRITE', videoUrl: `${SIGNBANK_BASE}/write.mp4`, fallbackEmoji: '✍️', category: 'common' },
  { sign: 'WORK', videoUrl: `${SIGNBANK_BASE}/work.mp4`, fallbackEmoji: '💼', category: 'common' },
  { sign: 'PLAY', videoUrl: `${SIGNBANK_BASE}/play.mp4`, fallbackEmoji: '🎮', category: 'common' },
  { sign: 'TRY', videoUrl: `${SIGNBANK_BASE}/try.mp4`, fallbackEmoji: '💪', category: 'common' },
  { sign: 'FINISH', videoUrl: `${SIGNBANK_BASE}/finish.mp4`, fallbackEmoji: '✅', category: 'common' },
  { sign: 'START', videoUrl: `${SIGNBANK_BASE}/start.mp4`, fallbackEmoji: '▶️', category: 'common' },
];

// Education-related videos
const educationVideos: BSLVideoEntry[] = [
  { sign: 'LEARN', videoUrl: `${SIGNBANK_BASE}/learn.mp4`, fallbackEmoji: '📖', category: 'education' },
  { sign: 'TEACH', videoUrl: `${SIGNBANK_BASE}/teach.mp4`, fallbackEmoji: '👨‍🏫', category: 'education' },
  { sign: 'TEACHER', videoUrl: `${SIGNBANK_BASE}/teacher.mp4`, fallbackEmoji: '👨‍🏫', category: 'education' },
  { sign: 'STUDENT', videoUrl: `${SIGNBANK_BASE}/student.mp4`, fallbackEmoji: '👨‍🎓', category: 'education' },
  { sign: 'SCHOOL', videoUrl: `${SIGNBANK_BASE}/school.mp4`, fallbackEmoji: '📚', category: 'education' },
  { sign: 'UNIVERSITY', videoUrl: `${SIGNBANK_BASE}/university.mp4`, fallbackEmoji: '🎓', category: 'education' },
  { sign: 'BOOK', videoUrl: `${SIGNBANK_BASE}/book.mp4`, fallbackEmoji: '📕', category: 'education' },
  { sign: 'STUDY', videoUrl: `${SIGNBANK_BASE}/study.mp4`, fallbackEmoji: '📚', category: 'education' },
  { sign: 'EDUCATION', videoUrl: `${SIGNBANK_BASE}/education.mp4`, fallbackEmoji: '🎓', category: 'education' },
  { sign: 'QUESTION', videoUrl: `${SIGNBANK_BASE}/question.mp4`, fallbackEmoji: '❓', category: 'education' },
  { sign: 'ANSWER', videoUrl: `${SIGNBANK_BASE}/answer.mp4`, fallbackEmoji: '💬', category: 'education' },
  { sign: 'EXPLAIN', videoUrl: `${SIGNBANK_BASE}/explain.mp4`, fallbackEmoji: '💡', category: 'education' },
  { sign: 'COMPUTER', videoUrl: `${SIGNBANK_BASE}/computer.mp4`, fallbackEmoji: '💻', category: 'education' },
  { sign: 'TECHNOLOGY', videoUrl: `${SIGNBANK_BASE}/technology.mp4`, fallbackEmoji: '⚙️', category: 'education' },
  { sign: 'SCIENCE', videoUrl: `${SIGNBANK_BASE}/science.mp4`, fallbackEmoji: '🔬', category: 'education' },
  { sign: 'MATH', videoUrl: `${SIGNBANK_BASE}/mathematics.mp4`, fallbackEmoji: '🔢', category: 'education' },
  { sign: 'MATHS', videoUrl: `${SIGNBANK_BASE}/mathematics.mp4`, fallbackEmoji: '🔢', category: 'education' },
  { sign: 'ENGLISH', videoUrl: `${SIGNBANK_BASE}/english.mp4`, fallbackEmoji: '📝', category: 'education' },
  { sign: 'HISTORY', videoUrl: `${SIGNBANK_BASE}/history.mp4`, fallbackEmoji: '📜', category: 'education' },
  { sign: 'ART', videoUrl: `${SIGNBANK_BASE}/art.mp4`, fallbackEmoji: '🎨', category: 'education' },
  { sign: 'MUSIC', videoUrl: `${SIGNBANK_BASE}/music.mp4`, fallbackEmoji: '🎵', category: 'education' },
  { sign: 'ARTIFICIAL', videoUrl: null, fallbackEmoji: '🤖', category: 'education' },
  { sign: 'INTELLIGENCE', videoUrl: null, fallbackEmoji: '🧠', category: 'education' },
  { sign: 'AI', videoUrl: null, fallbackEmoji: '🤖', category: 'education' },
];

// Question words
const questionVideos: BSLVideoEntry[] = [
  { sign: 'WHAT', videoUrl: `${SIGNBANK_BASE}/what.mp4`, fallbackEmoji: '❓', category: 'question' },
  { sign: 'WHERE', videoUrl: `${SIGNBANK_BASE}/where.mp4`, fallbackEmoji: '📍', category: 'question' },
  { sign: 'WHEN', videoUrl: `${SIGNBANK_BASE}/when.mp4`, fallbackEmoji: '⏰', category: 'question' },
  { sign: 'WHY', videoUrl: `${SIGNBANK_BASE}/why.mp4`, fallbackEmoji: '🤔', category: 'question' },
  { sign: 'HOW', videoUrl: `${SIGNBANK_BASE}/how.mp4`, fallbackEmoji: '💭', category: 'question' },
  { sign: 'WHO', videoUrl: `${SIGNBANK_BASE}/who.mp4`, fallbackEmoji: '👤', category: 'question' },
  { sign: 'WHICH', videoUrl: `${SIGNBANK_BASE}/which.mp4`, fallbackEmoji: '👈', category: 'question' },
];

// Pronouns and common grammatical words
const pronounVideos: BSLVideoEntry[] = [
  { sign: 'I', videoUrl: `${SIGNBANK_BASE}/i.mp4`, fallbackEmoji: '👆', category: 'pronoun' },
  { sign: 'YOU', videoUrl: `${SIGNBANK_BASE}/you.mp4`, fallbackEmoji: '👉', category: 'pronoun' },
  { sign: 'WE', videoUrl: `${SIGNBANK_BASE}/we.mp4`, fallbackEmoji: '👥', category: 'pronoun' },
  { sign: 'THEY', videoUrl: `${SIGNBANK_BASE}/they.mp4`, fallbackEmoji: '👥', category: 'pronoun' },
  { sign: 'HE', videoUrl: `${SIGNBANK_BASE}/he.mp4`, fallbackEmoji: '👤', category: 'pronoun' },
  { sign: 'SHE', videoUrl: `${SIGNBANK_BASE}/she.mp4`, fallbackEmoji: '👤', category: 'pronoun' },
  { sign: 'MY', videoUrl: `${SIGNBANK_BASE}/my.mp4`, fallbackEmoji: '✋', category: 'pronoun' },
  { sign: 'YOUR', videoUrl: `${SIGNBANK_BASE}/your.mp4`, fallbackEmoji: '👉', category: 'pronoun' },
  { sign: 'THIS', videoUrl: `${SIGNBANK_BASE}/this.mp4`, fallbackEmoji: '👇', category: 'pronoun' },
  { sign: 'THAT', videoUrl: `${SIGNBANK_BASE}/that.mp4`, fallbackEmoji: '👉', category: 'pronoun' },
];

// Combine all videos into the library
export const bslVideoLibrary: Map<string, BSLVideoEntry> = new Map();

// Initialize library
[
  ...alphabetVideos,
  ...numberVideos,
  ...greetingVideos,
  ...commonVideos,
  ...educationVideos,
  ...questionVideos,
  ...pronounVideos,
].forEach(entry => {
  bslVideoLibrary.set(entry.sign, entry);
});

/**
 * Get video entry for a sign
 */
export const getVideoEntry = (sign: string): BSLVideoEntry | null => {
  return bslVideoLibrary.get(sign.toUpperCase()) || null;
};

/**
 * Get video URL for a sign (or null if not available)
 */
export const getVideoUrl = (sign: string): string | null => {
  const entry = getVideoEntry(sign);
  return entry?.videoUrl || null;
};

/**
 * Get fallback emoji for a sign
 */
export const getFallbackEmoji = (sign: string): string => {
  const entry = getVideoEntry(sign);
  return entry?.fallbackEmoji || '✋';
};

/**
 * Check if a video is available for a sign
 */
export const hasVideo = (sign: string): boolean => {
  const entry = getVideoEntry(sign);
  return entry?.videoUrl !== null && entry?.videoUrl !== undefined;
};

/**
 * Get all signs in a category
 */
export const getSignsByCategory = (category: BSLVideoEntry['category']): BSLVideoEntry[] => {
  return Array.from(bslVideoLibrary.values()).filter(entry => entry.category === category);
};

/**
 * Get all available signs
 */
export const getAllSigns = (): string[] => {
  return Array.from(bslVideoLibrary.keys());
};

/**
 * Get library statistics
 */
export const getLibraryStats = () => {
  const entries = Array.from(bslVideoLibrary.values());
  return {
    total: entries.length,
    withVideo: entries.filter(e => e.videoUrl !== null).length,
    categories: {
      alphabet: entries.filter(e => e.category === 'alphabet').length,
      number: entries.filter(e => e.category === 'number').length,
      greeting: entries.filter(e => e.category === 'greeting').length,
      common: entries.filter(e => e.category === 'common').length,
      education: entries.filter(e => e.category === 'education').length,
      question: entries.filter(e => e.category === 'question').length,
      pronoun: entries.filter(e => e.category === 'pronoun').length,
    },
  };
};

export default {
  bslVideoLibrary,
  getVideoEntry,
  getVideoUrl,
  getFallbackEmoji,
  hasVideo,
  getSignsByCategory,
  getAllSigns,
  getLibraryStats,
};
