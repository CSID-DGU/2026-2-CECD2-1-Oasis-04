#!/usr/bin/env bash
# 시안 스크린샷을 다시 찍는다. Git Bash 에서: design/mockups/archive 폴더로 가서 `bash shoot.sh`
#   shots/<방향>-<화면>.png        원본 1080×1920
#   shots/<방향>-<화면>-gray.png   흑백 1080×1920 (원본 그림을 흑백으로 바꾼 것)
#   shots/<방향>-<화면>-small.png  1/4 축소 270×480 (원본 그림을 줄인 것)
#   shots/measure.txt              하한선 검사 결과 (한 줄에 화면 하나)
# 그림 도구 없이 Edge 만 쓴다: 원본은 시안 페이지를, 흑백·축소는 derive.html 을 찍는다.
set -euo pipefail
cd "$(dirname "$0")"

EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || EDGE="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
HERE="$(pwd -W)"
DIRECTIONS="a b c"
SCREENS="${SCREENS:-IDLE LISTENING ROUTING ROUTE_GUIDE}" # 비교하는 화면 4개. 다른 화면은 SCREENS="CHECKING" bash shoot.sh

shot() { # shot <가로> <세로> <저장할 파일> <주소>
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$1,$2" --virtual-time-budget=1500 --screenshot="$HERE/$3" "file:///$HERE/$4" >/dev/null 2>&1
}

mkdir -p shots
: > shots/measure.txt
for d in $DIRECTIONS; do
  for s in $SCREENS; do
    shot 1080 1920 "shots/$d-$s.png" "$d.html?s=$s"
    shot 1080 1920 "shots/$d-$s-gray.png" "../shared/derive.html?src=../archive/shots/$d-$s.png&w=1080&h=1920&gray=1"
    shot 270 480 "shots/$d-$s-small.png" "../shared/derive.html?src=../archive/shots/$d-$s.png&w=270&h=480"
    echo "$d $("$EDGE" --headless=new --disable-gpu --window-size=1080,1920 --virtual-time-budget=3000 \
      --dump-dom "file:///$HERE/$d.html?s=$s&measure=1" 2>/dev/null | grep -o '{"screen.*}')" >> shots/measure.txt
    echo "찍음: $d-$s"
  done
done
