#!/usr/bin/env bash
# v4 세 장을 찍고 시선 순서 검사용 그림을 만든다. Git Bash 에서: design/mockups/archive 폴더로 가서 `bash v4-shoot.sh`
#   shots/v4-<이름>.png        원본 1080×1920
#   shots/v4-<이름>-blur.png   흐림 검사: blur(12px)
#   shots/v4-<이름>-gray.png   흑백 검사
#   shots/v4-<이름>-small.png  축소 검사: 270×480
#   shots/v4-check.png         위 그림을 한 장에 모은 것 (v4-check.html)
#   shots/v4-measure.txt       하한선 검사 결과
set -euo pipefail
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || EDGE="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
HERE="$(pwd -W)"
shot() { # shot <가로> <세로> <저장할 파일> <주소>
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$1,$2" --virtual-time-budget=2000 --screenshot="$HERE/$3" "file:///$HERE/$4" >/dev/null 2>&1
}
: > shots/v4-measure.txt
for n in subway bus default; do
  shot 1080 1920 "shots/v4-$n.png" "v4-$n.html"
  shot 1080 1920 "shots/v4-$n-blur.png" "../shared/derive.html?src=../archive/shots/v4-$n.png&w=1080&h=1920&blur=12"
  shot 1080 1920 "shots/v4-$n-gray.png" "../shared/derive.html?src=../archive/shots/v4-$n.png&w=1080&h=1920&gray=1"
  shot 270 480 "shots/v4-$n-small.png" "../shared/derive.html?src=../archive/shots/v4-$n.png&w=270&h=480"
  echo "v4-$n $("$EDGE" --headless=new --disable-gpu --window-size=1080,1920 --virtual-time-budget=3000 \
    --dump-dom "file:///$HERE/v4-$n.html?s=IDLE&measure=1" 2>/dev/null | grep -o '{"screen.*}')" >> shots/v4-measure.txt
  echo "찍음: v4-$n"
done
shot 1250 2100 "shots/v4-check.png" "v4-check.html"
