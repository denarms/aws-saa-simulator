/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question } from "./types";

// The demo question bank is ~6MB of JSON. It used to be a static import,
// which meant it was parsed and shipped inside the app's main JS bundle on
// *every* page load, even for users who never click "Cargar Set Demo".
// Loading it lazily via dynamic import() lets bundlers split it into its
// own chunk that's only fetched the first time it's actually needed.
function normalizeSampleQuestions(raw: any[]): Question[] {
  return raw.map((item, idx) => {
    const qEsp = item.question_esp || item.translated_question || undefined;
    const opts = Array.isArray(item.options) ? item.options.map((opt: any) => ({
      key: opt.key || String.fromCharCode(65 + idx),
      text: opt.text || "",
      text_esp: opt.text_esp || undefined
    })) : [];

    let trOpts = item.translated_options;
    if (!trOpts && opts.some((o: any) => o.text_esp)) {
      trOpts = opts.map((o: any) => ({
        key: o.key,
        text: o.text_esp || o.text
      }));
    }

    return {
      id: item.id || `sample-${idx + 1}`,
      question_number: item.question_number || (idx + 1),
      is_multiple_choice: item.is_multiple_choice !== undefined ? item.is_multiple_choice : (item.correct_answers && item.correct_answers.length > 1),
      question: item.question || "",
      options: opts,
      correct_answers: Array.isArray(item.correct_answers) ? item.correct_answers.map((a: any) => String(a).trim().toUpperCase()) : [],
      question_esp: qEsp,
      translated_question: qEsp,
      translated_options: trOpts,
      explanation: item.explanation || item.feedback || item.retroalimentacion || ""
    };
  });
}

let cachedSampleQuestions: Question[] | null = null;

export async function loadSampleQuestions(): Promise<Question[]> {
  if (cachedSampleQuestions) return cachedSampleQuestions;
  const mod = await import("./sampleQuestions.json");
  const raw = (mod as any).default ?? (mod as unknown as any[]);
  cachedSampleQuestions = normalizeSampleQuestions(raw);
  return cachedSampleQuestions;
}
