"""보조 학습 데이터(AI-Hub 검증용 묶음 일부)를 매니페스트로 만든다. 교통·방언 발화에 더해 약한 부분을 메우기 위한 것이다.

  number   484 「숫자가 포함된 패턴 발화 데이터」 교통정보: 버스 번호·정거장 수가 든 문장 (pcm → wav). 50대 이상 우선
  noisecmd 71405 「명령어 인식을 위한 소음 환경 데이터」 기차역: 원거리·근거리 마이크, 소음이 섞인 쪽(-N)만
  elder    107 「자유대화 음성(노인남여)」 AI스피커: 60대 이상의 자연스러운 말투
  address  71556 「주소 음성 데이터」 서울: 지명·주소가 든 짧은 대화 (두 사람 말을 한 문장으로 이어 붙임)

정답 표기는 기존 교통 발화와 맞춘다: 숫자는 읽는 그대로 한글로 적는다('사십 오 번'). 주석 기호가 남는 문장은 뺀다.
분할은 화자 해시(0~7 train, 8 dev, 9 test). 화자 정보가 없는 number 는 녹음 ID 를 화자 대신 쓴다.

usage:  python build_extra_manifest.py --src ~/data/aihub_extra --out ~/data/aihub_extra16k
출력: <out>/wav/<종류>/…wav, <out>/manifests/{train,dev,test}_extra.jsonl, stats_extra.json
"""
import argparse
import collections
import glob
import io
import json
import os
import random
import re
import sys
import zipfile

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_manifest import speaker_bucket, split_of  # noqa: E402
from text_norm import normalize_for_training  # noqa: E402

LEFTOVER = re.compile(r"[()\[\]{}/*&@#<>+=_~^|\]|[A-Za-z]{2,}:")
OLDER = ("50대", "60대", "70대", "80대")


def fixed(name: str) -> str:
    """zip 안의 한글 파일 이름 복원 (cp949 로 저장된 이름이 cp437 로 읽힌 경우)"""
    try:
        return name.encode("cp437").decode("cp949")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name


def stem(name: str) -> str:
    return os.path.splitext(os.path.basename(name))[0]


def find_zip(src: str, sub: str, pattern: str) -> list[str]:
    return sorted(z for z in glob.glob(os.path.join(src, sub, "**", "*.zip"), recursive=True) if re.search(pattern, os.path.basename(z)))


def clean(text: str) -> str:
    t = normalize_for_training(text)
    return "" if (not t or LEFTOVER.search(t)) else t


# ---------------------------------------------------------------- 종류별 읽기: (행 목록, 음성을 돌려주는 함수)
def load_number(src):
    """484 교통정보. 텍스트 zip: 분류/<scriptID>.txt
    음성 zip: 분류/<scriptID>/교통정보_<id>_<성별>_<나이대>_<거주>_<억양>_<환경>_<마이크>_<녹음ID>.pcm"""
    texts = {}
    tz = zipfile.ZipFile(find_zip(src, "number484", r"VS_4.*텍스트")[0])
    for i in tz.infolist():
        if not i.filename.endswith(".txt"):
            continue
        body = tz.read(i).decode("utf-8-sig", errors="replace")
        m = re.search(r"scriptTN\s*:\s*(.+)", body)
        theme = re.search(r"patternTheme\s*:\s*(.+)", body)
        if m:
            texts[stem(i.filename)] = (re.sub(r"[\[\]]", "", m.group(1)).strip(), theme.group(1).strip() if theme else "")
    az = zipfile.ZipFile(find_zip(src, "number484", r"VS_4.*음성")[0])
    rows = []
    for i in az.infolist():
        if not i.filename.lower().endswith(".pcm"):
            continue
        parts = stem(fixed(i.filename)).split("_")      # 교통정보, id, 성별, 나이대, 거주, 억양, 환경, 마이크, 녹음ID
        if len(parts) < 9 or parts[1] not in texts:
            continue
        text, theme = texts[parts[1]]
        rows.append({"key": stem(i.filename), "zip": i.filename, "text_raw": text, "speaker": "num_" + parts[-1],
                     "duration": i.file_size / 2 / 16000, "subdomain": "숫자", "intent": theme, "script_no": parts[1],
                     "age_group": parts[3], "accent": parts[5], "env": parts[6], "prefer": parts[3] in OLDER})

    def audio(row):
        pcm = np.frombuffer(az.read(row["zip"]), dtype="<i2")
        buf = io.BytesIO()
        sf.write(buf, pcm, 16000, format="WAV", subtype="PCM_16")
        return buf.getvalue()
    return rows, audio


def load_noisecmd(src):
    """71405 기차역 원거리·근거리. 라벨 <이름>-J.json, 음성 <이름>-N.wav(소음 섞임) / -S.wav(깨끗한 음성). -N 만 쓴다"""
    rows, zips = [], {}
    for lz in find_zip(src, "noisecmd71405", r"^VL_01.*기차역"):
        dist = "원거리" if "원거리" in os.path.basename(lz) else "근거리"
        az_path = find_zip(src, "noisecmd71405", rf"^VS_01.*기차역.*{dist}")
        if not az_path:
            continue
        zips[dist] = zipfile.ZipFile(az_path[0])
        have = {os.path.basename(n) for n in zips[dist].namelist()}
        lzf = zipfile.ZipFile(lz)
        for i in lzf.infolist():
            if not i.filename.endswith(".json"):
                continue
            d = json.loads(lzf.read(i).decode("utf-8-sig"))
            name = d["file"]["name"]
            if f"{name}-N.wav" not in have:
                continue
            rows.append({"key": name + "-N", "zip": None,
                         "text_raw": d["command"]["text"], "speaker": "cmd_" + d["speaker"]["id"], "duration": float(d["file"]["length"]),
                         "subdomain": f"소음명령({dist})", "intent": d["command"].get("domain", ""), "script_no": d["command"].get("commandId", ""),
                         "age_group": d["speaker"].get("age", ""), "env": d["noise"].get("level", ""), "prefer": False, "dist": dist})
    index = {dist: {os.path.basename(n): n for n in z.namelist()} for dist, z in zips.items()}

    def audio(row):
        return zips[row["dist"]].read(index[row["dist"]][row["key"] + ".wav"])
    return rows, audio


_TAG = re.compile(r"\((?:FP|SP|SS):([^)]*)\)")       # 간투어·머뭇거림 표시는 말한 내용만 남긴다: '(FP:뭐)' → '뭐'


def load_elder(src):
    """107 노인 자유대화(AI스피커). 라벨 <화자 폴더>/<이름>.json, 음성 같은 이름의 .WAV. 화자는 폴더 이름으로 구분한다"""
    rows = []
    lzf = zipfile.ZipFile(find_zip(src, "elder107", r"라벨링.*VALIDATION")[0])
    az = zipfile.ZipFile(find_zip(src, "elder107", r"^4\.AI스피커_자유대화.*VALIDATION")[0])
    wavs = {stem(fixed(n)): n for n in az.namelist() if n.lower().endswith(".wav")}
    for i in lzf.infolist():
        if not i.filename.endswith(".json"):
            continue
        d = json.loads(lzf.read(i).decode("utf-8-sig"))
        u, who = d.get("발화정보") or {}, d.get("녹음자정보") or {}
        key = stem(fixed(i.filename))
        if key not in wavs:
            continue
        folder = os.path.basename(os.path.dirname(fixed(i.filename))) or key.rsplit("_", 1)[0]
        age = int(who.get("age") or 0)
        rows.append({"key": key, "zip": wavs[key], "text_raw": _TAG.sub(lambda m: m.group(1), u.get("stt") or ""), "speaker": "eld_" + folder,
                     "duration": float(u.get("recrdTime") or 0), "subdomain": "노인대화",
                     "intent": (d.get("대화정보") or {}).get("convrsThema", "").strip(), "script_no": str(u.get("scriptId") or ""),
                     "age_group": str(age or ""), "env": "", "prefer": age >= 65})

    def audio(row):
        return az.read(row["zip"])
    return rows, audio


_MARK = re.compile(r"(?<!\S)[a-z]/\s*")        # 'n/ 네 맞아요' 의 잡음·숨소리 표시


def load_address(src):
    """71556 주소 음성(서울). 파일 하나가 두 사람의 짧은 대화(8~13초)라 통째로 쓰고, 두 사람 말을 이어 한 문장으로 만든다"""
    rows = []
    lzf = zipfile.ZipFile(find_zip(src, "address71556", r"^VL_01.*서울")[0])
    az = zipfile.ZipFile(find_zip(src, "address71556", r"^VS_01.*서울")[0])
    wavs = {stem(n): n for n in az.namelist() if n.lower().endswith(".wav")}
    for i in lzf.infolist():
        if not i.filename.endswith(".json"):
            continue
        d = json.loads(lzf.read(i).decode("utf-8-sig"))
        key = stem(d["info"]["file_name"])
        turns = d.get("dialogs") or []
        if key not in wavs or not turns:
            continue
        text = " ".join(_MARK.sub("", re.sub(r"[\[\]]", "", t.get("text") or "")).strip() for t in turns)
        parts = key.split("_")
        rows.append({"key": key, "zip": wavs[key], "text_raw": text, "speaker": "adr_" + "_".join(parts[2:4]),
                     "duration": float(turns[-1].get("endPoint") or 0), "subdomain": "주소", "intent": d["info"].get("environment", ""),
                     "script_no": parts[1] if len(parts) > 1 else "", "age_group": "", "env": "", "prefer": False})

    def audio(row):
        return az.read(row["zip"])
    return rows, audio


SOURCES = {"number": load_number, "noisecmd": load_noisecmd, "elder": load_elder, "address": load_address}


def pick(rows, hours, rng):
    """우선 대상(prefer)을 먼저, 화자를 돌아가며 시간 상한까지 뽑는다."""
    by_spk = collections.defaultdict(list)
    for r in rows:
        by_spk[r["speaker"]].append(r)
    for v in by_spk.values():
        rng.shuffle(v)
        v.sort(key=lambda r: r["prefer"])           # pop() 이 뒤에서 꺼내므로 우선 대상이 먼저 나온다
    speakers = sorted(by_spk)
    rng.shuffle(speakers)
    speakers.sort(key=lambda s: -sum(r["prefer"] for r in by_spk[s]) / len(by_spk[s]))
    out, total, limit = [], 0.0, hours * 3600
    while speakers and total < limit:
        for s in list(speakers):
            if not by_spk[s]:
                speakers.remove(s)
                continue
            r = by_spk[s].pop()
            out.append(r)
            total += r["duration"]
            if total >= limit:
                break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="~/data/aihub_extra", help="aihubshell 로 받은 폴더 (종류별 하위 폴더)")
    ap.add_argument("--out", default="~/data/aihub_extra16k")
    ap.add_argument("--sources", default="number,noisecmd,elder,address")
    ap.add_argument("--train-hours", type=float, default=4.0, help="종류마다 학습에 넣을 시간 상한")
    ap.add_argument("--dev-hours", type=float, default=0.3)
    ap.add_argument("--test-hours", type=float, default=0.5)
    ap.add_argument("--min-seconds", type=float, default=1.0)
    ap.add_argument("--max-seconds", type=float, default=20.0)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    src, out = os.path.expanduser(args.src), os.path.expanduser(args.out)
    caps = {"train": args.train_hours, "dev": args.dev_hours, "test": args.test_hours}
    rng = random.Random(args.seed)
    os.makedirs(os.path.join(out, "manifests"), exist_ok=True)
    result = {"train": [], "dev": [], "test": []}
    stats = {}

    for name in [s for s in args.sources.split(",") if s]:
        rows, audio = SOURCES[name](src)
        dropped = collections.Counter()
        usable = []
        for r in rows:
            r["text"] = clean(r["text_raw"])
            if not r["text"]:
                dropped["text(빈 문장·주석 기호)"] += 1
            elif not (args.min_seconds <= r["duration"] <= args.max_seconds):
                dropped["duration"] += 1
            else:
                r["split"] = split_of(speaker_bucket(r["speaker"]), {8}, {9})
                usable.append(r)
        wav_dir = os.path.join(out, "wav", name)
        os.makedirs(wav_dir, exist_ok=True)
        stats[name] = {"available": {"files": len(usable), "hours": round(sum(r["duration"] for r in usable) / 3600, 1),
                                     "speakers": len({r["speaker"] for r in usable})}}
        for split in ("train", "dev", "test"):
            kept = []
            for r in pick([r for r in usable if r["split"] == split], caps[split], rng):
                data = audio(r)
                info = sf.info(io.BytesIO(data))
                if info.samplerate != 16000 or info.channels != 1:
                    dropped["not_16k_mono"] += 1
                    continue
                path = os.path.join(wav_dir, r["key"] + ".wav")
                with open(path, "wb") as f:
                    f.write(data)
                kept.append({"audio": path, "text": r["text"], "text_raw": r["text_raw"], "speaker": r["speaker"],
                             "duration": round(info.frames / info.samplerate, 2), "domain": "보조", "subdomain": r["subdomain"],
                             "intent": r["intent"], "script_no": r["script_no"], "aihub_split": "extra_validation", "split": split,
                             "age_group": r.get("age_group", ""), "env": r.get("env", "")})
            result[split].extend(kept)
            stats[name][split] = {"files": len(kept), "hours": round(sum(r["duration"] for r in kept) / 3600, 2),
                                  "speakers": len({r["speaker"] for r in kept})}
        stats[name]["dropped"] = dict(dropped)
        print(name, json.dumps(stats[name], ensure_ascii=False), flush=True)

    for split, rows in result.items():
        path = os.path.join(out, "manifests", f"{split}_extra.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"{split:5s} | files {len(rows):6d} | {sum(r['duration'] for r in rows) / 3600:5.1f} h | "
              f"speakers {len({r['speaker'] for r in rows}):4d} | {path}")
    with open(os.path.join(out, "manifests", "stats_extra.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
