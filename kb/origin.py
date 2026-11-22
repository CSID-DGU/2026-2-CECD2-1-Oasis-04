"""출발지 결정. 브라우저가 보낸 현재 위치(GPS·와이파이 추정)를 가장 가까운 정류장·역에 맞춘다.

키오스크는 한자리에 서 있는 기기라 설정 파일(stt/config.yaml 의 rag.kiosks)의 고정 위치가 기본이다.
설치 위치를 아직 정하지 않았거나 노트북·태블릿으로 옮겨 다니며 쓸 때는 브라우저 위치로 출발지를 잡는다.
위치가 쓸 만하지 않으면(오차가 크거나 안내 범위 밖) 쓰지 않고 그 이유를 돌려주며, 부르는 쪽이 고정 위치로 대신한다.

외부 호출이 없고 지식베이스(TransitKB)만 쓴다.
"""
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from station_lines import lines_at  # noqa: E402
from stop_routes import stop_at  # noqa: E402

SNAP_M = 150.0            # 이 거리 안에 정류장·역이 있으면 그곳에 있는 것으로 보고 출발 좌표도 그곳으로 맞춘다
MAX_ACCURACY_M = 1000.0   # 브라우저가 알려 준 오차 반경이 이보다 크면 믿지 않는다 (IP 주소로 추정한 위치 등)
MAX_DISTANCE_M = 2000.0   # 가장 가까운 정류장·역이 이보다 멀면 안내 범위(지식베이스) 밖으로 본다
PLACE_NEAR_M = 300.0      # 이 거리 안의 정류장·역만 화면의 "지금 계신 곳"(역명판 띠)으로 내보낸다


def place_label(p: dict) -> str:
    """화면에 보여 줄 이름: '종로3가역', '종로3가.탑골공원(중) 정류장'"""
    name = str(p.get("name", "")).strip()
    if p.get("poi_type") == "SUBWAY_STATION":
        plain = re.sub(r"\s*\(.*?\)", "", name).strip() or name
        return plain if plain.endswith("역") else plain + "역"
    if p.get("poi_type") == "BUS_STOP":
        return name if name.endswith(("정류장", "정류소")) else f"{name} 정류장"
    return name


def place_of(kb, poi):
    """정류장·역 하나 → 화면 첫 화면의 역명판 띠가 쓰는 장소 정보 (프런트 디자인 문서 8-5절). 종류를 모르면 None

      지하철역   {"type": "SUBWAY_STATION", "name": "종로3가역", "lines": [{"lineId": "seoul-1", "label": "1", "prev": "종각", "next": "종로5가"}]}
                 노선과 앞·다음 역은 지식베이스 폴더의 station_lines.json 에서 찾는다 (station_lines.py). 파일이 없으면 빈 목록
      버스정류장 {"type": "BUS_STOP", "name": "종로3가.탑골공원 정류장", "prev": "종로2가", "next": "종로4가.종묘",
                  "buses": [{"kind": "TRUNK", "numbers": ["101", "260"], "prev": "종로2가", "next": "종로4가.종묘", "nextMedian": True},
                            {"kind": "BRANCH", "numbers": ["7212"], "prev": "낙원상가", "next": "창덕궁", "nextMedian": False}]}
                 서는 버스와 앞·다음 정류장은 지식베이스 폴더의 stop_routes.json 에서 찾는다 (stop_routes.py).
                 buses 는 종류와 앞·다음 정류장이 같은 버스끼리 한 묶음이다 (같은 종류가 여러 묶음일 수 있다).
                 nextMedian 은 다음 정류장이 중앙차로 정류장인가. 같은 종류 안에서는 그런 묶음이 먼저 온다
                 파일이 없거나 그 자료에 없는 정류장이면 prev·next 는 None, buses 는 빈 목록
    poi 는 {"name", "poi_type", "x", "y"} 를 가진 것 (지식베이스의 장소, 또는 locate 가 돌려준 nearest). 정류장은 poi_id 도 본다
    """
    if not poi:
        return None
    label = place_label(poi)
    if poi.get("poi_type") == "SUBWAY_STATION":
        table = getattr(kb, "station_lines", None) or {}
        return {"type": "SUBWAY_STATION", "name": label, "lines": lines_at(table, poi["name"], poi["y"], poi["x"])}
    if poi.get("poi_type") == "BUS_STOP":
        found = _stop_routes(kb, poi) or {"prev": None, "next": None, "buses": []}
        return {"type": "BUS_STOP", "name": label, **found}
    return None


def _stop_routes(kb, poi):
    """정류장 하나 → {"prev", "next", "buses"} 또는 None. 정류장 번호는 poi 에 없으면 지식베이스에서 읽는다 (nearest 에는 번호가 없다)"""
    table = getattr(kb, "stop_routes", None) or {}
    if not table:
        return None
    poi_id = poi.get("poi_id")
    ars = poi.get("ars_id")
    if ars is None and poi_id:
        ars = (kb.poi(poi_id) or {}).get("ars_id")
    return stop_at(table, poi_id, ars, poi.get("y"), poi.get("x"), by_ars=getattr(kb, "stops_by_ars", None))


def fixed_place(kb, kiosk, near_m=PLACE_NEAR_M):
    """설정 파일의 고정 위치(키오스크)가 놓인 역·정류장을 찾는다. near_m 안에 없으면 None

    역과 정류장이 붙어 있는 곳이 많아서 가장 가까운 것 하나로는 정할 수 없다. 설정의 place_type
    (SUBWAY_STATION | BUS_STOP) 을 따르고, 없으면 키오스크 이름으로 짐작한다 ('…정류장…' 은 정류장, '…역…' 은 역).
    """
    kind = kiosk.get("place_type")
    name = str(kiosk.get("name", ""))
    if kind not in ("SUBWAY_STATION", "BUS_STOP"):
        kind = "BUS_STOP" if "정류장" in name or "정류소" in name else "SUBWAY_STATION" if "역" in name else None
    xy = (kiosk["x"], kiosk["y"])
    found = kb.nearest(xy, poi_type=kind, limit=1) if kind else kb.nearest_any(xy, limit=1)
    return found[0] if found and found[0]["distance_m"] <= near_m else None


def pinned(kb, poi_id):
    """설정에서 직접 정한 역·정류장 → 출발지. 지식베이스에 없거나 역·정류장이 아니면 None

    GPS 가 없는 PC 처럼 브라우저 위치를 믿을 수 없을 때 쓴다. locate 가 돌려주는 것과 같은 모양이고 source 만 'MANUAL' 이다.
    """
    p = kb.poi(poi_id) if poi_id else None
    if not p or p.get("poi_type") not in ("SUBWAY_STATION", "BUS_STOP") or p.get("x") is None or p.get("y") is None:
        return None
    label = place_label(p)
    return {
        "source": "MANUAL", "x": p["x"], "y": p["y"], "name": label, "snapped": True, "accuracy_m": None,
        "nearest": {"poi_id": p["poi_id"], "name": label, "poi_type": p["poi_type"], "x": p["x"], "y": p["y"], "distance_m": 0},
    }


def locate(kb, x, y, accuracy_m=None, snap_m=SNAP_M, max_accuracy_m=MAX_ACCURACY_M, max_distance_m=MAX_DISTANCE_M):
    """(x 경도, y 위도, 오차 반경 m) → (출발지, None) 또는 (None, 쓰지 못한 이유)

    출발지 = {"source": "GPS", "x", "y", "name", "snapped", "accuracy_m",
              "nearest": {"poi_id", "name", "poi_type", "x", "y", "distance_m"}}
      snapped True : 정류장·역이 snap_m 안에 있고 오차도 그 안이다. 좌표와 이름을 그곳으로 맞춘다 ('○○ 정류장')
      snapped False: 조금 떨어져 있거나 오차가 크다. 좌표는 받은 그대로 쓰고 이름은 '○○ 정류장 근처'
    이유 = "INVALID_POSITION" | "LOW_ACCURACY" | "OUT_OF_AREA"
    """
    try:
        x, y = float(x), float(y)
        acc = None if accuracy_m is None else float(accuracy_m)
    except (TypeError, ValueError):
        return None, "INVALID_POSITION"
    if not (math.isfinite(x) and math.isfinite(y) and -180 <= x <= 180 and -90 <= y <= 90):
        return None, "INVALID_POSITION"
    if acc is not None and not (0 <= acc <= max_accuracy_m):   # NaN 도 여기서 걸린다
        return None, "LOW_ACCURACY"
    found = kb.nearest_any((x, y), limit=1)
    if not found or found[0]["distance_m"] > max_distance_m:
        return None, "OUT_OF_AREA"
    p = found[0]
    label = place_label(p)
    snapped = p["distance_m"] <= snap_m and (acc is None or acc <= snap_m)
    return {
        "source": "GPS",
        "x": p["x"] if snapped else x,
        "y": p["y"] if snapped else y,
        "name": label if snapped else f"{label} 근처",
        "snapped": snapped,
        "accuracy_m": None if acc is None else int(round(acc)),
        "nearest": {"poi_id": p["poi_id"], "name": label, "poi_type": p["poi_type"],
                    "x": p["x"], "y": p["y"], "distance_m": p["distance_m"]},
    }, None
