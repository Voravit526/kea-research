/**
 * TypeScript interfaces for the 4-step KEA pipeline.
 */

// =============================================================================
// STEP RESPONSE DATA
// =============================================================================

export interface Step1Data {
  provider: string;
  answer: string;
  confidence: number;
  atomic_facts: string[];
}

export interface Step2Data {
  provider: string;
  improved_answer: string;
  confidence: number;
  improvements: string[];
}

export interface ProviderEvaluation {
  score: number;
  strengths: string;
  weaknesses: string;
}

export interface Step3Data {
  provider: string;
  ranking: string[];
  predicted_winner: string;
  evaluations: Record<string, ProviderEvaluation>;
  flagged_facts: string[];
  consensus_facts: string[];
  raw_response?: string; // Preserve raw text for fallback display
}

export interface Step4Data {
  provider: string;
  final_answer: string;
  confidence: number;
  sources_used: string[];
  excluded: string[];
}

// =============================================================================
// PIPELINE STATE
// =============================================================================

export interface PipelineState {
  currentStep: number;
  step1Responses: Record<string, Step1Data>;
  step2Responses: Record<string, Step2Data>;
  step3Responses: Record<string, Step3Data>;
  step4Response: Step4Data | null;
  isComplete: boolean;
  errors: Record<string, string[]>;
  synthesizer: string | null;
}

// =============================================================================
// SSE EVENT TYPES
// =============================================================================

export interface StepStartEvent {
  provider: string;
  step: number;
  name: string;
}

export interface StepCompleteEvent {
  provider: string;
  step: number;
  count?: number;
  has_response?: boolean;
}

export interface ChunkEvent {
  provider: string;
  content: string;
}

export interface StepDoneEvent {
  provider: string;
  success: boolean;
  confidence?: number;
  facts_count?: number;
  ranking?: string[];
  flagged_count?: number;
  final_answer?: string;
}

export interface ErrorEvent {
  provider: string;
  error: string;
  message?: string;
}

export interface SynthesizerEvent {
  provider: string;
  label: string;
}

export interface PipelineCompleteEvent {
  provider: string;
  step1_count: number;
  step2_count: number;
  step3_count: number;
  has_final: boolean;
  final_answer: string | null;
  final_confidence: number | null;
  synthesizer_provider: string | null;
  errors: Record<string, string[]>;
}

// =============================================================================
// PROVIDER CONFIG (re-exported from constants.ts for backward compatibility)
// =============================================================================

export { PROVIDER_CONFIG, type ProviderConfig } from './constants';

// =============================================================================
// STEP NAMES
// =============================================================================

export const STEP_NAMES: Record<number, string> = {
  1: 'Initial Responses',
  2: 'MoA Refinement',
  3: 'Peer Evaluation',
  4: 'KEA Synthesis',
};

export const STEP_BADGES: Record<number, string> = {
  1: '1. Initial',
  2: '2. Refine',
  3: '3. Evaluate',
  4: '4. Synthesize',
};
