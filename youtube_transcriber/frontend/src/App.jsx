import React, { useState, useRef, useEffect } from 'react'
import {
  Menu,
  Search,
  Mic,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Bookmark,
  Copy,
  Check,
  Download,
  FileText,
  ListFilter,
  CheckCircle2,
  Clock,
  User,
  ExternalLink,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Play,
  Share2
} from 'lucide-react'

// 유튜브 URL에서 비디오 ID 추출
function getYouTubeVideoId(url) {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

// "MM:SS" 또는 "HH:MM:SS" -> 초 단위 변환
function timeToSeconds(timeStr) {
  if (!timeStr) return 0
  const parts = timeStr.split(':').map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

export default function App() {
  const [url, setUrl] = useState('')
  const [activeVideoId, setActiveVideoId] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [videoInfo, setVideoInfo] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('segments') // 'segments' | 'full'
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0)

  const eventSourceRef = useRef(null)
  const iframeRef = useRef(null)

  const handleTranscribe = (targetUrl) => {
    const inputUrl = typeof targetUrl === 'string' ? targetUrl : url
    if (!inputUrl.trim()) return

    const videoId = getYouTubeVideoId(inputUrl.trim())
    if (videoId) {
      setActiveVideoId(videoId)
    }

    // 초기화
    setError('')
    setResult(null)
    setVideoInfo(null)
    setLoading(true)
    setCurrentStep(1)
    setStatusMessage('유튜브 영상 정보를 분석하고 있습니다...')

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const sseUrl = `/api/transcribe-stream?url=${encodeURIComponent(inputUrl.trim())}`
    const eventSource = new EventSource(sseUrl)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.status === 'error') {
          setError(data.message)
          setLoading(false)
          eventSource.close()
          return
        }

        if (data.step) {
          setCurrentStep(data.step)
        }

        if (data.message) {
          setStatusMessage(data.message)
        }

        if (data.info) {
          setVideoInfo(data.info)
          if (!activeVideoId && data.info.id) {
            setActiveVideoId(data.info.id)
          }
        }

        if (data.status === 'completed') {
          setResult(data.transcript)
          setLoading(false)
          eventSource.close()
        }
      } catch (err) {
        console.error('SSE 파싱 에러:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE 연결 에러:', err)
      setError('서버와의 실시간 연결이 끊어졌거나 처리 중 오류가 발생했습니다.')
      setLoading(false)
      eventSource.close()
    }
  }

  const handleSeek = (timeStr) => {
    const seconds = timeToSeconds(timeStr)
    setCurrentPlaybackTime(seconds)
    if (iframeRef.current && activeVideoId) {
      // YouTube IFrame API 메시지 전송
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [seconds, true],
        }),
        '*'
      )
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadTxt = () => {
    if (!result) return
    let content = `제목: ${videoInfo?.title || 'YouTube Transcript'}\n`
    content += `URL: ${url}\n`
    content += `\n[Gemini AI 요약]\n${result.summary || ''}\n\n`
    if (result.key_takeaways?.length) {
      content += `[주요 포인트]\n${result.key_takeaways.map((p) => `- ${p}`).join('\n')}\n\n`
    }
    content += `[전체 대본]\n${result.full_transcript || ''}\n`

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${videoInfo?.title ? videoInfo.title.replace(/[\/\\?%*:|"<>]/g, '_') : 'transcript'}.txt`
    link.click()
  }

  const handleDownloadSrt = () => {
    if (!result?.segments) return

    let srtContent = ''
    result.segments.forEach((seg, index) => {
      const formatTime = (timeStr) => {
        const parts = timeStr.split(':')
        let min = 0,
          sec = 0
        if (parts.length === 2) {
          min = parseInt(parts[0], 10)
          sec = parseInt(parts[1], 10)
        } else if (parts.length === 3) {
          min = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
          sec = parseInt(parts[2], 10)
        }
        const h = Math.floor(min / 60)
        const m = min % 60
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},000`
      }

      const start = formatTime(seg.start || '00:00')
      const end = formatTime(seg.end || '00:05')

      srtContent += `${index + 1}\n${start} --> ${end}\n${seg.speaker ? `[${seg.speaker}] ` : ''}${seg.text}\n\n`
    })

    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${videoInfo?.title ? videoInfo.title.replace(/[\/\\?%*:|"<>]/g, '_') : 'transcript'}.srt`
    link.click()
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f1f1f1] flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* 1. 상단 네비게이션 헤더 (유튜브 정품 스타일) */}
      <header className="sticky top-0 z-50 bg-[#0f0f0f] px-4 py-2.5 flex items-center justify-between border-b border-[#272727]">
        {/* 왼쪽: 메뉴 아이콘 & 유튜브 로고 */}
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-[#272727] rounded-full transition-colors">
            <Menu className="w-5 h-5 text-white" />
          </button>
          {/* 독자 브랜드 로고 & 아이콘 */}
          <div
            onClick={() => window.location.reload()}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            title="TubeScribe AI 새로고침"
          >
            {/* 독자적인 테크 로고 심볼 (그라디언트 + 오디오 음파 심볼) */}
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 fill-white"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 비디오 & 사운드 음파 결합 심볼 */}
                <path d="M4 7C4 6.17 4.67 5.5 5.5 5.5C6.33 5.5 7 6.17 7 7V17C7 17.83 6.33 18.5 5.5 18.5C4.67 18.5 4 17.83 4 17V7Z" />
                <path d="M9.5 3.5C9.5 2.67 10.17 2 11 2C11.83 2 12.5 2.67 12.5 3.5V20.5C12.5 21.33 11.83 22 11 22C10.17 22 9.5 21.33 9.5 20.5V3.5Z" />
                <path d="M15 6C15 5.17 15.67 4.5 16.5 4.5C17.33 4.5 18 5.17 18 6V18C18 18.83 17.33 19.5 16.5 19.5C15.67 19.5 15 18.83 15 18V6Z" />
                <path d="M20.5 8.5C20.5 7.67 21.17 7 22 7C22.83 7 23.5 7.67 23.5 8.5V15.5C23.5 16.33 22.83 17 22 17C21.17 17 20.5 16.33 20.5 15.5V8.5Z" />
              </svg>
              {/* 반짝이는 네온 AI 포인트 */}
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-400 rounded-full ring-2 ring-[#0f0f0f]" />
            </div>

            {/* 브랜드 네이밍 텍스트 */}
            <div className="flex items-center gap-1.5">
              <span className="font-black tracking-tight text-lg text-white">
                Tube<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400">Scribe</span>
              </span>
              <span className="px-1.5 py-0.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-extrabold tracking-wider rounded uppercase">
                AI
              </span>
            </div>
          </div>
        </div>

        {/* 가운데: 검색창 (영상 URL 입력란) */}
        <div className="flex-1 max-w-[680px] mx-4 flex items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleTranscribe()
            }}
            className="flex flex-1 items-center"
          >
            <div className="flex flex-1 items-center bg-[#121212] border border-[#303030] rounded-l-full px-4 py-2 focus-within:border-[#1c62b9] focus-within:ring-1 focus-within:ring-[#1c62b9] transition-all">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="YouTube 동영상 링크를 붙여넣으세요..."
                disabled={loading}
                className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              title="트랜스크립트 추출"
              className="bg-[#222222] hover:bg-[#272727] border border-l-0 border-[#303030] rounded-r-full px-6 py-2.5 flex items-center justify-center transition-colors disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
              ) : (
                <Search className="w-4 h-4 text-gray-300" />
              )}
            </button>
          </form>
          <button
            type="button"
            title="음성 검색"
            className="ml-3 p-2.5 rounded-full bg-[#222222] hover:bg-[#272727] transition-colors"
          >
            <Mic className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* 오른쪽: Gemini AI 뱃지 */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 text-blue-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Gemini Flash STT</span>
          </div>
        </div>
      </header>

      {/* 2. 에러 알림 바 */}
      {error && (
        <div className="mx-6 mt-4 p-3.5 bg-red-950/60 border border-red-500/60 rounded-xl flex items-center justify-between text-red-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-900/40 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. 진행 상태 게이지 (로딩 중일 때 표시) */}
      {loading && (
        <div className="mx-6 mt-4 p-4 bg-[#1e1e1e] border border-[#303030] rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400 flex-shrink-0" />
            <div className="text-sm font-medium text-gray-200">{statusMessage}</div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-3 py-1 rounded-full ${
                currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-gray-400'
              }`}
            >
              1. 정보 확인
            </span>
            <span>➔</span>
            <span
              className={`px-3 py-1 rounded-full ${
                currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-gray-400'
              }`}
            >
              2. 오디오 다운로드
            </span>
            <span>➔</span>
            <span
              className={`px-3 py-1 rounded-full ${
                currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-gray-400'
              }`}
            >
              3. Gemini STT 전사
            </span>
          </div>
        </div>
      )}

      {/* 4. 메인 컨텐츠 영역 (유튜브 데스크톱 시청 페이지 레이아웃) */}
      <main className="flex-1 p-4 md:p-6 max-w-[1720px] mx-auto w-full">
        {/* 영상이 아직 로드되지 않았을 때의 웰컴/안내 뷰 */}
        {!activeVideoId && !loading && (
          <div className="py-20 text-center max-w-xl mx-auto">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-600/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
              <Play className="w-10 h-10 text-red-500 fill-red-500 ml-1" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              유튜브 영상을 불러와 대본을 추출해 보세요
            </h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              상단 검색창에 YouTube 링크를 넣고 검색 버튼을 누르면, 영상 재생과 함께 Gemini AI가 타임스탬프와 요약이 포함된 정밀한 트랜스크립트를 자동으로 추출합니다.
            </p>
            <div className="inline-flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400">
              <span className="text-gray-500">테스트 영상:</span>
              <button
                type="button"
                onClick={() => {
                  const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
                  setUrl(testUrl)
                  handleTranscribe(testUrl)
                }}
                className="px-3 py-1.5 bg-[#272727] hover:bg-[#333333] text-blue-400 rounded-full transition-colors flex items-center gap-1.5"
              >
                <span>Me at the zoo (최초의 유튜브 영상)</span>
              </button>
            </div>
          </div>
        )}

        {/* 유튜브 시청 화면 레이아웃: 좌측(영상+컨트롤) + 우측(트랜스크립트 패널) */}
        {activeVideoId && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 좌측 영역 (7~8 컬럼): 비디오 플레이어 + 제목 + 채널 정보 + 액션 버튼 + 설명/요약 박스 */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-4">
              {/* (1) 실제 유튜브 비디오 플레이어 (16:9 반응형) */}
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-[#272727]">
                <iframe
                  ref={iframeRef}
                  id="yt-player"
                  src={`https://www.youtube.com/embed/${activeVideoId}?enablejsapi=1&autoplay=0&origin=${window.location.origin}`}
                  title={videoInfo?.title || 'YouTube Player'}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              {/* (2) 동영상 제목 */}
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-snug">
                {videoInfo?.title || 'YouTube 동영상'}
              </h1>

              {/* (3) 채널 정보 바 & 액션 버튼 행 (이미지 스타일 그대로 재현) */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
                {/* 좌측: 채널 프로필, 채널명, 인증 뱃지, 구독자 수 */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md text-sm">
                    {videoInfo?.channel ? videoInfo.channel.slice(0, 2) : 'YT'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white text-sm hover:underline cursor-pointer">
                        {videoInfo?.channel || 'YouTube Creator'}
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div className="text-xs text-gray-400">
                      {videoInfo?.duration_formatted
                        ? `영상 길이: ${videoInfo.duration_formatted}`
                        : 'YouTube Channel'}
                    </div>
                  </div>
                </div>

                {/* 우측: 액션 버튼 그룹 (요청사항: '공유'와 '가입' 제외) */}
                <div className="flex items-center flex-wrap gap-2">
                  {/* 좋아요 / 싫어요 묶음 버튼 */}
                  <div className="flex items-center bg-[#272727] hover:bg-[#333333] rounded-full transition-colors overflow-hidden">
                    <button
                      onClick={() => {
                        setLiked(!liked)
                        if (disliked) setDisliked(false)
                      }}
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-medium border-r border-[#3a3a3a] ${
                        liked ? 'text-blue-400' : 'text-white'
                      }`}
                    >
                      <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-blue-400' : ''}`} />
                      <span>{liked ? '1.2만' : '1.1만'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setDisliked(!disliked)
                        if (liked) setLiked(false)
                      }}
                      className={`px-3 py-2 text-white hover:text-gray-300 ${
                        disliked ? 'text-red-400' : ''
                      }`}
                    >
                      <ThumbsDown className={`w-4 h-4 ${disliked ? 'fill-red-400' : ''}`} />
                    </button>
                  </div>

                  {/* 질문하기 / AI 요약 보기 버튼 (이미지의 '질문하기' 위치) */}
                  <button
                    onClick={() => setShowSummaryModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#272727] hover:bg-[#383838] text-white text-xs md:text-sm font-medium rounded-full transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>질문하기</span>
                  </button>

                  {/* 대본 복사 버튼 */}
                  <button
                    onClick={() => result?.full_transcript && handleCopy(result.full_transcript)}
                    disabled={!result?.full_transcript}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#272727] hover:bg-[#383838] text-white text-xs md:text-sm font-medium rounded-full transition-colors disabled:opacity-40"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>{copied ? '복사됨!' : '대본 복사'}</span>
                  </button>

                  {/* 저장 버튼 (TXT 다운로드) */}
                  <button
                    onClick={handleDownloadTxt}
                    disabled={!result}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#272727] hover:bg-[#383838] text-white text-xs md:text-sm font-medium rounded-full transition-colors disabled:opacity-40"
                  >
                    <Bookmark className="w-4 h-4" />
                    <span>저장</span>
                  </button>

                  {/* 자막(SRT) 다운로드 버튼 */}
                  <button
                    onClick={handleDownloadSrt}
                    disabled={!result?.segments}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#272727] hover:bg-[#383838] text-gray-300 text-xs md:text-sm font-medium rounded-full transition-colors disabled:opacity-40"
                    title="SRT 자막 다운로드"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">SRT</span>
                  </button>
                </div>
              </div>

              {/* (4) 설명란 및 Gemini 핵심 요약 박스 (유튜브 설명 박스 스타일) */}
              <div className="bg-[#272727] hover:bg-[#2d2d2d] transition-colors rounded-xl p-4 text-sm text-gray-200">
                <div className="flex items-center justify-between font-semibold text-xs text-gray-300 mb-2">
                  <div className="flex items-center gap-3">
                    <span>조회수 12만회</span>
                    <span>1일 전</span>
                    <span className="text-blue-400 font-bold">#Gemini_AI_STT</span>
                  </div>
                  {result?.summary && (
                    <button
                      onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <span>{descriptionExpanded ? '접기' : '더보기'}</span>
                      {descriptionExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Gemini AI 요약 내용 */}
                {result?.summary ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-[#1e1e1e] rounded-lg border border-indigo-500/30">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Gemini AI 영상 핵심 요약</span>
                      </div>
                      <p className="text-gray-200 text-xs md:text-sm leading-relaxed">
                        {result.summary}
                      </p>
                    </div>

                    {descriptionExpanded && result.key_takeaways?.length > 0 && (
                      <div className="p-3 bg-[#1e1e1e] rounded-lg border border-[#3a3a3a]">
                        <span className="text-xs font-bold text-gray-300 block mb-1.5">
                          📌 주요 포인트
                        </span>
                        <ul className="space-y-1 text-xs text-gray-300 list-disc list-inside">
                          {result.key_takeaways.map((point, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">
                    {loading
                      ? 'AI가 영상을 청취하고 요약하는 중입니다...'
                      : '상단 검색창을 통해 대본 추출을 시작하세요.'}
                  </p>
                )}
              </div>
            </div>

            {/* 우측 영역 (4~5 컬럼): 유튜브 정품 스타일 트랜스크립트 (스크립트) 사이드 패널 */}
            <div className="lg:col-span-5 xl:col-span-4 bg-[#1e1e1e] border border-[#2f2f2f] rounded-2xl overflow-hidden flex flex-col h-[700px] shadow-xl sticky top-20">
              {/* 패널 헤더: 탭 전환 및 상태 */}
              <div className="px-4 py-3 bg-[#242424] border-b border-[#2f2f2f] flex items-center justify-between">
                <div className="flex items-center gap-1 bg-[#161616] p-1 rounded-lg">
                  <button
                    onClick={() => setActiveTab('segments')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeTab === 'segments'
                        ? 'bg-[#2b2b2b] text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>타임스탬프</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('full')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeTab === 'full'
                        ? 'bg-[#2b2b2b] text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>전체 대본</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    스크립트
                  </span>
                </div>
              </div>

              {/* 스크립트 본문 리스트 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-[#272727]/60">
                {loading && !result && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
                    <p className="text-sm font-medium text-gray-300">
                      음성을 텍스트로 변환하고 있습니다...
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{statusMessage}</p>
                  </div>
                )}

                {!loading && !result && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <Clock className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="text-sm">대본이 여기에 표시됩니다.</p>
                  </div>
                )}

                {result && activeTab === 'segments' && (
                  <div className="space-y-2 pt-1">
                    {result.segments?.length > 0 ? (
                      result.segments.map((seg, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSeek(seg.start)}
                          className="group p-2.5 rounded-xl hover:bg-[#282828] cursor-pointer transition-colors flex items-start gap-3"
                          title="클릭 시 해당 시간대로 영상 이동"
                        >
                          {/* 타임스탬프 뱃지 (클릭 시 재생 위치 이동) */}
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded bg-blue-950/60 hover:bg-blue-600 group-hover:bg-blue-600 text-blue-400 group-hover:text-white font-mono text-xs font-semibold transition-colors flex-shrink-0"
                          >
                            {seg.start}
                          </button>

                          {/* 발화 내용 */}
                          <div className="flex-1 min-w-0">
                            {seg.speaker && (
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 mb-0.5">
                                <User className="w-3 h-3 text-gray-500" />
                                <span>{seg.speaker}</span>
                              </div>
                            )}
                            <p className="text-gray-200 text-xs md:text-sm leading-relaxed group-hover:text-white">
                              {seg.text}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 text-xs py-8">
                        구간별 정보가 없습니다.
                      </p>
                    )}
                  </div>
                )}

                {result && activeTab === 'full' && (
                  <div className="p-2">
                    <p className="text-gray-200 text-xs md:text-sm leading-relaxed whitespace-pre-wrap selection:bg-blue-600">
                      {result.full_transcript}
                    </p>
                  </div>
                )}
              </div>

              {/* 하단 패널 푸터: 복사/다운로드 원클릭 버튼 */}
              {result && (
                <div className="p-3 bg-[#242424] border-t border-[#2f2f2f] flex items-center justify-between text-xs text-gray-400">
                  <span>총 {result.segments?.length || 0}개 구간</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(result.full_transcript || '')}
                      className="px-2.5 py-1 bg-[#333333] hover:bg-[#444444] text-white rounded transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copied ? '복사됨' : '복사'}</span>
                    </button>
                    <button
                      onClick={handleDownloadTxt}
                      className="px-2.5 py-1 bg-[#333333] hover:bg-[#444444] text-white rounded transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>TXT</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 5. '질문하기' 모달 (이미지의 질문하기 팝업 스타일) */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e1e1e] border border-[#333333] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#333333] mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-white text-base">Gemini 영상 질문 및 분석</h3>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="p-1.5 hover:bg-[#2c2c2c] rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  영상 핵심 요약
                </h4>
                <p className="text-sm text-gray-200 bg-[#141414] p-3.5 rounded-xl border border-[#2c2c2c] leading-relaxed">
                  {result?.summary || '아직 추출된 요약이 없습니다. 영상을 먼저 분석해주세요.'}
                </p>
              </div>

              {result?.key_takeaways?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    주요 하이라이트
                  </h4>
                  <ul className="space-y-1.5 text-xs text-gray-300 bg-[#141414] p-3.5 rounded-xl border border-[#2c2c2c] list-disc list-inside">
                    {result.key_takeaways.map((point, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSummaryModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
