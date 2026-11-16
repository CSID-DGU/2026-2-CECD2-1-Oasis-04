from dataclasses import dataclass, field

from pydantic import SerializerFunctionWrapHandler, model_serializer

from kakao_transit import TransitRoute, TransitStep

ROUTE_MODE_SENTENCES = {
    "BUS": "버스만 이용해요.",
    "SUBWAY": "전철만 이용해요.",
    "BUS_AND_SUBWAY": "버스와 전철을 이용해요.",
}


@dataclass(frozen=True, slots=True)
class GuidedTransitRoute(TransitRoute):
    """대중교통 경로와 해당 경로의 한국어 안내."""

    summary: str = field(
        metadata={
            "description": "교통수단, 예상 소요 시간, 환승 횟수를 풀어 쓴 요약",
            "examples": ["버스만 이용해요. 약 20분 걸려요. 갈아타지 않아요."],
        }
    )
    instructions: list[str] = field(
        metadata={
            "description": "`steps`와 같은 순서의 한국어 안내. 구간에서 탈 수 있는 모든 버스 후보를 안내한다.",
            "examples": [["출발 정류장에서 101번, 102번 버스 중 한 대를 타세요. 도착 정류장에서 내리세요."]],
        }
    )

    @model_serializer(mode="wrap")
    def _serialize_guidance_first(self, serialize: SerializerFunctionWrapHandler):
        route = serialize(self)
        return {"summary": route.pop("summary"), "instructions": route.pop("instructions"), **route}


def _format_duration(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds}초"

    hours, minutes = divmod((seconds + 30) // 60, 60)
    if hours and minutes:
        return f"{hours}시간 {minutes}분"
    if hours:
        return f"{hours}시간"
    return f"{minutes}분"


def _step_instruction(step: TransitStep) -> str:
    stops = [name for name in map(str.strip, step.stop_names) if name]
    if step.type == "WALKING" and step.distance_meters > 0:
        walking = f"약 {step.distance_meters}미터 걸으세요."
        if "환승" in step.guidance:
            return f"갈아타려면 {walking}"
        return f"{stops[-1]}까지 {walking}" if stops else walking

    vehicles = [name for name in map(str.strip, step.vehicle_names) if name]
    if vehicles and step.type in ("BUS", "SUBWAY"):
        if step.type == "BUS":
            vehicles = [f"{name}번" if name[-1].isdigit() else name for name in vehicles]
            vehicle_kind, stop_suffix, separator = "버스", "정류장", " "
        else:
            vehicle_kind, stop_suffix, separator = "열차", "역", ""

        unique_vehicles = list(dict.fromkeys(vehicles))
        alternatives = " 중 한 대" if len(unique_vehicles) > 1 else ""
        boarding = f"{', '.join(unique_vehicles)} {vehicle_kind}{alternatives}를 타세요."
        if len(stops) < 2:
            return boarding
        start = f"{stops[0].removesuffix(stop_suffix).rstrip()}{separator}{stop_suffix}"
        end = f"{stops[-1].removesuffix(stop_suffix).rstrip()}{separator}{stop_suffix}"
        return f"{start}에서 {boarding} {end}에서 내리세요."

    return step.guidance.strip() or "이 구간의 상세 안내를 확인해 주세요."


def add_route_guidance(route: TransitRoute) -> GuidedTransitRoute:
    mode = ROUTE_MODE_SENTENCES.get(route.type, "")
    duration = _format_duration(route.duration_seconds)
    transfers = f"{route.transfers}번 갈아타요." if route.transfers else "갈아타지 않아요."
    return GuidedTransitRoute(
        type=route.type,
        duration_seconds=route.duration_seconds,
        distance_meters=route.distance_meters,
        transfers=route.transfers,
        steps=route.steps,
        summary=f"{mode} 약 {duration} 걸려요. {transfers}".lstrip(),
        instructions=[_step_instruction(step) for step in route.steps],
    )
