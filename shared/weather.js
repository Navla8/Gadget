// 날씨 요소 — 날씨 단독 위젯과 시계 대시보드가 함께 사용
// 위치는 저장소에 두지 않고 임베드 주소로만 받음
//   city=서울        도시 이름 (Open-Meteo 지오코딩으로 좌표 검색)
//   lat=..&lon=..    좌표 직접 지정 (city보다 우선)
//   name=집          화면에 보일 이름 (기본: city 값)
//   tomorrow=0       내일 날씨 숨김
import { param, numParam, onVisible } from './common.js';

const REFRESH_MS = 30 * 60_000;

// WMO 날씨 코드 → [이모지, 설명]
function describe(code) {
  if (code === 0) return ['☀️', '맑음'];
  if (code === 1) return ['🌤️', '대체로 맑음'];
  if (code === 2) return ['⛅', '구름 조금'];
  if (code === 3) return ['☁️', '흐림'];
  if (code === 45 || code === 48) return ['🌫️', '안개'];
  if (code >= 51 && code <= 57) return ['🌦️', '이슬비'];
  if (code >= 61 && code <= 67) return ['🌧️', '비'];
  if (code >= 71 && code <= 77) return ['❄️', '눈'];
  if (code >= 80 && code <= 82) return ['🌦️', '소나기'];
  if (code === 85 || code === 86) return ['🌨️', '눈 소나기'];
  if (code >= 95) return ['⛈️', '뇌우'];
  return ['·', ''];
}

// 해당 지역 시간대 기준 오늘 (YYYY-MM-DD)
const today = (tz) => new Date().toLocaleDateString('sv-SE', { timeZone: tz });

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeCache(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

// 날씨 요소를 만들어 돌려줌. 내용이 바뀔 때마다 onChange()를 불러 크기를 다시 맞추게 함
export function createWeather(onChange = () => {}) {
  const city = param('city', '').trim();
  const latP = numParam('lat', NaN);
  const lonP = numParam('lon', NaN);
  const hasCoords = Number.isFinite(latP) && Number.isFinite(lonP);
  const name = param('name', city);
  const showTomorrow = param('tomorrow', '1') === '1';
  const cacheKey = `weather:${hasCoords ? `${latP},${lonP}` : city}`;

  const root = document.createElement('div');
  root.className = 'wx';
  root.innerHTML = `
    <div class="today">
      <div class="emoji" data-icon>·</div>
      <div>
        <div class="label"><span data-label></span><span class="pct" data-rain></span></div>
        <div class="temps"><span data-max>–</span><span class="sep">/</span><span class="muted" data-min>–</span></div>
      </div>
    </div>
    <div class="tomorrow" hidden>
      <div class="label">내일<span class="pct" data-t-rain></span></div>
      <div class="row"><span class="emoji" data-t-icon></span><span class="frac"><span data-t-max></span><span class="muted" data-t-min></span></span></div>
    </div>`;
  const $ = (k) => root.querySelector(`[data-${k}]`);

  function setLabel(text) {
    $('label').textContent = text;
    onChange();
  }

  // 도시 이름 → 좌표 (한 번 찾으면 이 브라우저에 저장)
  async function locate() {
    if (hasCoords) return { lat: latP, lon: lonP };
    const key = `geo:${city}`;
    const saved = readCache(key);
    if (saved) return saved;
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name: city, count: 1, language: 'ko', format: 'json' });
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const hit = (await res.json()).results?.[0];
    if (!hit) return null;
    const place = { lat: hit.latitude, lon: hit.longitude };
    writeCache(key, place);
    return place;
  }

  function render(w) {
    const [d0, d1] = w.days;
    const [emoji, desc] = describe(d0.code);
    $('icon').textContent = emoji;
    $('rain').textContent = d0.rain == null ? '' : `${d0.rain}%`;
    $('max').textContent = `${Math.round(d0.max)}°`;
    $('min').textContent = `${Math.round(d0.min)}°`;
    if (showTomorrow && d1) {
      $('t-icon').textContent = describe(d1.code)[0];
      $('t-max').textContent = `${Math.round(d1.max)}°`;
      $('t-min').textContent = `${Math.round(d1.min)}°`;
      $('t-rain').textContent = d1.rain == null ? '' : `${d1.rain}%`;
      root.querySelector('.tomorrow').hidden = false;
    }
    setLabel([name, desc].filter(Boolean).join(' · '));
  }

  let fetchedAt = 0;
  async function refresh() {
    if (!hasCoords && !city) return setLabel('주소에 ?city=도시이름 을 넣어 주세요');
    let place;
    try {
      place = await locate();
    } catch {
      if (!fetchedAt) setLabel(`${name} · 불러오지 못함`);
      return;
    }
    if (!place) return setLabel(`'${city}'을(를) 찾지 못함`);
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: place.lat, longitude: place.lon, timezone: 'auto', forecast_days: 2,
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    });
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const { daily, timezone } = await res.json();
      const w = {
        date: daily.time[0],
        tz: timezone,
        days: daily.time.map((_, i) => ({
          code: daily.weather_code[i],
          max: daily.temperature_2m_max[i],
          min: daily.temperature_2m_min[i],
          rain: daily.precipitation_probability_max[i],
        })),
      };
      fetchedAt = Date.now();
      writeCache(cacheKey, w);
      render(w);
    } catch {
      if (!fetchedAt) setLabel(`${name} · 불러오지 못함`);
    }
  }

  const cached = hasCoords || city ? readCache(cacheKey) : null;
  if (cached?.days) queueMicrotask(() => render(cached));
  queueMicrotask(refresh);   // 호출한 쪽이 요소를 받은 뒤에 첫 갱신
  setInterval(refresh, REFRESH_MS);
  onVisible(() => {
    const c = readCache(cacheKey);
    const stale = Date.now() - fetchedAt > REFRESH_MS || !c?.days || c.date !== today(c.tz);
    if (stale) refresh();
  });

  return root;
}
