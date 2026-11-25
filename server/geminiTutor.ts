import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { buildTutorSystemPrompt } from '../src/shared/tutorLogic.ts';
import type {
  ChatMessage,
  ConceptDiagram,
  LearningMode,
  QuizQuestion,
  SkillLevel,
  Subject,
  SuggestedFlashcard,
  TutorAttachment,
} from '../src/shared/types.ts';

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  if (cachedClient && cachedApiKey === apiKey) {
    return cachedClient;
  }
  cachedApiKey = apiKey;
  cachedClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return cachedClient;
}

export interface TutorModelOutput {
  reply: string;
  conceptTag?: string;
  guidingQuestion?: string;
  quickReplies?: string[];
  diagram?: ConceptDiagram;
  quiz?: QuizQuestion[];
  suggestedFlashcard?: SuggestedFlashcard;
  progressSignal?: 'none' | 'needs_review' | 'mastered';
}

function parseDataUrlToInlineData(
  dataUrl: string,
  fallbackMime: string
): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1] || fallbackMime,
    data: match[2],
  };
}

export async function generateTutorTurn(params: {
  subject: Subject;
  level: SkillLevel;
  mode: LearningMode;
  stuckCount: number;
  currentConcept?: string;
  scratchpad: string;
  history: ChatMessage[];
  userPrompt: string;
  attachment?: TutorAttachment;
}): Promise<TutorModelOutput> {
  const ai = getGeminiClient();

  const systemInstruction = buildTutorSystemPrompt({
    subject: params.subject,
    level: params.level,
    mode: params.mode,
    stuckCount: params.stuckCount,
    currentConcept: params.currentConcept,
  });

  // Keep context concise (last 6 messages) for lower latency
  const recentHistory = params.history
    .slice(-6)
    .map((msg) => {
      const content = String(msg.content ?? '').slice(0, 360);
      const q = msg.guidingQuestion
        ? ` (Asked: ${String(msg.guidingQuestion).slice(0, 160)})`
        : '';
      return `${msg.role === 'student' ? msg.senderName : 'Tutor'} [${msg.mode}]: ${content}${q}`;
    })
    .join('\n');

  const contextSections: string[] = [];
  if (recentHistory) {
    contextSections.push(`Recent conversation:\n${recentHistory}`);
  }
  if (params.scratchpad.trim()) {
    contextSections.push(
      `Student's shared notes:\n"""\n${params.scratchpad.trim().slice(0, 4000)}\n"""`
    );
  }
  if (params.attachment?.textPreview) {
    contextSections.push(
      `Uploaded text file (${params.attachment.name}):\n"""\n${params.attachment.textPreview.slice(0, 4000)}\n"""`
    );
  }

  const promptText = [
    ...contextSections,
    `Student's current message:\n${params.userPrompt}`,
  ].join('\n\n');

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (params.attachment?.dataUrl) {
    const inline = parseDataUrlToInlineData(
      params.attachment.dataUrl,
      params.attachment.mimeType
    );
    if (inline) {
      parts.push({ inlineData: inline });
    }
  }
  parts.push({ text: promptText });

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      reply: {
        type: Type.STRING,
        description:
          'Short 1-2 sentence feedback or explanation without stacking questions.',
      },
      guidingQuestion: {
        type: Type.STRING,
        description:
          'ONE single, small, easy-to-answer question for the student to tackle next.',
      },
      quickReplies: {
        type: Type.ARRAY,
        description:
          '2 to 4 short clickable response prompts (2-7 words each).',
        items: { type: Type.STRING },
      },
      conceptTag: {
        type: Type.STRING,
        description: 'Short 2-5 word topic name.',
      },
      progressSignal: {
        type: Type.STRING,
        enum: ['none', 'needs_review', 'mastered'],
      },
      diagram: {
        type: Type.OBJECT,
        description: 'Populate ONLY in Explain It mode when helpful.',
        properties: {
          title: { type: Type.STRING },
          diagramType: {
            type: Type.STRING,
            enum: ['flowchart', 'comparison', 'steps'],
          },
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                detail: { type: Type.STRING },
              },
              required: ['id', 'label', 'detail'],
            },
          },
          edges: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                from: { type: Type.STRING },
                to: { type: Type.STRING },
                label: { type: Type.STRING },
              },
              required: ['from', 'to'],
            },
          },
        },
        required: ['title', 'diagramType', 'nodes'],
      },
      quiz: {
        type: Type.ARRAY,
        description: 'Populate ONLY in Quick Quiz mode with 3 to 4 questions.',
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
            concept: { type: Type.STRING },
          },
          required: [
            'id',
            'question',
            'options',
            'correctIndex',
            'explanation',
            'concept',
          ],
        },
      },
      suggestedFlashcard: {
        type: Type.OBJECT,
        properties: {
          front: { type: Type.STRING },
          back: { type: Type.STRING },
          topic: { type: Type.STRING },
        },
        required: ['front', 'back', 'topic'],
      },
    },
    required: ['reply', 'guidingQuestion', 'quickReplies', 'conceptTag', 'progressSignal'],
  };

  let responseText = '';
  const attempts: Array<{ model: string; useThinking: boolean; delayMs: number }> = [
    { model: 'gemini-4-hydrogen', useThinking: true, delayMs: 250 },
    { model: 'gemini-3.1-flash-lite', useThinking: false, delayMs: 350 },
    { model: 'gemini-4-hydrogen', useThinking: true, delayMs: 0 },
  ];

  for (let i = 0; i < attempts.length; i += 1) {
    const { model, useThinking, delayMs } = attempts[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          ...(useThinking
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      });
      responseText = (response.text ?? '').trim();
      if (responseText) break;
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const isTransient =
        /503|429|UNAVAILABLE|high demand|RESOURCE_EXHAUSTED|overloaded|timeout/i.test(
          rawMsg
        );
      if (isTransient && i < attempts.length - 1) {
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
        continue;
      }
      if (isTransient) {
        throw new Error(
          'The tutor is briefly busy right now. Please tap Send again in a moment.'
        );
      }
      throw err instanceof Error
        ? err
        : new Error('Unable to reach the tutoring service right now.');
    }
  }

  const rawText = responseText;
  if (!rawText) {
    throw new Error('The tutor model returned an empty response.');
  }

  let parsed: TutorModelOutput;
  try {
    parsed = JSON.parse(rawText) as TutorModelOutput;
  } catch {
    parsed = {
      reply: rawText,
      conceptTag: params.currentConcept || params.subject,
      progressSignal: 'none',
    };
  }

  parsed.reply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : 'Let us take this one step at a time.';

  if (typeof parsed.guidingQuestion === 'string') {
    parsed.guidingQuestion = parsed.guidingQuestion.trim() || undefined;
  } else {
    parsed.guidingQuestion = undefined;
  }

  if (Array.isArray(parsed.quickReplies)) {
    const seen = new Set<string>();
    parsed.quickReplies = parsed.quickReplies
      .map((item) => (typeof item === 'string' ? item.trim().slice(0, 90) : ''))
      .filter((item) => {
        if (!item || seen.has(item.toLowerCase())) return false;
        seen.add(item.toLowerCase());
        return true;
      })
      .slice(0, 4);
  } else {
    parsed.quickReplies = undefined;
  }

  if (parsed.diagram && Array.isArray(parsed.diagram.nodes)) {
    parsed.diagram = {
      title: String(parsed.diagram.title || 'Visual Guide'),
      diagramType:
        parsed.diagram.diagramType === 'flowchart' ||
        parsed.diagram.diagramType === 'comparison' ||
        parsed.diagram.diagramType === 'steps'
          ? parsed.diagram.diagramType
          : 'steps',
      nodes: parsed.diagram.nodes
        .filter((n) => n && (n.label || n.detail))
        .map((n, idx) => ({
          id: String(n.id || `node_${idx}`),
          label: String(n.label || `Step ${idx + 1}`),
          detail: String(n.detail || ''),
        })),
      edges: Array.isArray(parsed.diagram.edges) ? parsed.diagram.edges : [],
    };
  } else {
    parsed.diagram = undefined;
  }

  if (parsed.quiz && Array.isArray(parsed.quiz)) {
    parsed.quiz = parsed.quiz
      .slice(0, 5)
      .filter(
        (q) =>
          q &&
          typeof q.question === 'string' &&
          Array.isArray(q.options) &&
          q.options.length >= 2
      )
      .map((q, idx) => {
        const cleanOptions = q.options.slice(0, 5).map((opt) => String(opt));
        return {
          id: q.id || `q_${Date.now()}_${idx}`,
          question: String(q.question),
          options: cleanOptions,
          correctIndex:
            typeof q.correctIndex === 'number' &&
            q.correctIndex >= 0 &&
            q.correctIndex < cleanOptions.length
              ? q.correctIndex
              : 0,
          explanation:
            typeof q.explanation === 'string' && q.explanation.trim()
              ? q.explanation.trim()
              : 'Review this step together with your notes.',
          concept:
            typeof q.concept === 'string' && q.concept.trim()
              ? q.concept.trim()
              : parsed.conceptTag || params.subject,
        };
      });
  }

  if (
    !parsed.suggestedFlashcard ||
    typeof parsed.suggestedFlashcard.front !== 'string' ||
    typeof parsed.suggestedFlashcard.back !== 'string' ||
    !parsed.suggestedFlashcard.front.trim() ||
    !parsed.suggestedFlashcard.back.trim()
  ) {
    parsed.suggestedFlashcard = undefined;
  }

  return parsed;
}
