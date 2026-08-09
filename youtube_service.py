import os
import re
import tempfile
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
import yt_dlp
from google import genai
from google.genai import types

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def extract_video_id(url_or_id: str) -> Optional[str]:
    """
    Extracts 11-character YouTube video ID from various URL formats or raw ID.
    """
    if not url_or_id:
        return None
    
    url_or_id = url_or_id.strip()
    
    # Direct 11-character ID
    if len(url_or_id) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
        
    patterns = [
        r'(?:v=|\/)([a-zA-Z0-9_-]{11})(?:[\?&]|$)',
        r'youtu\.be\/([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/v\/([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
            
    return None

def format_timestamp(seconds: float) -> str:
    """Format seconds into HH:MM:SS or MM:SS."""
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

class YouTubeExtractor:
    def __init__(self, gemini_api_key: Optional[str] = None):
        self.gemini_api_key = gemini_api_key or os.environ.get("GEMINI_API_KEY")

    def get_transcript(
        self, 
        video_url_or_id: str, 
        cookies_content: Optional[str] = None, 
        preferred_languages: List[str] = None
    ) -> Dict[str, Any]:
        """
        Main method to get transcript using 3 layered fallback strategies:
        1. youtube-transcript-api (Fastest, clean)
        2. yt-dlp subtitle download
        3. Audio download + Gemini 2.0 Flash Audio Transcription
        """
        video_id = extract_video_id(video_url_or_id)
        if not video_id:
            return {
                "success": False,
                "error_code": "invalid_url",
                "error": "Invalid URL, or no video ID could be found."
            }
            
        if not preferred_languages:
            preferred_languages = ['th', 'en', 'auto']
            
        cookie_file_path = None
        if cookies_content and cookies_content.strip():
            try:
                temp_cookie = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8')
                temp_cookie.write(cookies_content)
                temp_cookie.close()
                cookie_file_path = temp_cookie.name
            except Exception as e:
                logger.error(f"Error creating temp cookie file: {e}")

        try:
            # --- Strategy 1: youtube-transcript-api ---
            logger.info(f"Attempting Strategy 1 (youtube-transcript-api) for video {video_id}")
            result = self._fetch_via_official_api(video_id, cookie_file_path, preferred_languages)
            if result.get("success"):
                result["method"] = "subtitles_official_api"
                result["video_id"] = video_id
                return result
                
            # --- Strategy 2: yt-dlp Subtitle Extraction ---
            logger.info(f"Attempting Strategy 2 (yt-dlp subtitles) for video {video_id}")
            result = self._fetch_via_ytdlp_subtitles(video_id, cookie_file_path, preferred_languages)
            if result.get("success"):
                result["method"] = "subtitles_ytdlp"
                result["video_id"] = video_id
                return result

            # --- Strategy 3: Audio Download + Gemini Audio STT ---
            logger.info(f"Attempting Strategy 3 (Audio Extraction + AI STT) for video {video_id}")
            result = self._transcribe_via_audio_ai(video_id, cookie_file_path)
            if result.get("success"):
                result["method"] = "ai_audio_transcription"
                result["video_id"] = video_id
                return result
                
            return {
                "success": False,
                "video_id": video_id,
                "error_code": "no_transcript",
                "error": "This video's text could not be retrieved. Check that you have permission to watch it and that it is not restricted."
            }

        finally:
            if cookie_file_path and os.path.exists(cookie_file_path):
                try:
                    os.remove(cookie_file_path)
                except Exception as e:
                    logger.error(f"Failed to remove temp cookie file: {e}")

    def _fetch_via_official_api(
        self, 
        video_id: str, 
        cookie_file_path: Optional[str], 
        languages: List[str]
    ) -> Dict[str, Any]:
        try:
            api = YouTubeTranscriptApi()
            kwargs = {}
            if cookie_file_path:
                kwargs['cookies'] = cookie_file_path
                
            # Attempt to fetch directly with preferred languages
            fetched = None
            try:
                fetched = api.fetch(video_id, languages=languages, **kwargs)
            except Exception:
                try:
                    transcript_list = api.list(video_id, **kwargs)
                    for tr in transcript_list:
                        fetched = tr.fetch()
                        break
                except Exception as list_err:
                    logger.warning(f"List transcripts failed: {list_err}")

            if not fetched:
                return {"success": False, "error": "No subtitle track found"}

            items = []
            full_text_lines = []
            
            snippets = getattr(fetched, 'snippets', [])
            if not snippets and isinstance(fetched, list):
                snippets = fetched

            for entry in snippets:
                if hasattr(entry, 'start'):
                    start = getattr(entry, 'start', 0.0)
                    text = getattr(entry, 'text', '').strip()
                    duration = getattr(entry, 'duration', 0.0)
                elif isinstance(entry, dict):
                    start = entry.get('start', 0.0)
                    text = entry.get('text', '').strip()
                    duration = entry.get('duration', 0.0)
                else:
                    continue

                if text:
                    timestamp_str = format_timestamp(start)
                    items.append({
                        "timestamp": timestamp_str,
                        "start": start,
                        "duration": duration,
                        "text": text
                    })
                    full_text_lines.append(f"[{timestamp_str}] {text}")

            full_text = "\n".join(full_text_lines)
            raw_text_only = " ".join([item["text"] for item in items])
            
            return {
                "success": True,
                "language": getattr(fetched, 'language', 'unknown'),
                "is_generated": getattr(fetched, 'is_generated', False),
                "items": items,
                "full_text_timestamped": full_text,
                "full_text_clean": raw_text_only
            }
        except (TranscriptsDisabled, NoTranscriptFound) as e:
            logger.warning(f"Official API transcript not found: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.warning(f"Official API error: {e}")
            return {"success": False, "error": str(e)}

    def _fetch_via_ytdlp_subtitles(
        self, 
        video_id: str, 
        cookie_file_path: Optional[str], 
        languages: List[str]
    ) -> Dict[str, Any]:
        ydl_opts = {
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': languages + ['th', 'en'],
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
        }
        if cookie_file_path:
            ydl_opts['cookiefile'] = cookie_file_path

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                
                subtitles = info.get('subtitles', {})
                auto_subtitles = info.get('automatic_captions', {})
                
                chosen_sub = None
                # Priority: manual subtitles in preferred languages -> auto subtitles
                for lang in languages:
                    if lang in subtitles:
                        chosen_sub = subtitles[lang]
                        break
                if not chosen_sub:
                    for lang in languages:
                        if lang in auto_subtitles:
                            chosen_sub = auto_subtitles[lang]
                            break
                            
                if not chosen_sub and subtitles:
                    chosen_sub = list(subtitles.values())[0]
                if not chosen_sub and auto_subtitles:
                    chosen_sub = list(auto_subtitles.values())[0]

                if not chosen_sub:
                    return {"success": False, "error": "No subtitles found via yt-dlp"}

                # Find json3 or vtt format
                json_format = next((f for f in chosen_sub if f.get('ext') == 'json3'), None)
                if json_format:
                    # Download json3 subtitle directly
                    import requests
                    resp = requests.get(json_format['url'], timeout=10, verify=False)
                    if resp.status_code == 200:
                        sub_json = resp.json()
                        items = []
                        full_lines = []
                        for event in sub_json.get('events', []):
                            start_ms = event.get('tStartMs', 0)
                            segs = event.get('segs', [])
                            text = "".join([s.get('utf8', '') for s in segs]).strip()
                            if text and text != "\n":
                                timestamp_str = format_timestamp(start_ms / 1000.0)
                                items.append({
                                    "timestamp": timestamp_str,
                                    "start": start_ms / 1000.0,
                                    "text": text
                                })
                                full_lines.append(f"[{timestamp_str}] {text}")

                        if items:
                            return {
                                "success": True,
                                "items": items,
                                "full_text_timestamped": "\n".join(full_lines),
                                "full_text_clean": " ".join([i['text'] for i in items])
                            }

                return {"success": False, "error": "Could not parse subtitle format"}
        except Exception as e:
            logger.warning(f"yt-dlp subtitle extraction error: {e}")
            return {"success": False, "error": str(e)}

    def _transcribe_via_audio_ai(
        self, 
        video_id: str, 
        cookie_file_path: Optional[str]
    ) -> Dict[str, Any]:
        """
        Downloads audio stream and uses Gemini 2.0 Flash API to generate full transcript with timestamps.
        """
        api_key = self.gemini_api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {
                "success": False,
                "error_code": "stt_api_key_required",
                "error": "This video has no subtitles, so a Gemini API Key is required to transcribe its audio (speech-to-text)."
            }

        with tempfile.TemporaryDirectory() as temp_dir:
            audio_path = os.path.join(temp_dir, "audio.m4a")
            ydl_opts = {
                'format': 'm4a/bestaudio/best',
                'outtmpl': os.path.join(temp_dir, 'audio.%(ext)s'),
                'quiet': True,
                'no_warnings': True,
                'nocheckcertificate': True,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'm4a',
                    'preferredquality': '128',
                }],
            }
            if cookie_file_path:
                ydl_opts['cookiefile'] = cookie_file_path

            try:
                logger.info("Downloading audio for AI transcription...")
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
                
                # Check for output file
                actual_files = [os.path.join(temp_dir, f) for f in os.listdir(temp_dir) if f.startswith("audio.")]
                if not actual_files:
                    return {"success": False, "error": "Failed to download audio file"}
                
                audio_file_path = actual_files[0]
                
                # Upload file to Gemini File API
                client = genai.Client(api_key=api_key)
                logger.info(f"Uploading audio file {audio_file_path} to Gemini File API...")
                audio_file = client.files.upload(file=audio_file_path)
                
                prompt = (
                    "คุณเป็นผู้เชี่ยวชาญด้านการถอดเสียง (Audio Transcription) โปรดถอดข้อความทั้งหมดจากไฟล์เสียงนี้อย่างถูกต้องและแม่นยำที่สุด "
                    "ระบุช่วงเวลา (Timestamp) กำกับในรูปแบบ [MM:SS] หรือ [HH:MM:SS] ทุกๆ การเปลี่ยนประเด็นหรือทุกๆ 30-60 วินาที "
                    "หากเป็นภาษาไทยให้เขียนสะกดคำภาษาไทยอย่างถูกต้อง "
                    "ผลลัพธ์ให้ส่งออกมาในรูปแบบ:\n"
                    "[00:00] ข้อความแรก...\n"
                    "[00:30] ข้อความถัดไป...\n"
                )
                
                logger.info("Calling Gemini 2.0 Flash for audio transcription...")
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[audio_file, prompt]
                )
                
                # Clean up uploaded file from Gemini storage
                try:
                    client.files.delete(name=audio_file.name)
                except Exception:
                    pass

                text_response = response.text or ""
                
                # Parse timestamped response into items
                items = []
                lines = text_response.strip().split("\n")
                clean_texts = []
                
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    ts_match = re.match(r'^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)', line)
                    if ts_match:
                        ts, txt = ts_match.group(1), ts_match.group(2)
                        items.append({"timestamp": ts, "text": txt})
                        clean_texts.append(txt)
                    else:
                        clean_texts.append(line)

                return {
                    "success": True,
                    "items": items,
                    "full_text_timestamped": text_response,
                    "full_text_clean": "\n".join(clean_texts)
                }

            except Exception as e:
                logger.error(f"Error during audio transcription: {e}")
                return {
                    "success": False,
                    "error_code": "stt_failed",
                    "error": f"Audio STT failed: {str(e)}"
                }

