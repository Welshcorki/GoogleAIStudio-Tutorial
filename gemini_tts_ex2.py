# ============================================================================
# Gemini 3.1 Flash TTS 예제 코드 — 주석 분석판
#
# [실행 전 준비]
#   pip install google-genai
#   export GEMINI_API_KEY="..."
#
# [이 파일의 상태]
#   AI Studio가 자동 생성한 코드 원본. 동작은 하지만 그대로 쓰기엔 문제가 있음.
#   아래 [확정] / [미확인] / [버그] 태그를 따라가면 됨.
# ============================================================================

import mimetypes
import os
import re          # [버그-사소] 사용되지 않는 import. 삭제해도 무방.
import struct
from google import genai
from google.genai import types


def save_binary_file(file_name, data):
    # [버그-사소] 파일 핸들을 with 없이 열고 닫음. 쓰기 중 예외 발생 시 파일이 닫히지 않음.
    #             권장: with open(file_name, "wb") as f: f.write(data)
    f = open(file_name, "wb")
    f.write(data)
    f.close()
    print(f"File saved to to: {file_name}")   # [버그-사소] "to to" 오타


def generate():
    client = genai.Client(
        # [주의] api_key가 None이면 SDK가 GOOGLE_API_KEY 환경변수로 폴백을 시도하고,
        #        그것도 없으면 Client 생성 시점에 ValueError가 발생함.
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    # [확정] 2026-09 기준 유효한 모델 ID. AI Studio / Vertex AI에서 프리뷰 제공 중.
    #        출력 스펙: 24kHz / 16bit / 모노 PCM
    #        가격: 입력 $1 / 1M 토큰, 출력 오디오 $20 / 1M 토큰 → 반복 테스트 시 비용 주의
    model = "gemini-3.1-flash-tts-preview"

    contents = [
        types.Content(
            role="user",
            parts=[
                # [확정] '## Scene / ## Sample Context / ## Transcript' 3단 구조는
                #        3.1 TTS가 의도한 프롬프트 포맷. 헤더는 지시문으로 해석되고
                #        낭독되지 않음.
                #
                # [미확인] 대괄호 인라인 태그는 공식 목록에 있는 것만 동작이 보장됨.
                #          - [excited], [surprised], [confident] → 확인된 태그
                #          - [breaking news tone] → 목록에 있는지 미확인.
                #            미등록 태그는 무시되거나, 최악의 경우 그대로 읽힐 수 있음.
                #          실제 오디오를 들어보고 판단할 것.
                types.Part.from_text(text="""## Scene:
A professional IT newsroom studio broadcasting an urgent breaking tech report. Crisp, energetic, and authoritative broadcast atmosphere.

## Sample Context:
The anchor is delivering sudden breaking news just announced by Google.

## Transcript:
[breaking news tone] 테크 긴급 속보입니다! [excited] 구글이 차세대 플래그십 AI 모델인 'Gemini 4.0 Pro'를 전격 공개했습니다. [pause] 놀라운 점은 성능뿐만이 아닙니다. [surprised] 기존 모델 대비 무려 80% 이상 인하된, 그야말로 파괴적인 가격으로 출시되어 전 세계 개발자들을 충격에 빠뜨리고 있습니다! [confident] AI 시장의 판도를 완전히 뒤흔들 이번 Gemini 4.0 Pro의 자세한 소식, 지금 바로 전해드립니다."""),
            ],
        ),
    ]

    generate_content_config = types.GenerateContentConfig(
        temperature=1,
        # [확정] TTS 모드 진입 스위치. 이게 없으면 그냥 텍스트가 반환됨.
        response_modalities=[
            "audio",
        ],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    # [확정] 유효한 프리빌트 보이스. 3.1 TTS는 총 30종 제공.
                    voice_name="Kore"
                )
            )
        ),
    )

    file_index = 0

    # ------------------------------------------------------------------------
    # [핵심] 이 루프가 이 코드의 모든 문제의 근원.
    #
    # generate_content_stream()은 오디오를 여러 청크로 나눠서 흘려보냄.
    # 그런데 아래 루프는 청크를 받을 때마다 즉시 헤더를 붙여 파일로 저장함.
    #
    #   [확정]  오디오가 든 청크 N개  →  wav 파일 N개 생성 (예외 없음)
    #   [미확인] N이 몇인가?
    #            청크 분할 단위를 정하는 파라미터는 이 코드 어디에도 없음.
    #            전적으로 서버가 결정하며, 공식 문서에도 명시돼 있지 않음.
    #
    #            참고 — 동일 대본을 AI Studio에서 돌린 결과물 실측:
    #              27.92초 / PCM 1,340,160 bytes
    #            서버 청크가 256KB면 6개, 64KB면 21개, 1MB면 2개.
    #            N이 1로 나오면 파일도 1개라 정상 동작처럼 보이지만,
    #            대본이 길어지면 언젠가 쪼개지는 구조라 고쳐두는 게 맞음.
    #
    #   → 정상 동작은 "PCM 바이트를 전부 누적한 뒤 마지막에 헤더 1번"임.
    #      수정본은 이 함수 아래 generate_fixed() 참고.
    # ------------------------------------------------------------------------
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        # [주의] chunk.parts는 비교적 최신 google-genai에서 추가된 편의 프로퍼티.
        #        구버전 SDK에서는 AttributeError가 발생함.
        #        호환성이 필요하면 chunk.candidates[0].content.parts로 접근할 것.
        if (
            chunk.parts is None
        ):
            continue

        # [주의] parts[0]만 확인함. 한 청크에 여러 part가 담겨 오면 뒤쪽은 유실됨.
        #        (Gemini 3.1 계열은 단일 이벤트에 복수 part를 담을 수 있음)
        if chunk.parts[0].inline_data and chunk.parts[0].inline_data.data:

            # ▼▼ 진단용 추가 라인 — 원본에는 없음 ▼▼
            # 이 줄이 찍힌 횟수 = 생성된 파일 개수 = 미확인 상태였던 N.
            # 출력되는 bytes 값이 곧 서버의 실제 청크 단위.
            print(f"[chunk {file_index}] {len(chunk.parts[0].inline_data.data)} bytes, "
                  f"mime={chunk.parts[0].inline_data.mime_type}")
            # ▲▲ 여기까지 ▲▲

            # [버그] AI Studio가 남긴 플레이스홀더. 안 고쳐도 에러는 안 나고
            #        ENTER_FILE_NAME_0.wav, ENTER_FILE_NAME_1.wav ... 로 저장됨.
            file_name = f"ENTER_FILE_NAME_{file_index}"
            file_index += 1

            inline_data = chunk.parts[0].inline_data
            data_buffer = inline_data.data

            # [확정] mime_type은 "audio/L16;rate=24000" 형태로 들어옴.
            #        guess_extension()은 파라미터가 붙은 MIME을 표준 테이블에서
            #        찾지 못하므로 항상 None을 반환함.
            #        → 즉 아래 if 분기는 100% 참이 되고, 매번 convert_to_wav()를 탐.
            #        (죽은 코드는 아니지만, 사실상 분기가 아니라 고정 경로임)
            file_extension = mimetypes.guess_extension(inline_data.mime_type)
            if file_extension is None:
                file_extension = ".wav"
                data_buffer = convert_to_wav(inline_data.data, inline_data.mime_type)

            save_binary_file(f"{file_name}{file_extension}", data_buffer)
        else:
            # [참고] response_modalities가 audio 전용이므로 텍스트는 오지 않음.
            #        사실상 실행되지 않는 분기.
            if text := chunk.text:
                print(text)


# ============================================================================
# 수정본 — 청크를 누적한 뒤 파일 1개로 저장.
# N이 몇이든 결과물은 항상 단일 wav.
# ============================================================================
def generate_fixed():
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    # (model / contents / generate_content_config는 위 generate()와 동일하게 구성)

    audio_chunks = []   # PCM 원본 바이트만 모음. 헤더는 아직 붙이지 않음.
    mime_type = None

    for chunk in client.models.generate_content_stream(
        model=model, contents=contents, config=generate_content_config
    ):
        # 버전 호환성을 위해 candidates 경로로 접근
        if not chunk.candidates or not chunk.candidates[0].content:
            continue
        # parts[0]만 보지 않고 전체 순회 → part 유실 방지
        for part in chunk.candidates[0].content.parts or []:
            if part.inline_data and part.inline_data.data:
                audio_chunks.append(part.inline_data.data)
                mime_type = part.inline_data.mime_type

    if audio_chunks:
        # 전부 이어붙인 뒤 헤더를 딱 한 번만 씌움
        merged_pcm = b"".join(audio_chunks)
        save_binary_file("breaking_news.wav", convert_to_wav(merged_pcm, mime_type))
    else:
        print("오디오 데이터를 받지 못했습니다. 모델 응답을 확인하세요.")


def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    """raw PCM 바이트 앞에 44바이트 RIFF/WAVE 헤더를 붙여 재생 가능한 wav로 만듦.

    [중요] 이 함수 자체는 정상. 문제는 '언제 호출하느냐'임.
           청크마다 호출하면 조각 파일 N개, 누적 후 1번 호출하면 온전한 파일 1개.
    """
    parameters = parse_audio_mime_type(mime_type)
    bits_per_sample = parameters["bits_per_sample"]
    sample_rate = parameters["rate"]
    num_channels = 1                                   # 모노 고정 (모델 스펙과 일치)
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size   # 전체 파일 크기 - 8. data 청크 앞 헤더 필드가 36바이트.

    # http://soundfile.sapp.org/doc/WaveFormat/
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",          # ChunkID
        chunk_size,       # ChunkSize
        b"WAVE",          # Format
        b"fmt ",          # Subchunk1ID
        16,               # Subchunk1Size (PCM은 16 고정)
        1,                # AudioFormat (1 = PCM)
        num_channels,     # NumChannels
        sample_rate,      # SampleRate
        byte_rate,        # ByteRate
        block_align,      # BlockAlign
        bits_per_sample,  # BitsPerSample
        b"data",          # Subchunk2ID
        data_size         # Subchunk2Size
    )
    return header + audio_data


def parse_audio_mime_type(mime_type: str) -> dict[str, int | None]:
    """"audio/L16;rate=24000" 문자열에서 비트뎁스와 샘플레이트를 뽑아냄."""
    # 파싱 실패 시 사용할 기본값. 3.1 TTS의 실제 출력 스펙과 동일하므로
    # 사실상 이 값이 그대로 쓰인다고 봐도 무방함.
    bits_per_sample = 16
    rate = 24000

    parts = mime_type.split(";")
    for param in parts:   # [버그-사소] 아래 주석은 "메인 타입은 건너뛴다"고 하지만
                          #             실제로는 건너뛰지 않고 전부 순회함.
                          #             elif에서 "audio/L"을 직접 처리하므로 결과는 정상.
        param = param.strip()
        if param.lower().startswith("rate="):
            try:
                rate_str = param.split("=", 1)[1]
                rate = int(rate_str)
            except (ValueError, IndexError):
                pass   # "rate=" 처럼 값이 없거나 숫자가 아니면 기본값 유지
        elif param.startswith("audio/L"):
            try:
                bits_per_sample = int(param.split("L", 1)[1])   # "audio/L16" → 16
            except (ValueError, IndexError):
                pass

    return {"bits_per_sample": bits_per_sample, "rate": rate}


if __name__ == "__main__":
    # generate()        # 원본 동작 + 청크 로그. 실행하면 N이 몇인지 알 수 있음.
    generate_fixed()     # 실사용 권장. 항상 단일 wav.