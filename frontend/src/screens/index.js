// 상태 이름 → 화면 컴포넌트. App.jsx 가 SCREEN_BY_STATE[state.state] 로 화면을 고른다 (계획서 2-4절).
// 상태 1 : 화면 1. 14개 모두 있어야 한다 (누락 시 App 에서 알 수 있도록 테스트로도 확인).
import { STATES } from '../state/states.js'
import StartupCheckScreen from './StartupCheckScreen.jsx'
import CheckingScreen from './CheckingScreen.jsx'
import IdleScreen from './IdleScreen.jsx'
import IdleReducedScreen from './IdleReducedScreen.jsx'
import ListeningScreen from './ListeningScreen.jsx'
import ResolvingScreen from './ResolvingScreen.jsx'
import ConfirmingScreen from './ConfirmingScreen.jsx'
import FailCountCheckScreen from './FailCountCheckScreen.jsx'
import RoutingScreen from './RoutingScreen.jsx'
import ReaskingScreen from './ReaskingScreen.jsx'
import UnavailableScreen from './UnavailableScreen.jsx'
import ManualSelectScreen from './ManualSelectScreen.jsx'
import RouteGuideScreen from './RouteGuideScreen.jsx'
import QrHandoffScreen from './QrHandoffScreen.jsx'

export const SCREEN_BY_STATE = Object.freeze({
  [STATES.STARTUP_CHECK]: StartupCheckScreen,
  [STATES.CHECKING]: CheckingScreen,
  [STATES.IDLE]: IdleScreen,
  [STATES.IDLE_REDUCED]: IdleReducedScreen,
  [STATES.LISTENING]: ListeningScreen,
  [STATES.RESOLVING]: ResolvingScreen,
  [STATES.CONFIRMING]: ConfirmingScreen,
  [STATES.FAIL_COUNT_CHECK]: FailCountCheckScreen,
  [STATES.ROUTING]: RoutingScreen,
  [STATES.REASKING]: ReaskingScreen,
  [STATES.UNAVAILABLE]: UnavailableScreen,
  [STATES.MANUAL_SELECT]: ManualSelectScreen,
  [STATES.ROUTE_GUIDE]: RouteGuideScreen,
  [STATES.QR_HANDOFF]: QrHandoffScreen,
})
