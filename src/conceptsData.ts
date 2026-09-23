/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The default concepts glossary is ~280KB of JSON covering 700+ AWS terms.
// Loaded lazily (see loadDefaultConcepts) so it doesn't inflate the initial
// JS bundle for users who never open the "Tarjetas Conceptos" tab.
export interface ConceptCard {
  concept: string;
  definition: string;
  question_reference?: number;
}

let cachedConcepts: ConceptCard[] | null = null;

export async function loadDefaultConcepts(): Promise<ConceptCard[]> {
  if (cachedConcepts) return cachedConcepts;
  const mod = await import("./conceptsData.json");
  const data = (mod as any).default ?? mod;
  cachedConcepts = (data as { concepts: ConceptCard[] }).concepts;
  return cachedConcepts;
}
