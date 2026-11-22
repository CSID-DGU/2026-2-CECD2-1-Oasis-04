// 설정 페이지의 '음성 안내' 탭. 화면의 안내를 소리로 읽어 줄지, 얼마나 천천히, 어느 목소리로 읽을지 정한다 (settings/speechSettings.js).
//
// 읽는 일은 브라우저의 음성 합성이 한다 (devices/speaker.js). 서버가 없어도 되고, 목소리는 브라우저와 기기마다 다르다.
// 한국어 목소리가 하나도 없는 기기에서는 소리가 나지 않거나 다른 나라 말씨로 읽으니, 그때는 기기에 한국어 음성을 깔아야 한다.
// '들어 보기' 는 저장하기 전의 선택으로 예시 문장을 읽는다.

import { useEffect, useState } from 'react'
import { speaker } from '../devices/speaker.js'
import { RATES, SAMPLE_LINES, rateValue, readSpeech, supportText, writeSpeech } from './speechSettings.js'
import { spoken } from '../view/speechText.js'

const RATE_HELP = Object.freeze({
  slow: '또박또박 느리게 읽습니다.',
  normal: '보통보다 조금 느리게 읽습니다. 처음 값입니다.',
  fast: '브라우저의 보통 빠르기입니다.',
})

export default function SpeechTab({ storage, onDone, device = speaker }) {
  const [saved] = useState(() => readSpeech(storage))
  const [enabled, setEnabled] = useState(saved.enabled)
  const [rate, setRate] = useState(saved.rate)
  const [voiceURI, setVoiceURI] = useState(saved.voiceURI ?? '')
  const [voices, setVoices] = useState(() => device.voices())
  const [failed, setFailed] = useState(false)
  const supported = device.supported()

  // 목소리 목록은 페이지가 열린 뒤 조금 있다가 채워진다. 탭을 떠나면 '들어 보기' 로 읽던 것을 멈춘다
  useEffect(() => {
    const stop = device.onVoices(() => setVoices(device.voices()))
    return () => {
      stop()
      device.cancel()
    }
  }, [device])

  const listen = () => device.speak(SAMPLE_LINES.map(spoken), { rate: rateValue(rate), voiceURI: voiceURI || null })
  const save = () => {
    if (writeSpeech({ enabled, rate, voiceURI: voiceURI || null }, storage)) onDone()
    else setFailed(true)
  }

  return (
    <section className="settings-section" aria-labelledby="settings-speech-title">
      <h2 id="settings-speech-title">음성 안내 (TTS)</h2>
      <p className="settings-note">
        확인 질문, 가는 길, 안내 문구를 소리로 읽어 줍니다. 서버 없이 이 기기 브라우저의 목소리로 읽고, 화면 위쪽 띠의 '다시 듣기' 로 다시
        들을 수 있습니다.
      </p>

      <dl className="settings-status">
        <dt>브라우저</dt>
        <dd className={!supported || voices.length === 0 ? 'is-off' : undefined}>{supportText(supported, voices.length)}</dd>
      </dl>

      <fieldset className="settings-choices">
        <legend>읽어 주기</legend>
        <label className="settings-choice">
          <input type="radio" name="speech-enabled" value="on" checked={enabled} onChange={() => setEnabled(true)} />
          <span>
            <strong>켜기</strong>
            <small>화면이 바뀔 때마다 그 화면의 안내를 읽습니다. 처음 값입니다.</small>
          </span>
        </label>
        <label className="settings-choice">
          <input type="radio" name="speech-enabled" value="off" checked={!enabled} onChange={() => setEnabled(false)} />
          <span>
            <strong>끄기</strong>
            <small>읽지 않습니다. '다시 듣기' 버튼도 보이지 않습니다.</small>
          </span>
        </label>
      </fieldset>

      <fieldset className="settings-choices" disabled={!enabled}>
        <legend>빠르기</legend>
        {RATES.map((r) => (
          <label key={r.id} className="settings-choice">
            <input type="radio" name="speech-rate" value={r.id} checked={rate === r.id} onChange={() => setRate(r.id)} />
            <span>
              <strong>{r.label}</strong>
              <small>{RATE_HELP[r.id]}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="settings-block">
        <div className="settings-search">
          <label htmlFor="settings-speech-voice">목소리</label>
          <div className="settings-search-row">
            <select id="settings-speech-voice" value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)} disabled={!enabled || voices.length === 0}>
              <option value="">자동 (브라우저의 한국어 목소리)</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
            <button type="button" className="settings-button" onClick={listen} disabled={!supported}>
              들어 보기
            </button>
          </div>
        </div>
      </div>

      {failed && (
        <p className="settings-error" role="alert">
          설정을 저장하지 못했습니다. 브라우저가 저장소를 막고 있는지 확인해 주세요.
        </p>
      )}

      <div className="settings-actions">
        <button type="button" className="settings-button is-primary" onClick={save}>
          저장하고 키오스크 화면 열기
        </button>
        <button type="button" className="settings-button" onClick={onDone}>
          저장하지 않고 돌아가기
        </button>
      </div>
    </section>
  )
}
