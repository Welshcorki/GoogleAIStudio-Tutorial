import asyncio
import json
import logging
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import AsyncGenerator

import uvicorn
import yt_dlp
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from google import genai
from google.genai import types

# 로깅 설정
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("yt-transcribe")

app = FastAPI(title="YouTube Audio Transcriber", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMP_DIR = BASE_DIR / "temp_audio"
TEMP_DIR.mkdir(exist_ok=True)


class VideoInfoRequest(BaseModel):
    url: str


def get_gemini_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. API 키를 등록해주세요.",
        )
    return genai.Client(api_key=api_key)


def fetch_video_info(url: str) -> dict:
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            duration = info.get("duration", 0)
            mins, secs = divmod(duration, 60)
            duration_str = f"{mins:02d}:{secs:02d}"
            return {
                "id": info.get("id"),
                "title": info.get("title"),
                "channel": info.get("uploader") or info.get("channel"),
                "duration": duration,
                "duration_formatted": duration_str,
                "thumbnail": info.get("thumbnail"),
                "url": url,
            }
        except Exception as e:
            logger.error(f"비디오 정보 추출 실패: {e}")
            raise HTTPException(status_code=400, detail=f"유튜브 영상 정보를 가져올 수 없습니다: {str(e)}")


def download_audio_from_youtube(url: str, output_folder: Path) -> Path:
    """yt-dlp를 이용해 유튜브 영상에서 최고 음질 mp3 오디오만 추출하여 다운로드합니다."""
    timestamp = int(time.time() * 1000)
    out_tmpl = str(output_folder / f"audio_{timestamp}.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": out_tmpl,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        audio_path = output_folder / f"audio_{timestamp}.mp3"
        if not audio_path.exists():
            # 확장자가 m4a/opus 등 다른 포맷으로 저장되었을 경우 탐색
            candidates = list(output_folder.glob(f"audio_{timestamp}.*"))
            if candidates:
                return candidates[0]
            raise RuntimeError("오디오 파일 다운로드에 실패했습니다.")
        return audio_path


def transcribe_audio_with_gemini(client: genai.Client, audio_file_path: Path) -> dict:
    """Gemini API에 오디오를 업로드하고 타임스탬프와 요약이 포함된 구조화된 트랜스크립트를 생성합니다."""
    logger.info(f"Gemini Files API 업로드 시작: {audio_file_path.name}")
    uploaded_file = client.files.upload(file=str(audio_file_path))

    try:
        # 파일 업로드 처리 대기
        while uploaded_file.state.name == "PROCESSING":
            time.sleep(1)
            uploaded_file = client.files.get(name=uploaded_file.name)

        if uploaded_file.state.name == "FAILED":
            raise RuntimeError("Gemini에 오디오 업로드 처리 중 오류가 발생했습니다.")

        logger.info("Gemini STT 분석 시작...")
        prompt = """
        당신은 오디오 분석 및 전사 전문 AI입니다.
        제공된 오디오를 듣고 한국어로 다음 JSON 규격에 맞추어 정확하게 전사 및 요약해 주세요:

        응답은 반드시 마크다운(```json) 없이 순수한 JSON 형식으로만 출력해야 합니다:
        {
            "summary": "영상 전체의 핵심 요약 (2~3문장)",
            "key_takeaways": [
                "핵심 포인트 1",
                "핵심 포인트 2",
                "핵심 포인트 3"
            ],
            "full_transcript": "전체 줄글 대본 텍스트",
            "segments": [
                {
                    "start": "00:00",
                    "end": "00:15",
                    "speaker": "화자 1",
                    "text": "해당 구간의 정확한 발화 내용"
                }
            ]
        }
        규칙:
        - 발화 내용은 생략하지 말고 가능한 상세히 전사해 주세요.
        - 타임스탬프는 분:초(MM:SS) 형식으로 자연스러운 문장 단위로 분할해 주세요.
        - 화자가 변경되면 적절히 화자 번호를 구분해 주세요.
        """

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=[uploaded_file, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )

        response_text = response.text.strip()
        data = json.loads(response_text)
        return data

    finally:
        # Gemini 원격 파일 삭제 정리
        try:
            client.files.delete(name=uploaded_file.name)
            logger.info("Gemini 원격 파일 삭제 완료")
        except Exception as e:
            logger.warning(f"원격 파일 삭제 중 경고: {e}")


@app.post("/api/info")
async def api_get_info(req: VideoInfoRequest):
    return fetch_video_info(req.url)


@app.get("/api/transcribe-stream")
async def api_transcribe_stream(url: str = Query(..., description="YouTube URL")):
    """SSE(Server-Sent Events)를 통해 실시간 단계별 진행상황과 최종 결과를 스트리밍합니다."""

    async def event_generator() -> AsyncGenerator[str, None]:
        client = get_gemini_client()
        temp_audio_dir = Path(tempfile.mkdtemp(dir=TEMP_DIR))
        audio_file_path = None

        try:
            # 1단계: 영상 정보 확인
            yield f"data: {json.dumps({'step': 1, 'message': '유튜브 영상 정보를 분석하고 있습니다...'}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.3)
            info = fetch_video_info(url)
            video_title = info.get("title", "영상")
            yield f"data: {json.dumps({'step': 1, 'status': 'info_done', 'info': info, 'message': f'[{video_title}] 오디오 다운로드를 준비합니다.'}, ensure_ascii=False)}\n\n"

            # 2단계: 오디오 다운로드
            yield f"data: {json.dumps({'step': 2, 'message': '영상에서 고음질 오디오를 다운로드 및 변환하고 있습니다...'}, ensure_ascii=False)}\n\n"
            loop = asyncio.get_event_loop()
            audio_file_path = await loop.run_in_executor(None, download_audio_from_youtube, url, temp_audio_dir)
            file_size_mb = audio_file_path.stat().st_size / (1024 * 1024)
            yield f"data: {json.dumps({'step': 2, 'status': 'download_done', 'message': f'오디오 다운로드 완료 ({file_size_mb:.1f} MB). Gemini AI로 전송합니다.'}, ensure_ascii=False)}\n\n"

            # 3단계: Gemini STT 및 트랜스크립트 추출
            yield f"data: {json.dumps({'step': 3, 'message': 'Google Gemini AI가 음성을 인식하고 타임스탬프와 대본을 추출하는 중입니다...'}, ensure_ascii=False)}\n\n"
            result = await loop.run_in_executor(None, transcribe_audio_with_gemini, client, audio_file_path)

            # 완료
            final_payload = {
                "step": 4,
                "status": "completed",
                "info": info,
                "transcript": result,
                "message": "트랜스크립트 추출이 성공적으로 완료되었습니다!",
            }
            yield f"data: {json.dumps(final_payload, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"전사 처리 중 오류: {e}")
            error_payload = {
                "step": -1,
                "status": "error",
                "message": f"오류가 발생했습니다: {str(e)}",
            }
            yield f"data: {json.dumps(error_payload, ensure_ascii=False)}\n\n"

        finally:
            # 로컬 임시 폴더 삭제 정리
            if temp_audio_dir.exists():
                shutil.rmtree(temp_audio_dir, ignore_errors=True)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# 정적 파일 서빙 (Frontend 빌드 산출물 서빙)
if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # API 경로는 가로채지 않음
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API Not Found")
        
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "Frontend build not found. Please build frontend first."}
else:
    @app.get("/")
    async def root_index():
        return {"message": "Static directory not found. Please build frontend to 'static/'."}


if __name__ == "__main__":
    print("\n" + "=" * 55)
    print(" 🚀 YouTube Audio Transcriber Web Service")
    print(" 👉 브라우저 접속 주소: http://localhost:8000")
    print("=" * 55 + "\n")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
