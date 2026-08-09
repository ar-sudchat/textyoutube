import os
import logging
from typing import Dict, Any, Optional
from google import genai

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prompt templates are written in English and stay language-neutral; the desired
# output language is appended separately (see LANGUAGE_NAMES) so adding a new
# language never requires rewriting a template.
PROMPTS = {
    "article": (
        "You are a senior editor and expert article writer. "
        "Take the video transcript below and rewrite it as a **complete, polished article** "
        "that is easy to read, engaging and professional.\n\n"
        "Requirements:\n"
        "- Give it a compelling title (H1)\n"
        "- Open with an introduction that captures the core message\n"
        "- Break the body into subsections (H2, H3) covering every important point in the video\n"
        "- Close with a conclusion offering takeaways or practical applications\n"
        "- Write clearly, concisely and enjoyably\n"
        "- Format with Markdown (bold, headings and lists used tastefully)"
    ),
    "executive_summary": (
        "Summarise the video transcript below as an **Executive Summary**:\n\n"
        "- **Main topic**: one sentence\n"
        "- **Top 5 key points**: short, sharp bullets\n"
        "- **Key takeaway & impact**: 2-3 sentences\n"
        "- Format with Markdown, as clear and concise as possible"
    ),
    "key_takeaways": (
        "Extract **all the key takeaways** from the video transcript below:\n\n"
        "- Group the points by theme or topic\n"
        "- Under each heading, spell out the details, insights, facts or techniques discussed\n"
        "- Report any numbers, statistics, specific recommendations, names or places precisely\n"
        "- Format with Markdown, clean and easy to scan"
    ),
    "timestamps": (
        "Build a **timestamped outline (table of contents)** from the transcript below:\n\n"
        "- List the topics in chronological order using [MM:SS] or [HH:MM:SS]\n"
        "- For each timestamp, summarise briefly what is being discussed at that point\n"
        "- Format as a Markdown list"
    ),
    "full_report": (
        "Produce a **comprehensive full report** from the transcript below:\n\n"
        "1. **Executive Summary**\n"
        "2. **Detailed Article**, broken into subsections\n"
        "3. **Key Takeaways**\n"
        "4. **Timestamped Breakdown**\n\n"
        "Format with Markdown — readable, professional and complete."
    ),
}

# Output languages offered by the UI. Add an entry here to support a new one.
LANGUAGE_NAMES = {
    "en": "English",
    "th": "Thai (ภาษาไทย)",
    "zh": "Simplified Chinese (简体中文)",
    "ja": "Japanese (日本語)",
}

DEFAULT_LANGUAGE = "en"

MAX_TRANSCRIPT_CHARS = 150000


class AISummarizer:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")

    def summarize(
        self,
        transcript_text: str,
        summary_type: str = "article",
        custom_instructions: Optional[str] = None,
        language: str = DEFAULT_LANGUAGE
    ) -> Dict[str, Any]:
        """
        Summarizes transcript text using Gemini 2.0 Flash.
        """
        api_key = self.api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {
                "success": False,
                "error_code": "missing_api_key",
                "error": "No Gemini API Key found. Set one in settings or via the GEMINI_API_KEY environment variable."
            }

        if not transcript_text or not transcript_text.strip():
            return {
                "success": False,
                "error_code": "empty_transcript",
                "error": "There is no transcript text to summarise."
            }

        prompt_base = PROMPTS.get(summary_type, PROMPTS["article"])

        if custom_instructions and custom_instructions.strip():
            prompt_base += f"\n\nAdditional instructions from the user:\n{custom_instructions.strip()}"

        language_name = LANGUAGE_NAMES.get(language, LANGUAGE_NAMES[DEFAULT_LANGUAGE])
        prompt_base += (
            f"\n\nWrite the entire response in fluent, natural {language_name}. "
            f"Use {language_name} for every heading, label and body paragraph, "
            "regardless of the language spoken in the video."
        )

        full_prompt = (
            f"{prompt_base}\n\n"
            f"--- VIDEO TRANSCRIPT ---\n"
            f"{transcript_text[:MAX_TRANSCRIPT_CHARS]}\n"
            f"------------------------"
        )

        try:
            client = genai.Client(api_key=api_key)
            logger.info(
                f"Generating AI summary using gemini-2.0-flash "
                f"(type: {summary_type}, language: {language})..."
            )

            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=full_prompt
            )

            summary_md = response.text or ""
            return {
                "success": True,
                "summary_type": summary_type,
                "language": language,
                "result": summary_md
            }
        except Exception as e:
            logger.error(f"Error during AI summarization: {e}")
            return {
                "success": False,
                "error_code": "summarize_failed",
                "error": f"AI summarisation failed: {str(e)}"
            }
