import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

import yt_dlp
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from google import genai
from google.genai import types

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("TubeFinder")

# 디렉토리 설정
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMP_DIR = BASE_DIR / "temp_audio"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="AI YouTube Searcher API",
    description="gemini-3.5-transcribe 및 gemini-3.8-flash 기반 유튜브 검색 & Q&A 서비스",
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_genai_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.",
        )
    return genai.Client(api_key=api_key)


def fetch_video_info(url: str) -> Dict[str, Any]:
    """yt-dlp를 사용하여 유튜브 영상의 메타데이터를 추출합니다."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            duration = info.get("duration", 0)
            mins, secs = divmod(duration, 60)
            hours, mins = divmod(mins, 60)
            duration_formatted = (
                f"{hours:02d}:{mins:02d}:{secs:02d}"
                if hours > 0
                else f"{mins:02d}:{secs:02d}"
            )

            return {
                "id": info.get("id"),
                "title": info.get("title", "제목 없음"),
                "channel": info.get("uploader", "알 수 없는 채널"),
                "duration": duration,
                "duration_formatted": duration_formatted,
                "thumbnail": info.get("thumbnail"),
                "view_count": info.get("view_count", 0),
                "webpage_url": info.get("webpage_url", url),
            }
        except Exception as e:
            logger.error(f"영상 메타데이터 추출 오류: {e}")
            raise HTTPException(status_code=400, detail=f"유튜브 정보를 가져오지 못했습니다: {e}")


def download_audio_from_youtube(url: str, output_dir: Path) -> Path:
    """yt-dlp를 사용해 고음질 오디오(mp3)를 추출하여 다운로드합니다."""
    output_template = str(output_dir / "%(id)s.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        video_id = info.get("id")
        audio_file = output_dir / f"{video_id}.mp3"
        if not audio_file.exists():
            for f in output_dir.glob(f"{video_id}.*"):
                if f.suffix in [".mp3", ".m4a", ".wav", ".opus"]:
                    return f
            raise FileNotFoundError("오디오 다운로드 파일을 찾을 수 없습니다.")
        return audio_file


import csv
from datetime import datetime

# CSV 캐시 파일 설정
CSV_FILE = BASE_DIR / "transcripts.csv"
CSV_FIELDNAMES = [
    "url",
    "video_id",
    "title",
    "channel",
    "duration_formatted",
    "full_transcript",
    "segments_json",
    "created_at",
]


def init_csv_cache():
    if not CSV_FILE.exists():
        with open(CSV_FILE, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
            writer.writeheader()


def get_cached_transcript(url: str, video_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """CSV 파일에서 캐시된 트랜스크립트를 검색합니다."""
    init_csv_cache()
    if not CSV_FILE.exists():
        return None

    norm_url = url.strip().rstrip("/")
    try:
        with open(CSV_FILE, "r", newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                row_url = (row.get("url") or "").strip().rstrip("/")
                row_id = (row.get("video_id") or "").strip()
                if (norm_url and norm_url == row_url) or (video_id and video_id == row_id):
                    try:
                        segments = json.loads(row.get("segments_json", "[]"))
                    except Exception:
                        segments = []
                    return {
                        "info": {
                            "id": row.get("video_id"),
                            "title": row.get("title"),
                            "channel": row.get("channel"),
                            "duration_formatted": row.get("duration_formatted"),
                            "webpage_url": row.get("url"),
                        },
                        "transcript": {
                            "full_transcript": row.get("full_transcript", ""),
                            "segments": segments,
                        },
                    }
    except Exception as e:
        logger.warning(f"CSV 캐시 읽기 오류: {e}")
    return None


def save_transcript_to_csv(url: str, info: Dict[str, Any], transcript: Dict[str, Any]):
    """추출된 트랜스크립트를 CSV 파일에 저장(캐싱)합니다."""
    init_csv_cache()
    try:
        # 이미 동일 URL이 저장되어 있는지 확인
        if get_cached_transcript(url, info.get("id")):
            logger.info(f"이미 CSV에 저장된 항목입니다: {url}")
            return

        with open(CSV_FILE, "a", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
            writer.writerow({
                "url": url.strip(),
                "video_id": info.get("id", ""),
                "title": info.get("title", ""),
                "channel": info.get("channel", ""),
                "duration_formatted": info.get("duration_formatted", ""),
                "full_transcript": transcript.get("full_transcript", ""),
                "segments_json": json.dumps(transcript.get("segments", []), ensure_ascii=False),
                "created_at": datetime.now().isoformat(),
            })
        logger.info(f"트랜스크립트가 CSV 파일에 성공적으로 저장되었습니다: {CSV_FILE.name}")
    except Exception as e:
        logger.error(f"CSV 저장 오류: {e}")


def transcribe_audio_with_gemini_35(client: genai.Client, audio_path: Path) -> Dict[str, Any]:
    """gemini-3.5-transcribe 모델을 사용하여 오디오 전사, 타임스탬프 및 화자 분리 추출"""
    logger.info(f"Gemini에 오디오 파일 업로드 시작: {audio_path.name}")
    uploaded_file = client.files.upload(file=str(audio_path))
    logger.info(f"업로드 완료. File URI: {uploaded_file.uri}, Name: {uploaded_file.name}")

    try:
        # 파일 처리 상태 대기
        import time
        max_wait = 60
        waited = 0
        while uploaded_file.state.name == "PROCESSING" and waited < max_wait:
            time.sleep(1)
            waited += 1
            uploaded_file = client.files.get(name=uploaded_file.name)

        if uploaded_file.state.name != "ACTIVE":
            raise RuntimeError(f"파일 처리 실패: 상태={uploaded_file.state.name}")

        config = types.GenerateContentConfig(
            audio_transcription_config=types.AudioTranscriptionConfig(
                word_timestamp=True,
                diarization=True,
            )
        )

        response = client.models.generate_content(
            model="gemini-3.5-transcribe",
            contents=[uploaded_file],
            config=config,
        )

        segments = []
        full_transcript_lines = []

        # candidates[0].content.parts 순회 (audio_transcription 객체 파싱)
        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                at = getattr(part, "audio_transcription", None)
                if at:
                    # 화자 분리 라벨 처리 (spk:0 -> 화자 1, spk:1 -> 화자 2 등)
                    raw_spk = at.speaker_label or "화자"
                    if raw_spk.startswith("spk:"):
                        try:
                            spk_idx = int(raw_spk.split(":")[1]) + 1
                            speaker_name = f"화자 {spk_idx}"
                        except Exception:
                            speaker_name = raw_spk
                    else:
                        speaker_name = raw_spk

                    text = (at.text or "").strip()
                    if not text:
                        continue

                    # 첫 단어의 start_offset에서 시작 시간(초) 계산
                    start_seconds = 0.0
                    if at.words and len(at.words) > 0 and at.words[0].start_offset:
                        offset_str = at.words[0].start_offset
                        try:
                            start_seconds = float(str(offset_str).rstrip("s"))
                        except ValueError:
                            start_seconds = 0.0

                    mins = int(start_seconds // 60)
                    secs = int(start_seconds % 60)
                    time_formatted = f"{mins:02d}:{secs:02d}"

                    segments.append({
                        "time": time_formatted,
                        "speaker": speaker_name,
                        "text": text,
                    })
                    full_transcript_lines.append(f"[{time_formatted}] {speaker_name}: {text}")

        # 만약 audio_transcription 파트가 비어있는 경우의 Fallback
        if not segments and response.text:
            raw_text = response.text.strip()
            paragraphs = [p.strip() for p in raw_text.split("\n") if p.strip()]
            segments = [{"time": "00:00", "speaker": "화자", "text": p} for p in paragraphs]
            full_transcript_lines = [p for p in paragraphs]

        full_transcript = "\n".join(full_transcript_lines)

        return {
            "full_transcript": full_transcript,
            "segments": segments,
        }
    finally:
        # 원격 업로드 파일 정리
        try:
            client.files.delete(name=uploaded_file.name)
            logger.info(f"원격 임시 파일 삭제 완료: {uploaded_file.name}")
        except Exception as e:
            logger.warning(f"원격 파일 삭제 실패: {e}")


# API 라우트
class QuestionRequest(BaseModel):
    question: str
    transcript: str
    video_title: Optional[str] = "YouTube Video"


@app.post("/api/info")
async def get_info(data: Dict[str, str]):
    url = data.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL이 필요합니다.")
    return fetch_video_info(url)


@app.get("/api/process-stream")
async def process_stream(url: str):
    """SSE 실시간 스트림: CSV 캐시 확인 ➔ (없을 시) 다운로드 & 전사 ➔ CSV 저장"""
    if not url:
        raise HTTPException(status_code=400, detail="url 파라미터가 누락되었습니다.")

    client = get_genai_client()
    import uuid
    session_id = uuid.uuid4().hex[:8]
    temp_dir = TEMP_DIR / session_id
    temp_dir.mkdir(parents=True, exist_ok=True)

    async def event_generator():
        audio_file = None
        try:
            # 1단계: CSV 캐시 확인
            yield f"data: {json.dumps({'step': 1, 'message': '저장된 트랜스크립트(CSV)가 있는지 확인하고 있습니다...'}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.3)

            cached_data = get_cached_transcript(url)
            if cached_data:
                info = cached_data["info"]
                transcript = cached_data["transcript"]
                video_title = info.get("title", "동영상")
                logger.info(f"CSV 캐시에서 트랜스크립트 로드 완료: {url}")
                yield f"data: {json.dumps({'step': 1, 'status': 'info_done', 'info': info, 'message': f'[{video_title}] 저장된 트랜스크립트(CSV)를 발견했습니다!'}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.3)
                final_data = {
                    "step": 4,
                    "status": "completed",
                    "info": info,
                    "transcript": transcript,
                    "from_cache": True,
                    "message": "저장된 트랜스크립트(CSV)를 성공적으로 불러왔습니다!",
                }
                yield f"data: {json.dumps(final_data, ensure_ascii=False)}\n\n"
                return

            # 캐시가 없는 경우: 영상 메타데이터 추출
            info = fetch_video_info(url)
            video_title = info.get("title", "동영상")
            yield f"data: {json.dumps({'step': 1, 'status': 'info_done', 'info': info, 'message': f'[{video_title}] 오디오 다운로드를 시작합니다.'}, ensure_ascii=False)}\n\n"

            # 2단계: 오디오 다운로드
            yield f"data: {json.dumps({'step': 2, 'message': '고음질 오디오 스트림을 추출하고 있습니다...'}, ensure_ascii=False)}\n\n"
            loop = asyncio.get_event_loop()
            audio_file = await loop.run_in_executor(None, download_audio_from_youtube, url, temp_dir)
            size_mb = audio_file.stat().st_size / (1024 * 1024)
            yield f"data: {json.dumps({'step': 2, 'status': 'download_done', 'message': f'오디오 추출 완료 ({size_mb:.1f} MB). Gemini 3.5 Transcribe로 전송합니다.'}, ensure_ascii=False)}\n\n"

            # 3단계: gemini-3.5-transcribe 전사 (타임스탬프 & 화자 분리)
            yield f"data: {json.dumps({'step': 3, 'message': 'Google Gemini 3.5 Transcribe 모델이 화자 분리 및 타임스탬프를 추출 중입니다...'}, ensure_ascii=False)}\n\n"
            result = await loop.run_in_executor(None, transcribe_audio_with_gemini_35, client, audio_file)

            # CSV 파일에 저장 (캐싱)
            save_transcript_to_csv(url, info, result)

            # 4단계: 완료
            final_data = {
                "step": 4,
                "status": "completed",
                "info": info,
                "transcript": result,
                "from_cache": False,
                "message": "음성 전사 및 CSV 파일 저장이 완료되었습니다!",
            }
            yield f"data: {json.dumps(final_data, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"작업 오류: {e}", exc_info=True)
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            if audio_file and audio_file.exists():
                try:
                    audio_file.unlink()
                except Exception:
                    pass
            try:
                temp_dir.rmdir()
            except Exception:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/ask")
async def ask_question(req: QuestionRequest):
    """gemini-3.8-flash 모델을 사용하여 트랜스크립트 기반 영상 Q&A 수행"""
    client = get_genai_client()

    if not req.question.strip():
        raise HTTPException(status_code=400, detail="질문 내용을 입력해주세요.")

    prompt = f"""
    당신은 영상 분석 및 어시스턴트 AI입니다.
    사용자가 시청 중인 유튜브 영상의 제목과 트랜스크립트(타임스탬프 포함)는 다음과 같습니다:

    [영상 제목] {req.video_title}

    [영상 트랜스크립트]
    {req.transcript[:30000]}

    [사용자의 질문]
    {req.question}

    [답변 지침]
    1. 반드시 위 트랜스크립트의 실제 대화 내용을 기반으로 한국어로 정직하고 명확하게 답변하세요.
    2. 답변 내용에 관련된 영상의 시간 위치가 있다면 반드시 '[MM:SS]' 형식(예: [08:50] 또는 [01:25])으로 문장 중에 언급해 주세요. (사용자가 이를 클릭해 해당 시간으로 바로 점프합니다)
    3. 핵심을 짚어 친절하게 설명해 주세요.
    """

    try:
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt,
        )
        return {"answer": response.text}
    except Exception as e:
        logger.error(f"Gemini 3.8 Flash Q&A 오류: {e}")
        raise HTTPException(status_code=500, detail=f"AI 질의응답 처리 중 오류: {e}")


# 정적 파일 서빙 (Frontend 산출물)
if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
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
        return {"message": "Static directory not found. Please build frontend."}


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 55)
    print(" 🚀 AI 유튜브 검색기 (TubeFinder AI) 웹서비스")
    print(" 👉 브라우저 접속 주소: http://localhost:8001")
    print("=" * 55 + "\n")
    uvicorn.run("server:app", host="127.0.0.1", port=8001, reload=True)
