"""
Pipeline models for the 4-step KEA response system.

Step 1: Initial Responses - Independent answers with confidence + atomic facts
Step 2: MoA Refinement - Each provider sees all Step 1, creates improved answer
Step 3: Peer Evaluation - Ranking, fact verification, flagging
Step 4: KEA Synthesis - Final answer from best-ranked provider
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class ProviderEvaluation(BaseModel):
    """Single provider's evaluation of a response"""
    score: int = Field(ge=1, le=10)
    strengths: str = ""
    weaknesses: str = ""


class Step1Response(BaseModel):
    """Initial response from each provider"""
    provider: str
    answer: str
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    atomic_facts: List[str] = Field(default_factory=list)
    raw_response: str = ""  # Original text for debugging


class Step2Response(BaseModel):
    """Refined response after seeing all Step 1 responses"""
    provider: str
    improved_answer: str
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    improvements: List[str] = Field(default_factory=list)
    raw_response: str = ""


class Step3Response(BaseModel):
    """Peer evaluation results"""
    provider: str
    ranking: List[str] = Field(default_factory=list)  # Provider IDs in rank order (A, B, C...)
    predicted_winner: str = ""  # For Surprisingly Popular algorithm
    evaluations: Dict[str, ProviderEvaluation] = Field(default_factory=dict)
    flagged_facts: List[str] = Field(default_factory=list)
    consensus_facts: List[str] = Field(default_factory=list)
    raw_response: str = ""


class Step4Response(BaseModel):
    """Final KEA synthesis"""
    provider: str  # Best-ranked provider from Step 3
    final_answer: str
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    sources_used: List[str] = Field(default_factory=list)
    excluded: List[str] = Field(default_factory=list)
    raw_response: str = ""


class PipelineState(BaseModel):
    """Complete state of the 4-step pipeline"""
    question: str
    step1_responses: Dict[str, Step1Response] = Field(default_factory=dict)
    step2_responses: Dict[str, Step2Response] = Field(default_factory=dict)
    step3_responses: Dict[str, Step3Response] = Field(default_factory=dict)
    step4_response: Optional[Step4Response] = None
    current_step: int = 1
    errors: Dict[str, List[str]] = Field(default_factory=dict)  # step -> list of error messages

    # Mapping from anonymous labels (A, B, C) to provider names
    label_to_provider: Dict[str, str] = Field(default_factory=dict)
    provider_to_label: Dict[str, str] = Field(default_factory=dict)


class PipelineSummary(BaseModel):
    """Summary sent at pipeline completion"""
    step1_count: int = 0
    step2_count: int = 0
    step3_count: int = 0
    has_final: bool = False
    final_answer: Optional[str] = None
    final_confidence: Optional[float] = None
    synthesizer_provider: Optional[str] = None
    errors: Dict[str, List[str]] = Field(default_factory=dict)
