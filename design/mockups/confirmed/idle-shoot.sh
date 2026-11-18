#!/usr/bin/env bash
# IDLE 세 가지, IDLE_REDUCED, 얇은 띠 확정본을 찍는다. Git Bash 에서: design/mockups/confirmed 폴더로 가서 `bash idle-shoot.sh`
#   shots/idle-final-<경우>.png (+ -blur)   IDLE 지하철역·버스정류장·장소 정보 없음
#   shots/idle-reduced-final.png (+ -blur)  IDLE_REDUCED
#   shots/band-thin.png                     얇은 띠 (MANUAL_SELECT 예시)
#   shots/final-measure.txt                 하한선 검사 (mock.js)
# 확정 파일을 고친 뒤(archive/ 에서 node build-final.mjs) 다시 찍는다
set -euo pipefail
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || EDGE="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
HERE="$(pwd -W)"
shot() { "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1920,1080 --virtual-time-budget=2400 --screenshot="$HERE/$1" "file:///$HERE/$2" >/dev/null 2>&1; }
measure() { echo "$1 $("$EDGE" --headless=new --disable-gpu --window-size=1920,1080 --virtual-time-budget=3000 --dump-dom "file:///$HERE/$2" 2>/dev/null | grep -o '{"screen.*}')" >> shots/final-measure.txt; }
PAGES=(
  "idle-final-subway|IDLE|blur" "idle-final-bus|IDLE|blur" "idle-final-default|IDLE|blur"
  "idle-reduced-final|IDLE_REDUCED|blur" "band-thin|MANUAL_SELECT|"
)
: > shots/final-measure.txt
for page in "${PAGES[@]}"; do
  IFS='|' read -r name screen blur <<< "$page"
  shot "shots/$name.png" "$name.html"
  [ -n "$blur" ] && shot "shots/$name-blur.png" "../shared/derive.html?src=../confirmed/shots/$name.png&w=1920&h=1080&blur=12"
  measure "$name" "$name.html?s=$screen&measure=1"
  echo "찍음: $name"
done
