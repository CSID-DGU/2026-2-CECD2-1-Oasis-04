#!/usr/bin/env bash
# v5(가로 1920×1080) 세 장을 찍고 검사용 그림을 만든다. Git Bash 에서: design/mockups/archive 폴더로 가서 `bash v5-shoot.sh`
#   shots/v5-<이름>.png           원본 1920×1080
#   shots/v5-<이름>-blur.png      흐림 검사: blur(12px)
#   shots/v5-<이름>-gray.png      흑백 검사
#   shots/v5-<이름>-portrait.png  세로 창(1080×1920)에 맞춰 줄였을 때 (배율 56%)
#   shots/v5-subway-rail.png      제안: 오른쪽 칸을 옅은 판으로
#   shots/v5-measure.txt          하한선 검사 결과
set -euo pipefail
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || EDGE="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
HERE="$(pwd -W)"
shot() { # shot <가로> <세로> <저장할 파일> <주소>
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$1,$2" --virtual-time-budget=2000 --screenshot="$HERE/$3" "file:///$HERE/$4" >/dev/null 2>&1
}
: > shots/v5-measure.txt
for n in subway bus default; do
  shot 1920 1080 "shots/v5-$n.png" "v5-$n.html"
  shot 1920 1080 "shots/v5-$n-blur.png" "../shared/derive.html?src=../archive/shots/v5-$n.png&w=1920&h=1080&blur=12"
  shot 1920 1080 "shots/v5-$n-gray.png" "../shared/derive.html?src=../archive/shots/v5-$n.png&w=1920&h=1080&gray=1"
  shot 1080 1920 "shots/v5-$n-portrait.png" "v5-fit.html?src=shots/v5-$n.png"
  echo "v5-$n $("$EDGE" --headless=new --disable-gpu --window-size=1920,1080 --virtual-time-budget=3000 \
    --dump-dom "file:///$HERE/v5-$n.html?s=IDLE&measure=1" 2>/dev/null | grep -o '{"screen.*}')" >> shots/v5-measure.txt
  echo "찍음: v5-$n"
done
shot 1920 1080 "shots/v5-subway-rail.png" "v5-subway.html?rail=1"
