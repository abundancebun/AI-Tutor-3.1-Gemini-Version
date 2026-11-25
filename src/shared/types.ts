export type Subject =
  | 'Math'
  | 'Science'
  | 'Writing'
  | 'Coding'
  | 'Language'
  | 'History';

export type SkillLevel =
  | 'Elementary'
  | 'Middle School'
  | 'High School'
  | 'College'
  | 'Adult Learner';

export type LearningMode = 'socratic' | 'explainer' | 'quiz';

export type AuthProvider = 'google' | 'microsoft' | 'guest';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  provider: AuthProvider;
  createdAt: number;
}

export interface ConceptDiagramNode {
  id: string;
  label: string;
  detail: string;
}

export interface ConceptDiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ConceptDiagram {
  title: string;
  diagramType: 'flowchart' | 'comparison' | 'steps';
  nodes: ConceptDiagramNode[];
  edges?: ConceptDiagramEdge[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  concept: string;
}

export interface QuizSubmission {
  answers: Record<string, number>;
  score: number;
  total: number;
  submittedAt: number;
  submittedBy: string;
}

export interface TutorAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl?: string;
  textPreview?: string;
  source: 'upload' | 'camera-snap' | 'live-frame';
}

export interface SuggestedFlashcard {
  front: string;
  back: string;
  topic: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  role: 'student' | 'tutor';
  content: string;
  mode: LearningMode;
  timestamp: number;
  attachment?: TutorAttachment;
  diagram?: ConceptDiagram;
  quiz?: QuizQuestion[];
  quizSubmission?: QuizSubmission;
  conceptTag?: string;
  guidingQuestion?: string;
  quickReplies?: string[];
  suggestedFlashcard?: SuggestedFlashcard;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  topic: string;
  subject: Subject;
  createdAt: number;
}

export interface TopicProgress {
  id: string;
  topic: string;
  subject: Subject;
  status: 'mastered' | 'review';
  masteryScore: number;
  updatedAt: number;
}

export interface UserProgress {
  topics: TopicProgress[];
  flashcards: Flashcard[];
}

export interface Participant {
  id: string;
  name: string;
  provider: AuthProvider;
  role: 'host' | 'peer';
  joinedAt: number;
  online: boolean;
}

export interface TutorSession {
  id: string;
  title: string;
  subject: Subject;
  level: SkillLevel;
  mode: LearningMode;
  scratchpad: string;
  hostId: string;
  participants: Participant[];
  messages: ChatMessage[];
  stuckCount: number;
  currentConcept?: string;
  createdAt: number;
  updatedAt: number;
}
