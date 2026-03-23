---
title: "POC: LLM-as-Judge Alignment — Building Evals That Match Human Judgment"
layer: poc
section: agent-workflows/concepts
level: intermediate
difficulty: intermediate
prerequisites:
  - agent-workflows/concepts/agent-evaluation-testing
tags: [evaluation, llm-as-judge, alignment, calibration, quality, cohen-kappa]
---

# POC: LLM-as-Judge Alignment — Building Evals That Match Human Judgment

**Level**: 🟡 Intermediate
**Reading Time**: 15 minutes

> A judge you haven't calibrated is worse than no judge. It gives you false confidence in a metric that doesn't reflect what your users actually experience.

## The Problem with Naive LLM-as-Judge

The obvious approach to automated agent evaluation: ask an LLM to rate responses on a scale of 1-10. Deploy this judge. Watch your eval scores. Optimize for high scores.

The problem: the LLM judge's definition of "good" may not match your users' definition of "good."

```python
# Naive judge — looks reasonable, but...
def naive_judge(question: str, answer: str) -> int:
    response = llm.invoke(f"""
Rate this answer to the question on a scale of 1-10.

Question: {question}
Answer: {answer}

Score (1-10):
""")
    return int(response.content.strip())

# Results:
# Answer A: "I sincerely apologize for the inconvenience. Your request has been noted
#            and will be addressed by our team within 3-5 business days."
# Naive judge score: 8/10 (complete, professional-sounding)
# Human preference score: 4/10 (unhelpful, bureaucratic, no actual resolution)

# Answer B: "Refund processed. Should hit your account in 1-2 days."
# Naive judge score: 5/10 (brief, possibly too terse)
# Human preference score: 9/10 (direct, actually solved the problem)
```

The naive judge has length bias: longer-sounding "complete" answers score higher, even when they're bureaucratic non-answers. Your users hate these answers. Your judge loves them.

## The Solution: Align the Judge Against Human Labels

**Align eval** calibrates the judge by comparing its scores to human-labeled examples:

```
Aligned eval process:
1. Collect 50-200 real traces from production
2. Human labels each with: score (1-10) + reason (1-2 sentences)
3. Compare judge scores to human scores → measure agreement
4. Add disagreements as few-shot examples to judge prompt
5. Re-measure agreement → iterate until agreement is high
6. Only use judge in CI/CD once agreement is above threshold (e.g., kappa > 0.65)
```

## Full Implementation

### Core Types

```python
from dataclasses import dataclass, field
from typing import Optional
import statistics

@dataclass
class AgentTrace:
    trace_id: str
    question: str
    answer: str
    tool_calls: list = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

@dataclass
class HumanLabel:
    trace: AgentTrace
    score: int           # 1-10
    reason: str          # Why this score?
    labeled_by: str      # Who labeled this?
    labeled_at: str      # When?

@dataclass
class JudgeResult:
    trace_id: str
    score: int
    reasoning: str
    confidence: float    # 0-1, how confident the judge is
```

### Step 1: Naive Judge

```python
class NaiveJudge:
    """Baseline judge — no calibration, just a generic prompt."""

    def __init__(self, llm):
        self.llm = llm
        self.prompt_template = """
Rate this answer to the customer support question on a scale of 1 to 10.

Question: {question}
Answer: {answer}

Rate based on:
- Did it actually resolve the customer's issue?
- Was the tone appropriate?
- Was it accurate?

Return a JSON object with keys: score (int 1-10), reasoning (string)
"""

    def score(self, trace: AgentTrace) -> JudgeResult:
        response = self.llm.invoke(
            self.prompt_template.format(
                question=trace.question,
                answer=trace.answer
            )
        )
        result = parse_json(response.content)
        return JudgeResult(
            trace_id=trace.trace_id,
            score=result["score"],
            reasoning=result["reasoning"],
            confidence=0.5  # Naive judge has low confidence
        )
```

### Step 2: Build the Human Label Dataset

```python
# 10 labeled examples (in production: 50-200)
LABELED_EXAMPLES = [
    HumanLabel(
        trace=AgentTrace(
            trace_id="ex-001",
            question="My order #12345 hasn't arrived, where is it?",
            answer="I sincerely apologize for the inconvenience. Your order status "
                   "will be investigated and you will be contacted within 3-5 business days."
        ),
        score=2,
        reason="Completely unhelpful — the agent could have checked the CRM tool but "
               "didn't. Customer asked where the order is; agent promised to investigate "
               "without actually doing so. Corporate-speak makes it worse.",
        labeled_by="alice@company.com",
        labeled_at="2026-03-20"
    ),
    HumanLabel(
        trace=AgentTrace(
            trace_id="ex-002",
            question="My order #12345 hasn't arrived, where is it?",
            answer="Checked your order — it's in transit and should arrive tomorrow, "
                   "March 23. Carrier is UPS, tracking: 1Z9999W99999999999. "
                   "Let me know if it doesn't show up!"
        ),
        score=10,
        reason="Perfect. Checked the tool, gave specific useful information, "
               "friendly tone, clear next step.",
        labeled_by="alice@company.com",
        labeled_at="2026-03-20"
    ),
    HumanLabel(
        trace=AgentTrace(
            trace_id="ex-003",
            question="I want a refund for order #67890.",
            answer="Of course! I've processed your refund for order #67890. "
                   "It should appear in your account within 1-2 business days. "
                   "Is there anything else I can help with?"
        ),
        score=9,
        reason="Direct, took action, gave clear timeline. Slightly docking for "
               "not verifying the order was within the refund window before processing.",
        labeled_by="bob@company.com",
        labeled_at="2026-03-20"
    ),
    HumanLabel(
        trace=AgentTrace(
            trace_id="ex-004",
            question="I want a refund for order #67890.",
            answer="I understand your frustration. Our refund policy allows returns "
                   "within 30 days. Please note that refunds are subject to review. "
                   "Your request has been submitted."
        ),
        score=3,
        reason="Technically mentions the policy but doesn't actually process the "
               "refund or tell the customer what happens next. 'I understand your "
               "frustration' is a red flag phrase — patronizing.",
        labeled_by="bob@company.com",
        labeled_at="2026-03-20"
    ),
    # ... 6 more examples across different scenarios
]
```

### Step 3: Measure Naive Judge Agreement

```python
def measure_agreement(labels: list[HumanLabel], judge) -> dict:
    """
    Measure how well the judge agrees with human labels.
    Returns: percent within 1 point, percent within 2 points, and mean absolute error.
    """
    human_scores = [l.score for l in labels]
    judge_scores = [judge.score(l.trace).score for l in labels]

    absolute_errors = [abs(h - j) for h, j in zip(human_scores, judge_scores)]

    within_1 = sum(1 for e in absolute_errors if e <= 1) / len(absolute_errors)
    within_2 = sum(1 for e in absolute_errors if e <= 2) / len(absolute_errors)
    mae = statistics.mean(absolute_errors)

    return {
        "within_1_point": within_1,
        "within_2_points": within_2,
        "mean_absolute_error": mae,
        "n_examples": len(labels),
        "human_scores": human_scores,
        "judge_scores": judge_scores
    }

naive_judge = NaiveJudge(llm)
naive_agreement = measure_agreement(LABELED_EXAMPLES, naive_judge)

print("Naive Judge Agreement:")
print(f"  Within 1 point: {naive_agreement['within_1_point']:.0%}")  # e.g., 30%
print(f"  Within 2 points: {naive_agreement['within_2_points']:.0%}")  # e.g., 55%
print(f"  Mean absolute error: {naive_agreement['mean_absolute_error']:.1f}")  # e.g., 3.2
```

**Typical naive judge results:**
- Within 1 point of human: ~30-45% (a coin flip is 50% if scores cluster)
- Mean absolute error: 2-4 points out of 10
- The judge rates the bureaucratic non-answers too high (length bias)
- The judge rates terse but accurate answers too low (conciseness not rewarded)

### Step 4: Build the Aligned Judge

```python
class AlignedJudge:
    """Calibrated judge using few-shot examples from human labels."""

    def __init__(self, llm, labels: list[HumanLabel]):
        self.llm = llm
        self.labels = labels
        self.calibration_examples = self._build_calibration_examples()

    def _build_calibration_examples(self) -> str:
        """Format labeled examples as few-shot examples for the judge prompt."""
        examples = []
        for label in self.labels:
            examples.append(f"""
Example:
Question: {label.trace.question}
Answer: {label.trace.answer}
Human score: {label.score}/10
Why: {label.reason}
""")
        return "\n---\n".join(examples)

    def score(self, trace: AgentTrace) -> JudgeResult:
        prompt = f"""
You are evaluating customer support agent responses. Below are examples showing
how a human expert scores responses, with reasoning.

CALIBRATION EXAMPLES:
{self.calibration_examples}

---

Now score this new response using the same criteria as the examples above.

Key criteria (derived from examples):
- **Actually resolved the issue**: Did the agent use tools to get real information, or did it give vague promises?
- **Tone**: Conversational and warm beats formal and corporate. "Sorry about that" > "I sincerely apologize".
- **Specificity**: Specific information (tracking number, exact date, exact amount) > vague references.
- **Directness**: Terse but accurate > lengthy but non-committal.

Question: {trace.question}
Answer: {trace.answer}

Return JSON: {{"score": int 1-10, "reasoning": string, "confidence": float 0-1}}
"""
        response = self.llm.invoke(prompt)
        result = parse_json(response.content)
        return JudgeResult(
            trace_id=trace.trace_id,
            score=result["score"],
            reasoning=result["reasoning"],
            confidence=result.get("confidence", 0.7)
        )
```

### Step 5: Measure Aligned Judge Agreement

```python
aligned_judge = AlignedJudge(llm, LABELED_EXAMPLES)
aligned_agreement = measure_agreement(LABELED_EXAMPLES, aligned_judge)

print("Aligned Judge Agreement:")
print(f"  Within 1 point: {aligned_agreement['within_1_point']:.0%}")  # e.g., 75%
print(f"  Within 2 points: {aligned_agreement['within_2_points']:.0%}")  # e.g., 90%
print(f"  Mean absolute error: {aligned_agreement['mean_absolute_error']:.1f}")  # e.g., 1.1

# Improvement:
before = naive_agreement['within_1_point']
after = aligned_agreement['within_1_point']
print(f"\nImprovement: {before:.0%} → {after:.0%} within 1 point")
```

### Step 6: Iterate — Find and Fix Disagreements

```python
def find_disagreements(labels: list[HumanLabel], judge, threshold: int = 2) -> list:
    """Find examples where judge and human disagree by more than threshold points."""
    disagreements = []
    for label in labels:
        judge_result = judge.score(label.trace)
        gap = abs(label.score - judge_result.score)
        if gap > threshold:
            disagreements.append({
                "label": label,
                "judge_score": judge_result.score,
                "judge_reasoning": judge_result.reasoning,
                "gap": gap,
                "direction": "judge_high" if judge_result.score > label.score else "judge_low"
            })
    return sorted(disagreements, key=lambda d: -d["gap"])

disagreements = find_disagreements(LABELED_EXAMPLES, aligned_judge)

print(f"\nDisagreements (gap > 2 points): {len(disagreements)}")
for d in disagreements:
    print(f"\n  Trace {d['label'].trace.trace_id}:")
    print(f"  Human: {d['label'].score}/10 — {d['label'].reason}")
    print(f"  Judge: {d['judge_score']}/10 — {d['judge_reasoning']}")
    print(f"  Direction: {d['direction']}, gap: {d['gap']}")
```

**What disagreements reveal:**
- Judge rates formal answers too high (length bias remains) → add explicit example where verbose = low score
- Judge rates "I'm not sure but..." answers too high (humility misread as honesty) → add example showing uncertainty without resolution is bad
- Judge is harsh on short answers that are actually correct → add example showing brevity is fine when complete

Add these disagreement examples to the calibration set and re-run. Repeat until agreement is stable.

## When to Use What

| Evaluation Method | When to Use | When to Avoid |
|------------------|-------------|---------------|
| **Naive LLM-as-judge** | Initial prototyping, sanity checking | Any production eval you'll act on |
| **Aligned LLM-as-judge** | Production evals, CI/CD gates, volume eval | When human labels are unavailable or too costly |
| **Deterministic checks** | Tool call validation, schema compliance, forbidden words | Open-ended quality assessment |
| **Human review** | New task types, high-stakes cases, edge cases | Routine evals at high volume |
| **Golden dataset comparison** | Fixed-answer tasks (math, SQL, fact lookups) | Open-ended generation tasks |

## Common Mistakes

1. **Vague rubric without examples**: "Rate 1-10 based on quality" gives LLMs nothing to anchor to. Examples are essential.

2. **Judge trained on same biases as the agent**: If your agent was trained to prefer formal language, and your judge LLM shares that preference (or is the same model), the judge will validate the agent's mistakes. Use a different model family for judging.

3. **Calibrating on too-easy examples**: If your 50 labeled examples are all clear-cut cases (obviously good or obviously bad), the judge won't know how to handle borderline cases. Include ambiguous examples intentionally.

4. **Not holding out a validation set**: Split your labels: use 70% for calibration (adding to judge prompt), hold 30% for measuring true agreement. Otherwise you're measuring how well the judge memorized your examples, not how well it generalizes.

5. **One-time calibration**: User expectations change over time. Re-calibrate the judge quarterly by reviewing recent disagreements.

6. **Conflating judge agreement with correctness**: High agreement means the judge matches human preferences. It doesn't mean either the human or the judge is objectively correct. Be explicit about what you're measuring.

## Key Takeaways

- Naive LLM-as-judge has known biases (length, formality, confidence) that don't match user preferences
- Align eval: label 50-200 examples with human scores + reasons → calibrate judge with few-shot examples → measure agreement
- Target: >70% within 1 point of human score, or Cohen's kappa > 0.65
- Disagreements are valuable: they reveal exactly what the judge is getting wrong → add as calibration examples
- Use aligned LLM-as-judge for volume eval; reserve human review for edge cases and high-stakes decisions
- Recalibrate periodically — user expectations and task distributions shift over time
