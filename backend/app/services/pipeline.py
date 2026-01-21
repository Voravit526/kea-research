"""
4-Step Pipeline Orchestrator for KEA.

Runs the complete pipeline:
Step 1: Initial Responses (parallel) - Independent answers with confidence + atomic facts
Step 2: MoA Refinement (parallel) - Each provider sees all Step 1, creates improved answer
Step 3: Peer Evaluation (parallel) - Ranking, fact verification, flagging
Step 4: KEA Synthesis (single) - Final answer from best-ranked provider
"""

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

import orjson

from app.models.pipeline import (
    PipelineState,
    PipelineSummary,
    ProviderEvaluation,
    Step1Response,
    Step2Response,
    Step3Response,
    Step4Response,
)
from app.providers.base import BaseProvider
from app.providers.registry import provider_registry
from app.services.prompts import (
    STEP1_PROMPT,
    STEP2_PROMPT,
    STEP3_PROMPT,
    STEP4_PROMPT,
    build_step2_context,
    build_step3_context,
    build_step4_context,
)
from app.config import settings
from app.utils.sse import format_pipeline_sse
from app.utils.normalize import normalize_string_list, normalize_to_string, repair_llm_json
from app.utils.message_helpers import extract_text_only, has_images

logger = logging.getLogger(__name__)

# Constants
PROVIDER_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
# Step timeout multiplier (e.g., 2x provider_timeout to allow for full response)
STEP_TIMEOUT_MULTIPLIER = 2
# Stagger delay between starting providers (ms) to reduce rate limit hits
STAGGER_DELAY_MS = 150
# Maximum retry attempts for failed providers
MAX_RETRY_ATTEMPTS = 1
# Base delay for retry backoff (seconds)
RETRY_BASE_DELAY = 2.0


@dataclass
class StepConfig:
    """Configuration for running all providers concurrently within a single step.

    Note: Steps 1→2→3→4 run SEQUENTIALLY (each waits for previous to complete).
    This config is for the concurrent provider execution WITHIN each step.
    """
    step_num: int
    prompt: str
    event_prefix: str  # e.g., "step1" for step1_chunk, step1_done, step1_error
    response_store: str  # attribute name on state, e.g., "step1_responses"
    error_key: str  # key in state.errors dict
    done_data_builder: Callable[[Any], dict]  # builds the "done" event payload


class PipelineOrchestrator:
    """
    Orchestrates the 4-step KEA pipeline.

    Each step runs providers in parallel, collects responses,
    then passes aggregated context to the next step.
    """

    def __init__(
        self,
        providers: List[BaseProvider],
        min_providers_per_step: int = 2,
    ):
        self.providers = providers
        self.min_providers = min_providers_per_step
        self.state: Optional[PipelineState] = None

        # Build provider lookup by name
        self.providers_by_name: Dict[str, BaseProvider] = {p.name: p for p in providers}

    async def run_pipeline(
        self,
        messages: List[dict],
        question: str,
    ) -> AsyncIterator[str]:
        """
        Run the complete 4-step pipeline with SSE streaming.

        IMPORTANT: Images are only sent in Step 1.
        Steps 2-4 use text-only message history.

        Yields SSE events for frontend to display progress.
        """
        # Initialize pipeline state
        self.state = PipelineState(question=question)

        # Create anonymous labels (A, B, C, ...) for providers
        for idx, provider in enumerate(self.providers):
            label = PROVIDER_LABELS[idx]
            self.state.label_to_provider[label] = provider.name
            self.state.provider_to_label[provider.name] = label

        # =========================================================================
        # STEP 1: Initial Responses (with images if present)
        # =========================================================================
        yield format_pipeline_sse("step_start", "system", {"step": 1, "name": "Initial Responses"})
        self.state.current_step = 1

        # Check if any messages have images
        has_any_images = any(has_images(msg) for msg in messages)

        if has_any_images:
            # Filter to only vision-capable providers
            vision_providers = [p for p in self.providers if p.supports_vision]
            if not vision_providers:
                yield format_pipeline_sse("error", "system", {
                    "message": "No vision-capable providers available for image analysis"
                })
                return
            logger.info(f"Image(s) detected. Using {len(vision_providers)} vision-capable providers: {[p.name for p in vision_providers]}")
            # Temporarily use only vision providers for Step 1
            original_providers = self.providers
            original_providers_by_name = self.providers_by_name.copy()
            self.providers = vision_providers
            # Update provider lookup dictionary
            self.providers_by_name = {p.name: p for p in vision_providers}

        # Step 1: Use original messages (WITH images)
        async for event in self._run_step1(messages):
            yield event

        # Restore original provider list if we filtered
        if has_any_images:
            self.providers = original_providers
            self.providers_by_name = original_providers_by_name

        yield format_pipeline_sse(
            "step_complete",
            "system",
            {"step": 1, "count": len(self.state.step1_responses)},
        )

        # Check minimum providers
        if len(self.state.step1_responses) < self.min_providers:
            yield format_pipeline_sse(
                "error",
                "pipeline",
                {"message": f"Not enough Step 1 responses ({len(self.state.step1_responses)}/{self.min_providers})"},
            )
            yield format_pipeline_sse("pipeline_complete", "system", self._get_summary().model_dump())
            return

        # =========================================================================
        # CONVERT TO TEXT-ONLY FOR STEPS 2-4
        # =========================================================================
        # This is CRITICAL: remove images to avoid redundant API calls
        text_only_messages = [
            extract_text_only(msg) if msg.get("role") == "user" else msg
            for msg in messages
        ]

        # =========================================================================
        # STEP 2: MoA Refinement (text-only)
        # =========================================================================
        yield format_pipeline_sse("step_start", "system", {"step": 2, "name": "MoA Refinement"})
        self.state.current_step = 2

        async for event in self._run_step2(text_only_messages):
            yield event

        yield format_pipeline_sse(
            "step_complete",
            "system",
            {"step": 2, "count": len(self.state.step2_responses)},
        )

        if len(self.state.step2_responses) < self.min_providers:
            yield format_pipeline_sse(
                "error",
                "pipeline",
                {"message": f"Not enough Step 2 responses ({len(self.state.step2_responses)}/{self.min_providers})"},
            )
            yield format_pipeline_sse("pipeline_complete", "system", self._get_summary().model_dump())
            return

        # =========================================================================
        # STEP 3: Peer Evaluation (text-only)
        # =========================================================================
        yield format_pipeline_sse("step_start", "system", {"step": 3, "name": "Peer Evaluation"})
        self.state.current_step = 3

        async for event in self._run_step3(text_only_messages):
            yield event

        yield format_pipeline_sse(
            "step_complete",
            "system",
            {"step": 3, "count": len(self.state.step3_responses)},
        )

        # =========================================================================
        # STEP 4: KEA Synthesis (text-only)
        # =========================================================================
        yield format_pipeline_sse("step_start", "system", {"step": 4, "name": "KEA Synthesis"})
        self.state.current_step = 4

        async for event in self._run_step4(text_only_messages):
            yield event

        yield format_pipeline_sse(
            "step_complete",
            "system",
            {"step": 4, "has_response": self.state.step4_response is not None},
        )

        # =========================================================================
        # PIPELINE COMPLETE
        # =========================================================================
        yield format_pipeline_sse("pipeline_complete", "system", self._get_summary().model_dump())

    # =========================================================================
    # STEP IMPLEMENTATIONS
    # =========================================================================

    async def _run_providers_concurrently(
        self,
        config: StepConfig,
        messages: List[dict],
        parser: Callable[[str, str], Any],
        response_store: Dict[str, Any],
    ) -> AsyncIterator[str]:
        """
        Generic method to run all providers concurrently within a step.

        This handles the async queue pattern, task management, and SSE event
        generation that was duplicated across _run_step1/2/3.

        Features:
        - Provider-specific timeouts (free tier gets 3x longer)
        - Staggered starts to reduce rate limit hits
        - Retry with backoff for failed providers
        """
        queue: asyncio.Queue = asyncio.Queue()
        active_tasks = set()
        retry_counts: Dict[str, int] = {}  # Track retry attempts per provider
        failed_providers: set = set()  # Providers that failed and need retry

        # Base timeout
        base_timeout = settings.provider_timeout * STEP_TIMEOUT_MULTIPLIER

        def get_provider_timeout(provider: BaseProvider) -> float:
            """Calculate provider-specific timeout based on tier."""
            return base_timeout * provider.timeout_multiplier

        async def collect_response(provider: BaseProvider, is_retry: bool = False):
            """Collect streaming response from a provider."""
            full_response = ""
            provider_registry.stream_started()
            retry_label = " (retry)" if is_retry else ""
            try:
                async for chunk in provider.stream_chat(messages, config.prompt):
                    if chunk.error:
                        await queue.put(("error", provider.name, chunk.error, is_retry))
                        return
                    elif not chunk.is_done:
                        full_response += chunk.content
                        await queue.put(("chunk", provider.name, chunk.content, is_retry))
                    else:
                        await queue.put(("done", provider.name, full_response, is_retry))
            except Exception as e:
                logger.exception(f"Step {config.step_num} error from {provider.name}{retry_label}")
                await queue.put(("error", provider.name, str(e), is_retry))
            finally:
                provider_registry.stream_ended()

        async def collect_with_timeout(provider: BaseProvider, is_retry: bool = False):
            """Wrapper to apply provider-specific timeout."""
            timeout = get_provider_timeout(provider)
            retry_label = " (retry)" if is_retry else ""
            try:
                await asyncio.wait_for(collect_response(provider, is_retry), timeout=timeout)
            except asyncio.TimeoutError:
                logger.warning(
                    f"Step {config.step_num} timeout from {provider.name}{retry_label} "
                    f"after {timeout}s (multiplier: {provider.timeout_multiplier}x)"
                )
                await queue.put(("error", provider.name, f"Timeout after {timeout}s", is_retry))

        async def retry_provider(provider: BaseProvider, delay: float):
            """Retry a failed provider after a delay."""
            await asyncio.sleep(delay)
            logger.info(f"Retrying {provider.name} after {delay}s delay")
            await collect_with_timeout(provider, is_retry=True)

        # Start providers with staggered delay to reduce rate limit hits
        stagger_delay = STAGGER_DELAY_MS / 1000.0  # Convert to seconds
        for idx, provider in enumerate(self.providers):
            if idx > 0:
                await asyncio.sleep(stagger_delay)
            task = asyncio.create_task(collect_with_timeout(provider))
            active_tasks.add(task)
            task.add_done_callback(active_tasks.discard)

        providers_done = set()
        providers_succeeded = set()

        while len(providers_done) < len(self.providers) or active_tasks:
            try:
                result = await asyncio.wait_for(queue.get(), timeout=0.1)
                event_type, provider_name, data, is_retry = result

                if event_type == "chunk":
                    yield format_pipeline_sse(f"{config.event_prefix}_chunk", provider_name, {"content": data})

                elif event_type == "done":
                    parsed = parser(provider_name, data)
                    if parsed:
                        response_store[provider_name] = parsed
                        providers_succeeded.add(provider_name)
                    yield format_pipeline_sse(
                        f"{config.event_prefix}_done",
                        provider_name,
                        config.done_data_builder(parsed),
                    )
                    providers_done.add(provider_name)

                elif event_type == "error":
                    provider = self.providers_by_name.get(provider_name)

                    # Check if we should retry (only for free tier providers, and only once)
                    retry_count = retry_counts.get(provider_name, 0)
                    should_retry = (
                        provider
                        and provider.is_free_tier
                        and retry_count < MAX_RETRY_ATTEMPTS
                        and not is_retry
                    )

                    if should_retry:
                        retry_counts[provider_name] = retry_count + 1
                        retry_delay = RETRY_BASE_DELAY * (2 ** retry_count)  # Exponential backoff
                        logger.info(
                            f"Will retry {provider_name} (attempt {retry_count + 1}/{MAX_RETRY_ATTEMPTS}) "
                            f"after {retry_delay}s - Error was: {data}"
                        )
                        # Don't mark as done yet - start retry
                        task = asyncio.create_task(retry_provider(provider, retry_delay))
                        active_tasks.add(task)
                        task.add_done_callback(active_tasks.discard)
                        # Send a "retrying" event to frontend
                        yield format_pipeline_sse(
                            f"{config.event_prefix}_retry",
                            provider_name,
                            {"attempt": retry_count + 1, "delay": retry_delay},
                        )
                    else:
                        # No retry - mark as failed
                        self.state.errors.setdefault(config.error_key, []).append(f"{provider_name}: {data}")
                        yield format_pipeline_sse(f"{config.event_prefix}_error", provider_name, {"error": data})
                        providers_done.add(provider_name)

            except asyncio.TimeoutError:
                if not active_tasks and len(providers_done) >= len(self.providers):
                    break

    async def _run_step1(self, messages: List[dict]) -> AsyncIterator[str]:
        """Step 1: Get independent responses from all providers concurrently."""
        config = StepConfig(
            step_num=1,
            prompt=STEP1_PROMPT,
            event_prefix="step1",
            response_store="step1_responses",
            error_key="step1",
            done_data_builder=lambda p: {
                "success": p is not None,
                "confidence": p.confidence if p else None,
                "facts_count": len(p.atomic_facts) if p else 0,
            },
        )
        async for event in self._run_providers_concurrently(
            config, messages, self._parse_step1_response, self.state.step1_responses
        ):
            yield event

    async def _run_step2(self, messages: List[dict]) -> AsyncIterator[str]:
        """Step 2: Each provider sees all Step 1 responses and creates improved answer."""
        context = build_step2_context(
            self.state.question,
            self.state.step1_responses,
            self.state.provider_to_label,
        )
        augmented_messages = messages + [{"role": "user", "content": context}]

        config = StepConfig(
            step_num=2,
            prompt=STEP2_PROMPT,
            event_prefix="step2",
            response_store="step2_responses",
            error_key="step2",
            done_data_builder=lambda p: {
                "success": p is not None,
                "confidence": p.confidence if p else None,
                # Include parsed data for frontend (handles malformed JSON from local LLMs)
                "parsed": {
                    "improved_answer": p.improved_answer if p else "",
                    "confidence": p.confidence if p else 0.5,
                    "improvements": p.improvements if p else [],
                } if p else None,
            },
        )
        async for event in self._run_providers_concurrently(
            config, augmented_messages, self._parse_step2_response, self.state.step2_responses
        ):
            yield event

    async def _run_step3(self, messages: List[dict]) -> AsyncIterator[str]:
        """Step 3: Each provider evaluates all Step 2 responses."""
        context = build_step3_context(
            self.state.question,
            self.state.step2_responses,
            self.state.provider_to_label,
        )
        augmented_messages = messages + [{"role": "user", "content": context}]

        config = StepConfig(
            step_num=3,
            prompt=STEP3_PROMPT,
            event_prefix="step3",
            response_store="step3_responses",
            error_key="step3",
            done_data_builder=lambda p: {
                "success": p is not None,
                "ranking": p.ranking if p else [],
                "flagged_count": len(p.flagged_facts) if p else 0,
                # Include parsed data for frontend (handles malformed JSON from local LLMs)
                "parsed": {
                    "ranking": p.ranking if p else [],
                    "predicted_winner": p.predicted_winner if p else "",
                    "evaluations": {k: {"score": v.score, "strengths": v.strengths, "weaknesses": v.weaknesses} for k, v in p.evaluations.items()} if p and p.evaluations else {},
                    "flagged_facts": p.flagged_facts if p else [],
                    "consensus_facts": p.consensus_facts if p else [],
                } if p else None,
            },
        )
        async for event in self._run_providers_concurrently(
            config, augmented_messages, self._parse_step3_response, self.state.step3_responses
        ):
            yield event

    async def _run_step4(self, messages: List[dict]) -> AsyncIterator[str]:
        """Step 4: Final synthesis by best-ranked provider from Step 3."""
        # Select synthesizer (best-ranked from Step 3)
        synthesizer = self._select_synthesizer()
        if not synthesizer:
            yield format_pipeline_sse(
                "step4_error",
                "pipeline",
                {"error": "No synthesizer available"},
            )
            return

        yield format_pipeline_sse(
            "step4_synthesizer",
            synthesizer.name,
            {"label": self.state.provider_to_label.get(synthesizer.name, synthesizer.name)},
        )

        # Build context with all data
        context = build_step4_context(
            self.state.question,
            self.state.step2_responses,
            self.state.step3_responses,
            self.state.provider_to_label,
        )

        augmented_messages = messages + [{"role": "user", "content": context}]

        full_response = ""
        provider_registry.stream_started()
        try:
            async for chunk in synthesizer.stream_chat(augmented_messages, STEP4_PROMPT):
                if chunk.error:
                    yield format_pipeline_sse("step4_error", synthesizer.name, {"error": chunk.error})
                    return
                elif not chunk.is_done:
                    full_response += chunk.content
                    yield format_pipeline_sse("step4_chunk", synthesizer.name, {"content": chunk.content})
                else:
                    parsed = self._parse_step4_response(synthesizer.name, full_response)
                    if parsed:
                        self.state.step4_response = parsed
                    yield format_pipeline_sse(
                        "step4_done",
                        synthesizer.name,
                        {
                            "success": parsed is not None,
                            "final_answer": parsed.final_answer if parsed else None,
                            "confidence": parsed.confidence if parsed else None,
                        },
                    )
        except Exception as e:
            logger.exception(f"Step 4 error from {synthesizer.name}")
            yield format_pipeline_sse("step4_error", synthesizer.name, {"error": str(e)})
        finally:
            provider_registry.stream_ended()

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def _select_synthesizer(self) -> Optional[BaseProvider]:
        """
        Select best-ranked provider from Step 3 as synthesizer.

        Uses Surprisingly Popular algorithm with Borda count fallback:
        1. SP Algorithm: Find provider where actual_votes > predicted_votes
           (indicates expert knowledge - answers better than expected)
        2. Borda Count: First place gets N points, second N-1, etc.
        3. Final score = SP_score + (Borda_score * 0.1) for tiebreaking
        """
        if not self.state.step3_responses:
            # Fallback: use first provider with Step 2 response
            for provider_name in self.state.step2_responses:
                if provider_name in self.providers_by_name:
                    return self.providers_by_name[provider_name]
            return self.providers[0] if self.providers else None

        # Count actual first-place votes and predicted first-place votes
        actual_first_place: Dict[str, int] = {}
        predicted_first_place: Dict[str, int] = {}
        borda_scores: Dict[str, int] = {}

        for _evaluator, response in self.state.step3_responses.items():
            # Count actual first-place votes (who was ranked #1)
            if response.ranking and len(response.ranking) > 0:
                first_place_label = response.ranking[0]
                first_place_provider = self.state.label_to_provider.get(
                    first_place_label, first_place_label
                )
                actual_first_place[first_place_provider] = (
                    actual_first_place.get(first_place_provider, 0) + 1
                )

            # Count predicted first-place votes (who was predicted to win)
            if response.predicted_winner:
                predicted_provider = self.state.label_to_provider.get(
                    response.predicted_winner, response.predicted_winner
                )
                predicted_first_place[predicted_provider] = (
                    predicted_first_place.get(predicted_provider, 0) + 1
                )

            # Calculate Borda count for tiebreaking
            if response.ranking:
                num_ranked = len(response.ranking)
                for position, label in enumerate(response.ranking):
                    provider_name = self.state.label_to_provider.get(label, label)
                    points = num_ranked - position
                    borda_scores[provider_name] = borda_scores.get(provider_name, 0) + points

        if not borda_scores:
            return self.providers[0] if self.providers else None

        # Calculate Surprisingly Popular score for each provider
        # SP score = actual_first_place_votes - predicted_first_place_votes
        # Positive score means "surprisingly popular" (better than expected)
        sp_scores: Dict[str, float] = {}
        all_providers = set(borda_scores.keys())

        for provider in all_providers:
            actual = actual_first_place.get(provider, 0)
            predicted = predicted_first_place.get(provider, 0)
            sp_score = actual - predicted
            # Combine SP with Borda (SP primary, Borda for tiebreaking)
            # Borda is normalized to 0.1 weight to serve as tiebreaker
            borda_normalized = borda_scores.get(provider, 0) * 0.1
            sp_scores[provider] = sp_score + borda_normalized

        # Log selection details for debugging
        logger.debug(
            f"Synthesizer selection - Actual: {actual_first_place}, "
            f"Predicted: {predicted_first_place}, SP+Borda: {sp_scores}"
        )

        # Get provider with highest combined score
        best_provider_name = max(sp_scores, key=sp_scores.get)
        return self.providers_by_name.get(best_provider_name)

    def _get_summary(self) -> PipelineSummary:
        """Generate summary for pipeline completion event."""
        return PipelineSummary(
            step1_count=len(self.state.step1_responses),
            step2_count=len(self.state.step2_responses),
            step3_count=len(self.state.step3_responses),
            has_final=self.state.step4_response is not None,
            final_answer=self.state.step4_response.final_answer if self.state.step4_response else None,
            final_confidence=self.state.step4_response.confidence if self.state.step4_response else None,
            synthesizer_provider=self.state.step4_response.provider if self.state.step4_response else None,
            errors=self.state.errors,
        )

    # =========================================================================
    # JSON PARSING
    # =========================================================================

    def _extract_json(self, text: str) -> str:
        """Extract JSON from response, handling markdown code blocks."""
        # Try to find JSON in code blocks first (greedy to capture full nested JSON)
        match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
        if match:
            return match.group(1)
        # Try to find raw JSON
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return match.group(0)
        return text

    def _clean_answer_field(self, value: str) -> str:
        """
        Clean answer field that may contain nested JSON/markdown.

        Handles cases like:
        - "```json\n{\"answer\": \"actual text...\"}"
        - "{\"final_answer\": \"actual text...\"}"
        - "{\n  \"answer\": \"text\"..."
        """
        if not isinstance(value, str):
            return str(value)

        text = value.strip()

        # Check if it looks like nested JSON (starts with { or ```)
        if text.startswith('```') or text.startswith('{'):
            try:
                # Find JSON object boundaries directly
                start = text.find('{')
                end = text.rfind('}')

                if start != -1 and end != -1 and end > start:
                    inner_json = text[start:end + 1]
                    inner_data = orjson.loads(inner_json)

                    if isinstance(inner_data, dict):
                        # Check for nested answer field (try multiple field names)
                        for key in ['final_answer', 'answer', 'improved_answer']:
                            nested = inner_data.get(key)
                            if nested and isinstance(nested, str) and nested != value:
                                # Recursively clean in case of double nesting
                                return self._clean_answer_field(nested)
            except Exception:
                pass

            # If JSON parsing failed but starts with JSON-like structure,
            # try to extract text after the first colon and quotes
            if text.startswith('{'):
                # Pattern: {"final_answer": "actual content here...
                match = re.search(r'^\s*\{\s*"(?:final_answer|answer|improved_answer)"\s*:\s*"(.+)', text, re.DOTALL)
                if match:
                    # Extract content, remove trailing JSON artifacts
                    content = match.group(1)
                    # Remove trailing ", "confidence":... or similar
                    content = re.sub(r'",?\s*"(?:confidence|sources_used|excluded|atomic_facts|improvements)".*$', '', content, flags=re.DOTALL)
                    content = re.sub(r'"\s*\}\s*$', '', content)
                    if content and len(content) > 5:
                        return content.strip()

        return value

    def _extract_text_fallback(self, raw: str) -> str:
        """
        Extract meaningful text from malformed responses.

        Small models may return partially valid JSON or mixed formats.
        This tries to salvage the actual answer content.
        """
        text = raw.strip()

        # Pattern 0: Markdown-wrapped incomplete JSON (common with small models)
        # ```json\n{"final_answer": "actual content...
        if text.startswith('```'):
            # Remove markdown code fence and try to extract answer
            inner = re.sub(r'^```(?:json|markdown)?\s*', '', text)
            inner = re.sub(r'\s*```\s*$', '', inner)  # Remove closing fence if present

            # Try to extract the answer content from JSON-like structure
            answer_match = re.search(
                r'["\']?(?:final_answer|answer|improved_answer)["\']?\s*:\s*["\'](.+)',
                inner,
                re.DOTALL
            )
            if answer_match:
                content = answer_match.group(1)
                # Clean up trailing JSON artifacts
                content = re.sub(r'["\'],?\s*["\']?(?:confidence|sources_used|excluded|atomic_facts)["\']?\s*:.*$', '', content, flags=re.DOTALL)
                content = re.sub(r'["\']?\s*\}?\s*$', '', content)
                if content and len(content) > 5:
                    return content.strip()

        # Pattern 1: Try valid JSON extraction
        try:
            json_match = re.search(r'\{[^{}]*"(?:final_answer|answer|improved_answer)"[^{}]*\}', text, re.DOTALL)
            if json_match:
                data = orjson.loads(json_match.group(0))
                for key in ['final_answer', 'answer', 'improved_answer']:
                    if key in data and data[key]:
                        return self._clean_answer_field(str(data[key]))
        except Exception:
            pass

        # Pattern 2: Complete markdown code blocks with valid JSON
        md_match = re.search(r'```(?:json|markdown)?\s*(.*?)\s*```', text, re.DOTALL)
        if md_match:
            inner = md_match.group(1).strip()
            try:
                data = orjson.loads(inner)
                if isinstance(data, dict):
                    for key in ['final_answer', 'answer', 'improved_answer']:
                        if key in data and data[key]:
                            return str(data[key])
            except Exception:
                if inner and not inner.startswith('{'):
                    return inner

        # Pattern 3: Direct JSON-like structure
        if text.startswith('{'):
            answer_match = re.search(
                r'"(?:final_answer|answer|improved_answer)"\s*:\s*"(.+)',
                text,
                re.DOTALL
            )
            if answer_match:
                content = answer_match.group(1)
                content = re.sub(r'",?\s*"(?:confidence|sources_used|excluded|atomic_facts)".*$', '', content, flags=re.DOTALL)
                content = re.sub(r'"\s*\}\s*$', '', content)
                if content and len(content) > 5:
                    return content.strip()

        # Fallback: return original text
        return text

    def _parse_step1_response(self, provider: str, raw: str) -> Optional[Step1Response]:
        """Parse Step 1 JSON response with fallback."""
        try:
            json_str = self._extract_json(raw)
            # Try fast orjson first, fall back to repair for malformed JSON
            try:
                data = orjson.loads(json_str)
            except Exception:
                data = repair_llm_json(json_str, provider)
                if data is None:
                    raise ValueError("JSON repair failed")
                logger.info(f"[{provider}] Step 1: JSON repaired successfully")

            return Step1Response(
                provider=provider,
                answer=self._clean_answer_field(data.get("answer", "")),
                confidence=float(data.get("confidence", 0.5)),
                atomic_facts=normalize_string_list(
                    data.get("atomic_facts", []), "atomic_facts", provider
                ),
                raw_response=raw,
            )
        except Exception as e:
            logger.warning(f"Failed to parse Step 1 from {provider}: {e}")
            # Fallback: try to extract meaningful text
            return Step1Response(
                provider=provider,
                answer=self._extract_text_fallback(raw),
                confidence=0.5,
                atomic_facts=[],
                raw_response=raw,
            )

    def _parse_step2_response(self, provider: str, raw: str) -> Optional[Step2Response]:
        """Parse Step 2 JSON response with fallback."""
        try:
            json_str = self._extract_json(raw)
            # Try fast orjson first, fall back to repair for malformed JSON
            try:
                data = orjson.loads(json_str)
            except Exception:
                data = repair_llm_json(json_str, provider)
                if data is None:
                    raise ValueError("JSON repair failed")
                logger.info(f"[{provider}] Step 2: JSON repaired successfully, keys: {list(data.keys())}")

            return Step2Response(
                provider=provider,
                improved_answer=self._clean_answer_field(data.get("improved_answer", "")),
                confidence=float(data.get("confidence", 0.5)),
                improvements=normalize_string_list(
                    data.get("improvements", []), "improvements", provider
                ),
                raw_response=raw,
            )
        except Exception as e:
            logger.warning(f"Failed to parse Step 2 from {provider}: {e}")
            # Fallback: try to extract meaningful text
            return Step2Response(
                provider=provider,
                improved_answer=self._extract_text_fallback(raw),
                confidence=0.5,
                improvements=[],
                raw_response=raw,
            )

    def _parse_step3_response(self, provider: str, raw: str) -> Optional[Step3Response]:
        """Parse Step 3 JSON response with fallback."""
        try:
            json_str = self._extract_json(raw)
            # Try fast orjson first, fall back to repair for malformed JSON
            try:
                data = orjson.loads(json_str)
            except Exception:
                data = repair_llm_json(json_str, provider)
                if data is None:
                    raise ValueError("JSON repair failed")

            # Parse evaluations (normalize strengths/weaknesses - LLMs may return lists)
            evaluations = {}
            for label, eval_data in data.get("evaluations", {}).items():
                if isinstance(eval_data, dict):
                    evaluations[label] = ProviderEvaluation(
                        score=int(eval_data.get("score", 5)),
                        strengths=normalize_to_string(eval_data.get("strengths", "")),
                        weaknesses=normalize_to_string(eval_data.get("weaknesses", "")),
                    )

            return Step3Response(
                provider=provider,
                ranking=data.get("ranking", []),
                predicted_winner=data.get("predicted_winner", ""),
                evaluations=evaluations,
                flagged_facts=normalize_string_list(
                    data.get("flagged_facts", []), "flagged_facts", provider
                ),
                consensus_facts=normalize_string_list(
                    data.get("consensus_facts", []), "consensus_facts", provider
                ),
                raw_response=raw,
            )
        except Exception as e:
            logger.warning(f"Failed to parse Step 3 from {provider}: {e}")
            return Step3Response(
                provider=provider,
                ranking=[],
                predicted_winner="",
                evaluations={},
                flagged_facts=[],
                consensus_facts=[],
                raw_response=raw,
            )

    def _parse_step4_response(self, provider: str, raw: str) -> Optional[Step4Response]:
        """Parse Step 4 JSON response with fallback."""
        try:
            json_str = self._extract_json(raw)
            # Try fast orjson first, fall back to repair for malformed JSON
            try:
                data = orjson.loads(json_str)
            except Exception:
                data = repair_llm_json(json_str, provider)
                if data is None:
                    raise ValueError("JSON repair failed")
                logger.info(f"[{provider}] Step 4: JSON repaired successfully")
            return Step4Response(
                provider=provider,
                final_answer=self._clean_answer_field(data.get("final_answer", "")),
                confidence=float(data.get("confidence", 0.5)),
                sources_used=normalize_string_list(
                    data.get("sources_used", []), "sources_used", provider
                ),
                excluded=normalize_string_list(
                    data.get("excluded", []), "excluded", provider
                ),
                raw_response=raw,
            )
        except Exception as e:
            logger.warning(f"Failed to parse Step 4 from {provider}: {e}")
            # Try to extract any meaningful text from the raw response
            return Step4Response(
                provider=provider,
                final_answer=self._extract_text_fallback(raw),
                confidence=0.5,
                sources_used=[],
                excluded=[],
                raw_response=raw,
            )
