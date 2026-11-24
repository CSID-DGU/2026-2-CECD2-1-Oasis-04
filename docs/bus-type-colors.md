# 버스 종류별 API 값과 테두리 색상

`steps[].bus_type`은 영문 대문자 문자열이며, 종류를 식별할 수 없으면 `null`이다.

| 버스 종류 | API의 `bus_type` | 경로 화면 테두리 | CSS 변수 |
|---|---|---|---|
| 간선 | `TRUNK` | 파랑 `#0068B7` | `--bus-trunk` |
| 지선 | `BRANCH` | 초록 `#53B332` | `--bus-branch` |
| 광역 | `EXPRESS` | 빨강 `#E60012` | `--bus-express` |
| 순환 | `CIRCULAR` | 노랑 `#F2B70A` | `--bus-circular` |
| 마을 | `VILLAGE` | 초록 `#53B332` | `--bus-branch` |
| 심야 | `NIGHT` | 기본 회색 `#DCDCDC` | `--line-none` |
| 공항 | `AIRPORT` | 기본 회색 `#DCDCDC` | `--line-none` |
| 경기 일반 | `GG_GENERAL` | 청록 `#33CC99` | `--bus-gg-general` |
| 경기 좌석 | `GG_SEAT` | 파랑 `#0068B7` | `--bus-gg-seat` |
| 경기 직행 | `GG_DIRECT` | 빨강 `#E60012` | `--bus-gg-direct` |
