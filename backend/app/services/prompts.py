"""
Step-specific prompts and context builders for the 4-step KEA pipeline.
"""

from typing import Dict
from app.models.pipeline import Step1Response, Step2Response, Step3Response


# =============================================================================
# STEP PROMPTS
# =============================================================================

STEP1_PROMPT = """Respond in JSON only:
{
  "answer": "your complete answer",
  "confidence": 0.0-1.0,
  "atomic_facts": ["fact1", "fact2", "..."]
}
confidence: 0.95+ certain, 0.85-0.94 high, 0.70-0.84 moderate, <0.70 uncertain
Be calibrated — overconfidence is penalized.
atomic_facts: 3-10 independent verifiable claims from your answer.
Each fact = single statement, true or false on its own.
Respond in user's language."""

STEP2_PROMPT = """You see multiple AI responses to a question. Your task: create an IMPROVED answer combining the best insights.

Respond in JSON only:
{
  "improved_answer": "your synthesized answer",
  "confidence": 0.0-1.0,
  "improvements": ["what you added/fixed", "..."]
}

Rules:
- Take best parts from all responses
- Fix obvious errors if you spot them
- Add missing important details
- Don't just copy — synthesize and improve
- Respond in user's language"""

STEP3_PROMPT = """Evaluate these AI responses to the question. Respond in JSON only:
{
  "ranking": ["best_id", "second_id", "..."],
  "predicted_winner": "id you think OTHERS will rank first",
  "evaluations": {
    "A": {"score": 1-10, "strengths": "...", "weaknesses": "..."},
    "B": {...}
  },
  "flagged_facts": ["questionable claim 1", "..."],
  "consensus_facts": ["agreed by most", "..."]
}

Be critical. Look for:
- Factual errors
- Internal contradictions
- Unsupported claims
- Missing important info"""

STEP4_PROMPT = """You are KEA — the final synthesizer. Create the best possible answer from all inputs.

You receive:
- Original question
- Multiple AI responses with rankings
- Flagged potential errors
- Consensus facts

Respond in JSON:
{
  "final_answer": "your synthesized answer (use markdown formatting)",
  "confidence": 0.0-1.0,
  "sources_used": ["which responses contributed", "..."],
  "excluded": ["what you intentionally left out and why"]
}

Rules:
- Prioritize facts with high agreement
- EXCLUDE anything flagged as potential error
- Be concise but complete
- ALWAYS use markdown in final_answer: headers (##), **bold**, *italic*, bullet lists, numbered lists, `code`
- Respond in user's language"""


# =============================================================================
# CONTEXT BUILDERS
# =============================================================================

def build_step2_context(
    question: str,
    step1_responses: Dict[str, Step1Response],
    provider_to_label: Dict[str, str]
) -> str:
    """
    Build anonymized context for Step 2.
    Each provider sees all Step 1 responses labeled A, B, C... without knowing who wrote them.
    """
    context = f"Original Question: {question}\n\n"
    context += "=== AI Responses ===\n\n"

    for provider, response in step1_responses.items():
        label = provider_to_label.get(provider, provider)
        context += f"Response {label}:\n"
        context += f"Answer: {response.answer}\n"
        context += f"Confidence: {response.confidence}\n"
        if response.atomic_facts:
            context += f"Key Facts: {', '.join(response.atomic_facts)}\n"
        context += "\n"

    return context


def build_step3_context(
    question: str,
    step2_responses: Dict[str, Step2Response],
    provider_to_label: Dict[str, str]
) -> str:
    """
    Build anonymized context for Step 3.
    Each provider evaluates all Step 2 responses.
    """
    context = f"Original Question: {question}\n\n"
    context += "=== Improved AI Responses ===\n\n"

    for provider, response in step2_responses.items():
        label = provider_to_label.get(provider, provider)
        context += f"Response {label}:\n"
        context += f"Answer: {response.improved_answer}\n"
        context += f"Confidence: {response.confidence}\n"
        if response.improvements:
            context += f"Improvements Made: {', '.join(response.improvements)}\n"
        context += "\n"

    return context


def build_step4_context(
    question: str,
    step2_responses: Dict[str, Step2Response],
    step3_responses: Dict[str, Step3Response],
    provider_to_label: Dict[str, str]
) -> str:
    """
    Build comprehensive context for final synthesis.
    Includes: improved responses, aggregated rankings, flagged facts, consensus facts.
    """
    # Aggregate all flagged and consensus facts
    all_flagged = set()
    all_consensus = set()
    rankings_summary = []

    for evaluator, eval_response in step3_responses.items():
        evaluator_label = provider_to_label.get(evaluator, evaluator)
        if eval_response.ranking:
            rankings_summary.append(f"{evaluator_label}: {' > '.join(eval_response.ranking)}")
        all_flagged.update(eval_response.flagged_facts)
        all_consensus.update(eval_response.consensus_facts)

    # Build context
    context = f"Original Question: {question}\n\n"

    context += "=== Improved Responses ===\n\n"
    for provider, response in step2_responses.items():
        label = provider_to_label.get(provider, provider)
        context += f"Response {label}:\n"
        context += f"{response.improved_answer}\n"
        context += f"Confidence: {response.confidence}\n\n"

    context += "=== Peer Rankings ===\n"
    if rankings_summary:
        context += "\n".join(rankings_summary)
    else:
        context += "No rankings available"
    context += "\n\n"

    context += "=== Flagged as Potentially Incorrect ===\n"
    if all_flagged:
        context += "\n".join(f"- {fact}" for fact in all_flagged)
    else:
        context += "None"
    context += "\n\n"

    context += "=== Consensus Facts (Agreed by Most) ===\n"
    if all_consensus:
        context += "\n".join(f"- {fact}" for fact in all_consensus)
    else:
        context += "None"

    return context
