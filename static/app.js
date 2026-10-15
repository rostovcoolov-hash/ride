// ROADWORLD — complete static/app.js
// Satellite imagery, 3D terrain, car, joystick, mini-map, weather and generated sky.

const $ = id => document.getElementById(id);

const CAR_MODEL_URL =
    'https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/GroundVehicle/GroundVehicle.glb';

let state = {
    lat: 32.0853,
    lon: 34.7818,
    heading: 0,
    speed: 200,
    steer: 0,
    alt: 0,
    plateCountry: 'IL',
    plate: 'IL 4827',
    weather: null,
    skyAt: null
};

let carModel = null;
let last = performance.now();
let lastWeather = 0;
let countryLayer = null;

// ------------------------------------------------------------
// CESIUM VIEWER + IMAGERY
// ------------------------------------------------------------

const viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    infoBox: false,
    selectionIndicator: false,
    fullscreenButton: false,
    shouldAnimate: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    imageryProvider: false
});

viewer.scene.globe.show = true;

viewer.scene.globe.baseColor =
    Cesium.Color.fromCssColorString('#526778');

viewer.scene.globe.enableLighting = false;
viewer.scene.globe.showGroundAtmosphere = true;
viewer.scene.skyAtmosphere.show = true;
viewer.scene.fog.enabled = false;

viewer.scene.globe.maximumScreenSpaceError = 2;
viewer.scene.globe.tileCacheSize = 300;

viewer.scene.screenSpaceCameraController.minimumZoomDistance = 30;
viewer.scene.screenSpaceCameraController.maximumZoomDistance = 10000000;

viewer.scene.backgroundColor =
    Cesium.Color.fromCssColorString('#91c8e8');

// Убираем стандартные слои изображений Cesium.
viewer.imageryLayers.removeAll();

// Основной спутниковый слой Esri.
const satelliteProvider = new Cesium.UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: 'Imagery © Esri',
    minimumLevel: 0,
    maximumLevel: 17
});

const satelliteLayer =
    viewer.imageryLayers.addImageryProvider(satelliteProvider);

// Резервная карта OpenStreetMap.
const fallbackProvider = new Cesium.UrlTemplateImageryProvider({
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    credit: '© OpenStreetMap contributors',
    minimumLevel: 0,
    maximumLevel: 19
});

const fallbackLayer =
    viewer.imageryLayers.addImageryProvider(fallbackProvider);

fallbackLayer.show = false;

let satelliteErrors = 0;
let fallbackActivated = false;

function activateFallback(reason) {
    if (fallbackActivated) return;

    fallbackActivated = true;

    console.warn(
        'ROADWORLD: switching to OpenStreetMap fallback.',
        reason || ''
    );

    satelliteLayer.show = false;
    fallbackLayer.show = true;

    const status = $('status');

    if (status) {
        status.textContent = 'MAP FALLBACK · OPENSTREETMAP';
    }

    viewer.scene.requestRender();
}

// Отслеживаем ошибки спутниковых изображений.
if (
    satelliteProvider.errorEvent &&
    typeof satelliteProvider.errorEvent.addEventListener === 'function'
) {
    satelliteProvider.errorEvent.addEventListener(error => {
        satelliteErrors += 1;

        console.error(
            'ROADWORLD: satellite imagery error:',
            error
        );

        if (satelliteErrors >= 4) {
            activateFallback('Repeated satellite tile errors');
        }
    });
}

// Отслеживаем ошибки резервной карты.
if (
    fallbackProvider.errorEvent &&
    typeof fallbackProvider.errorEvent.addEventListener === 'function'
) {
    fallbackProvider.errorEvent.addEventListener(error => {
        console.error(
            'ROADWORLD: fallback map error:',
            error
        );
    });
}

// Диагностика загрузки изображений.
setTimeout(() => {
    if (viewer.isDestroyed()) return;

    console.log('ROADWORLD imagery diagnostic:', {
        layerCount: viewer.imageryLayers.length,
        satelliteVisible: satelliteLayer.show,
        fallbackVisible: fallbackLayer.show,
        satelliteErrors
    });

    viewer.scene.requestRender();
}, 8000);

// ------------------------------------------------------------
// 3D TERRAIN
// ------------------------------------------------------------

(async () => {
    try {
        const terrain = await Cesium.CesiumTerrainProvider.fromUrl(
            'https://terrain.reearth.land/cesium-mesh/ellipsoid',
            {
                requestVertexNormals: false,
                requestWaterMask: false
            }
        );

        viewer.terrainProvider = terrain;

        const status = $('status');

        if (status) {
            status.textContent = '3D TERRAIN CONNECTED';
        }

        viewer.scene.requestRender();

    } catch (error) {
        console.warn(
            'ROADWORLD: terrain unavailable:',
            error
        );

        const status = $('status');

        if (status) {
            status.textContent =
                'SATELLITE MODE · TERRAIN FALLBACK';
        }
    }
})();

// ------------------------------------------------------------
// MINI-MAP + COUNTRY BORDERS
// ------------------------------------------------------------

const miniMap = L.map('miniMap', {
    zoomControl: false,
    attributionControl: false,
    dragging: true,
    scrollWheelZoom: false
}).setView([state.lat, state.lon], 5);

L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 18,
        attribution: '© OpenStreetMap contributors'
    }
).addTo(miniMap);

const carPin = L.circleMarker(
    [state.lat, state.lon],
    {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#12bce8',
        fillOpacity: 1
    }
).addTo(miniMap);

// Загружаем границы стран.
fetch(
    'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
)
    .then(response => {
        if (!response.ok) {
            throw new Error(
                `Country borders HTTP ${response.status}`
            );
        }

        return response.json();
    })
    .then(geojson => {
        countryLayer = L.geoJSON(
            geojson,
            {
                style: {
                    color: '#a5ecff',
                    weight: 1,
                    opacity: 0.6,
                    fillOpacity: 0
                }
            }
        ).addTo(miniMap);
    })
    .catch(error => {
        console.warn(
            'ROADWORLD: country borders unavailable:',
            error
        );
    });

// ------------------------------------------------------------
// CAR MODEL + POSITION
// ------------------------------------------------------------

function matrix() {
    return Cesium.Transforms.headingPitchRollToFixedFrame(
        Cesium.Cartesian3.fromDegrees(
            state.lon,
            state.lat,
            Math.max(0, state.alt)
        ),
        new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(state.heading),
            0,
            0
        )
    );
}

// Загружаем 3D-модель машины.
(async () => {
    try {
        carModel = await Cesium.Model.fromGltfAsync({
            url: CAR_MODEL_URL,
            modelMatrix: matrix(),
            scale: 1,
            minimumPixelSize: 70,
            maximumScale: 300,
            allowPicking: false
        });

        viewer.scene.primitives.add(carModel);

        const status = $('status');

        if (status) {
            status.textContent = 'CAR MODEL LOADED';
        }

        viewer.scene.requestRender();

    } catch (error) {
        console.error(
            'ROADWORLD: car GLB failed:',
            error
        );

        const status = $('status');

        if (status) {
            status.textContent = 'CAR MODEL UNAVAILABLE';
        }
    }
})();

// Камера следует за автомобилем.
function camera() {
    const position = Cesium.Cartesian3.fromDegrees(
        state.lon,
        state.lat,
        Math.max(2, state.alt + 2)
    );

    viewer.camera.lookAt(
        position,
        new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(state.heading + 180),
            Cesium.Math.toRadians(-18),
            85
        )
    );

    viewer.camera.lookAtTransform(
        Cesium.Matrix4.IDENTITY
    );
}

// Движение автомобиля.
function move(dt) {
    state.heading = (
        state.heading +
        state.steer * 70 * dt +
        360
    ) % 360;

    const meters = state.speed / 3.6 * dt;

    const radians = Cesium.Math.toRadians(
        state.heading
    );

    state.lat +=
        meters * Math.cos(radians) / 111320;

    state.lon +=
        meters * Math.sin(radians) /
        (
            111320 *
            Math.max(
                0.15,
                Math.cos(
                    Cesium.Math.toRadians(state.lat)
                )
            )
        );

    state.lon =
        ((state.lon + 180) % 360 + 360) % 360 - 180;

    if (carModel) {
        carModel.modelMatrix = matrix();
    }

    carPin.setLatLng([
        state.lat,
        state.lon
    ]);

    miniMap.panTo(
        [state.lat, state.lon],
        { animate: false }
    );

    const coords = $('coords');

    if (coords) {
        coords.textContent =
            `${state.lat.toFixed(4)}°, ${state.lon.toFixed(4)}°`;
    }

    viewer.scene.requestRender();

    camera();
}

// Основной игровой цикл.
function tick(now) {
    const dt = Math.min(
        0.06,
        (now - last) / 1000
    );

    last = now;

    move(dt);

    requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

// ------------------------------------------------------------
// VIRTUAL JOYSTICK
// ------------------------------------------------------------

const joystick = $('joystick');
const stick = $('joyStick');

let dragging = false;

function joy(event) {
    const rect = joystick.getBoundingClientRect();

    const centerX =
        rect.left + rect.width / 2;

    const centerY =
        rect.top + rect.height / 2;

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;

    const max = 33;

    const distance = Math.hypot(dx, dy);

    if (distance > max) {
        dx = dx / distance * max;
        dy = dy / distance * max;
    }

    stick.style.transform =
        `translate(${dx}px, ${dy}px)`;

    state.steer = dx / max;
}

joystick.addEventListener(
    'pointerdown',
    event => {
        dragging = true;

        joystick.setPointerCapture(
            event.pointerId
        );

        joy(event);
    }
);

joystick.addEventListener(
    'pointermove',
    event => {
        if (dragging) {
            joy(event);
        }
    }
);

function endJoy() {
    dragging = false;

    state.steer = 0;

    stick.style.transform =
        'translate(0, 0)';
}

joystick.addEventListener(
    'pointerup',
    endJoy
);

joystick.addEventListener(
    'pointercancel',
    endJoy
);

// Регулировка скорости.
$('speedRange').addEventListener(
    'input',
    event => {
        state.speed = Number(event.target.value);

        $('speedValue').textContent =
            state.speed;

        $('speedReadout').textContent =
            state.speed;
    }
);

// ------------------------------------------------------------
// WEATHER
// ------------------------------------------------------------

async function updateWeather() {
    try {
        const response = await fetch(
            `/api/weather?lat=${state.lat}&lon=${state.lon}`
        );

        if (!response.ok) {
            let message = 'Weather unavailable';

            try {
                const body = await response.json();

                message = body.detail || message;

            } catch (_) {}

            throw new Error(message);
        }

        const weather = await response.json();

        state.weather = weather;

        $('temp').textContent =
            `${Math.round(weather.main.temp)}°C`;

        $('weatherDesc').textContent =
            weather.weather?.[0]?.description ||
            'Local weather';

        $('weatherTemp').textContent =
            `${Math.round(weather.main.temp)}°`;

        $('weatherLong').textContent =
            weather.weather?.[0]?.description ||
            'Current conditions';

        $('humidity').textContent =
            `${weather.main.humidity}%`;

        $('wind').textContent =
            `${Math.round(
                (weather.wind?.speed || 0) * 3.6
            )} km/h`;

        $('weatherIcon').textContent =
            weatherEmoji(
                weather.weather?.[0]?.id || 800
            );

        if (
            Date.now() - lastWeather >
            15 * 60 * 1000
        ) {
            lastWeather = Date.now();

            updateSky(false);
        }

    } catch (error) {
        $('weatherDesc').textContent =
            'Set OpenWeather key';

        $('weatherLong').textContent =
            'Weather API not configured';

        console.warn(
            'ROADWORLD: weather request failed:',
            error
        );
    }
}

function weatherEmoji(id) {
    if (id < 300) return 'ϟ';
    if (id < 600) return '☂';
    if (id < 700) return '❄';
    if (id < 800) return '≋';
    if (id === 800) return '☀';

    return '☁';
}

// ------------------------------------------------------------
// CLOUDFLARE-GENERATED SKY
// ------------------------------------------------------------

async function updateSky(force = true) {
    $('skyStatus').textContent =
        'Generating location-specific sky…';

    $('generateSky').disabled = true;

    try {
        const response = await fetch(
            '/api/sky',
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    lat: state.lat,
                    lon: state.lon,

                    weather:
                        state.weather?.weather?.[0]?.description ||
                        'natural daylight'
                })
            }
        );

        if (!response.ok) {
            let message = 'Sky generation failed';

            try {
                const body = await response.json();

                message = body.detail || message;

            } catch (_) {}

            throw new Error(message);
        }

        const blob = await response.blob();

        const url = URL.createObjectURL(blob);

        $('sceneSky').style.backgroundImage =
            `url('${url}')`;

        $('skyStatus').textContent =
            'Generated sky for current location';

        state.skyAt = Date.now();

    } catch (error) {
        $('skyStatus').textContent =
            error.message;

        console.warn(
            'ROADWORLD: sky generation failed:',
            error
        );

    } finally {
        $('generateSky').disabled = false;
    }
}

$('generateSky').addEventListener(
    'click',
    () => updateSky(true)
);

// ------------------------------------------------------------
// LOCATION + COUNTRY-BASED NUMBER PLATE
// ------------------------------------------------------------

async function locate() {
    if (!navigator.geolocation) {
        await updateWeather();

        return;
    }

    navigator.geolocation.getCurrentPosition(
        async position => {
            state.lat =
                position.coords.latitude;

            state.lon =
                position.coords.longitude;

            viewer.camera.flyTo({
                destination:
                    Cesium.Cartesian3.fromDegrees(
                        state.lon,
                        state.lat,
                        1800
                    ),

                duration: 1.5
            });

            miniMap.setView(
                [state.lat, state.lon],
                6
            );

            carPin.setLatLng([
                state.lat,
                state.lon
            ]);

            $('coords').textContent =
                `${state.lat.toFixed(4)}°, ${state.lon.toFixed(4)}°`;

            if (carModel) {
                carModel.modelMatrix = matrix();
            }

            await updatePlateCountry();

            await updateWeather();

            viewer.scene.requestRender();
        },

        async error => {
            console.warn(
                'ROADWORLD: location permission/unavailable:',
                error
            );

            await updatePlateCountry();

            await updateWeather();
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

// Определяем код страны для номера машины.
async function updatePlateCountry() {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${state.lat}&lon=${state.lon}&zoom=3`
        );

        if (!response.ok) {
            throw new Error(
                `Reverse geocoding HTTP ${response.status}`
            );
        }

        const data = await response.json();

        const countryCode =
            (data.address?.country_code || 'il').toUpperCase();

        state.plateCountry = countryCode;

        state.plate =
            `${countryCode} ${
                String(
                    Math.floor(Math.random() * 10000)
                ).padStart(4, '0')
            }`;

        $('countryCode').textContent =
            countryCode;

        $('plate').textContent =
            state.plate;

        $('mapCountry').textContent =
            countryCode;

    } catch (error) {
        console.warn(
            'ROADWORLD: country lookup failed:',
            error
        );

        $('countryCode').textContent =
            state.plateCountry;

        $('mapCountry').textContent =
            state.plateCountry;
    }
}

// ------------------------------------------------------------
// STARTUP + PERIODIC REFRESH
// ------------------------------------------------------------

locate();

setInterval(
    async () => {
        await updatePlateCountry();

        await updateWeather();
    },
    10 * 60 * 1000
);

viewer.scene.requestRender();
