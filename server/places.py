import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

DATA_DIR = Path(__file__).resolve().parent / "data"
PlaceType = Literal["bus_stop", "subway_station"]


@dataclass(frozen=True, slots=True)
class Place:
    type: PlaceType
    id: str
    name: str
    latitude: float
    longitude: float


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
