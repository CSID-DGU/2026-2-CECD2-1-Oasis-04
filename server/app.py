from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, Query, Request

from place_search import PlaceSearch
from places import Place, load_places


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.place_search = PlaceSearch(load_places())
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/places/search")
def search_places(request: Request, q: Annotated[str, Query(min_length=1, description="장소 검색어")]) -> list[Place]:
    search: PlaceSearch = request.app.state.place_search
    return search.search(q)
