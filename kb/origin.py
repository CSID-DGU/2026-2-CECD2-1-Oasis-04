"""출발지 결정. 브라우저가 보낸 현재 위치(GPS·와이파이 추정)를 가장 가까운 정류장·역에 맞춘다.

키오스크는 한자리에 서 있는 기기라 설정 파일(stt/config.yaml 의 rag.kiosks)의 고정 위치가 기본이다.
설치 위치를 아직 정하지 않았거나 노트북·태블릿으로 옮겨 다니며 쓸 때는 브라우저 위치로 출발지를 잡는다.
위치가 쓸 만하지 않으면(오차가 크거나 안내 범위 밖) 쓰지 않고 그 이유를 돌려주며, 부르는 쪽이 고정 위치로 대신한다.

외부 호출이 없고 지식베이스(TransitKB)만 쓴다.
"""
import math
import re

SNAP_M = 150.0            # 이 거리 안에 정류장·역이 있으면 그곳에 있는 것으로 보고 출발 좌표도 그곳으로 맞춘다
MAX_ACCURACY_M = 1000.0   # 브라우저가 알려 준 오차 반경이 이보다 크면 믿지 않는다 (IP 주소로 추정한 위치 등)
MAX_DISTANCE_M = 2000.0   # 가장 가까운 정류장·역이 이보다 멀면 안내 범위(지식베이스) 밖으로 본다


def place_label(p: dict) -> str:
    """화면에 보여 줄 이름: '종로3가역', '종로3가.탑골공원(중) 정류장'"""
    name = str(p.get("name", "")).strip()
    if p.get("poi_type") == "SUBWAY_STATION":
        plain = re.sub(r"\s*\(.*?\)", "", name).strip() or name
        return plain if plain.endswith("역") else plain + "역"
    if p.get("poi_type") == "BUS_STOP":
        return name if name.endswith(("정류장", "정류소")) else f"{name} 정류장"
    return name


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
