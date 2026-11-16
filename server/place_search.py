from collections import Counter
from math import sqrt
from unicodedata import normalize


def vectorize(text: str) -> dict[str, float]:
    """글자 단위 1~3그램 빈도를 길이 1의 희소 벡터로 변환한다."""
    folded = normalize("NFKC", text).casefold()
    cleaned = "".join(char for char in folded if char.isalnum())

    counts = Counter(cleaned[start : start + size] for size in range(1, 4) for start in range(len(cleaned) - size + 1))
    if not counts:
        return {}

    magnitude = sqrt(sum(count**2 for count in counts.values()))
    return {ngram: count / magnitude for ngram, count in counts.items()}
