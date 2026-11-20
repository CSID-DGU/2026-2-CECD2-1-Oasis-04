// 보조 버튼. 모양은 Button.css. props 는 PrimaryButton 과 같다

import Icon from './Icon.jsx'
import './Button.css'

export default function SecondaryButton({ icon, onClick, children }) {
  return (
    <button type="button" className="btn btn-secondary" onClick={onClick}>
      {icon && <Icon name={icon} className="btn-icon" />}
      <span>{children}</span>
    </button>
  )
}
