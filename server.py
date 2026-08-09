import os
import logging
from typing import Optional, List
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from youtube_service import YouTubeExtractor
from ai_summarizer import AISummarizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YouTube Transcript & AI Summarizer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExtractRequest(BaseModel):
    url: str
    cookies_text: Optional[str] = None
    gemini_api_key: Optional[str] = None
    languages: Optional[List[str]] = ["en", "th"]

class SummarizeRequest(BaseModel):
    transcript_text: str
    summary_type: Optional[str] = "article"
    custom_instructions: Optional[str] = None
    gemini_api_key: Optional[str] = None
    language: Optional[str] = "en"

@app.post("/api/extract")
async def extract_transcript(req: ExtractRequest):
    logger.info(f"Extract request received for URL: {req.url}")
    extractor = YouTubeExtractor(gemini_api_key=req.gemini_api_key)
    
    result = extractor.get_transcript(
        video_url_or_id=req.url,
        cookies_content=req.cookies_text,
        preferred_languages=req.languages
    )
    
    if not result.get("success"):
        return JSONResponse(status_code=400, content=result)
        
    return result

@app.post("/api/summarize")
async def summarize_transcript(req: SummarizeRequest):
    logger.info(f"Summarize request received (type: {req.summary_type})")
    summarizer = AISummarizer(api_key=req.gemini_api_key)
    
    result = summarizer.summarize(
        transcript_text=req.transcript_text,
        summary_type=req.summary_type,
        custom_instructions=req.custom_instructions,
        language=req.language
    )
    
    if not result.get("success"):
        return JSONResponse(status_code=400, content=result)
        
    return result

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "gemini_key_set": bool(os.environ.get("GEMINI_API_KEY"))}

# Mount static directory if exists
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/favicon.ico")
async def serve_favicon():
    """Browsers request /favicon.ico at the root even when <link> tags point elsewhere."""
    icon_path = os.path.join(static_dir, "favicon.svg")
    if os.path.exists(icon_path):
        return FileResponse(icon_path, media_type="image/svg+xml")
    return JSONResponse(status_code=404, content={"error": "not found"})

@app.get("/")
async def serve_index():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "API Server is running. Frontend static files not found."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
