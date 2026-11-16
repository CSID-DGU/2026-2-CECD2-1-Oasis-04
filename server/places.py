import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

DATA_DIR = Path(__file__).resolve().parent / "data"
PlaceType = Literal["bus_stop", "subway_station"]


@dataclass(frozen=True, slots=True)
class Place:
    """버스정류장 또는 지하철역 검색 결과 한 건."""

    type: PlaceType = field(metadata={"description": "`bus_stop`은 버스정류장, `subway_station`은 지하철역", "examples": ["bus_stop"]})
    id: str = field(metadata={"description": "원본 CSV의 장소 ID. 앞에 붙은 0까지 보존하는 문자열.", "examples": ["100000001"]})
    name: str = field(metadata={"description": "버스정류장 또는 지하철역 이름", "examples": ["종로2가사거리"]})
    latitude: float = field(metadata={"description": "장소 위도(십진도)", "examples": [37.5698055407]})
    longitude: float = field(metadata={"description": "장소 경도(십진도)", "examples": [126.9877522923]})


def _read_places(filename: str, place_type: PlaceType, id_column: str, name_column: str) -> list[Place]:
    path = DATA_DIR / filename
    with path.open(encoding="cp949", newline="") as source:
        return [
            Place(
                type=place_type,
                id=row[id_column].strip(),
                name=row[name_column].strip(),
                latitude=float(row["위도"]),
                longitude=float(row["경도"]),
            )
            for row in csv.DictReader(source)
        ]


def load_places() -> list[Place]:
    bus_stops = _read_places("서울시 정류장마스터 정보.csv", "bus_stop", "정류장_ID", "정류장_명칭")
    subway_stations = _read_places("서울시 역사마스터 정보.csv", "subway_station", "역사_ID", "역사명")
    return bus_stops + subway_stations
