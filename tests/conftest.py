"""pytest 공통 설정: kb/, stt/ 를 import 경로에 넣고, 임베딩 없이 만든 작은 지식베이스를 제공한다."""
import os
import subprocess
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for sub in ("kb", "stt"):
    p = os.path.join(ROOT, sub)
    if p not in sys.path:
        sys.path.insert(0, p)

FIXTURE_BUS = os.path.join(ROOT, "tests", "fixtures", "bus_stops_sample.csv")
FIXTURE_SUBWAY = os.path.join(ROOT, "tests", "fixtures", "subway_stations_sample.csv")
FIXTURE_BUS_SEOUL = os.path.join(ROOT, "tests", "fixtures", "seoul_bus_stops_sample.csv")


@pytest.fixture(scope="session")
def kb_dir_merged(tmp_path_factory):
    """전국 파일 + 서울시 파일을 함께 넣은 지식베이스 (겹치는 정류장 제거 확인용)."""
    out = tmp_path_factory.mktemp("kb_merged")
    subprocess.run([sys.executable, os.path.join(ROOT, "kb", "build_kb.py"), "--bus", FIXTURE_BUS,
                    "--bus-seoul", FIXTURE_BUS_SEOUL, "--subway", FIXTURE_SUBWAY, "--regions", "서울",
                    "--out", str(out), "--no-embedding"], check=True, capture_output=True)
    return str(out)


@pytest.fixture(scope="session")
def kb_dir(tmp_path_factory):
    """tests/fixtures 의 표본으로 --no-embedding 지식베이스를 만든다 (torch·faiss 불필요)."""
    out = tmp_path_factory.mktemp("kb")
    subprocess.run([sys.executable, os.path.join(ROOT, "kb", "build_kb.py"), "--bus", FIXTURE_BUS,
                    "--subway", FIXTURE_SUBWAY, "--regions", "서울", "--out", str(out), "--no-embedding"],
                   check=True, capture_output=True)
    return str(out)
