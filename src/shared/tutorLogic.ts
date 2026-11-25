import type {
  AuthProvider,
  LearningMode,
  QuizQuestion,
  SkillLevel,
  Subject,
} from './types';

export const SUBJECTS: readonly Subject[] = [
  'Math',
  'Science',
  'Writing',
  'Coding',
  'Language',
  'History',
] as const;

export const SKILL_LEVELS: readonly SkillLevel[] = [
  'Elementary',
  'Middle School',
  'High School',
  'College',
  'Adult Learner',
] as const;

export const LEARNING_MODES: readonly {
  id: LearningMode;
  label: string;
  shortDesc: string;
}[] = [
  {
    id: 'socratic',
    label: 'Step-by-Step',
    shortDesc: 'Hints and guiding questions',
  },
  {
    id: 'explainer',
    label: 'Explain It',
    shortDesc: 'Simple examples and diagrams',
  },
  {
    id: 'quiz',
    label: 'Quick Quiz',
    shortDesc: '3 to 5 practice questions',
  },
] as const;

const LEVEL_GUIDANCE: Record<SkillLevel, string> = {
  Elementary:
    'Use simple, everyday words and short sentences with familiar examples (like sharing pizza slices or counting blocks). Explain any new word right away.',
  'Middle School':
    'Use clear, friendly words and short steps that connect real-life examples to new ideas like ratios, variables, and basic science. Explain any school term in plain language.',
  'High School':
    'Use clear, everyday wording. Explain formulas and rules in plain English before using formal terms, and guide the student to reason through each step.',
  College:
    'Use clear, approachable wording while keeping key course terms accurate. Break big ideas into simple parts before going deeper.',
  'Adult Learner':
    'Keep explanations clear, practical, and direct. Connect ideas to everyday life or work without heavy jargon.',
};

const MODE_GUIDANCE: Record<LearningMode, string> = {
  socratic: [
    'MODE: STEP-BY-STEP TUTOR.',
    '1. NEVER give the final answer right away when a student shares a problem, essay prompt, or bug.',
    '2. Keep `reply` super short (1 to 2 plain sentences): briefly praise what they tried or name the main idea.',
    '3. Put ONLY ONE small, easy-to-answer question in `guidingQuestion`. NEVER stack 2 or 3 questions in one turn—split big problems into one tiny step at a time.',
    '4. Fill `quickReplies` with 3 short clickable reply options (2 to 7 words each) so the student can tap an answer easily (include 2 realistic step guesses and 1 option like "Give me a smaller hint").',
  ].join('\n'),
  explainer: [
    'MODE: EXPLAIN IT.',
    '1. Explain the idea from scratch in 2 to 3 short sentences using an everyday example anyone can picture.',
    '2. Fill in the `diagram` field with a simple 3-to-5 step visual chart showing how the parts fit together.',
    '3. Put ONE quick check-in question in `guidingQuestion` and 3 short `quickReplies` options so it is easy to respond.',
  ].join('\n'),
  quiz: [
    'MODE: QUICK QUIZ.',
    '1. Create a 3-to-5 question multiple-choice quiz in the `quiz` field based on the current topic or notes.',
    '2. Give each question 4 realistic choices, the zero-based `correctIndex`, a short friendly `explanation` in plain words, and a short `concept` name.',
    '3. Keep `reply` brief (1 short sentence), put a short prompt in `guidingQuestion` (like "Start with Question 1 above!"), and leave `quickReplies` concise.',
  ].join('\n'),
};

export function getDefaultQuickReplies(
  mode: LearningMode,
  subject: Subject
): string[] {
  if (mode === 'explainer') {
    return [
      `Give a real-life ${subject} example`,
      'Walk me through step by step',
      'Quiz me on this',
    ];
  }
  if (mode === 'quiz') {
    return [
      'Explain the missed question',
      'Make an easier quiz',
      'Switch to Step-by-Step',
    ];
  }
  return [
    'Help me with the first step',
    'Give me a smaller hint',
    'Show a similar example',
  ];
}

export function buildTutorSystemPrompt(params: {
  subject: Subject;
  level: SkillLevel;
  mode: LearningMode;
  stuckCount: number;
  currentConcept?: string;
}): string {
  const { subject, level, mode, stuckCount, currentConcept } = params;

  const stuckInstruction =
    stuckCount >= 2
      ? 'IMPORTANT HELP RULE: The student felt stuck twice in a row. Give a much smaller, easier hint or a quick simple example in `reply`, and make `guidingQuestion` a very simple either/or or multiple-choice-style question.'
      : '';

  const conceptLine = currentConcept
    ? `Current topic: ${currentConcept}.`
    : 'Spot the main idea from what the student shared.';

  return [
    `You are Abundant Knowledge, a warm, human-sounding tutor helping a ${level} student with ${subject}.`,
    conceptLine,
    LEVEL_GUIDANCE[level],
    MODE_GUIDANCE[mode],
    stuckInstruction,
    'TONE & QUESTION-SPLITTING RULES:',
    '- Write naturally like a real tutor sitting beside the student.',
    '- Use plain, everyday words and short sentences. Avoid big academic words or jargon unless the student asks for them.',
    '- NEVER ask multiple questions at once. Split multi-part questions so the student only has to answer ONE small thing per message, placed in `guidingQuestion`.',
    '- Do NOT repeat `guidingQuestion` at the end of `reply`—keep feedback/explanation in `reply` and the single question in `guidingQuestion`.',
    '- Always provide 2 to 4 short `quickReplies` so students who feel unsure can tap a starting response right away.',
    '- NEVER use robotic filler phrases like "Certainly!", "Of course!", "Delve into", "Great question!", "As an AI", or "Let us embark".',
    '- Avoid heavy bold text (at most 1-2 short phrases) and avoid walls of bullet points.',
    '- If the student sends a photo, PDF, or camera snapshot of handwritten work, read it closely, point out what they already did right, and guide them on the next single step.',
    '- When you cover a key takeaway worth saving, you may include `suggestedFlashcard` with a short front and back.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

const STRUGGLE_PATTERNS = [
  /\bi\s*(don'?t|do\s*not)\s*know\b/i,
  /\bi'?m\s*stuck\b/i,
  /\bstuck\b/i,
  /\bno\s*idea\b/i,
  /\bconfused\b/i,
  /\bnot\s*sure\b/i,
  /\bcan'?t\s*figure\b/i,
  /\bhelp\s*me\b/i,
  /\bgive\s*(me\s*)?(a\s*)?hint\b/i,
];

export function detectStudentStruggle(messageText: string): boolean {
  const trimmed = messageText.trim();
  if (!trimmed) return false;
  return STRUGGLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export interface GradedQuestionResult {
  questionId: string;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  concept: string;
  explanation: string;
}

export interface QuizGradeReport {
  score: number;
  total: number;
  percentage: number;
  perQuestion: GradedQuestionResult[];
  topicsMastered: string[];
  conceptsToReview: string[];
  feedbackSummary: string;
}

export function gradePracticeQuiz(
  questions: QuizQuestion[],
  selectedAnswers: Record<string, number>
): QuizGradeReport {
  const total = questions.length;
  if (total === 0) {
    return {
      score: 0,
      total: 0,
      percentage: 0,
      perQuestion: [],
      topicsMastered: [],
      conceptsToReview: [],
      feedbackSummary: 'No quiz questions were present to grade.',
    };
  }

  let score = 0;
  const masteredSet = new Set<string>();
  const reviewSet = new Set<string>();

  const perQuestion: GradedQuestionResult[] = questions.map((q) => {
    const raw = selectedAnswers[q.id];
    const selectedIndex =
      typeof raw === 'number' && Number.isInteger(raw) ? raw : null;
    const isCorrect = selectedIndex === q.correctIndex;
    if (isCorrect) {
      score += 1;
      masteredSet.add(q.concept);
    } else {
      reviewSet.add(q.concept);
    }
    return {
      questionId: q.id,
      selectedIndex,
      correctIndex: q.correctIndex,
      isCorrect,
      concept: q.concept,
      explanation: q.explanation,
    };
  });

  // If any concept had both right and wrong answers, keep it in review so the student reinforces it
  for (const concept of reviewSet) {
    masteredSet.delete(concept);
  }

  const percentage = Math.round((score / total) * 100);
  let feedbackSummary = '';
  if (percentage === 100) {
    feedbackSummary = `Great job! You got all ${total} questions right.`;
  } else if (percentage >= 60) {
    feedbackSummary = `Nice work! You got ${score} out of ${total} right. Let's look at the one you missed together.`;
  } else {
    feedbackSummary = `You got ${score} out of ${total} this round. Want to walk through the first missed question step by step?`;
  }

  return {
    score,
    total,
    percentage,
    perQuestion,
    topicsMastered: Array.from(masteredSet),
    conceptsToReview: Array.from(reviewSet),
    feedbackSummary,
  };
}

export function validateAuthInput(input: {
  provider: AuthProvider;
  name?: string;
  email?: string;
}): { valid: boolean; error?: string; normalizedName: string; normalizedEmail?: string } {
  if (input.provider === 'guest') {
    const cleanName = (input.name ?? '').trim() || 'Guest Learner';
    return {
      valid: true,
      normalizedName: cleanName.slice(0, 60),
    };
  }

  const cleanName = (input.name ?? '').trim();
  const cleanEmail = (input.email ?? '').trim().toLowerCase();

  if (!cleanName || cleanName.length < 2) {
    return {
      valid: false,
      error: 'Please enter your name (at least 2 characters).',
      normalizedName: '',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return {
      valid: false,
      error: `Please enter a valid ${input.provider === 'google' ? 'Google' : 'Microsoft / Outlook'} email address.`,
      normalizedName: cleanName.slice(0, 60),
    };
  }

  return {
    valid: true,
    normalizedName: cleanName.slice(0, 60),
    normalizedEmail: cleanEmail.slice(0, 120),
  };
}

export function sanitizeSessionCode(raw: string): string | null {
  const trimmed = raw.trim();
  // Accept full share URLs or raw numeric session codes
  const matchFromUrl = trimmed.match(/[?&]session=(\d{4,12})(?:&|$)/);
  const candidate = matchFromUrl ? matchFromUrl[1] : trimmed;
  if (/^\d{4,12}$/.test(candidate)) {
    return candidate;
  }
  return null;
}

