from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from api import router as api_router
from discharge_api import router as discharge_router
from websocket import router as ws_router
from simulation import sim_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await sim_engine.stop()


app = FastAPI(title="DocBox Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router)
app.include_router(api_router, prefix="/api")
app.include_router(discharge_router, prefix="/api")
