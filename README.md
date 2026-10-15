# RoadWorld — Drive Anywhere

FastAPI + CesiumJS driving prototype for Render. Includes satellite imagery, public global terrain endpoint, an externally hosted GLB ground vehicle model, draggable virtual joystick, adjustable speed, mini-map with country borders, browser geolocation, OpenWeather current conditions, and Cloudflare Workers AI generated sky image.

## Render setup
Build command: `pip install -r requirements.txt`
Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Add these environment variables in Render (never put secret values in frontend code):
- `OPENWEATHER_API_KEY` — OpenWeather current weather API key.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `CLOUDFLARE_API_TOKEN` — token with Workers AI permission.

The app requests browser location permission; if denied it starts at Tel Aviv coordinates. Cloudflare sky generation is on-demand after the first weather response and can consume Workers AI quota/billing. The app uses external public map/terrain/model endpoints, whose availability and terms may change. The vehicle is a generic ground-vehicle sample GLB, not a branded licensed production car. Plate country prefix comes from reverse geocoding; suffix is random for the session and is fictional, not a real registration.
