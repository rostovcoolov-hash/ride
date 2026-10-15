import os, base64, json
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
import httpx

app = FastAPI(title='RoadWorld Car Simulator')
app.mount('/static', StaticFiles(directory='static'), name='static')
OW_KEY = os.getenv('OPENWEATHER_API_KEY', '')
CF_ACCOUNT = os.getenv('CLOUDFLARE_ACCOUNT_ID', '')
CF_TOKEN = os.getenv('CLOUDFLARE_API_TOKEN', '')

@app.get('/', response_class=HTMLResponse)
async def home():
    with open('index.html', encoding='utf-8') as f: return f.read()

@app.get('/api/weather')
async def weather(lat: float, lon: float):
    if not OW_KEY: raise HTTPException(503, 'Set OPENWEATHER_API_KEY in Render environment variables.')
    async with httpx.AsyncClient(timeout=12) as client:
        r = await client.get('https://api.openweathermap.org/data/2.5/weather', params={'lat':lat,'lon':lon,'appid':OW_KEY,'units':'metric','lang':'en'})
    if r.status_code != 200: raise HTTPException(r.status_code, 'OpenWeather request failed: '+r.text[:200])
    return r.json()

@app.post('/api/sky')
async def sky(payload: dict):
    if not CF_ACCOUNT or not CF_TOKEN: raise HTTPException(503, 'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Render environment variables.')
    lat, lon = float(payload.get('lat',0)), float(payload.get('lon',0))
    weather = str(payload.get('weather','clear skies'))[:120]
    prompt = (f'Photorealistic wide 16:9 real-world sky and distant horizon over the landscape near latitude {lat:.3f}, longitude {lon:.3f}. Weather: {weather}. Natural physically plausible atmospheric perspective, realistic clouds, no text, no buildings in foreground, no sun disk, cinematic but true-to-life, seamless panoramic sky background.')
    url = f'https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/ai/run/@cf/black-forest-labs/flux-1-schnell'
    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(url, headers={'Authorization':f'Bearer {CF_TOKEN}'}, json={'prompt':prompt,'width':1024,'height':576,'steps':4})
    if r.status_code != 200: raise HTTPException(502, 'Cloudflare image generation failed: '+r.text[:300])
    content_type = r.headers.get('content-type','')
    if 'image/' in content_type:
        return Response(content=r.content, media_type=content_type, headers={'Cache-Control':'public, max-age=1800'})
    try:
        data = r.json()
        result = data.get('result',{})
        if isinstance(result, dict) and result.get('image'):
            return Response(base64.b64decode(result['image']), media_type='image/png')
    except Exception: pass
    raise HTTPException(502, 'Unexpected Cloudflare image response.')

@app.get('/api/health')
def health(): return {'status':'ok','weather_configured':bool(OW_KEY),'cloudflare_configured':bool(CF_ACCOUNT and CF_TOKEN)}
