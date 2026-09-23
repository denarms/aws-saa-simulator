/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Option {
  key: string; // "A", "B", "C", "D", "E", etc.
  text: string;
  text_esp?: string;
}

export interface Question {
  id?: string; // Client-side generated unique ID
  question_number: number;
  is_multiple_choice: boolean;
  question: string;
  options: Option[];
  correct_answers: string[]; // e.g. ["A"], ["A", "B"]
  
  // Optional translation properties for "Mix" or dual translation
  translated_question?: string;
  translated_options?: Option[];
  question_esp?: string; // Embedded Spanish translation
  explanation?: string; // Optional detailed explanation
}

export interface QuizProgress {
  currentQuestionIndex: number;
  selectedAnswers: { [questionIdOrIndex: string]: string[] }; // Map of question index/ID to keys selected
  submittedAnswers: { [questionIdOrIndex: string]: boolean }; // Map of whether answer was submitted for feedback
  score: {
    correct: number;
    incorrect: number;
    totalAnswered: number;
  };
  timeRemaining?: number; // In seconds
  examDuration?: number; // Initial time
}

export type QuizLanguage = "en" | "es" | "mix";

export type QuizMode = "practice" | "exam";

export interface ExplanationPayload {
  question: string;
  options: Option[];
  correctAnswers: string[];
  selectedAnswers?: string[];
  language: QuizLanguage;
}

export interface GeneratePayload {
  topic: string;
  language: QuizLanguage;
}

// A single completed exam/practice attempt, kept for the history & stats view.
export interface ExamHistoryEntry {
  id: string;
  date: string; // ISO timestamp
  mode: QuizMode;
  language: QuizLanguage;
  total: number;
  answered: number;
  correct: number;
  percent: number;
  passed: boolean;
  durationSeconds?: number; // Time actually spent, when known (exam mode)
}

export interface PersistedSettings {
  quizLanguage: QuizLanguage;
  timerDuration: number;
  examQuestionCount: number;
  randomizeQuestions: boolean;
}
