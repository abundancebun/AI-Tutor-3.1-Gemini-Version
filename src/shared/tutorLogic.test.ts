import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTutorSystemPrompt,
  detectStudentStruggle,
  getDefaultQuickReplies,
  gradePracticeQuiz,
  sanitizeSessionCode,
  SKILL_LEVELS,
  validateAuthInput,
} from './tutorLogic';
import type { QuizQuestion } from './types';

test('buildTutorSystemPrompt adapts to Step-by-Step mode and enforces one question per turn', () => {
  const prompt = buildTutorSystemPrompt({
    subject: 'Math',
    level: 'High School',
    mode: 'socratic',
    stuckCount: 0,
    currentConcept: 'Linear Equations',
  });

  assert.match(prompt, /NEVER give the final answer right away/);
  assert.match(prompt, /NEVER ask multiple questions at once/);
  assert.match(prompt, /guidingQuestion/);
  assert.match(prompt, /quickReplies/);
  assert.match(prompt, /High School/);
  assert.match(prompt, /Linear Equations/);
  assert.match(prompt, /NEVER use robotic filler phrases/);
});

test('getDefaultQuickReplies provides subject and mode tailored response prompts', () => {
  const socraticPrompts = getDefaultQuickReplies('socratic', 'Math');
  assert.equal(socraticPrompts.length, 3);
  const explainerPrompts = getDefaultQuickReplies('explainer', 'Science');
  assert.match(explainerPrompts[0], /Science/);
});

test('SKILL_LEVELS includes Middle School and prompt adapts for it', () => {
  assert.equal(SKILL_LEVELS.includes('Middle School'), true);
  const prompt = buildTutorSystemPrompt({
    subject: 'Science',
    level: 'Middle School',
    mode: 'socratic',
    stuckCount: 0,
  });
  assert.match(prompt, /Middle School/);
  assert.match(prompt, /plain language/);
});

test('buildTutorSystemPrompt triggers simpler hint after 2 stuck turns', () => {
  const prompt = buildTutorSystemPrompt({
    subject: 'Coding',
    level: 'Elementary',
    mode: 'socratic',
    stuckCount: 2,
  });

  assert.match(prompt, /stuck twice in a row/);
  assert.match(prompt, /much smaller, easier hint/);
  assert.match(prompt, /sharing pizza slices/);
});

test('detectStudentStruggle recognizes confusion phrases accurately', () => {
  assert.equal(detectStudentStruggle("I don't know where to start"), true);
  assert.equal(detectStudentStruggle("I'm stuck on step 2"), true);
  assert.equal(detectStudentStruggle('Could you give me a hint?'), true);
  assert.equal(detectStudentStruggle('I think we subtract 5 from both sides'), false);
  assert.equal(detectStudentStruggle('   '), false);
});

test('gradePracticeQuiz scores answers and partitions mastered vs review concepts', () => {
  const questions: QuizQuestion[] = [
    {
      id: 'q1',
      question: 'What is the first step in 2x + 5 = 15?',
      options: ['Divide by 2', 'Subtract 5 from both sides', 'Add 5', 'Multiply by 2'],
      correctIndex: 1,
      explanation: 'Isolate the variable term by undoing +5 first.',
      concept: 'Inverse Operations',
    },
    {
      id: 'q2',
      question: 'If 2x = 10, what is x?',
      options: ['20', '8', '5', '2'],
      correctIndex: 2,
      explanation: 'Divide both sides by 2 to get x = 5.',
      concept: 'Solving One-Step Equations',
    },
    {
      id: 'q3',
      question: 'Which property keeps both sides equal when subtracting 5?',
      options: ['Distributive', 'Subtraction Property of Equality', 'Commutative', 'Associative'],
      correctIndex: 1,
      explanation: 'Doing the same operation to both sides preserves equality.',
      concept: 'Inverse Operations',
    },
  ];

  const report = gradePracticeQuiz(questions, { q1: 1, q2: 0, q3: 1 });
  assert.equal(report.score, 2);
  assert.equal(report.total, 3);
  assert.equal(report.percentage, 67);
  assert.deepEqual(report.topicsMastered, ['Inverse Operations']);
  assert.deepEqual(report.conceptsToReview, ['Solving One-Step Equations']);
});

test('validateAuthInput enforces valid emails for Google/Microsoft and allows Guest', () => {
  const guest = validateAuthInput({ provider: 'guest' });
  assert.equal(guest.valid, true);
  assert.equal(guest.normalizedName, 'Guest Learner');

  const badGoogle = validateAuthInput({
    provider: 'google',
    name: 'Sam',
    email: 'not-an-email',
  });
  assert.equal(badGoogle.valid, false);

  const validMs = validateAuthInput({
    provider: 'microsoft',
    name: '  Maya Lin ',
    email: 'Maya.Lin@outlook.com',
  });
  assert.equal(validMs.valid, true);
  assert.equal(validMs.normalizedName, 'Maya Lin');
  assert.equal(validMs.normalizedEmail, 'maya.lin@outlook.com');
});

test('sanitizeSessionCode extracts numeric-only codes from share URLs or raw input', () => {
  assert.equal(
    sanitizeSessionCode('https://example.com/?session=482910'),
    '482910'
  );
  assert.equal(sanitizeSessionCode('  904215  '), '904215');
  assert.equal(sanitizeSessionCode('math-group-101'), null);
  assert.equal(sanitizeSessionCode('a3f90b12'), null);
  assert.equal(sanitizeSessionCode('123'), null);
  assert.equal(sanitizeSessionCode('482 910'), null);
});

