// 서비스 이름. 시안 전체에서 이 한 곳만 고친다 (디자인 문서 5절).
// 화면에는 이름 자리로 <service-name></service-name> 만 둔다. 이 파일을 <head> 에서 불러 두면
// 브라우저가 그 자리를 만나는 순간(템플릿에서 복제해 넣을 때도) 아래 이름을 채운다.
// 로고 그림(원 안의 점)은 각 화면의 svg 그대로다.
;(() => {
  const SERVICE_NAME = '오아시스'
  customElements.define(
    'service-name',
    class extends HTMLElement {
      connectedCallback() {
        this.textContent = SERVICE_NAME
      }
    },
  )
})()
