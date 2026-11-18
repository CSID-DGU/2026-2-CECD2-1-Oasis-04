#!/usr/bin/env bash
# v6(가로 1920×1080) 세 장을 찍고 검사용 그림을 만든다. Git Bash 에서: design/mockups/archive 폴더로 가서 `bash v6-shoot.sh`
#   shots/v6-<이름>.png        원본 1920×1080
#   shots/v6-<이름>-blur.png   흐림 검사: blur(12px)
#   shots/v6-<이름>-gray.png   흑백 검사
#   shots/v6-measure.txt       하한선 검사와 시선 순서 숫자 (주 버튼 넓이 비율, 가장 큰 글씨, 주 버튼 글씨)
#   shots/v5-v6.png            v5 와 v6 을 나란히 놓은 비교 (v6-compare.html)
set -euo pipefail
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || EDGE="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
HERE="$(pwd -W)"
shot() { # shot <가로> <세로> <저장할 파일> <주소>
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$1,$2" --virtual-time-budget=2400 --screenshot="$HERE/$3" "file:///$HERE/$4" >/dev/null 2>&1
}
: > shots/v6-measure.txt
for n in subway bus default; do
  shot 1920 1080 "shots/v6-$n.png" "v6-$n.html"
  shot 1920 1080 "shots/v6-$n-blur.png" "../shared/derive.html?src=../archive/shots/v6-$n.png&w=1920&h=1080&blur=12"
  shot 1920 1080 "shots/v6-$n-gray.png" "../shared/derive.html?src=../archive/shots/v6-$n.png&w=1920&h=1080&gray=1"
  echo "v6-$n $("$EDGE" --headless=new --disable-gpu --window-size=1920,1080 --virtual-time-budget=3000 \
    --dump-dom "file:///$HERE/v6-$n.html?s=IDLE&measure=1" 2>/dev/null | grep -o '{"screen.*}')" >> shots/v6-measure.txt
  echo "찍음: v6-$n"
done
shot 1980 1250 "shots/v5-v6.png" "v6-compare.html"
