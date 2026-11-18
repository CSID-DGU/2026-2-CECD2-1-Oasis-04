#!/usr/bin/env bash
# ROUTE_GUIDE 확정본(route-guide-final.html)을 찍는다. Git Bash 에서: design/mockups/confirmed 폴더로 가서 `bash route-shoot.sh`
#   shots/bus-<이름>.png       기본 데이터 (pick1~3, long)
#   shots/subway-<이름>.png    지하철역 데이터 ?set=subway (pick1~3)
#   shots/case-<경우>.png      시험 데이터 9가지 (route-cases.js)
#   shots/bus-measure.txt      하한선 검사(mock.js) + 넘침 결과(카드 노선 줄 수, 타임라인 넘침, 쓴 줄이기 단계)
set -euo pipefail
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$EDGE" ] || EDGE="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
HERE="$(pwd -W)"
shot() { "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1920,1080 --virtual-time-budget=2400 --screenshot="$HERE/$1" "file:///$HERE/$2" >/dev/null 2>&1; }
dom() { "$EDGE" --headless=new --disable-gpu --window-size=1920,1080 --virtual-time-budget=3000 --dump-dom "file:///$HERE/$1" 2>/dev/null; }
PAGES=(
  "bus-pick1|pick=1" "bus-pick2|pick=2" "bus-pick3|pick=3" "bus-long|set=long"
  "subway-pick1|set=subway&pick=1" "subway-pick2|set=subway&pick=2" "subway-pick3|set=subway&pick=3"
  "case-transfer3|case=transfer3" "case-one|case=one" "case-two|case=two" "case-walk|case=walk"
  "case-longcard|case=longcard" "case-longname|case=longname" "case-named|case=named" "case-place|case=place" "case-noexit|case=noexit" "case-longthree|case=longthree"
)
: > shots/bus-measure.txt
for page in "${PAGES[@]}"; do
  IFS='|' read -r name q <<< "$page"
  shot "shots/$name.png" "route-guide-final.html?$q"
  out="$(dom "route-guide-final.html?$q&s=ROUTE_GUIDE&measure=1")"
  fit="$(echo "$out" | grep -o 'data-fit="[^"]*"' | sed 's/&quot;/"/g')"
  echo "$name $fit $(echo "$out" | grep -o '{"screen.*}')" >> shots/bus-measure.txt
  echo "찍음: $name"
done
