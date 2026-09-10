import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Search,
  Sparkles,
  Volume2,
  Volume1,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Send,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  ListFilter,
  MessageSquare,
  FileText,
  ExternalLink,
  ChevronRight,
  Maximize2
} from 'lucide-react'

// 유튜브 URL에서 비디오 ID 추출
function getYouTubeVideoId(url) {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

// "MM:SS" 또는 "HH:MM:SS" -> 초(seconds) 변환
function timeToSeconds(timeStr) {
  if (!timeStr) return 0
  const clean = timeStr.replace(/[\[\]]/g, '').trim()
  const parts = clean.split(':').map(Number)
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0)
  } else if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  }
  return 0
}

// 다중 화자 구분을 위한 고유 컬러 테마 팔레트
const SPEAKER_COLORS = [
  { bg: 'bg-blue-950/80', text: 'text-blue-300', border: 'border-blue-500/40' },       // 화자 1: 블루
  { bg: 'bg-purple-950/80', text: 'text-purple-300', border: 'border-purple-500/40' }, // 화자 2: 퍼플
  { bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-500/40' }, // 화자 3: 에메랄드/그린
  { bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-500/40' },   // 화자 4: 앰버/오렌지
  { bg: 'bg-rose-950/80', text: 'text-rose-300', border: 'border-rose-500/40' },       // 화자 5: 로즈/핑크
  { bg: 'bg-cyan-950/80', text: 'text-cyan-300', border: 'border-cyan-500/40' },       // 화자 6: 시안/청록
  { bg: 'bg-indigo-950/80', text: 'text-indigo-300', border: 'border-indigo-500/40' }, // 화자 7: 인디고
  { bg: 'bg-lime-950/80', text: 'text-lime-300', border: 'border-lime-500/40' },       // 화자 8: 라임
]

function getSpeakerColorClass(speakerStr) {
  if (!speakerStr) return 'bg-gray-800/80 text-gray-300 border border-gray-600/40'

  const match = speakerStr.match(/\d+/)
  let index = 0
  if (match) {
    const num = parseInt(match[0], 10)
    index = Math.max(0, num - 1) % SPEAKER_COLORS.length
  } else {
    let hash = 0
    for (let i = 0; i < speakerStr.length; i++) {
      hash = speakerStr.charCodeAt(i) + ((hash << 5) - hash)
    }
    index = Math.abs(hash) % SPEAKER_COLORS.length
  }

  const c = SPEAKER_COLORS[index]
  return `${c.bg} ${c.text} ${c.border}`
}

export default function App() {
  const [url, setUrl] = useState('')
  const [activeVideoId, setActiveVideoId] = useState('')
  const [videoInfo, setVideoInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [transcriptData, setTranscriptData] = useState(null)

  // 볼륨 제어 상태 (0 ~ 100)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)

  // 검색 & 탭 상태
  const [activeTab, setActiveTab] = useState('search') // 'search' | 'qa' | 'transcript'
  const [contentQuery, setContentQuery] = useState('')

  // Q&A 상태
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      text: '안녕하세요! 영상 전사가 완료되면 영상의 특정 내용이나 궁금한 점을 질문해 보세요. 관련 장면 타임스탬프와 함께 답변해 드립니다.',
    },
  ])

  const iframeRef = useRef(null)
  const eventSourceRef = useRef(null)
  const chatBottomRef = useRef(null)

  // IFrame YouTube API 커맨드 전송 헬퍼
  const sendPlayerCommand = (func, args = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: func,
          args: args,
        }),
        '*'
      )
    }
  }

  // 특정 시간으로 이동하고 자동 재생 (SeekTo & Play)
  const handleSeekAndPlay = (timeStr) => {
    const seconds = timeToSeconds(timeStr)
    sendPlayerCommand('seekTo', [seconds, true])
    sendPlayerCommand('playVideo', [])
  }

  // 볼륨 변경 핸들러
  const handleVolumeChange = (newVol) => {
    const volNum = parseInt(newVol, 10)
    setVolume(volNum)
    if (isMuted && volNum > 0) {
      setIsMuted(false)
      sendPlayerCommand('unMute', [])
    }
    sendPlayerCommand('setVolume', [volNum])
  }

  // 음소거 토글
  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      sendPlayerCommand('unMute', [])
      sendPlayerCommand('setVolume', [volume || 50])
    } else {
      setIsMuted(true)
      sendPlayerCommand('mute', [])
    }
  }

  // 영상 처리 시작
  const handleStartProcess = (targetUrl) => {
    const inputUrl = typeof targetUrl === 'string' ? targetUrl : url
    if (!inputUrl.trim()) return

    const videoId = getYouTubeVideoId(inputUrl.trim())
    if (!videoId) {
      setError('올바른 YouTube 영상 링크 형식이 아닙니다.')
      return
    }

    setActiveVideoId(videoId)
    setError('')
    setTranscriptData(null)
    setLoading(true)
    setCurrentStep(1)
    setStatusMessage('유튜브 영상 정보를 분석하고 있습니다...')

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const sseUrl = `/api/process-stream?url=${encodeURIComponent(inputUrl.trim())}`
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

        if (data.step) setCurrentStep(data.step)
        if (data.message) setStatusMessage(data.message)
        if (data.info) setVideoInfo(data.info)

        if (data.status === 'completed') {
          setTranscriptData(data.transcript)
          setLoading(false)
          eventSource.close()
          // 첫 환영 멘트 갱신
          setChatHistory([
            {
              role: 'assistant',
              text: `[${data.info.title}] 영상의 음성 전사가 완료되었습니다! 영상 내용에 대해 무엇이든 질문해 보세요.`,
            },
          ])
        }
      } catch (err) {
        console.error('SSE 에러:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE 연결 끊김:', err)
      setError('서버 처리 중 연결이 끊어졌거나 오류가 발생했습니다.')
      setLoading(false)
      eventSource.close()
    }
  }

  // Gemini 3.8 Flash Q&A 전송
  const handleAskQuestion = async (e) => {
    e?.preventDefault()
    if (!question.trim() || asking || !transcriptData) return

    const userQ = question.trim()
    setQuestion('')
    setChatHistory((prev) => [...prev, { role: 'user', text: userQ }])
    setAsking(true)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userQ,
          transcript: transcriptData.full_transcript,
          video_title: videoInfo?.title || 'YouTube Video',
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.detail || '질문 응답 실패')
      }

      const data = await res.json()
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', text: data.answer },
      ])
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', text: `오류가 발생했습니다: ${err.message}` },
      ])
    } finally {
      setAsking(false)
    }
  }

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // 영상 내용 실시간 필터링 (키워드 검색)
  const filteredSegments = useMemo(() => {
    if (!transcriptData?.segments) return []
    if (!contentQuery.trim()) return transcriptData.segments

    const query = contentQuery.toLowerCase().trim()
    return transcriptData.segments.filter((seg) =>
      seg.text.toLowerCase().includes(query)
    )
  }, [transcriptData, contentQuery])

  // 텍스트 내의 [MM:SS] 타임스탬프를 감지하여 클릭 가능한 버튼으로 파싱 렌더링
  const renderTextWithTimestamps = (text) => {
    const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      const timeStr = match[1]
      parts.push(
        <button
          key={match.index}
          onClick={() => handleSeekAndPlay(timeStr)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-1 bg-red-950/80 hover:bg-red-600 text-red-400 hover:text-white rounded text-xs font-mono font-semibold transition-colors border border-red-500/30"
          title="클릭 시 해당 위치로 영상 이동 & 재생"
        >
          <Play className="w-2.5 h-2.5 fill-current" />
          <span>{timeStr}</span>
        </button>
      )
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f1f1f1] flex flex-col font-sans">
      {/* 1. 상단 검색 헤더 (요청: 마이크, 만들기, 알림 제외) */}
      <header className="sticky top-0 z-50 bg-[#0f0f0f]/95 backdrop-blur-md px-4 py-2.5 border-b border-[#272727] flex items-center justify-between">
        {/* 독자 브랜드 로고: AI 유튜브 검색기 */}
        <div
          onClick={() => window.location.reload()}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
          title="AI 유튜브 검색기 새로고침"
        >
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/30 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
            <Search className="w-4 h-4 text-white stroke-[2.5]" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-300 rounded-full ring-2 ring-[#0f0f0f]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-black tracking-tight text-lg text-white">
              AI 유튜브 <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-400 to-amber-400">검색기</span>
            </span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 tracking-wider">
              TubeFinder AI
            </span>
          </div>
        </div>

        {/* 중앙: 유튜브 링크 주소 입력창 + 검색 버튼 */}
        <div className="flex-1 max-w-[720px] mx-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleStartProcess()
            }}
            className="flex items-center w-full"
          >
            <div className="flex flex-1 items-center bg-[#121212] border border-[#333333] rounded-l-full px-4 py-2 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500 transition-all">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="유튜브 영상 링크 주소를 입력하세요 (예: https://www.youtube.com/watch?v=...)"
                disabled={loading}
                className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              title="영상 검색 및 분석"
              className="bg-[#222222] hover:bg-red-600 border border-l-0 border-[#333333] hover:border-red-600 rounded-r-full px-6 py-2.5 flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-[#222222]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
              ) : (
                <Search className="w-4 h-4 text-gray-300" />
              )}
            </button>
          </form>
        </div>

        {/* 우측 뱃지 (마이크, 만들기, 알림 제외) */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e1e1e] border border-[#333333] text-gray-300 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Gemini 3.5 & 3.8 AI</span>
          </div>
        </div>
      </header>

      {/* 에러 메시지 */}
      {error && (
        <div className="mx-6 mt-3 p-3 bg-red-950/70 border border-red-500/60 rounded-xl flex items-center justify-between text-red-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-900/40 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 진행 상황 바 */}
      {loading && (
        <div className="mx-6 mt-3 p-3.5 bg-[#1a1a1a] border border-[#333333] rounded-xl flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-red-500 flex-shrink-0" />
            <span className="text-xs md:text-sm text-gray-200">{statusMessage}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2.5 py-1 rounded-full ${currentStep >= 1 ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400'}`}>
              1. 정보 확인
            </span>
            <span>➔</span>
            <span className={`px-2.5 py-1 rounded-full ${currentStep >= 2 ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400'}`}>
              2. 오디오 추출
            </span>
            <span>➔</span>
            <span className={`px-2.5 py-1 rounded-full ${currentStep >= 3 ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400'}`}>
              3. Gemini 3.5 Transcribe
            </span>
          </div>
        </div>
      )}

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="flex-1 p-4 md:p-6 max-w-[1720px] mx-auto w-full">
        {!activeVideoId && !loading && (
          <div className="py-24 text-center max-w-xl mx-auto">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-600/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
              <Search className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              유튜브 링크를 입력해 원하는 장면을 검색하세요
            </h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              상단 검색창에 영상 주소를 입력하면, Gemini 3.5가 영상 음성을 정밀 전사하고 대화 내용 검색 시 해당 위치로 즉시 이동해 영상을 재생합니다.
            </p>
            <div className="inline-flex items-center gap-2 text-xs text-gray-400">
              <span>테스트 예시:</span>
              <button
                type="button"
                onClick={() => {
                  const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
                  setUrl(testUrl)
                  handleStartProcess(testUrl)
                }}
                className="px-3 py-1.5 bg-[#222222] hover:bg-[#333333] text-red-400 rounded-full transition-colors flex items-center gap-1.5"
              >
                <span>Me at the zoo (19초 영상)</span>
              </button>
            </div>
          </div>
        )}

        {activeVideoId && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 좌측: 비디오 플레이어 & 음향/볼륨 컨트롤러 & 영상 정보 */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-4">
              {/* (1) 16:9 반응형 유튜브 플레이어 */}
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-[#272727] group">
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

              {/* (2) 커스텀 음향(볼륨) 조절 바 & 컨트롤 패널 */}
              <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* 음소거 / 볼륨 아이콘 */}
                  <button
                    onClick={handleToggleMute}
                    className="p-2 hover:bg-[#2c2c2c] rounded-lg transition-colors text-gray-300 hover:text-white"
                    title={isMuted ? '음소거 해제' : '음소거'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-5 h-5 text-red-400" />
                    ) : volume < 50 ? (
                      <Volume1 className="w-5 h-5 text-gray-300" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-gray-300" />
                    )}
                  </button>

                  {/* 음향 크기 슬라이더 (0 ~ 100) */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-gray-400 font-medium">볼륨</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(e.target.value)}
                      className="w-28 md:w-36 h-1.5 bg-[#333333] rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                    <span className="text-xs font-mono text-gray-400 w-8 text-right">
                      {isMuted ? '0%' : `${volume}%`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="px-2.5 py-1 bg-[#141414] rounded-md border border-[#2c2c2c]">
                    재생 시간: {videoInfo?.duration_formatted || '00:00'}
                  </span>
                </div>
              </div>

              {/* (3) 영상 제목 및 채널 정보 */}
              <div className="pt-1">
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-snug">
                  {videoInfo?.title || 'YouTube 동영상'}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
                  <span className="font-semibold text-gray-300">
                    {videoInfo?.channel || '채널'}
                  </span>
                  <span>•</span>
                  <span>조회수 {videoInfo?.view_count?.toLocaleString() || 0}회</span>
                </div>
              </div>
            </div>

            {/* 우측: 내용 검색기 & Gemini Q&A & 전체 대본 패널 */}
            <div className="lg:col-span-5 xl:col-span-4 bg-[#1a1a1a] border border-[#2d2d2d] rounded-2xl flex flex-col h-[750px] shadow-2xl sticky top-20 overflow-hidden">
              {/* 상단 탭 전환: [영상 내용 검색] | [Gemini Q&A] | [전체 대본] */}
              <div className="p-3 bg-[#222222] border-b border-[#2d2d2d] flex items-center justify-between gap-1">
                <button
                  onClick={() => setActiveTab('search')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'search'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-[#2c2c2c]'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>내용 검색</span>
                </button>
                <button
                  onClick={() => setActiveTab('qa')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'qa'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-[#2c2c2c]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gemini Q&A</span>
                </button>
                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'transcript'
                      ? 'bg-[#333333] text-white shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-[#2c2c2c]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>대본</span>
                </button>
              </div>

              {/* 탭 1: 영상 특정 내용 검색 (타임라인 점프 & 자동 재생) */}
              {activeTab === 'search' && (
                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={contentQuery}
                        onChange={(e) => setContentQuery(e.target.value)}
                        placeholder="찾고 싶은 대사나 키워드를 입력하세요..."
                        className="w-full bg-[#121212] border border-[#333333] rounded-xl pl-9 pr-8 py-2 text-xs md:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                      />
                      {contentQuery && (
                        <button
                          onClick={() => setContentQuery('')}
                          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 px-1">
                      <span>검색 결과: {filteredSegments.length}개 구간</span>
                      <span className="text-red-400">클릭 시 해당 시간으로 이동 & Play</span>
                    </div>
                  </div>

                  {/* 검색 결과 리스트 */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {loading && (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-red-500 mb-2" />
                        <span className="text-xs">음성을 분석하고 있습니다...</span>
                      </div>
                    )}

                    {!loading && filteredSegments.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-gray-500 py-16 text-center text-xs">
                        <Search className="w-8 h-8 text-gray-600 mb-2" />
                        <span>일치하는 내용이 없습니다.</span>
                      </div>
                    )}

                    {filteredSegments.map((seg, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSeekAndPlay(seg.time)}
                        className="group p-3 rounded-xl bg-[#141414] hover:bg-[#252525] border border-[#262626] hover:border-red-500/50 cursor-pointer transition-all flex items-start gap-3"
                      >
                        {/* 타임스탬프 뱃지 */}
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md bg-red-950/80 group-hover:bg-red-600 text-red-400 group-hover:text-white font-mono text-xs font-bold transition-colors flex items-center gap-1 flex-shrink-0"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>{seg.time}</span>
                        </button>

                        <div className="flex-1 min-w-0">
                          {seg.speaker && (
                            <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md mr-1.5 mb-1 ${getSpeakerColorClass(seg.speaker)}`}>
                              {seg.speaker}
                            </span>
                          )}
                          <p className="text-xs text-gray-300 leading-relaxed group-hover:text-white">
                            {seg.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 탭 2: Gemini 3.8 Flash 대화형 Q&A */}
              {activeTab === 'qa' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* 채팅 메시지 내역 */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {chatHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${
                          msg.role === 'user' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[88%] p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-red-600 text-white rounded-br-none shadow-md'
                              : 'bg-[#141414] text-gray-200 border border-[#2e2e2e] rounded-bl-none shadow'
                          }`}
                        >
                          {msg.role === 'assistant' ? (
                            <div>
                              <div className="flex items-center gap-1 text-[11px] font-bold text-red-400 mb-1">
                                <Sparkles className="w-3 h-3" />
                                <span>Gemini 3.8 Flash</span>
                              </div>
                              <div className="whitespace-pre-wrap">
                                {renderTextWithTimestamps(msg.text)}
                              </div>
                            </div>
                          ) : (
                            msg.text
                          )}
                        </div>
                      </div>
                    ))}
                    {asking && (
                      <div className="flex items-center gap-2 p-3 bg-[#141414] rounded-2xl text-xs text-gray-400 border border-[#2e2e2e] w-fit">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                        <span>Gemini가 영상 내용을 분석 중입니다...</span>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* 질문 입력 폼 */}
                  <form
                    onSubmit={handleAskQuestion}
                    className="p-3 bg-[#202020] border-t border-[#2e2e2e] flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="영상 내용에 대해 질문하세요..."
                      disabled={asking || !transcriptData}
                      className="flex-1 bg-[#121212] border border-[#333333] rounded-xl px-3.5 py-2 text-xs md:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="submit"
                      disabled={asking || !question.trim() || !transcriptData}
                      className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* 탭 3: 전체 대본 뷰 */}
              {activeTab === 'transcript' && (
                <div className="flex-1 overflow-y-auto p-4">
                  {transcriptData ? (
                    <div className="space-y-2">
                      {transcriptData.segments?.map((seg, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSeekAndPlay(seg.time)}
                          className="p-2 rounded-lg hover:bg-[#252525] cursor-pointer text-xs flex items-start gap-2.5 transition-colors"
                        >
                          <span className="text-red-400 font-mono font-semibold flex-shrink-0">
                            {seg.time}
                          </span>
                          {seg.speaker && (
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md flex-shrink-0 ${getSpeakerColorClass(seg.speaker)}`}>
                              {seg.speaker}
                            </span>
                          )}
                          <span className="text-gray-300 leading-relaxed">
                            {seg.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-center text-xs text-gray-500">
                      영상 분석 후 대본이 표시됩니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
