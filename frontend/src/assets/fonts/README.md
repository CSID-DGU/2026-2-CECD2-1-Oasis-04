# 글꼴 파일

키오스크는 네트워크가 끊길 수 있어서 글꼴을 CDN 에서 받지 않고 이 폴더에 넣어 둔다.
`@font-face` 선언은 `src/styles/global.css` 에 있다. 기준은 `docs/design-guidelines.md` 3-3절.

| 파일 | 굵기 | 쓰는 곳 |
|---|---|---|
| `Pretendard-Regular.woff2` | 400 | 본문, 보조 설명 |
| `Pretendard-Bold.woff2` | 700 | 제목, 버튼, 강조 |
| `LICENSE.txt` | - | SIL Open Font License 1.1 |

## 출처

- 글꼴: Pretendard 1.3.9 (길형진, https://github.com/orioncactus/pretendard)
- 받은 곳: npm 패키지 `pretendard@1.3.9` 의 `dist/web/static/woff2/` 와 `dist/LICENSE.txt` (2026-11-16)
- 파일은 고치지 않고 그대로 복사했다. 글자를 덜어 낸 subset 이 아니라 전체 글자가 든 파일이다 (목적지 이름에 어떤 한글이 올지 몰라서)

## 굵기를 더하거나 버전을 올릴 때

1. `docs/design-guidelines.md` 3-3절을 먼저 고친다
2. 같은 패키지의 `dist/web/static/woff2/` 에서 파일을 복사한다
3. `global.css` 의 `@font-face` 와 이 표를 고친다
