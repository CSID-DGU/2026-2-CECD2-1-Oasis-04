"""전체 서버: STT(/stt, /resolve, /health, /pois) + 경로 안내(/route) + 키오스크 화면.

    cd ~/senior-voice && .venv/bin/python server/app.py      → http://localhost:8000  (Swagger: /docs)

GET /api/v1/route 는 출발지(키오스크 고정 위치, 또는 화면이 POST /location 으로 알린 위치를 가까운 정류장에 맞춘 곳)에서
목적지까지의 대중교통 경로를 카카오맵 대중교통 경로 조회 API 로 받아,
어르신 맞춤 점수(환승·도보가 적은 순)로 다시 줄 세우고 쉬운 문장으로 바꿔 최대 3개를 돌려준다 (명세 3.4절).
지도 API 키는 서버만 가진다. 화면에는 내려가지 않는다.

환경변수 (저장소 루트의 .env 에 적어도 된다. .env 는 커밋하지 않는다):
    KAKAO_REST_API_KEY   카카오 디벨로퍼스 앱의 REST API 키 (앱에서 카카오맵 사용 설정 ON 필요)
    ROUTE_WALK_ONLY_M    이 거리(직선, m)보다 가까우면 지도 API 를 부르지 않고 '걸어서 가세요' 로 답한다 (기본 400)
    그 밖의 STT 쪽 환경변수는 stt/api.py 참고
"""
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _sub in ("server", "kb", "stt"):
    sys.path.insert(0, os.path.join(ROOT, _sub))


def load_env(path: str) -> None:
    """KEY=VALUE 줄을 읽어 환경변수로 올린다. 이미 설정된 값은 덮어쓰지 않는다."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key, value = key.strip(), value.strip().strip('"').strip("'")
            if key and value and key not in os.environ:
                os.environ[key] = value


load_env(os.path.join(ROOT, ".env"))

from fastapi import APIRouter  # noqa: E402

import api as stt_api  # noqa: E402  (stt/api.py)
from kakao import KakaoRouteProvider  # noqa: E402
from routing import RouteError, haversine_m, round10, to_response_routes  # noqa: E402

router = APIRouter(prefix="/api/v1", tags=["route"])
provider = KakaoRouteProvider()
WALK_ONLY_M = float(os.environ.get("ROUTE_WALK_ONLY_M", "400"))
KST = timezone(timedelta(hours=9))
stt_api.S.route_info = {"provider": provider.name, "configured": provider.configured}


@router.get("/route", summary="출발지 → 목적지 대중교통 경로 (어르신 맞춤 순, 최대 3개)")
def route(kiosk_id: str, dest_poi_id: Optional[str] = None, dest_x: Optional[float] = None,
          dest_y: Optional[float] = None, dest_name: Optional[str] = None, max_routes: int = 3):
    t0 = time.time()
    S = stt_api.S
    # 출발지: 화면이 POST /location 으로 현재 위치를 알렸으면 가까운 정류장에 맞춘 그 위치, 아니면 키오스크 고정 위치
    where, err = stt_api.resolve_origin(kiosk_id)
    if err:
        return stt_api.fail(err, f"unknown kiosk_id {kiosk_id}", t0)

    if dest_poi_id:
        if S.kb is None:
            return stt_api.fail("MODEL_NOT_READY", "kb loading", t0)
        p = S.kb.poi(dest_poi_id)
        if not p:
            return stt_api.fail("POI_NOT_FOUND", f"unknown dest_poi_id {dest_poi_id}", t0)
        dest = {"poi_id": dest_poi_id, "name": stt_api.confirm_name(stt_api.display_name(p)), "x": p["x"], "y": p["y"]}
    elif dest_x is not None and dest_y is not None:
        dest = {"poi_id": None, "name": (dest_name or "목적지").strip(), "x": dest_x, "y": dest_y}
    else:
        return stt_api.fail("VALIDATION_ERROR", "dest_poi_id or (dest_x, dest_y) is required", t0)

    origin = {"name": where["name"], "x": where["x"], "y": where["y"], "source": where["source"]}
    straight = haversine_m(origin["x"], origin["y"], dest["x"], dest["y"])
    if straight < WALK_ONLY_M:
        return stt_api.fail("ROUTE_TOO_CLOSE", f"straight distance {straight:.0f} m < {WALK_ONLY_M:.0f} m", t0,
                            easy=f"가까운 곳이라 걸어서 가실 수 있어요. 약 {max(10, round10(straight))}미터예요.")

    try:
        raw_routes, landing = provider.search(origin["x"], origin["y"], dest["x"], dest["y"],
                                              s_name=origin["name"], e_name=dest["name"])
        # 좌표를 넘겨 앞뒤 도보를 단계로 만들고, 지금 시각을 넘겨 낮의 심야버스 같은 경로를 뺀다
        routes = to_response_routes(raw_routes, dest["name"], max_routes, origin_xy=(origin["x"], origin["y"]),
                                    dest_xy=(dest["x"], dest["y"]), now=datetime.now(KST))
    except RouteError as e:
        if e.code == "UPSTREAM_ERROR":
            print(f"[route] upstream error: {e.message}", file=sys.stderr, flush=True)
        return stt_api.fail(e.code, e.message, t0, easy=e.easy)
    if not routes:
        return stt_api.fail("ROUTE_NOT_FOUND", "no usable route", t0)

    return stt_api.ok({
        "origin": origin,
        "destination": dest,
        "summary_text": f"{dest['name']}까지 가는 길을 {len(routes)}가지 찾았어요.",
        "routes": routes,
        "provider": provider.name,
        "landing_url": landing,   # 카카오맵 길찾기 화면 주소 (휴대폰으로 보내기용)
    }, t0)


app = stt_api.create_app(
    extra_routers=[router], title="Senior Voice API",
    description="어르신 음성 → 전사(RAG 보정) → 목적지 후보 → 대중교통 경로. /stt, /resolve, /route, /health, /pois")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
