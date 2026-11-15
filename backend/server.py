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
from collections import OrderedDict
import uuid
import json
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
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def _redact(msg: str) -> str:
    # Never echo credentials from a connection string into logs or responses
    return re.sub(r"//[^@/\s]+@", "//***@", str(msg))


# Database: a bad or missing MONGO_URL must not crash the server — it would never
# open its port and Render would only report a vague "port scan timeout".
mongo_url = os.environ.get('MONGO_URL', '').strip()
DB_ERROR: Optional[str] = None
client = None
db = None
try:
    if not mongo_url:
        raise RuntimeError("MONGO_URL is not set in the environment")
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=8000)
    db = client[os.environ.get('DB_NAME', 'jagdamba')]
except Exception as e:  # invalid URI, DNS failure for mongodb+srv, etc.
    DB_ERROR = _redact(f"{type(e).__name__}: {e}")
    logger.error(f"Database setup failed: {DB_ERROR}")

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-flash-latest')

TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_FROM_NUMBER = os.environ.get('TWILIO_FROM_NUMBER', '')          # e.g. +15017122661
TWILIO_MESSAGING_SERVICE_SID = os.environ.get('TWILIO_MESSAGING_SERVICE_SID', '')
# Automatic WhatsApp alerts. Sandbox sender is whatsapp:+14155238886 (or just +14155238886).
TWILIO_WHATSAPP_FROM = os.environ.get('TWILIO_WHATSAPP_FROM', '').strip()
# Optional approved WhatsApp template (Twilio Content SID, HX...). Needed to message a contact
# who hasn't written to your WhatsApp number in the last 24 hours. Variables: 1=name, 2=reason, 3=location link
TWILIO_WHATSAPP_CONTENT_SID = os.environ.get('TWILIO_WHATSAPP_CONTENT_SID', '').strip()
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


class RateLimiter:
    """In-memory sliding-window limits (one server instance). Stops one phone or one
    attacker from flooding SOS texts, the assistant or the database."""

    def __init__(self, max_keys: int = 50000):
        self._hits: Dict[str, List[float]] = {}
        self.max_keys = max_keys

    def allow(self, key: str, limit: int, window_s: int) -> bool:
        now = time.time()
        hits = [t for t in self._hits.get(key, []) if now - t < window_s]
        if len(hits) >= limit:
            self._hits[key] = hits
            return False
        hits.append(now)
        if len(self._hits) >= self.max_keys and key not in self._hits:
            self._hits.pop(next(iter(self._hits)))
        self._hits[key] = hits
        return True


_limiter = RateLimiter()


def client_ip(request: Request) -> str:
    # Render puts the real client address first in X-Forwarded-For
    fwd = request.headers.get('x-forwarded-for') or ''
    return fwd.split(',')[0].strip() or (request.client.host if request.client else 'unknown')


def rate_limit(request: Request, name: str, per_device: tuple, per_ip: tuple):
    did = (request.headers.get('x-device-id') or '').strip()
    ok = _limiter.allow(f"{name}:ip:{client_ip(request)}", *per_ip)
    if ok and did:
        ok = _limiter.allow(f"{name}:dev:{did}", *per_device)
    if not ok:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment and try again.")


MAX_CONTACTS = 10


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
    raise HTTPException(status_code=502, detail="Map data service is unavailable right now")


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

_chat_sessions: "OrderedDict[str, Any]" = OrderedDict()
MAX_CHAT_SESSIONS = 300  # keeps memory bounded on a small (512 MB) server

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
        self.history = self.history[-20:]
        return reply or OFFLINE_REPLY


def get_chat(session_id: str, system_prompt: str):
    if session_id in _chat_sessions:
        _chat_sessions.move_to_end(session_id)
    else:
        while len(_chat_sessions) >= MAX_CHAT_SESSIONS:
            _chat_sessions.popitem(last=False)  # forget the least recently used chat
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


def _twilio_creds() -> bool:
    return bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN)


def sms_configured() -> bool:
    return _twilio_creds() and bool(TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID)


def whatsapp_configured() -> bool:
    return _twilio_creds() and bool(TWILIO_WHATSAPP_FROM)


def twilio_configured() -> bool:
    return sms_configured() or whatsapp_configured()


TWILIO_MESSAGES_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"

# Twilio error codes worth explaining in plain words
TWILIO_HINTS = {
    63016: "WhatsApp only allows this message within 24 hours of the contact messaging your Twilio WhatsApp number. "
           "Ask them to send the sandbox join message again, or set up an approved template.",
    63015: "This contact hasn't joined your Twilio WhatsApp sandbox yet. They need to send the join code first.",
    63003: "This number isn't on WhatsApp.",
    21608: "Twilio trial accounts can only send to verified numbers.",
    21211: "The phone number is invalid.",
}


def _twilio_error(payload: dict, fallback: str) -> str:
    code = payload.get('code') or payload.get('error_code')
    try:
        code = int(code) if code is not None else None
    except (TypeError, ValueError):
        code = None
    return TWILIO_HINTS.get(code) or payload.get('message') or payload.get('error_message') or fallback


async def _twilio_post(http: httpx.AsyncClient, data: dict) -> Dict[str, Any]:
    try:
        r = await http.post(TWILIO_MESSAGES_URL.format(sid=TWILIO_ACCOUNT_SID), data=data,
                            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN))
        payload = r.json() if r.content else {}
        if r.status_code >= 400:
            return {"status": "failed", "error": _twilio_error(payload, f"HTTP {r.status_code}")}
        return {"status": "sent", "sid": payload.get('sid')}
    except Exception as e:
        return {"status": "failed", "error": str(e)}


async def send_sms(http: httpx.AsyncClient, to: str, body: str) -> Dict[str, Any]:
    number = to_e164(to)
    if not number:
        return {"status": "failed", "error": "Invalid phone number"}
    data = {"To": number, "Body": body}
    if TWILIO_MESSAGING_SERVICE_SID:
        data["MessagingServiceSid"] = TWILIO_MESSAGING_SERVICE_SID
    else:
        data["From"] = TWILIO_FROM_NUMBER
    return await _twilio_post(http, data)


async def send_whatsapp(http: httpx.AsyncClient, to: str, body: str, variables: Dict[str, str]) -> Dict[str, Any]:
    number = to_e164(to)
    if not number:
        return {"status": "failed", "error": "Invalid phone number"}
    sender = TWILIO_WHATSAPP_FROM if TWILIO_WHATSAPP_FROM.startswith("whatsapp:") else f"whatsapp:{TWILIO_WHATSAPP_FROM}"
    data = {"To": f"whatsapp:{number}", "From": sender}
    if TWILIO_WHATSAPP_CONTENT_SID:
        data["ContentSid"] = TWILIO_WHATSAPP_CONTENT_SID
        data["ContentVariables"] = json.dumps(variables)
    else:
        data["Body"] = body
    return await _twilio_post(http, data)


async def confirm_delivery(http: httpx.AsyncClient, result: Dict[str, Any]) -> Dict[str, Any]:
    """WhatsApp failures (e.g. outside the 24h window) arrive a moment after Twilio accepts
    the message, so look the message up once to report the real outcome."""
    if result.get("status") != "sent" or not result.get("sid"):
        return result
    try:
        r = await http.get(
            f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages/{result['sid']}.json",
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
        )
        payload = r.json() if r.content else {}
        if payload.get("status") in ("failed", "undelivered"):
            return {"status": "failed", "sid": result["sid"], "error": _twilio_error(payload, "Message was not delivered")}
    except Exception:
        pass
    return result


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
    status: str = "sent"  # sent (on at least one channel) | failed | not_sent
    error: Optional[str] = None
    channels: Dict[str, str] = {}  # e.g. {"whatsapp": "sent", "sms": "failed"}


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
    # Internal fields stay on the server
    return await db.profiles.find_one({"device_id": did}, {"_id": 0, "last_seen": 0, "created_at": 0})


# ----------------- Routes: core -----------------
@api_router.get("/")
async def root():
    return {
        "message": "Jagdamba API running",
        "database": "ok" if DB_ERROR is None else "error",
        "integrations": {
            "gemini": bool(GEMINI_API_KEY or (HAS_EMERGENT and EMERGENT_LLM_KEY)),
            "twilio_sms": sms_configured(),
            "twilio_whatsapp": whatsapp_configured(),
            "openstreetmap": True,
        },
    }


_health = {"at": 0.0, "ok": False}


@api_router.get("/health")
async def health():
    """Used by Render (and an uptime monitor) to check the server and database are working."""
    if time.time() - _health["at"] > 30:
        ok = False
        if db is not None and DB_ERROR is None:
            try:
                await asyncio.wait_for(client.admin.command("ping"), timeout=5)
                ok = True
            except Exception as e:
                logger.error(f"Health check: database ping failed: {e}")
        _health.update(at=time.time(), ok=ok)
    if not _health["ok"]:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"ok": False})
    return {"ok": True}


@api_router.get("/config")
async def config():
    return {"twilio_sms": sms_configured(), "twilio_whatsapp": whatsapp_configured(), "gemini": bool(GEMINI_API_KEY or (HAS_EMERGENT and EMERGENT_LLM_KEY))}


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
    rate_limit(request, "profile", per_device=(20, 3600), per_ip=(60, 3600))
    now = datetime.now(timezone.utc)
    doc = {
        "device_id": did,
        "name": payload.name.strip(),
        "phone": (payload.phone or "").strip() or None,
        "initials": _initials(payload.name),
        "updated_at": now,
    }
    # created_at / last_seen feed the admin console's registration and activity counts
    await db.profiles.update_one(
        {"device_id": did},
        {"$set": {**doc, "last_seen": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return Profile(**doc)


# ----------------- Routes: location / places -----------------
@api_router.get("/geo/reverse")
async def geo_reverse(lat: float, lng: float):
    try:
        return await reverse_geocode(lat, lng)
    except Exception as e:
        logger.warning(f"Geocoding failed: {e}")
        raise HTTPException(status_code=502, detail="Location names are unavailable right now")


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
    if len(req.message) > 2000 or len(req.session_id) > 100:
        raise HTTPException(status_code=400, detail="Message is too long")
    rate_limit(request, "chat", per_device=(30, 600), per_ip=(60, 600))
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
        raise HTTPException(status_code=503, detail="Jagdamba is unavailable right now. If you are in danger, call 112.")


# ----------------- Routes: reports + community alerts -----------------
@api_router.post("/reports", response_model=Report)
async def create_report(payload: ReportCreate, request: Request):
    rate_limit(request, "report", per_device=(10, 3600), per_ip=(30, 3600))
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
    did = device_id(request)
    rate_limit(request, "contact", per_device=(20, 3600), per_ip=(60, 3600))
    if await db.contacts.count_documents({"device_id": did}) >= MAX_CONTACTS:
        raise HTTPException(status_code=400, detail=f"You can save up to {MAX_CONTACTS} trusted contacts")
    contact = Contact(**payload.dict())
    doc = contact.dict()
    doc['device_id'] = did
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
    # Generous for real emergencies; if hit, the app falls back to the phone's own SMS app
    rate_limit(request, "sos", per_device=(6, 600), per_ip=(30, 600))
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
        variables = {"1": name, "2": reason, "3": maps_link or (landmark or "location unavailable")}
        async with httpx.AsyncClient(timeout=15) as http:
            async def deliver(c: Contact):
                channels: Dict[str, Dict[str, Any]] = {}
                jobs = []
                if whatsapp_configured():
                    jobs.append(("whatsapp", send_whatsapp(http, c.phone, message, variables)))
                if sms_configured():
                    jobs.append(("sms", send_sms(http, c.phone, message)))
                results = await asyncio.gather(*[j for _, j in jobs])
                for (ch, _), res in zip(jobs, results):
                    channels[ch] = res
                if "whatsapp" in channels:
                    await asyncio.sleep(2.5)
                    channels["whatsapp"] = await confirm_delivery(http, channels["whatsapp"])
                ok = any(r["status"] == "sent" for r in channels.values())
                errors = "; ".join(f"{ch}: {r['error']}" for ch, r in channels.items() if r.get("error"))
                return SosRecipient(
                    name=c.name, phone=c.phone, status="sent" if ok else "failed",
                    error=errors or None, channels={ch: r["status"] for ch, r in channels.items()},
                )
            recipients = list(await asyncio.gather(*[deliver(c) for c in contacts]))
    else:
        recipients = [SosRecipient(name=c.name, phone=c.phone, status="not_sent") for c in contacts]

    doc = {
        "id": sos_id, "device_id": did, "lat": payload.lat, "lng": payload.lng, "accuracy": payload.accuracy,
        "channel": "whatsapp" if whatsapp_configured() else "sms", "delivery": delivery, "maps_link": maps_link, "message": message,
        "recipients": [r.dict() for r in recipients], "battery": payload.battery, "network": payload.network,
        "landmark": landmark, "evidence_id": payload.evidence_id, "reason": payload.reason,
        "nearest_police": nearest_police, "shared_at": datetime.now(timezone.utc),
    }
    await db.sos_events.insert_one(doc)
    sent = sum(1 for r in recipients if r.status == 'sent')
    logger.info(f"SOS {sos_id}: delivery={delivery}, sent {sent}/{len(recipients)}")
    return SosResponse(
        id=sos_id, maps_link=maps_link or "https://www.google.com/maps", message=message, channel="whatsapp" if whatsapp_configured() else "sms",
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
        logger.warning(f"Routing failed: {e}")
        raise HTTPException(status_code=502, detail="Routing service is unavailable right now")
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


# ----------------- Admin console API -----------------
# Only Google accounts listed in ADMIN_EMAILS can use these routes. The console only
# ever receives counts and totals, never users' names, phone numbers, contacts or locations.
try:
    from google.oauth2 import id_token as g_id_token
    from google.auth.transport import requests as g_requests
    _g_request = g_requests.Request()
    HAS_GOOGLE_AUTH = True
except ImportError:  # dependency missing: admin routes report "not configured"
    HAS_GOOGLE_AUTH = False

ADMIN_GOOGLE_CLIENT_ID = os.environ.get('ADMIN_GOOGLE_CLIENT_ID', '').strip()
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()}
ADMIN_SECTIONS = ["users", "payments"]


def admin_configured() -> bool:
    return HAS_GOOGLE_AUTH and bool(ADMIN_GOOGLE_CLIENT_ID) and bool(ADMIN_EMAILS)


async def require_admin(request: Request) -> dict:
    if not admin_configured():
        raise HTTPException(status_code=503, detail="Admin console is not set up on the server yet")
    auth = request.headers.get('authorization') or ''
    token = auth[7:].strip() if auth.lower().startswith('bearer ') else ''
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in")
    try:
        info = await asyncio.to_thread(g_id_token.verify_oauth2_token, token, _g_request, ADMIN_GOOGLE_CLIENT_ID)
    except Exception:
        raise HTTPException(status_code=401, detail="Your sign-in has expired. Please sign in again.")
    email = (info.get('email') or '').lower()
    if not info.get('email_verified') or email not in ADMIN_EMAILS:
        logger.warning("Admin access refused for a non-allowlisted account")
        raise HTTPException(status_code=403, detail="This Google account is not allowed to use the admin console")
    return {"email": email, "name": info.get('name'), "sections": ADMIN_SECTIONS}


@api_router.get("/admin/config")
async def admin_config():
    # Public: the Google client ID is not a secret, it only identifies the sign-in button
    return {"configured": admin_configured(), "google_client_id": ADMIN_GOOGLE_CLIENT_ID or None}


@api_router.get("/admin/me")
async def admin_me(request: Request):
    return await require_admin(request)


def _daily_series(rows: List[dict], days: int, now: datetime, value_key: str = "count") -> List[dict]:
    by_day = {r["_id"]: r.get(value_key, 0) for r in rows}
    out = []
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        out.append({"date": d, "value": by_day.get(d, 0)})
    return out


@api_router.get("/admin/users-summary")
async def admin_users_summary(request: Request):
    await require_admin(request)
    now = datetime.now(timezone.utc)
    since = lambda d: now - timedelta(days=d)  # noqa: E731
    p = db.profiles
    registered, active_1d, active_7d, active_30d, new_7d, new_30d, untracked = await asyncio.gather(
        p.count_documents({}),
        p.count_documents({"last_seen": {"$gte": since(1)}}),
        p.count_documents({"last_seen": {"$gte": since(7)}}),
        p.count_documents({"last_seen": {"$gte": since(30)}}),
        p.count_documents({"created_at": {"$gte": since(7)}}),
        p.count_documents({"created_at": {"$gte": since(30)}}),
        p.count_documents({"created_at": {"$exists": False}}),
    )
    rows = await p.aggregate([
        {"$match": {"created_at": {"$gte": since(30)}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "count": {"$sum": 1}}},
    ]).to_list(40)
    with_contacts = len(await db.contacts.distinct("device_id"))
    return {
        "registered": registered,
        "active": {"day": active_1d, "week": active_7d, "month": active_30d},
        "new": {"week": new_7d, "month": new_30d},
        "registered_before_tracking": untracked,
        "with_trusted_contacts": with_contacts,
        "signups_daily": _daily_series(rows, 30, now),
        "generated_at": now.isoformat(),
    }


# Subscriptions and payments are written by the Google Play billing code (Phase 4).
# Amounts are stored in paise (integers) so totals never suffer rounding errors.
ACTIVE_SUB_STATES = ["active", "grace_period"]


@api_router.get("/admin/payments-summary")
async def admin_payments_summary(request: Request):
    await require_admin(request)
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)
    s, pay = db.subscriptions, db.payments
    active, cancelling, on_hold, expired, refunded_subs, total_subs = await asyncio.gather(
        s.count_documents({"status": {"$in": ACTIVE_SUB_STATES}}),
        s.count_documents({"status": "cancelled", "expiry_time": {"$gt": now}}),
        s.count_documents({"status": "on_hold"}),
        s.count_documents({"status": "expired"}),
        s.count_documents({"status": "refunded"}),
        s.count_documents({}),
    )

    async def totals(match: dict) -> Dict[str, Dict[str, int]]:
        rows = await pay.aggregate([
            {"$match": match},
            {"$group": {"_id": "$kind", "count": {"$sum": 1}, "paise": {"$sum": "$amount_paise"}}},
        ]).to_list(10)
        return {r["_id"]: {"count": r["count"], "paise": r["paise"]} for r in rows}

    all_time, last_30 = await asyncio.gather(totals({}), totals({"at": {"$gte": month_ago}}))

    def summarise(t: Dict[str, Dict[str, int]]) -> dict:
        get = lambda k, f: t.get(k, {}).get(f, 0)  # noqa: E731
        gross = get("new", "paise") + get("renewal", "paise")
        refunded = get("refund", "paise")
        return {
            "new_payments": get("new", "count"),
            "renewals": get("renewal", "count"),
            "refunds": get("refund", "count"),
            "gross_inr": gross / 100,
            "refunded_inr": refunded / 100,
            "net_inr": (gross - refunded) / 100,
        }

    rows = await pay.aggregate([
        {"$match": {"at": {"$gte": month_ago}, "kind": {"$in": ["new", "renewal"]}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$at"}}, "count": {"$sum": 1}}},
    ]).to_list(40)
    return {
        "billing_live": total_subs > 0,
        "subscriptions": {
            "active": active, "cancelling": cancelling, "on_hold": on_hold,
            "expired": expired, "refunded": refunded_subs, "total": total_subs,
        },
        "all_time": summarise(all_time),
        "last_30_days": summarise(last_30),
        "payments_daily": _daily_series(rows, 30, now),
        "generated_at": now.isoformat(),
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=[o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',')],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_database(request: Request, call_next):
    if DB_ERROR and request.url.path.startswith("/api/") and request.url.path not in ("/api/", "/api/config"):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"detail": "Service temporarily unavailable. In an emergency, call 112."},
                            headers={"Access-Control-Allow-Origin": "*"})
    return await call_next(request)


# Active-user tracking: marks a registered profile as seen at most once every 5 minutes,
# so busy phones don't cause a database write on every request.
_seen_at: Dict[str, float] = {}
SEEN_EVERY_S = 300


@app.middleware("http")
async def track_activity(request: Request, call_next):
    response = await call_next(request)
    try:
        did = (request.headers.get('x-device-id') or '').strip()
        path = request.url.path
        if (did and len(did) <= 128 and db is not None and DB_ERROR is None
                and path.startswith("/api/") and not path.startswith("/api/admin")
                and response.status_code < 500):
            now = time.time()
            if now - _seen_at.get(did, 0) > SEEN_EVERY_S:
                if len(_seen_at) > 50000:
                    _seen_at.clear()
                _seen_at[did] = now
                await db.profiles.update_one({"device_id": did}, {"$set": {"last_seen": datetime.now(timezone.utc)}})
    except Exception as e:  # tracking must never break a real request
        logger.warning(f"Activity tracking skipped: {e}")
    return response


@app.on_event("startup")
async def ensure_indexes():
    global DB_ERROR
    if db is None:
        return
    try:
        await client.admin.command("ping")
        logger.info("MongoDB connection OK")
    except Exception as e:
        DB_ERROR = _redact(f"{type(e).__name__}: {e}")[:500]
        logger.error(f"MongoDB not reachable: {DB_ERROR} (check MONGO_URL and Atlas Network Access 0.0.0.0/0)")
        return
    try:
        await db.profiles.create_index("device_id", unique=True)
        await db.contacts.create_index("device_id")
        await db.reports.create_index([("created_at", -1)])
        await db.reports.create_index([("lat", 1), ("lng", 1)])
        await db.profiles.create_index("last_seen")
        await db.profiles.create_index("created_at")
        await db.subscriptions.create_index("status")
        await db.payments.create_index([("at", -1)])
    except Exception as e:
        logger.warning(f"Index setup skipped: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()
