// STT 서버(음성 인식·목적지 해석·현재 위치)와 연동할지 정한다. 설정 페이지(SettingsPage.jsx)에서 바꾼다.
//
// 학습한 음성 모델을 올린 STT 서버는 GPU 와 모델 파일이 있는 PC 에서만 돈다. 그 서버가 없는 사람도 화면을 띄울 수 있게,
// 연동이 꺼져 있으면 서버를 부르지 않고 연습용 데이터(api/mock)와 가짜 마이크(devices/mockRecorder)로 돈다.
// 경로 서버는 출발·도착 좌표를 STT 서버 쪽에서 받아 쓰므로, 연동이 꺼지면 경로도 연습용 데이터가 된다.
//
//   선택(choice)  'auto' | 'on' | 'off'. 브라우저에 저장된다 (localStorage). 처음에는 'auto'
//   auto 의 규칙  실제 모드(VITE_USE_MOCK=false): 시작할 때 STT 서버에 닿으면 켜고, 닿지 않으면 끈다
//                 연습 모드(VITE_USE_MOCK=true):  끈다 (서버를 찾아보지 않는다)
//   시연 모드(VITE_DEMO=true)는 선택과 상관없이 늘 끈다 (발표가 서버·인터넷에 기대지 않게)
//
// 연동 여부는 앱을 그리기 전에 한 번 정하고(initIntegration, main.jsx) 그 뒤로는 바뀌지 않는다.
// api/index.js 의 USE_MOCK 이 이 값을 본다. 설정을 바꾸면 화면을 새로 연다.

import { apiFetch } from '../api/real/http.js'

const env = import.meta.env ?? {}
export const MOCK_BUILD = env.VITE_USE_MOCK === 'true'
export const DEMO_BUILD = env.VITE_DEMO === 'true'

export const CHOICES = Object.freeze(['auto', 'on', 'off'])
export const STORAGE_KEY = 'oasis.sttIntegration'
const PROBE_TIMEOUT_MS = 2500

/** 연동이 그렇게 정해진 이유 → 설정 페이지에 보일 문장 */
export const REASON_TEXT = Object.freeze({
  DEMO: '시연 모드라서 늘 꺼 둡니다',
  CHOICE_ON: '켜기로 설정했습니다',
  CHOICE_OFF: '끄기로 설정했습니다',
  AUTO_FOUND: '자동: 서버가 응답해서 켰습니다',
  AUTO_NOT_FOUND: '자동: 서버가 응답하지 않아 껐습니다',
  AUTO_MOCK_MODE: '자동: 연습 모드로 띄워서 껐습니다',
  NOT_DECIDED: '아직 정하지 않았습니다 (띄운 방식 그대로)',
})

const ENGINE_TEXT = Object.freeze({ finetuned: '학습한 모델', base: '기본 모델' })

/** probeStt 결과 → 설정 페이지의 "서버 상태" 한 줄. null 이면 아직 확인 중 */
export function statusText(status) {
  if (!status) return '서버를 확인하는 중입니다'
  if (!status.reachable) return '서버가 응답하지 않습니다'
  const model = status.model ? ` · ${status.model}${ENGINE_TEXT[status.engine] ? ` (${ENGINE_TEXT[status.engine]})` : ''}` : ''
  return `${status.ready ? '연결됨' : '연결됨 (모델을 올리는 중)'}${model}`
}

/** 화면 구석의 "연동 꺼짐" 알림을 보여야 하는가: 실제 모드로 띄웠는데 연동이 꺼져 있을 때만 (IntegrationNotice.jsx) */
export function shouldNotify({ linked }, { mockBuild = MOCK_BUILD, demo = DEMO_BUILD } = {}) {
  return !linked && !mockBuild && !demo
}

/**
 * 연동 여부를 정한다 (순수 함수).
 * @param {{ demo: boolean, mockBuild: boolean, choice: 'auto'|'on'|'off', reachable: boolean }} input
 * @returns {{ linked: boolean, reason: keyof typeof REASON_TEXT }}
 */
export function decide({ demo, mockBuild, choice, reachable }) {
  if (demo) return { linked: false, reason: 'DEMO' }
  if (choice === 'on') return { linked: true, reason: 'CHOICE_ON' }
  if (choice === 'off') return { linked: false, reason: 'CHOICE_OFF' }
  if (mockBuild) return { linked: false, reason: 'AUTO_MOCK_MODE' }
  return reachable ? { linked: true, reason: 'AUTO_FOUND' } : { linked: false, reason: 'AUTO_NOT_FOUND' }
}

const defaultStorage = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null // 저장소를 막아 둔 브라우저
  }
}

/** 저장된 선택. 없거나 이상한 값이면 'auto' */
export function readChoice(storage = defaultStorage()) {
  try {
    const value = storage?.getItem(STORAGE_KEY)
    return CHOICES.includes(value) ? value : 'auto'
  } catch {
    return 'auto'
  }
}

/** 선택을 저장한다. 'auto' 는 저장된 값을 지운다. 저장하지 못하면 false */
export function writeChoice(choice, storage = defaultStorage()) {
  try {
    if (choice === 'auto') storage?.removeItem(STORAGE_KEY)
    else if (CHOICES.includes(choice)) storage?.setItem(STORAGE_KEY, choice)
    else return false
    return Boolean(storage)
  } catch {
    return false
  }
}

/**
 * STT 서버에 닿는지 한 번 물어본다 (GET /api/v1/health). 실패해도 throw 하지 않는다.
 * @returns {Promise<{ reachable: boolean, ready: boolean, engine: string|null, model: string|null }>}
 *   ready  음성 모델과 장소 지식베이스가 모두 올라왔는가
 *   engine 'finetuned'(학습한 모델) | 'base'(기본 모델)
 */
export async function probeStt({ timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  try {
    const body = await apiFetch('/health', { timeoutMs })
    if (!body?.success) return { reachable: false, ready: false, engine: null, model: null }
    const d = body.data ?? {}
    return {
      reachable: true,
      ready: Boolean(d.stt?.loaded && d.knowledge_base?.loaded),
      engine: d.stt?.engine ?? null,
      model: d.stt?.model ?? null,
    }
  } catch {
    return { reachable: false, ready: false, engine: null, model: null }
  }
}

// 앱을 그리기 전에 정해지는 값. initIntegration 을 부르지 않은 곳(테스트 등)에서는 예전처럼 빌드 설정만 따른다
let current = { linked: !MOCK_BUILD, reason: MOCK_BUILD ? 'AUTO_MOCK_MODE' : 'NOT_DECIDED', choice: 'auto' }

/** 지금 적용된 연동 상태 { linked, reason, choice } */
export function getIntegration() {
  return current
}

/** 연동 여부를 정한다. 앱을 그리기 전에 한 번 부른다 (서버를 찾아봐야 할 때만 기다린다) */
export async function initIntegration({ storage = defaultStorage(), probe = probeStt, demo = DEMO_BUILD, mockBuild = MOCK_BUILD } = {}) {
  const choice = readChoice(storage)
  const needProbe = !demo && choice === 'auto' && !mockBuild
  const reachable = needProbe ? (await probe()).reachable : false
  current = { ...decide({ demo, mockBuild, choice, reachable }), choice }
  return current
}
