"""Jagdamba API — live data edition.

Everything the app shows now comes from a live source:
  * User profile + trusted contacts  -> MongoDB, scoped per device (X-Device-Id header)
  * Nearby police / hospitals / ...  -> OpenStreetMap via the Overpass API
  * Area / landmark names            -> OpenStreetMap Nominatim reverse geocoding
  * Walking routes                   -> OSRM (FOSSGIS foot-routing server by default)
  * Community alerts                 -> civic reports submitted by users of the app
  * SOS delivery                     -> Twilio SMS (real messages when keys are set)
  * Assistant                        -> Google Gemini
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import math
import time
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta

import httpx

try:  # Emergent's private SDK (only available on Emergent's servers)
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_EMERGENT = True
except ImportError:  # running elsewhere (Render, local, etc.)
    HAS_EMERGENT = False

    class UserMessage:  # minimal stand-in
        def __init__(self, text: str):
            self.text = text

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ----------------- Config -----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'jagdamba')]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-flash-latest')

TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_FROM_NUMBER = os.environ.get('TWILIO_FROM_NUMBER', '')          # e.g. +15017122661
TWILIO_MESSAGING_SERVICE_SID = os.environ.get('TWILIO_MESSAGING_SERVICE_SID', '')
DEFAULT_COUNTRY_CODE = os.environ.get('DEFAULT_COUNTRY_CODE', '+91')

OVERPASS_URLS = [u.strip() for u in os.environ.get(
    'OVERPASS_URLS',
    'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter',
).split(',') if u.strip()]
NOMINATIM_URL = os.environ.get('NOMINATIM_URL', 'https://nominatim.openstreetmap.org')
OSRM_URL = os.environ.get('OSRM_URL', 'https://routing.openstreetmap.de/routed-foot')
# OSM services require an identifying User-Agent with a contact.
OSM_USER_AGENT = os.environ.get('OSM_USER_AGENT', 'Jagdamba-Safety-App/1.0 (contact: set OSM_USER_AGENT)')

app = FastAPI(title="Jagdamba API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ----------------- Helpers -----------------
def haversine_m(a_lat, a_lng, b_lat, b_lng) -> float:
    R = 6371000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def device_id(request: Request) -> str:
    did = (request.headers.get('x-device-id') or '').strip()
    if not did or len(did) > 128:
        raise HTTPException(status_code=400, detail="Missing X-Device-Id header")
    return did


class TTLCache:
    """Tiny in-memory cache so we stay well within the free OSM services' usage policies."""

    def __init__(self, ttl_s: int, max_items: int = 2000):
        self.ttl = ttl_s
        self.max = max_items
        self._d: Dict[Any, tuple] = {}

    def get(self, key):
        v = self._d.get(key)
        if not v:
            return None
        if time.time() - v[0] > self.ttl:
            self._d.pop(key, None)
            return None
        return v[1]

    def set(self, key, value):
        if len(self._d) >= self.max:
            self._d.pop(next(iter(self._d)))
        self._d[key] = (time.time(), value)


_poi_cache = TTLCache(ttl_s=15 * 60)
_geo_cache = TTLCache(ttl_s=24 * 3600)
_nominatim_lock = asyncio.Lock()
_nominatim_last = 0.0


# ----------------- OpenStreetMap: places -----------------
POI_TYPES = {
    "police": {"label": "Police", "filters": ['["amenity"="police"]']},
    "hospital": {"label": "Hospital", "filters": ['["amenity"~"^(hospital|clinic)$"]', '["healthcare"="hospital"]']},
    "pharmacy": {"label": "Pharmacy", "filters": ['["amenity"="pharmacy"]']},
    "fire": {"label": "Fire Station", "filters": ['["amenity"="fire_station"]']},
    "support": {"label": "Support Centre", "filters": ['["amenity"="social_facility"]', '["office"="ngo"]']},
}


def _classify(tags: dict) -> Optional[str]:
    a = tags.get('amenity')
    if a == 'police':
        return 'police'
    if a in ('hospital', 'clinic') or tags.get('healthcare') == 'hospital':
        return 'hospital'
    if a == 'pharmacy':
        return 'pharmacy'
    if a == 'fire_station':
        return 'fire'
    if a == 'social_facility' or tags.get('office') == 'ngo':
        return 'support'
    return None


def _open_state(tags: dict) -> Optional[bool]:
    oh = (tags.get('opening_hours') or '').strip().lower()
    if oh in ('24/7', '24x7', 'mo-su 00:00-24:00'):
        return True
    if tags.get('emergency') == 'yes' or tags.get('amenity') in ('police', 'fire_station', 'hospital'):
        return True  # emergency services are staffed round the clock
    return None  # unknown — the UI will not claim open/closed


def _address(tags: dict) -> Optional[str]:
    parts = [tags.get('addr:housenumber'), tags.get('addr:street'), tags.get('addr:suburb') or tags.get('addr:city')]
    s = ", ".join(p for p in parts if p)
    return s or None


async def _overpass(query: str) -> dict:
    last_err = None
    async with httpx.AsyncClient(timeout=25, headers={"User-Agent": OSM_USER_AGENT}) as http:
        for url in OVERPASS_URLS:
            try:
                r = await http.post(url, data={"data": query})
                r.raise_for_status()
                return r.json()
            except Exception as e:  # try the next mirror
                last_err = e
                logger.warning(f"Overpass mirror failed ({url}): {e}")
    raise HTTPException(status_code=502, detail=f"Map data service unavailable: {last_err}")


async def fetch_pois(lat: float, lng: float, radius_m: int, types: List[str]) -> List[dict]:
    types = [t for t in types if t in POI_TYPES] or list(POI_TYPES)
    key = (round(lat, 3), round(lng, 3), radius_m, tuple(sorted(types)))
    cached = _poi_cache.get(key)
    if cached is not None:
        return cached

    clauses = []
    for t in types:
        for f in POI_TYPES[t]["filters"]:
            clauses.append(f'nwr(around:{radius_m},{lat},{lng}){f};')
    query = f'[out:json][timeout:20];({"".join(clauses)});out center tags 300;'
    data = await _overpass(query)

    seen = set()
    out = []
    for el in data.get('elements', []):
        tags = el.get('tags') or {}
        kind = _classify(tags)
        if kind not in types:
            continue
        plat = el.get('lat') or (el.get('center') or {}).get('lat')
        plng = el.get('lon') or (el.get('center') or {}).get('lon')
        if plat is None or plng is None:
            continue
        name = tags.get('name:en') or tags.get('name') or tags.get('operator') or POI_TYPES[kind]['label']
        dedupe = (name.lower(), round(plat, 4), round(plng, 4))
        if dedupe in seen:
            continue
        seen.add(dedupe)
        out.append({
            "id": f"{el.get('type')}/{el.get('id')}",
            "type": kind,
            "type_label": POI_TYPES[kind]['label'],
            "name": name,
            "lat": plat,
            "lng": plng,
            "distance_m": round(haversine_m(lat, lng, plat, plng)),
            "phone": tags.get('phone') or tags.get('contact:phone') or tags.get('emergency:phone'),
            "open": _open_state(tags),
            "opening_hours": tags.get('opening_hours'),
            "address": _address(tags),
            "source": "OpenStreetMap",
        })
    out.sort(key=lambda p: p['distance_m'])
    _poi_cache.set(key, out)
    return out


def nearest_of(pois: List[dict], kind: str, lat: float, lng: float) -> Optional[dict]:
    best = None
    for p in pois:
        if p['type'] != kind:
            continue
        d = round(haversine_m(lat, lng, p['lat'], p['lng']))
        if best is None or d < best['distance_m']:
            best = {"name": p['name'], "distance_m": d, "phone": p.get('phone'), "lat": p['lat'], "lng": p['lng']}
    return best


# ----------------- OpenStreetMap: reverse geocoding -----------------
async def reverse_geocode(lat: float, lng: float) -> dict:
    global _nominatim_last
    key = (round(lat, 3), round(lng, 3))
    cached = _geo_cache.get(key)
    if cached is not None:
        return cached
    async with _nominatim_lock:  # Nominatim policy: max 1 request / second
        wait = 1.05 - (time.time() - _nominatim_last)
        if wait > 0:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=12, headers={"User-Agent": OSM_USER_AGENT}) as http:
                r = await http.get(f"{NOMINATIM_URL}/reverse", params={
                    "lat": lat, "lon": lng, "format": "jsonv2", "zoom": 17, "addressdetails": 1,
                    "accept-language": "en",
                })
                r.raise_for_status()
                data = r.json()
        finally:
            _nominatim_last = time.time()
    a = data.get('address') or {}
    area = a.get('neighbourhood') or a.get('suburb') or a.get('quarter') or a.get('city_district') or a.get('village')
    city = a.get('city') or a.get('town') or a.get('county') or a.get('state_district')
    road = a.get('road')
    landmark = data.get('name') or road
    result = {
        "area": area,
        "city": city,
        "state": a.get('state'),
        "road": road,
        "landmark": ", ".join(p for p in [landmark, area] if p) or None,
        "label": ", ".join(p for p in [area, city] if p) or data.get('display_name'),
        "display_name": data.get('display_name'),
    }
    _geo_cache.set(key, result)
    return result


async def safe_reverse(lat, lng) -> dict:
    if lat is None or lng is None:
        return {}
    try:
        return await reverse_geocode(lat, lng)
    except Exception as e:
        logger.warning(f"Reverse geocode failed: {e}")
        return {}


# ----------------- Jagdamba AI -----------------
SAATHI_SYSTEM_PROMPT = (
    "You are Jagdamba, an AI community safety companion for people in India. "
    "Your role is to calmly guide users through unsafe, distressing, or civic situations. "
    "Always respond with warmth, empathy, and brevity (2-4 short sentences). "
    "Prioritise the user's immediate physical safety. "
    "When relevant, give concrete next steps and the correct Indian emergency numbers: "
    "Emergency 112, Police 100, Ambulance 108, Women Helpline 1091, Fire 101, Child Helpline 1098. "
    "If there is immediate danger, tell them to move to a well-lit crowded place and consider calling 112. "
    "You can suggest in-app actions: 'Start Safety Mode' for timed check-ins, 'Nearby Help' to find police/hospitals/NGOs, "
    "'Report a Civic Issue' for potholes/lights/sanitation, and the SOS button to share live location with a trusted contact. "
    "Never be preachy or judgemental. Be a reassuring, practical friend. "
    "Do not invent phone numbers other than the official helplines above, or numbers given to you in context."
)

_chat_sessions: dict = {}

OFFLINE_REPLY = (
    "I'm here with you. If you feel unsafe, move to a well-lit, crowded place right now. "
    "Call 112, Police 100, Ambulance 108 or Women Helpline 1091, and use the SOS button to alert a trusted contact."
)


class GeminiChat:
    """Direct Google Gemini chat with per-session history."""

    def __init__(self, session_id: str, system_prompt: str):
        self.session_id = session_id
        self.system_prompt = system_prompt
        self.history: list = []

    async def send_message(self, msg: "UserMessage") -> str:
        if not GEMINI_API_KEY:
            return OFFLINE_REPLY
        self.history.append({"role": "user", "parts": [{"text": msg.text}]})
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
        body = {
            "system_instruction": {"parts": [{"text": self.system_prompt}]},
            "contents": self.history[-20:],
        }
        async with httpx.AsyncClient(timeout=30) as http:
            r = await http.post(url, params={"key": GEMINI_API_KEY}, json=body)
            r.raise_for_status()
            data = r.json()
        reply = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"]).strip()
        self.history.append({"role": "model", "parts": [{"text": reply}]})
        return reply or OFFLINE_REPLY


def get_chat(session_id: str, system_prompt: str):
    if session_id not in _chat_sessions:
        if HAS_EMERGENT and EMERGENT_LLM_KEY:
            _chat_sessions[session_id] = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=session_id,
                system_message=system_prompt,
            ).with_model("gemini", "gemini-3.8-flash")
        else:
            _chat_sessions[session_id] = GeminiChat(session_id, system_prompt)
    return _chat_sessions[session_id]


# ----------------- Twilio SMS -----------------
def to_e164(phone: str) -> Optional[str]:
    digits = re.sub(r"[^\d+]", "", phone or "")
    if not digits:
        return None
    if digits.startswith('+'):
        return digits
    if digits.startswith('00'):
        return '+' + digits[2:]
    digits = digits.lstrip('0')
    return f"{DEFAULT_COUNTRY_CODE}{digits}"


def twilio_configured() -> bool:
    return bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and (TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID))


async def send_sms(http: httpx.AsyncClient, to: str, body: str) -> Dict[str, Any]:
    number = to_e164(to)
    if not number:
        return {"status": "failed", "error": "Invalid phone number"}
    data = {"To": number, "Body": body}
    if TWILIO_MESSAGING_SERVICE_SID:
        data["MessagingServiceSid"] = TWILIO_MESSAGING_SERVICE_SID
    else:
        data["From"] = TWILIO_FROM_NUMBER
    try:
        r = await http.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
            data=data, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
        )
        payload = r.json() if r.content else {}
        if r.status_code >= 400:
            return {"status": "failed", "error": payload.get('message') or f"HTTP {r.status_code}"}
        return {"status": "sent", "sid": payload.get('sid')}
    except Exception as e:
        return {"status": "failed", "error": str(e)}


# ----------------- Models -----------------
class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    phone: Optional[str] = Field(default=None, max_length=32)


class Profile(ProfileIn):
    device_id: str
    initials: str
    updated_at: datetime


class ChatRequest(BaseModel):
    session_id: str
    message: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str


ISSUE_LEVEL = {"safety": "high", "streetlight": "high", "water": "medium", "pothole": "medium", "garbage": "low", "other": "low"}
ISSUE_TITLE = {
    "streetlight": "Broken street light", "pothole": "Pothole / road damage", "garbage": "Garbage / sanitation",
    "safety": "Safety concern", "water": "Water / drainage", "other": "Civic issue",
}


class ReportCreate(BaseModel):
    category: str
    description: str = Field(min_length=1, max_length=2000)
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class Report(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket: str
    category: str
    description: str
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    status: str = "Submitted"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=5, max_length=32)
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
    channel: Optional[str] = "sms"
    battery: Optional[int] = None
    network: Optional[str] = None
    landmark: Optional[str] = None
    evidence_id: Optional[str] = None
    reason: Optional[str] = None  # sos | crash | missed_checkin


class SosRecipient(BaseModel):
    name: str
    phone: str
    status: str = "sent"  # sent | failed | not_sent
    error: Optional[str] = None


class SosResponse(BaseModel):
    id: str
    maps_link: str
    message: str
    channel: str
    delivery: str  # twilio | not_configured
    recipients: List[SosRecipient]
    shared_at: datetime
    nearest_police: Optional[dict] = None
    battery: Optional[int] = None
    network: Optional[str] = None
    landmark: Optional[str] = None


def _initials(name: str) -> str:
    parts = [p for p in re.split(r"\s+", name.strip()) if p]
    return ("".join(p[0] for p in parts[:2]) or "?").upper()


async def get_profile_doc(did: str) -> Optional[dict]:
    return await db.profiles.find_one({"device_id": did}, {"_id": 0})


# ----------------- Routes: core -----------------
@api_router.get("/")
async def root():
    return {
        "message": "Jagdamba API running",
        "integrations": {
            "gemini": bool(GEMINI_API_KEY or (HAS_EMERGENT and EMERGENT_LLM_KEY)),
            "twilio_sms": twilio_configured(),
            "openstreetmap": True,
        },
    }


@api_router.get("/config")
async def config():
    return {"twilio_sms": twilio_configured(), "gemini": bool(GEMINI_API_KEY or (HAS_EMERGENT and EMERGENT_LLM_KEY))}


# ----------------- Routes: profile -----------------
@api_router.get("/profile")
async def get_profile(request: Request):
    doc = await get_profile_doc(device_id(request))
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not set up")
    return doc


@api_router.put("/profile", response_model=Profile)
async def put_profile(payload: ProfileIn, request: Request):
    did = device_id(request)
    doc = {
        "device_id": did,
        "name": payload.name.strip(),
        "phone": (payload.phone or "").strip() or None,
        "initials": _initials(payload.name),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.profiles.update_one({"device_id": did}, {"$set": doc}, upsert=True)
    return Profile(**doc)


# ----------------- Routes: location / places -----------------
@api_router.get("/geo/reverse")
async def geo_reverse(lat: float, lng: float):
    try:
        return await reverse_geocode(lat, lng)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Geocoding unavailable: {e}")


@api_router.get("/nearby")
async def nearby(
    lat: float, lng: float,
    radius: int = Query(3000, ge=200, le=15000),
    types: str = "police,hospital,pharmacy,fire,support",
    limit: int = Query(40, ge=1, le=200),
):
    wanted = [t.strip() for t in types.split(',') if t.strip()]
    places = await fetch_pois(lat, lng, radius, wanted)
    if len(places) < 3 and radius < 8000:  # sparse area — widen the search once
        places = await fetch_pois(lat, lng, 8000, wanted)
    return {"places": places[:limit], "source": "OpenStreetMap contributors", "radius_m": radius}


# ----------------- Routes: chat -----------------
@api_router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, request: Request):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    try:
        did = request.headers.get('x-device-id')
        profile = await get_profile_doc(did) if did else None
        context_bits = []
        if profile:
            context_bits.append(f"The user's name is {profile['name']}.")
        if req.lat is not None and req.lng is not None:
            place = await safe_reverse(req.lat, req.lng)
            if place.get('label'):
                context_bits.append(f"The user is currently near {place['label']}.")
        prompt = SAATHI_SYSTEM_PROMPT + (" " + " ".join(context_bits) if context_bits else "")
        chat_instance = get_chat(req.session_id, prompt)
        reply = await chat_instance.send_message(UserMessage(text=req.message))
        await db.chat_messages.insert_one({
            "session_id": req.session_id,
            "device_id": did,
            "user": req.message,
            "assistant": reply,
            "created_at": datetime.now(timezone.utc),
        })
        return ChatResponse(reply=reply, session_id=req.session_id)
    except Exception as e:
        logger.exception("Chat error")
        raise HTTPException(status_code=500, detail=f"Jagdamba is unavailable right now: {str(e)}")


# ----------------- Routes: reports + community alerts -----------------
@api_router.post("/reports", response_model=Report)
async def create_report(payload: ReportCreate, request: Request):
    location = payload.location
    if not location and payload.lat is not None:
        location = (await safe_reverse(payload.lat, payload.lng)).get('label')
    data = payload.dict()
    data['location'] = location
    report = Report(ticket=str(uuid.uuid4().int)[:6], **data)
    doc = report.dict()
    doc['device_id'] = request.headers.get('x-device-id')
    await db.reports.insert_one(doc)
    return report


@api_router.get("/reports", response_model=List[Report])
async def list_reports(request: Request):
    did = device_id(request)
    rows = await db.reports.find({"device_id": did}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [Report(**r) for r in rows]


async def recent_reports_near(lat: float, lng: float, radius_m: float, days: int) -> List[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    # Rough bounding box first, exact distance after
    dlat = radius_m / 111_320
    dlng = radius_m / (111_320 * max(math.cos(math.radians(lat)), 0.01))
    rows = await db.reports.find({
        "created_at": {"$gte": since},
        "lat": {"$gte": lat - dlat, "$lte": lat + dlat},
        "lng": {"$gte": lng - dlng, "$lte": lng + dlng},
    }, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for r in rows:
        d = haversine_m(lat, lng, r['lat'], r['lng'])
        if d <= radius_m:
            r['distance_m'] = round(d)
            out.append(r)
    return out


@api_router.get("/alerts")
async def alerts(lat: float, lng: float, radius: int = Query(5000, ge=200, le=50000), days: int = Query(14, ge=1, le=90)):
    rows = await recent_reports_near(lat, lng, radius, days)
    items = []
    for r in rows:
        created = r['created_at']
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        items.append({
            "id": r['id'],
            "level": ISSUE_LEVEL.get(r['category'], 'low'),
            "category": r['category'],
            "title": ISSUE_TITLE.get(r['category'], 'Civic issue'),
            "desc": r['description'],
            "area": r.get('location') or f"{r['lat']:.4f}, {r['lng']:.4f}",
            "lat": r['lat'],
            "lng": r['lng'],
            "distance_m": r['distance_m'],
            "status": r.get('status', 'Submitted'),
            "created_at": created.isoformat(),
        })
    return {"alerts": items, "radius_m": radius, "days": days}


# ----------------- Routes: contacts (per device) -----------------
@api_router.get("/contacts", response_model=List[Contact])
async def list_contacts(request: Request):
    rows = await db.contacts.find({"device_id": device_id(request)}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return [Contact(**r) for r in rows]


@api_router.post("/contacts", response_model=Contact)
async def create_contact(payload: ContactCreate, request: Request):
    contact = Contact(**payload.dict())
    doc = contact.dict()
    doc['device_id'] = device_id(request)
    await db.contacts.insert_one(doc)
    return contact


@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, request: Request):
    res = await db.contacts.delete_one({"id": contact_id, "device_id": device_id(request)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"deleted": True, "id": contact_id}


# ----------------- Routes: SOS -----------------
@api_router.post("/sos", response_model=SosResponse)
async def create_sos(payload: SosCreate, request: Request):
    did = device_id(request)
    sos_id = str(uuid.uuid4())
    has_fix = payload.lat is not None and payload.lng is not None
    maps_link = f"https://www.google.com/maps?q={payload.lat},{payload.lng}" if has_fix else None

    profile = await get_profile_doc(did)
    name = profile['name'] if profile else "A Jagdamba user"
    rows = await db.contacts.find({"device_id": did}, {"_id": 0}).sort("created_at", 1).to_list(100)
    contacts = [Contact(**r) for r in rows]

    place = await safe_reverse(payload.lat, payload.lng) if has_fix else {}
    landmark = payload.landmark or place.get('landmark') or place.get('label')

    nearest_police = None
    if has_fix:
        try:
            pois = await fetch_pois(payload.lat, payload.lng, 5000, ["police"])
            nearest_police = nearest_of(pois, "police", payload.lat, payload.lng)
        except Exception as e:
            logger.warning(f"Nearest police lookup failed: {e}")

    reason = {
        "crash": "a possible crash or hard fall was detected",
        "missed_checkin": "they missed a safety check-in",
    }.get(payload.reason or "", "they pressed SOS")
    lines = [f"SOS from {name} via Jagdamba: {reason} and they may need help now."]
    if maps_link:
        lines.append(f"Location: {maps_link}")
    if landmark:
        lines.append(f"Near: {landmark}")
    if payload.battery is not None:
        lines.append(f"Battery: {payload.battery}%")
    lines.append("Please call them right away. If you can't reach them, call 112.")
    message = "\n".join(lines)

    delivery = "twilio" if twilio_configured() else "not_configured"
    recipients: List[SosRecipient] = []
    if delivery == "twilio" and contacts:
        async with httpx.AsyncClient(timeout=15) as http:
            results = await asyncio.gather(*[send_sms(http, c.phone, message) for c in contacts])
        for c, res in zip(contacts, results):
            recipients.append(SosRecipient(name=c.name, phone=c.phone, status=res['status'], error=res.get('error')))
    else:
        recipients = [SosRecipient(name=c.name, phone=c.phone, status="not_sent") for c in contacts]

    doc = {
        "id": sos_id, "device_id": did, "lat": payload.lat, "lng": payload.lng, "accuracy": payload.accuracy,
        "channel": "sms", "delivery": delivery, "maps_link": maps_link, "message": message,
        "recipients": [r.dict() for r in recipients], "battery": payload.battery, "network": payload.network,
        "landmark": landmark, "evidence_id": payload.evidence_id, "reason": payload.reason,
        "nearest_police": nearest_police, "shared_at": datetime.now(timezone.utc),
    }
    await db.sos_events.insert_one(doc)
    sent = sum(1 for r in recipients if r.status == 'sent')
    logger.info(f"SOS {sos_id}: delivery={delivery}, sent {sent}/{len(recipients)}")
    return SosResponse(
        id=sos_id, maps_link=maps_link or "https://www.google.com/maps", message=message, channel="sms",
        delivery=delivery, recipients=recipients, shared_at=doc["shared_at"], nearest_police=nearest_police,
        battery=payload.battery, network=payload.network, landmark=landmark,
    )


# ----------------- Routes: spatial intelligence -----------------
@api_router.get("/spatial/building-summary")
async def building_summary(lat: float, lng: float, user_lat: Optional[float] = None, user_lng: Optional[float] = None):
    pois_task = fetch_pois(lat, lng, 3000, ["police", "hospital", "pharmacy"])
    building_q = (
        f'[out:json][timeout:15];(way(around:25,{lat},{lng})["building"];'
        f'relation(around:25,{lat},{lng})["building"];);out tags center 5;'
    )
    building_task = _overpass(building_q)
    pois, bdata, place, incidents = await asyncio.gather(
        pois_task, building_task, safe_reverse(lat, lng), recent_reports_near(lat, lng, 300, 30),
        return_exceptions=True,
    )
    pois = pois if isinstance(pois, list) else []
    incidents = incidents if isinstance(incidents, list) else []
    place = place if isinstance(place, dict) else {}

    building = None
    if isinstance(bdata, dict):
        els = [e for e in (bdata.get('elements') or []) if (e.get('tags') or {}).get('building')]
        if els:
            def dist(el):
                c = el.get('center') or {}
                return haversine_m(lat, lng, c.get('lat', lat), c.get('lon', lng))
            building = (min(els, key=dist).get('tags') or {})

    levels = None
    height = None
    btype = None
    bname = None
    if building is not None:
        try:
            levels = int(float(building.get('building:levels'))) if building.get('building:levels') else None
        except ValueError:
            levels = None
        try:
            height = float(re.sub(r"[^\d.]", "", building['height'])) if building.get('height') else None
        except ValueError:
            height = None
        if height is None and levels:
            height = round(levels * 3.2, 1)
        btype = building.get('building')
        btype = None if btype in (None, 'yes') else btype.replace('_', ' ').title()
        bname = building.get('name')

    dist_user = round(haversine_m(user_lat, user_lng, lat, lng)) if user_lat is not None and user_lng is not None else None
    if any(i['category'] in ('safety', 'streetlight') for i in incidents):
        zone = "Caution"
    elif incidents:
        zone = "Reported Issues"
    else:
        zone = "No Reports"

    return {
        "name": bname or place.get('landmark') or "Selected location",
        "building_type": btype,
        "levels": levels,
        "height_m": height,
        "ward": place.get('area') or place.get('city'),
        "address": place.get('display_name') or f"{lat:.5f}, {lng:.5f}",
        "distance_from_user_m": dist_user,
        "zone_status": zone,
        "incident_count": len(incidents),
        "nearest": {
            "hospital": nearest_of(pois, "hospital", lat, lng),
            "police": nearest_of(pois, "police", lat, lng),
            "pharmacy": nearest_of(pois, "pharmacy", lat, lng),
        },
        "source": "OpenStreetMap contributors",
    }


@api_router.get("/routes")
async def safe_routes(from_lat: float, from_lng: float, to_lat: float, to_lng: float):
    if haversine_m(from_lat, from_lng, to_lat, to_lng) > 25000:
        raise HTTPException(status_code=400, detail="Destination is too far for a walking route (max 25 km)")
    url = f"{OSRM_URL}/route/v1/driving/{from_lng},{from_lat};{to_lng},{to_lat}"
    try:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": OSM_USER_AGENT}) as http:
            r = await http.get(url, params={"alternatives": "true", "overview": "full", "geometries": "geojson"})
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Routing service unavailable: {e}")
    routes = data.get('routes') or []
    if not routes:
        raise HTTPException(status_code=404, detail="No walking route found")

    mid_lat, mid_lng = (from_lat + to_lat) / 2, (from_lng + to_lng) / 2
    span = haversine_m(from_lat, from_lng, to_lat, to_lng) / 2 + 600
    try:
        pois = await fetch_pois(mid_lat, mid_lng, int(min(span, 15000)), ["police", "hospital"])
    except Exception:
        pois = []
    incidents = await recent_reports_near(mid_lat, mid_lng, span, 30)

    def near_path(pts, lat, lng, within=200):
        return any(haversine_m(lat, lng, p[1], p[0]) <= within for p in pts)

    scored = []
    for i, rt in enumerate(routes):
        coords = rt['geometry']['coordinates']  # [lng, lat]
        sample = coords[::max(1, len(coords) // 150)]
        safe_nodes = [p for p in pois if near_path(sample, p['lat'], p['lng'])]
        bad = [x for x in incidents if near_path(sample, x['lat'], x['lng'], 150)]
        score = len(safe_nodes) * 2 - len(bad) * 3
        scored.append({
            "id": chr(65 + i),
            "distance_km": round(rt['distance'] / 1000, 2),
            "eta_min": max(1, round(rt['duration'] / 60)),
            "path": [{"lat": c[1], "lng": c[0]} for c in coords],
            "safe_points": len(safe_nodes),
            "police_on_route": sum(1 for p in safe_nodes if p['type'] == 'police'),
            "reported_issues": len(bad),
            "score": score,
        })
    fastest = min(scored, key=lambda s: s['eta_min'])
    safest = max(scored, key=lambda s: (s['score'], -s['eta_min']))
    for s in scored:
        tags = []
        if s is safest:
            tags.append("Safest")
        if s is fastest:
            tags.append("Fastest")
        s['name'] = " · ".join(tags) or f"Alternative {s['id']}"
        s['color'] = "#059669" if s is safest else "#64748B"
    scored.sort(key=lambda s: (s is not safest, s['eta_min']))
    return {"routes": scored, "source": "OSRM / OpenStreetMap contributors"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=[o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',')],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def ensure_indexes():
    try:
        await db.profiles.create_index("device_id", unique=True)
        await db.contacts.create_index("device_id")
        await db.reports.create_index([("created_at", -1)])
        await db.reports.create_index([("lat", 1), ("lng", 1)])
    except Exception as e:
        logger.warning(f"Index setup skipped: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
