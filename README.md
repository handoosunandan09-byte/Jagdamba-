# Jagdamba — community safety assistant

React frontend (Netlify) + FastAPI backend (Render) + MongoDB.

## Live data sources

| Feature | Source |
| --- | --- |
| User profile, trusted contacts | MongoDB, scoped to each device (`X-Device-Id` header) |
| Nearby police / hospitals / pharmacies / fire / support | OpenStreetMap (Overpass API) around the user's GPS position |
| Area & landmark names | OpenStreetMap Nominatim reverse geocoding |
| Safe walking routes | OSRM foot routing, ranked by help points and reported issues along the way |
| Community alerts | Civic reports submitted in the app, within 5 km, last 14 days |
| SOS text messages | Twilio SMS (falls back to the phone's own SMS app if not configured) |
| Assistant | Google Gemini |

## Backend environment variables (Render)

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGO_URL`, `DB_NAME` | yes | MongoDB Atlas connection |
| `GEMINI_API_KEY` | yes | Google AI Studio key |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | for real SMS | On a Twilio trial you can only text verified numbers |
| `DEFAULT_COUNTRY_CODE` | no | Added to contact numbers saved without a country code (default `+91`) |
| `OSM_USER_AGENT` | recommended | e.g. `Jagdamba/1.0 (you@example.com)` — required by OpenStreetMap usage policy |
| `CORS_ORIGINS` | no | Comma-separated allowed origins (default `*`) |

## Frontend environment variables (Netlify)

| Variable | Notes |
| --- | --- |
| `REACT_APP_BACKEND_URL` | Your Render backend URL |
| `REACT_APP_CESIUM_ION_TOKEN` | Optional — enables real 3D buildings and terrain on the Guardian City map |
