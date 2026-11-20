// 고르는 카드 하나 (디자인 문서 11-1절). PickList 안에 둔다.
//   이름(굵게) / 분류(둘째 줄, 30px, 괄호 없이) + 오른쪽 끝 넘어감 화살표(본문색)
//   이름 줄 바꿈은 6절 규칙: 띄어쓰기가 있으면 띄어쓰기에서만, 한 단어면 글자 사이에서, 둘 다 줄 길이를 고르게 (view/textWrap.js)
//
// props: name, kind(분류, 없으면 줄을 그리지 않는다), onClick

import Icon from './Icon.jsx'
import { evenWrapClass } from '../view/textWrap.js'

export default function PickCard({ name, kind = null, onClick }) {
  return (
    <li>
      <button type="button" className="pick" onClick={onClick}>
        <span className="pick-text">
          <span className={`pick-name ${evenWrapClass(name)}`}>{name}</span>
          {kind && <small className="pick-kind">{kind}</small>}
        </span>
        <Icon name="chevron_right" className="pick-arrow" />
      </button>
    </li>
  )
}
