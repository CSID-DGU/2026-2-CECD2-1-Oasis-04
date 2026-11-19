#!/usr/bin/env bash
# REASKING · UNAVAILABLE · QR_HANDOFF · MANUAL_SELECT(불러오는 중·오류) 확정본을 찍는다 (2026-11-19). 규칙은 docs/design-guidelines.md 12절.
# Git Bash 에서: design/mockups/confirmed 폴더로 가서 `bash states-shoot.sh`
#   `bash states-shoot.sh unavailable` 처럼 이름 앞부분을 주면 그 화면들만 찍는다 (나란히 그림은 늘 다시 만든다)
#   shots/<이름>.png (+ -blur)   화면 한 장과 흐림(12px) 그림
#   shots/states-all.png (+ -blur)  REASKING, UNAVAILABLE 5가지, QR_HANDOFF, MANUAL_SELECT 불러오는 중·오류 (3열)
#   shots/states-timeout.png     남은 시간 알림을 적용한 세 화면 나란히
#   shots/states-measure.txt     하한선 검사(../shared/mock.js)
set -euo pipefail
ONLY="${1:-}"
cd "$(dirname "$0")"
mkdir -p shots
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || EDGE="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
HERE="$(pwd -W)"
shot() { "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size="$1,$2" --virtual-time-budget=2400 --screenshot="$HERE/$3" "file:///$HERE/$4" >/dev/null 2>&1; }
measure() { echo "$1 $("$EDGE" --headless=new --disable-gpu --window-size=1920,1080 --virtual-time-budget=3000 --dump-dom "file:///$HERE/$2" 2>/dev/null | grep -o '{"screen.*}')" >> shots/states-measure.txt; }
PAGES=(
  "reasking|reasking-final.html?s=REASKING"
  "reasking-noheard|reasking-final.html?s=REASKING&heard="
  "reasking-timeout|reasking-final.html?s=REASKING&left=15"
  "unavailable-noroute|unavailable-final.html?s=UNAVAILABLE&r=noroute"
  "unavailable-close|unavailable-final.html?s=UNAVAILABLE&r=close"
  "unavailable-scope|unavailable-final.html?s=UNAVAILABLE&r=scope"
  "unavailable-upstream|unavailable-final.html?s=UNAVAILABLE&r=upstream"
  "unavailable-generic|unavailable-final.html?s=UNAVAILABLE&r=generic"
  "unavailable-timeout|unavailable-final.html?s=UNAVAILABLE&r=noroute&left=15"
  "qr|qr-handoff-final.html?s=QR_HANDOFF"
  "qr-timeout|qr-handoff-final.html?s=QR_HANDOFF&left=15"
  "manual-loading|manual-select-final.html?s=MANUAL_SELECT&state=loading&freeze=0.5"
  "manual-loading-novoice|manual-select-final.html?s=MANUAL_SELECT&state=loading&voice=0&freeze=0.5"
  "manual-error|manual-select-final.html?s=MANUAL_SELECT&state=error"
  "manual-error-novoice|manual-select-final.html?s=MANUAL_SELECT&state=error&voice=0"
)
touch shots/states-measure.txt
for page in "${PAGES[@]}"; do
  IFS='|' read -r name url <<< "$page"
  [[ "$name" == "$ONLY"* ]] || continue
  grep -v "^$name " shots/states-measure.txt > shots/states-measure.tmp || true
  mv shots/states-measure.tmp shots/states-measure.txt
  shot 1920 1080 "shots/$name.png" "$url"
  shot 1920 1080 "shots/$name-blur.png" "../shared/derive.html?src=../confirmed/shots/$name.png&w=1920&h=1080&blur=12"
  measure "$name" "$url&measure=1"
  echo "찍음: $name"
done
imgs() { echo "$1" | sed "s#\([^,]*\)#../confirmed/shots/\1$2.png#g"; }
N="reasking,unavailable-noroute,unavailable-close,unavailable-scope,unavailable-upstream,unavailable-generic,qr,manual-loading,manual-error"
L="REASKING,UNAVAILABLE 경로 없음,UNAVAILABLE 가까움,UNAVAILABLE 범위 밖(서울 밖),UNAVAILABLE 길 안내 못 받음,UNAVAILABLE 공통 오류,QR_HANDOFF,MANUAL_SELECT 불러오는 중,MANUAL_SELECT 목록 오류"
shot 2976 1830 "shots/states-all.png" "../shared/flow-compare.html?cols=3&imgs=$(imgs "$N" '')&labels=$L"
shot 2976 1830 "shots/states-all-blur.png" "../shared/flow-compare.html?cols=3&imgs=$(imgs "$N" -blur)&labels=$L"
T="reasking-timeout,unavailable-timeout,qr-timeout"
shot 2976 630 "shots/states-timeout.png" "../shared/flow-compare.html?cols=3&imgs=$(imgs "$T" '')&labels=REASKING 남은 시간 15초,UNAVAILABLE 남은 시간 15초,QR_HANDOFF 남은 시간 15초"
echo "찍음: 나란히"
