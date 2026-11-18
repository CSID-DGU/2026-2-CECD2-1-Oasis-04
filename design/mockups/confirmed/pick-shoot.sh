#!/usr/bin/env bash
# CONFIRMING · MANUAL_SELECT 확정본(confirming-final.html, manual-select-final.html)을 찍는다.
# Git Bash 에서: design/mockups/confirmed 폴더로 가서 `bash pick-shoot.sh`
#   `bash pick-shoot.sh confirming` 처럼 이름 앞부분을 주면 그 화면들만 찍는다 (나란히 그림은 늘 다시 만든다)
#   shots/<이름>.png (+ -blur)   화면 한 장과 흐림(12px) 그림
#   shots/pick-all.png (+ -blur) 여섯 장 나란히 (3열)
#   shots/pick-measure.txt       하한선 검사(mock.js). 일부만 찍으면 그 줄만 바꾼다
set -euo pipefail
ONLY="${1:-}"
cd "$(dirname "$0")"
mkdir -p shots
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || EDGE="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
HERE="$(pwd -W)"
shot() { "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size="$1,$2" --virtual-time-budget=2400 --screenshot="$HERE/$3" "file:///$HERE/$4" >/dev/null 2>&1; }
measure() { echo "$1 $("$EDGE" --headless=new --disable-gpu --window-size=1920,1080 --virtual-time-budget=3000 --dump-dom "file:///$HERE/$2" 2>/dev/null | grep -o '{"screen.*}')" >> shots/pick-measure.txt; }
PAGES=(
  "confirming-3|confirming-final.html?s=CONFIRMING"
  "confirming-1|confirming-final.html?s=CONFIRMING&n=1"
  "confirming-3-timeout|confirming-final.html?s=CONFIRMING&left=15"
  "manual|manual-select-final.html?s=MANUAL_SELECT"
  "manual-novoice|manual-select-final.html?s=MANUAL_SELECT&voice=0"
  "manual-timeout|manual-select-final.html?s=MANUAL_SELECT&left=15"
  "confirming-3-long|confirming-final.html?s=CONFIRMING&names=long"
  "manual-long|manual-select-final.html?s=MANUAL_SELECT&names=long"
  "confirming-1-long|confirming-final.html?s=CONFIRMING&n=1&names=long"
  "confirming-3-timeout-longplace|confirming-final.html?s=CONFIRMING&left=15&place=종로3가.탑골공원"
  "manual-timeout-longplace|manual-select-final.html?s=MANUAL_SELECT&left=15&place=종로3가.탑골공원"
)
touch shots/pick-measure.txt
for page in "${PAGES[@]}"; do
  IFS='|' read -r name url <<< "$page"
  [[ "$name" == "$ONLY"* ]] || continue
  grep -v "^$name " shots/pick-measure.txt > shots/pick-measure.tmp || true
  mv shots/pick-measure.tmp shots/pick-measure.txt
  shot 1920 1080 "shots/$name.png" "$url"
  shot 1920 1080 "shots/$name-blur.png" "../shared/derive.html?src=../confirmed/shots/$name.png&w=1920&h=1080&blur=12"
  measure "$name" "$url&measure=1"
  echo "찍음: $name"
done
N="confirming-3,confirming-1,confirming-3-timeout,manual,manual-novoice,manual-timeout"
L="CONFIRMING 후보 3개,CONFIRMING 후보 1개,CONFIRMING 남은 시간 15초,MANUAL_SELECT,MANUAL_SELECT 말로 하기 숨김,MANUAL_SELECT 남은 시간 15초"
imgs() { echo "$N" | sed "s#\([^,]*\)#../confirmed/shots/\1$1.png#g"; }
shot 2976 1220 "shots/pick-all.png" "../shared/flow-compare.html?cols=3&imgs=$(imgs '')&labels=$L"
shot 2976 1220 "shots/pick-all-blur.png" "../shared/flow-compare.html?cols=3&imgs=$(imgs -blur)&labels=$L"
echo "찍음: 나란히"
