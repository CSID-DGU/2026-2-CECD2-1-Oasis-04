"""경로 API와 키오스크가 공유하는 버스 종류와 위치 응답의 노선 ID."""

BUS_KINDS = {
    "간선": "TRUNK", "지선": "BRANCH", "광역": "EXPRESS", "순환": "CIRCULAR",
    "마을": "VILLAGE", "심야": "NIGHT", "공항": "AIRPORT",
    "일반": "GG_GENERAL", "좌석": "GG_SEAT", "직행": "GG_DIRECT",
}

LINE_IDS = {
    **{f"{n}호선": f"seoul-{n}" for n in range(1, 10)},
    "공항철도": "arex", "공항철도1호선": "arex", "경의중앙선": "gyeongui-jungang",
    "수인분당선": "suin-bundang", "GTX-A": "gtx-a", "경춘선": "gyeongchun",
    "신분당선": "sinbundang", "우이신설선": "ui-sinseol", "신림선": "sillim",
    "김포골드라인": "gimpo-gold", "서해선": "seohae", "경강선": "gyeonggang",
    "인천1호선": "incheon-1", "인천2호선": "incheon-2",
    "의정부경전철": "uijeongbu", "에버라인": "everline",
}


def subway_line_id(name):
    normalized = "".join(name.split()).removeprefix("수도권")
    return LINE_IDS.get(normalized)


def bus_labels(vehicles):
    kinds = {}
    for name, raw_type in vehicles:
        if name:
            kind = BUS_KINDS.get(raw_type)
            kinds[name] = kind if kinds.get(name, kind) == kind else None
    # routeLegs.js와 같이 괄호 없는 첫 번호를 표시한다.
    display = next((name for name in kinds if "(" not in name), next(iter(kinds), None))
    return {"bus_type": kinds.get(display), "bus_types_by_name": kinds}
