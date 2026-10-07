from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
USER_NAME = "Priya"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ----------------- Saathi AI -----------------
SAATHI_SYSTEM_PROMPT = (
    "You are Saathi, an AI community safety companion for people in India. "
    "Your role is to calmly guide users through unsafe, distressing, or civic situations. "
    "Always respond with warmth, empathy, and brevity (2-4 short sentences). "
    "Prioritise the user's immediate physical safety. "
    "When relevant, give concrete next steps and the correct Indian emergency numbers: "
    "Police 100, Ambulance 108, Women Helpline 1091, Fire 101, Child Helpline 1098. "
    "If there is immediate danger, tell them to move to a well-lit crowded place and consider calling 100. "
    "You can suggest in-app actions: 'Start Safety Mode' for timed check-ins, 'Nearby Help' to find police/hospitals/NGOs, "
    "'Report a Civic Issue' for potholes/lights/sanitation, and the SOS button to share live location with a trusted contact. "
    "Never be preachy or judgemental. Be a reassuring, practical friend. "
    "Do not invent phone numbers other than the official helplines above."
)

# In-memory session cache so multi-turn history is preserved per session
_chat_sessions: dict = {}


def get_chat(session_id: str) -> LlmChat:
    if session_id not in _chat_sessions:
        _chat_sessions[session_id] = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=SAATHI_SYSTEM_PROMPT,
        ).with_model("gemini", "gemini-3.8-flash")
    return _chat_sessions[session_id]


# ----------------- Models -----------------
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str
    session_id: str


class ReportCreate(BaseModel):
    category: str
    description: str
    location: Optional[str] = None


class Report(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket: str
    category: str
    description: str
    location: Optional[str] = None
    status: str = "Submitted"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContactCreate(BaseModel):
    name: str
    phone: str
    relation: Optional[str] = None


class Contact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    relation: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SosCreate(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None
    channel: Optional[str] = "sms"  # sms | whatsapp


class SosRecipient(BaseModel):
    name: str
    phone: str
    status: str = "sent"


class SosResponse(BaseModel):
    id: str
    maps_link: str
    message: str
    channel: str
    recipients: List[SosRecipient]
    shared_at: datetime


# ----------------- Routes -----------------
@api_router.get("/")
async def root():
    return {"message": "Saathi API running"}


@api_router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    try:
        chat_instance = get_chat(req.session_id)
        reply = await chat_instance.send_message(UserMessage(text=req.message))
        # persist to mongo (best-effort)
        await db.chat_messages.insert_one({
            "session_id": req.session_id,
            "user": req.message,
            "assistant": reply,
            "created_at": datetime.now(timezone.utc),
        })
        return ChatResponse(reply=reply, session_id=req.session_id)
    except Exception as e:
        logger.exception("Chat error")
        raise HTTPException(status_code=500, detail=f"Saathi is unavailable right now: {str(e)}")


@api_router.post("/reports", response_model=Report)
async def create_report(payload: ReportCreate):
    ticket = str(uuid.uuid4().int)[:5]
    report = Report(ticket=ticket, **payload.dict())
    await db.reports.insert_one(report.dict())
    return report


@api_router.get("/reports", response_model=List[Report])
async def list_reports():
    rows = await db.reports.find().sort("created_at", -1).to_list(100)
    return [Report(**r) for r in rows]


@api_router.post("/sos", response_model=SosResponse)
async def create_sos(payload: SosCreate):
    sos_id = str(uuid.uuid4())
    if payload.lat is not None and payload.lng is not None:
        maps_link = f"https://www.google.com/maps?q={payload.lat},{payload.lng}"
    else:
        maps_link = "https://www.google.com/maps"

    # Fetch trusted contacts
    rows = await db.contacts.find().sort("created_at", 1).to_list(100)
    contacts = [Contact(**r) for r in rows]

    message = (
        f"\U0001F6A8 SOS from {USER_NAME} \u2014 she may need help right now. "
        f"Live location: {maps_link}  Please reach out or call her immediately."
    )

    channel = payload.channel or "sms"
    recipients = [SosRecipient(name=c.name, phone=c.phone, status="sent") for c in contacts]

    doc = {
        "id": sos_id,
        "lat": payload.lat,
        "lng": payload.lng,
        "accuracy": payload.accuracy,
        "channel": channel,
        "maps_link": maps_link,
        "message": message,
        "recipients": [r.dict() for r in recipients],
        "shared_at": datetime.now(timezone.utc),
    }
    await db.sos_events.insert_one(doc)
    logger.info(f"SOS ({channel}) to {len(recipients)} contacts: {maps_link}")
    # NOTE: Delivery is SIMULATED for the hackathon demo. Plug in Twilio to send for real.
    return SosResponse(
        id=sos_id,
        maps_link=maps_link,
        message=message,
        channel=channel,
        recipients=recipients,
        shared_at=doc["shared_at"],
    )


@api_router.get("/contacts", response_model=List[Contact])
async def list_contacts():
    rows = await db.contacts.find().sort("created_at", 1).to_list(100)
    return [Contact(**r) for r in rows]


@api_router.post("/contacts", response_model=Contact)
async def create_contact(payload: ContactCreate):
    contact = Contact(**payload.dict())
    await db.contacts.insert_one(contact.dict())
    return contact


@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str):
    res = await db.contacts.delete_one({"id": contact_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"deleted": True, "id": contact_id}


@api_router.get("/spatial/building-summary")
async def building_summary(lat: float, lng: float, user_lat: float = 12.9718, user_lng: float = 77.6071):
    import math

    def haversine_m(a_lat, a_lng, b_lat, b_lng):
        R = 6371000.0
        p1, p2 = math.radians(a_lat), math.radians(b_lat)
        dphi = math.radians(b_lat - a_lat)
        dl = math.radians(b_lng - a_lng)
        h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return 2 * R * math.asin(math.sqrt(h))

    # Mock civic infrastructure (mirrors frontend mapData)
    infra = {
        "hospital": [
            {"name": "Bowring & Lady Curzon Hospital", "lat": 12.9823, "lng": 77.6063},
            {"name": "Manipal Hospital (Old Airport Rd)", "lat": 12.9606, "lng": 77.6486},
            {"name": "St. Philomena's Hospital", "lat": 12.9709, "lng": 77.6089},
            {"name": "Vydehi Multispeciality (MG Rd)", "lat": 12.9754, "lng": 77.6096},
        ],
        "police": [
            {"name": "Ashok Nagar Police Station", "lat": 12.9655, "lng": 77.6045},
            {"name": "Cubbon Park Police Station", "lat": 12.9763, "lng": 77.5929},
            {"name": "Indiranagar Police Station", "lat": 12.9719, "lng": 77.6412},
            {"name": "Koramangala Police Station", "lat": 12.9352, "lng": 77.6245},
        ],
        "pharmacy": [
            {"name": "Apollo Pharmacy (Brigade Rd)", "lat": 12.9718, "lng": 77.6071},
            {"name": "MedPlus (Indiranagar 100ft)", "lat": 12.9711, "lng": 77.6401},
            {"name": "Apollo Pharmacy (Koramangala)", "lat": 12.9345, "lng": 77.6265},
            {"name": "MedPlus 24x7 (MG Road)", "lat": 12.9759, "lng": 77.6045},
        ],
    }

    def nearest(kind):
        best = None
        for item in infra[kind]:
            d = haversine_m(lat, lng, item["lat"], item["lng"])
            if best is None or d < best["distance_m"]:
                best = {"name": item["name"], "distance_m": round(d)}
        return best

    dist_user = round(haversine_m(user_lat, user_lng, lat, lng))

    # Simple deterministic zone classification based on nearby incidents
    incidents = [
        {"lat": 12.9690, "lng": 77.6150},
        {"lat": 12.9735, "lng": 77.6320},
    ]
    min_incident = min(haversine_m(lat, lng, i["lat"], i["lng"]) for i in incidents)
    if min_incident < 250:
        zone = "Caution"
    elif dist_user < 400:
        zone = "High Footfall"
    else:
        zone = "Normal"

    # Pseudo building metadata derived from coordinates (stable)
    seed = int(abs(lat * 1000) + abs(lng * 1000))
    levels = 3 + (seed % 18)
    height_m = levels * 3.2

    return {
        "name": "Selected structure",
        "building_type": ["Residential", "Commercial", "Mixed-use", "Institutional"][seed % 4],
        "levels": levels,
        "height_m": round(height_m, 1),
        "ward": "Central Bengaluru",
        "address": f"{lat:.4f}, {lng:.4f}",
        "distance_from_user_m": dist_user,
        "zone_status": zone,
        "nearest": {
            "hospital": nearest("hospital"),
            "police": nearest("police"),
            "pharmacy": nearest("pharmacy"),
        },
    }


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.dict())
    await db.status_checks.insert_one(status_obj.dict())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def seed_contacts():
    try:
        count = await db.contacts.count_documents({})
        if count == 0:
            defaults = [
                Contact(name="Mom", phone="+91 99887 76655", relation="Family"),
                Contact(name="Rahul (Brother)", phone="+91 98111 22233", relation="Family"),
            ]
            await db.contacts.insert_many([c.dict() for c in defaults])
            logger.info("Seeded default trusted contacts")
    except Exception as e:
        logger.warning(f"Contact seed skipped: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
