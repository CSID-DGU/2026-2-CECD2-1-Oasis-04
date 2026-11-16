from collections import Counter
from collections.abc import Iterable
from heapq import nlargest
from math import sqrt
from unicodedata import normalize

from places import Place


def vectorize(text: str) -> dict[str, float]:
    """글자 단위 1~3그램 빈도를 길이 1의 희소 벡터로 변환한다."""
    folded = normalize("NFKC", text).casefold()
    cleaned = "".join(char for char in folded if char.isalnum())

    counts = Counter(cleaned[start : start + size] for size in range(1, 4) for start in range(len(cleaned) - size + 1))
    if not counts:
        return {}

    magnitude = sqrt(sum(count**2 for count in counts.values()))
    return {ngram: count / magnitude for ngram, count in counts.items()}


class PlaceSearch:
    def __init__(self, places: Iterable[Place]) -> None:
        self._entries = [(place, vectorize(place.name)) for place in places]

    def search(self, text: str) -> list[Place]:
        """코사인 유사도 상위 5개를 반환한다. 동점이면 로딩 순서를 유지한다."""
        query = vectorize(text)
        if not query:
            return []

        def similarity(entry: tuple[Place, dict[str, float]]) -> float:
            _, vector = entry
            # 길이가 1인 벡터의 코사인 유사도는 내적과 같다.
            return sum(weight * vector.get(ngram, 0.0) for ngram, weight in query.items())

        matches = nlargest(5, self._entries, key=similarity)
        return [place for place, _ in matches]
