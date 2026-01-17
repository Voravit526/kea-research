"""
List normalization utilities for pipeline responses.

LLMs sometimes return objects instead of strings in list fields.
This module provides utilities to normalize them to List[str].

Also includes JSON repair for malformed LLM output.
"""

import logging
from typing import Any, Dict, List, Optional

from json_repair import repair_json

logger = logging.getLogger(__name__)


def repair_llm_json(
    raw_content: str,
    provider: str = "unknown",
) -> Optional[Dict[str, Any]]:
    """
    Repair and parse potentially malformed JSON from LLM output.

    Uses json-repair library to fix common issues like:
    - Control characters in strings
    - Trailing commas
    - Missing quotes
    - Unescaped special characters

    Args:
        raw_content: Raw JSON string from LLM (may be malformed)
        provider: Provider name for logging purposes

    Returns:
        Parsed dict if successful, None if repair failed

    Examples:
        >>> repair_llm_json('{"answer": "test",}')  # trailing comma
        {"answer": "test"}

        >>> repair_llm_json('{"answer": "line1\\nline2"}')  # control char
        {"answer": "line1\\nline2"}
    """
    if not raw_content or not raw_content.strip():
        return None

    try:
        # Try to repair and parse the JSON
        repaired = repair_json(raw_content, return_objects=True)

        if isinstance(repaired, dict):
            return repaired

        # Handle list results - LLM might output array instead of object
        if isinstance(repaired, list):
            # If list contains a single dict, extract it
            if len(repaired) == 1 and isinstance(repaired[0], dict):
                logger.info(f"[{provider}] JSON repair: extracted dict from single-element array")
                return repaired[0]

            # If list contains multiple dicts, try to find one with expected keys
            dicts_in_list = [item for item in repaired if isinstance(item, dict)]
            if dicts_in_list:
                # Return first dict that has meaningful content
                for d in dicts_in_list:
                    if any(k in d for k in ("atomic_facts", "answer", "ranking", "final_answer", "evaluations")):
                        logger.info(f"[{provider}] JSON repair: found dict with expected keys in array")
                        return d
                # Fall back to first dict
                logger.info(f"[{provider}] JSON repair: using first dict from array")
                return dicts_in_list[0]

            # List of strings/primitives - wrap as atomic_facts (common Step 2 issue)
            if all(isinstance(item, (str, int, float)) for item in repaired):
                logger.info(f"[{provider}] JSON repair: wrapped array as atomic_facts")
                return {"atomic_facts": repaired, "answer": ""}

        # If repair_json returns a string, it means it couldn't parse
        logger.warning(f"[{provider}] JSON repair returned non-dict: {type(repaired)}")
        return None

    except Exception as e:
        logger.warning(f"[{provider}] JSON repair failed: {e}")
        return None

# Priority order for extracting text from objects
TEXT_KEYS = (
    "statement",
    "fact",
    "text",
    "content",
    "description",
    "value",
    "improvement",
    "source",
    "item",
    "claim",
    "reason",
)


def normalize_string_list(
    items: Any,
    field_name: str = "items",
    provider: str = "unknown",
) -> List[str]:
    """
    Normalize a list that should contain strings but may contain objects.

    Args:
        items: The list to normalize (may be list of strings, objects, or mixed)
        field_name: Name of the field for logging purposes
        provider: Provider name for logging purposes

    Returns:
        List[str]: Normalized list of strings

    Examples:
        >>> normalize_string_list(["fact1", "fact2"])
        ["fact1", "fact2"]

        >>> normalize_string_list([{"statement": "fact1"}, "fact2"])
        ["fact1", "fact2"]

        >>> normalize_string_list([{"fact": "claim", "verified": True}])
        ["claim"]
    """
    if not items:
        return []

    if not isinstance(items, list):
        logger.warning(
            f"[{provider}] {field_name}: expected list, got {type(items).__name__}"
        )
        return []

    result: List[str] = []
    normalized_count = 0

    for item in items:
        if isinstance(item, str):
            # Already a string - keep as-is (stripped)
            if item.strip():
                result.append(item.strip())
        elif isinstance(item, dict):
            # Object - try to extract text value
            normalized_count += 1
            text = _extract_text_from_object(item)
            if text:
                result.append(text)
        elif item is not None:
            # Other types (int, float, bool) - convert to string
            result.append(str(item))

    if normalized_count > 0:
        logger.info(
            f"[{provider}] {field_name}: normalized {normalized_count}/{len(items)} "
            f"object items to strings"
        )

    return result


def normalize_to_string(value: Any, field_name: str = "field") -> str:
    """
    Normalize a value that should be a string but may be a list.

    Args:
        value: The value to normalize (string, list, or other)
        field_name: Name of the field for logging purposes

    Returns:
        str: Normalized string (lists are joined with ", ")

    Examples:
        >>> normalize_to_string("hello")
        "hello"

        >>> normalize_to_string(["good", "accurate"])
        "good, accurate"
    """
    if value is None:
        return ""

    if isinstance(value, str):
        return value.strip()

    if isinstance(value, list):
        # Join list items with comma
        str_items = [str(item).strip() for item in value if item]
        return ", ".join(str_items)

    # Other types - convert to string
    return str(value)


def _extract_text_from_object(obj: dict) -> str:
    """
    Extract text value from an object using known key patterns.

    Tries keys in priority order: statement, fact, text, content, etc.
    Falls back to first string value if no known keys found.

    Args:
        obj: Dictionary to extract text from

    Returns:
        Extracted string or empty string if extraction fails
    """
    # Try known keys in priority order
    for key in TEXT_KEYS:
        if key in obj:
            value = obj[key]
            if isinstance(value, str) and value.strip():
                return value.strip()

    # Fallback: use first non-empty string value
    for value in obj.values():
        if isinstance(value, str) and value.strip():
            return value.strip()

    return ""
