// 주 버튼 (화면당 최대 1개, 디자인 문서 2절). 모양은 Button.css.
// props: icon(Icon 이름, 글자 왼쪽), onClick, children(글자. 아이콘만 있는 버튼은 금지라 반드시 넣는다)

import Icon from './Icon.jsx'
import './Button.css'

export default function PrimaryButton({ icon, onClick, children }) {
  return (
    <button type="button" className="btn btn-primary" onClick={onClick}>
      {icon && <Icon name={icon} className="btn-icon" />}
      <span>{children}</span>
    </button>
  )
}
