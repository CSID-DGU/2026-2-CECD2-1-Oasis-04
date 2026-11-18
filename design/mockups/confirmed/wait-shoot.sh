#!/usr/bin/env bash
# LISTENING 과 기다림 화면 5개 확정본을 찍는다. Git Bash 에서: design/mockups/confirmed 폴더로 가서 `bash wait-shoot.sh`
#   shots/listening-final.png (+ -blur)    LISTENING (말소리가 큰 순간 0.6초로 멈춤)
#   shots/wait-<화면>.png (+ -blur)         기다림 화면 5개 (호는 0.5초, CHECKING 은 1.2초로 멈춤)
#   shots/wait-five.png (+ -blur)          기다림 화면 5개 나란히
#   shots/listening-wait.png               LISTENING 과 ROUTING 나란히
#   shots/wait-measure.txt                 하한선 검사와 고리 자리
set -euo pipefail
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || EDGE="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
HERE="$(pwd -W)"
shot() { "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size="$1,$2" --virtual-time-budget=2400 --screenshot="$HERE/$3" "file:///$HERE/$4" >/dev/null 2>&1; }
measure() { echo "$1 $("$EDGE" --headless=new --disable-gpu --window-size=1920,1080 --virtual-time-budget=3000 --dump-dom "file:///$HERE/$2" 2>/dev/null | grep -o '{"screen.*}')" >> shots/wait-measure.txt; }
PAGES=(
  "listening-final|listening-final.html?freeze=0.6|listening-final.html?freeze=0.6&s=LISTENING&measure=1"
  "wait-ROUTING|wait-final.html?freeze=0.5|wait-final.html?s=ROUTING&measure=1"
  "wait-RESOLVING|wait-final.html?s=RESOLVING&freeze=0.5|wait-final.html?s=RESOLVING&measure=1"
  "wait-STARTUP_CHECK|wait-final.html?s=STARTUP_CHECK&freeze=0.5|wait-final.html?s=STARTUP_CHECK&measure=1"
  "wait-FAIL_COUNT_CHECK|wait-final.html?s=FAIL_COUNT_CHECK&freeze=0.5|wait-final.html?s=FAIL_COUNT_CHECK&measure=1"
  "wait-CHECKING|wait-final.html?s=CHECKING&freeze=1.2|wait-final.html?s=CHECKING&freeze=1.2&measure=1"
)
: > shots/wait-measure.txt
for page in "${PAGES[@]}"; do
  IFS='|' read -r name url murl <<< "$page"
  shot 1920 1080 "shots/$name.png" "$url"
  shot 1920 1080 "shots/$name-blur.png" "../shared/derive.html?src=../confirmed/shots/$name.png&w=1920&h=1080&blur=12"
  measure "$name" "$murl"
  echo "찍음: $name"
done
W="../confirmed/shots/wait-ROUTING,../confirmed/shots/wait-RESOLVING,../confirmed/shots/wait-STARTUP_CHECK,../confirmed/shots/wait-FAIL_COUNT_CHECK,../confirmed/shots/wait-CHECKING"
L="ROUTING,RESOLVING,STARTUP_CHECK,FAIL_COUNT_CHECK,CHECKING"
shot 2976 1220 "shots/wait-five.png" "../shared/flow-compare.html?cols=3&imgs=$(echo $W | sed 's/,/.png,/g').png&labels=$L"
shot 2976 1220 "shots/wait-five-blur.png" "../shared/flow-compare.html?cols=3&imgs=$(echo $W | sed 's/,/-blur.png,/g')-blur.png&labels=$L"
shot 1992 634 "shots/listening-wait.png" "../shared/flow-compare.html?cols=2&imgs=../confirmed/shots/listening-final.png,../confirmed/shots/wait-RESOLVING.png&labels=LISTENING,RESOLVING"
echo "찍음: 비교 그림"
