const app = document.getElementById('app');
const rainCanvas = document.getElementById('rainCanvas');
const fogCanvas = document.getElementById('fogCanvas');
const rainCtx = rainCanvas.getContext('2d');
const fogCtx = fogCanvas.getContext('2d');
const hint = document.getElementById('hint');
const lightning = document.getElementById('lightning');
const lampButton = document.getElementById('lampButton');
const lampControl = document.getElementById('lampControl');
const clearButton = document.getElementById('clearButton');
const musicControl = document.getElementById('musicControl');
const placePanel = document.getElementById('placePanel');
const closePlace = document.getElementById('closePlace');
const countrySelect = document.getElementById('countrySelect');
const locationSelect = document.getElementById('locationSelect');
const weatherLabel = document.getElementById('weatherLabel');
const weatherMeta = document.getElementById('weatherMeta');
const weatherToggle = document.getElementById('weatherToggle');
const weatherPanel = document.getElementById('weatherPanel');
const weatherClose = document.getElementById('weatherClose');
const weatherLocationButton = document.getElementById('weatherLocationButton');
const weatherPlace = document.getElementById('weatherPlace');
const weatherCondition = document.getElementById('weatherCondition');
const weatherTemp = document.getElementById('weatherTemp');
const weatherFeels = document.getElementById('weatherFeels');
const weatherCloud = document.getElementById('weatherCloud');
const weatherRain = document.getElementById('weatherRain');
const weatherHumidity = document.getElementById('weatherHumidity');
const weatherWind = document.getElementById('weatherWind');
const weatherUpdated = document.getElementById('weatherUpdated');
const controlDock = document.getElementById('controlDock');
const dockToggle = document.getElementById('dockToggle');
const blindButton = document.getElementById('blindButton');
const musicBox = document.getElementById('musicBox');
const roomTrack = document.getElementById('roomTrack');
const roomDots = Array.from(document.querySelectorAll('.room-dot'));
const bookButtons = Array.from(document.querySelectorAll('.table-book'));
const photoFrame = document.getElementById('photoFrame');
const photoFrameInner = document.getElementById('photoFrameInner');
const frameImage = document.getElementById('frameImage');
const frameAbstract = document.getElementById('frameAbstract');
const frameEffects = document.getElementById('frameEffects');

let catalog = null;
let currentWeather = null;
let drops = [];
let drawing = false;
let last = null;
let lampOn = true;
let dpr = 1;
let lightningTimer = null;
let naturalFogStrength = 0;
let renderedFogStrength = 0;
let manualFog = null;
let blindStep = -1;
let musicAudioContext = null;
let musicLoopTimer = null;
let musicPlaying = false;

const fallbackWeather = {
  name: 'Sabah', city: 'Kota Kinabalu', temperature_c: 27,
  apparent_temperature_c: 32, relative_humidity_pct: 78,
  precipitation_mm: 0.6, rain_mm: 0.6, showers_mm: 0,
  weather_code: 61, cloud_cover_pct: 76,
  wind_speed_kmh: 10, wind_gusts_kmh: 18, is_day: false,
  time: null
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);

function weatherKind(code = 0, rain = 0) {
  if ([95, 96, 99].includes(code)) return 'storm';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    if (rain >= 4 || [65, 67, 82].includes(code)) return 'heavy-rain';
    return 'rain';
  }
  if ([1, 2].includes(code)) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  return 'clear';
}

function cloudName(cloud) {
  if (cloud <= 20) return 'Clear';
  if (cloud <= 50) return 'Partly cloudy';
  if (cloud <= 80) return 'Mostly cloudy';
  return 'Overcast';
}

function weatherName(kind, cloud = 0) {
  if (['clear', 'partly-cloudy', 'cloudy'].includes(kind)) return cloudName(cloud);
  return ({ drizzle: 'Drizzle', rain: 'Rain', 'heavy-rain': 'Heavy rain', storm: 'Thunderstorm', fog: 'Mist / fog' })[kind] || 'Weather';
}

function scenePalette(isDay, kind, cloud) {
  if (!isDay) {
    if (kind === 'storm') return ['#080d16', '#121d2b'];
    if (kind === 'fog') return ['#17212c', '#293746'];
    if (cloud > 80) return ['#0d1520', '#1c2834'];
    return ['#101827', '#1a2635'];
  }
  if (kind === 'storm') return ['#4f5963', '#7a8791'];
  if (kind === 'fog') return ['#a9b7be', '#d0d8db'];
  if (cloud > 80) return ['#7e919e', '#a9b7bf'];
  if (cloud > 45) return ['#7092ad', '#b2c2cc'];
  return ['#5f99c6', '#b7d7e8'];
}

function liveTimeOfDay() {
  const hour = new Date().getHours();
  return {
    isDay: hour >= 6 && hour < 19,
    isMorning: hour >= 6 && hour < 11
  };
}

function applySceneTime(kind, cloud) {
  const { isDay, isMorning } = liveTimeOfDay();
  const [skyTop, skyBottom] = scenePalette(isDay, kind, cloud);
  app.classList.toggle('is-night', !isDay);
  app.classList.toggle('is-day', isDay);
  app.classList.toggle('is-morning', isMorning);
  app.style.setProperty('--sky-top', skyTop);
  app.style.setProperty('--sky-bottom', skyBottom);
}

function refreshSceneTime() {
  const weather = currentWeather || fallbackWeather;
  const rain = Number(weather.rain_mm || 0) + Number(weather.showers_mm || 0);
  const cloud = clamp(Number(weather.cloud_cover_pct || 0), 0, 100);
  const kind = weatherKind(Number(weather.weather_code || 0), rain);
  applySceneTime(kind, cloud);
}

function displayTime(time) {
  if (!time || typeof time !== 'string') return '--';
  const match = time.match(/T(\d{2}):(\d{2})/);
  if (!match) return time;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function naturalCondensation(kind, humidity) {
  if (kind === 'fog') return 0.34;
  if (kind === 'storm' || kind === 'heavy-rain') return humidity >= 88 ? 0.16 : 0.10;
  if (kind === 'rain' || kind === 'drizzle') return humidity >= 90 ? 0.11 : 0.06;
  return 0;
}

function updateWeatherCard(weather, kind, cloud, rain, humidity, wind) {
  const condition = weatherName(kind, cloud);
  const temp = Number(weather.temperature_c);
  const feels = Number(weather.apparent_temperature_c);
  const place = weather.name || weather.city || 'Location';
  const city = weather.city && weather.city !== place ? ` · ${weather.city}` : '';
  weatherPlace.textContent = `${place}${city}`;
  weatherCondition.textContent = condition;
  weatherTemp.textContent = Number.isFinite(temp) ? `${Math.round(temp)}°C` : '--°C';
  weatherFeels.textContent = Number.isFinite(feels) ? `Feels ${Math.round(feels)}°C` : 'Feels --°C';
  weatherCloud.textContent = `${Math.round(cloud)}%`;
  weatherRain.textContent = `${rain.toFixed(rain >= 1 ? 1 : 2)} mm`;
  weatherHumidity.textContent = `${Math.round(humidity)}%`;
  weatherWind.textContent = `${Math.round(wind)} km/h`;
  weatherUpdated.textContent = `Updated ${displayTime(weather.time)}`;
}

function applyWeather(weather) {
  currentWeather = weather || fallbackWeather;
  const rain = Number(currentWeather.rain_mm || 0) + Number(currentWeather.showers_mm || 0);
  const cloud = clamp(Number(currentWeather.cloud_cover_pct || 0), 0, 100);
  const humidity = clamp(Number(currentWeather.relative_humidity_pct || 60), 0, 100);
  const wind = Math.max(0, Number(currentWeather.wind_speed_kmh || 0));
  const gust = Math.max(wind, Number(currentWeather.wind_gusts_kmh || wind));
  const kind = weatherKind(Number(currentWeather.weather_code || 0), rain);
  const condition = weatherName(kind, cloud);

  applySceneTime(kind, cloud);
  app.dataset.weather = kind;
  app.style.setProperty('--cloud', String(clamp((cloud - 8) / 92, 0.03, 1)));

  let haze = cloud / 520;
  if (kind === 'fog') haze = 0.72;
  if (kind === 'heavy-rain' || kind === 'storm') haze = Math.max(haze, 0.28);
  else if (kind === 'rain') haze = Math.max(haze, 0.16);
  app.style.setProperty('--haze', String(clamp(haze, 0.02, 0.82)));

  document.querySelector('.far').style.opacity = String(clamp(0.82 - haze * 0.7, 0.18, 0.8));
  document.querySelector('.mid').style.opacity = String(clamp(0.96 - haze * 0.45, 0.36, 0.96));

  const temp = Number(currentWeather.temperature_c);
  const tempText = Number.isFinite(temp) ? `${Math.round(temp)}°C` : '';
  weatherLabel.textContent = `${currentWeather.name || currentWeather.city || 'Location'} · ${condition}${tempText ? ` · ${tempText}` : ''}`;
  weatherMeta.textContent = `${currentWeather.city || currentWeather.name || ''} · ${Math.round(cloud)}% cloud · ${rain.toFixed(rain >= 1 ? 1 : 2)} mm rain · ${Math.round(wind)} km/h wind${currentWeather.time ? ` · ${displayTime(currentWeather.time)}` : ''}`;
  updateWeatherCard(currentWeather, kind, cloud, rain, humidity, wind);

  makeRain({ kind, rain, wind, gust });
  naturalFogStrength = naturalCondensation(kind, humidity);
  renderFog();
  scheduleLightning(kind === 'storm');
}

function sizeCanvases() {
  const box = rainCanvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  [rainCanvas, fogCanvas].forEach(canvas => {
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
  });
  rainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fogCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  applyWeather(currentWeather || fallbackWeather);
}

function makeRain({ kind, rain, wind, gust }) {
  const box = rainCanvas.getBoundingClientRect();
  let count = 0;
  if (kind === 'drizzle') count = 45;
  if (kind === 'rain') count = 90 + Math.round(rain * 16);
  if (kind === 'heavy-rain') count = 170 + Math.round(rain * 18);
  if (kind === 'storm') count = 210 + Math.round(rain * 20);
  count = clamp(count, 0, 330);
  const speedBase = 3.2 + clamp(rain * 0.9, 0, 7) + clamp(gust / 25, 0, 3);
  const slant = clamp(wind / 85, 0.02, 0.46);
  drops = Array.from({ length: count }, () => ({ x: rand(-40, box.width + 40), y: rand(-box.height, box.height), speed: rand(speedBase * 0.72, speedBase * 1.28), length: rand(kind === 'drizzle' ? 6 : 12, kind === 'storm' ? 37 : 29), alpha: rand(0.08, kind === 'storm' ? 0.34 : 0.27), drift: slant * rand(0.68, 1.25) }));
}

function animateRain() {
  const box = rainCanvas.getBoundingClientRect();
  rainCtx.clearRect(0, 0, box.width, box.height);
  rainCtx.lineCap = 'round';
  for (const drop of drops) {
    rainCtx.beginPath();
    rainCtx.strokeStyle = `rgba(205,225,238,${drop.alpha})`;
    rainCtx.lineWidth = drop.length > 30 ? 1.15 : 0.85;
    rainCtx.moveTo(drop.x, drop.y);
    rainCtx.lineTo(drop.x + drop.drift * drop.length, drop.y + drop.length);
    rainCtx.stroke();
    drop.y += drop.speed;
    drop.x += drop.drift * drop.speed * .22;
    if (drop.y > box.height + 45 || drop.x > box.width + 80) { drop.y = rand(-180, -20); drop.x = rand(-50, box.width + 10); }
  }
  requestAnimationFrame(animateRain);
}

function fogGlass(strength = 0) {
  renderedFogStrength = strength;
  const box = fogCanvas.getBoundingClientRect();
  fogCtx.globalCompositeOperation = 'source-over';
  fogCtx.clearRect(0, 0, box.width, box.height);
  const active = strength > 0.005;
  fogCanvas.style.pointerEvents = active ? 'auto' : 'none';
  fogCanvas.style.touchAction = active ? 'none' : 'pan-x';
  clearButton.textContent = `Fog · ${active ? 'On' : 'Off'}`;
  if (!active) return;
  const gradient = fogCtx.createLinearGradient(0, 0, box.width, box.height);
  gradient.addColorStop(0, `rgba(228,237,240,${strength})`);
  gradient.addColorStop(.52, `rgba(205,220,226,${strength * .78})`);
  gradient.addColorStop(1, `rgba(188,207,214,${strength * .92})`);
  fogCtx.fillStyle = gradient;
  fogCtx.fillRect(0, 0, box.width, box.height);
}

function renderFog() {
  const strength = manualFog === null ? naturalFogStrength : (manualFog ? 0.30 : 0);
  fogGlass(strength);
  hint.style.opacity = strength >= 0.09 ? '1' : '0';
}

function pointerPosition(event) {
  const box = fogCanvas.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function drawClearLine(a, b) {
  fogCtx.save();
  fogCtx.globalCompositeOperation = 'destination-out';
  fogCtx.lineCap = 'round';
  fogCtx.lineJoin = 'round';
  fogCtx.lineWidth = 30;
  fogCtx.strokeStyle = 'rgba(0,0,0,.84)';
  fogCtx.beginPath();
  fogCtx.moveTo(a.x, a.y);
  fogCtx.lineTo(b.x, b.y);
  fogCtx.stroke();
  fogCtx.restore();
}

fogCanvas.addEventListener('pointerdown', event => {
  if (renderedFogStrength <= 0.005) return;
  event.preventDefault();
  drawing = true;
  roomTrack?.classList.add('drawing-fog');
  fogCanvas.setPointerCapture(event.pointerId);
  last = pointerPosition(event);
  drawClearLine(last, last);
  hint.style.opacity = '0';
});
fogCanvas.addEventListener('pointermove', event => {
  if (!drawing) return;
  event.preventDefault();
  const next = pointerPosition(event);
  drawClearLine(last, next);
  last = next;
});
function endDrawing() {
  drawing = false;
  last = null;
  roomTrack?.classList.remove('drawing-fog');
}
fogCanvas.addEventListener('pointerup', endDrawing);
fogCanvas.addEventListener('pointercancel', endDrawing);
fogCanvas.addEventListener('lostpointercapture', endDrawing);

function scheduleLightning(enabled) {
  clearTimeout(lightningTimer);
  if (!enabled) return;
  const strike = () => { lightning.classList.remove('flash'); void lightning.offsetWidth; lightning.classList.add('flash'); lightningTimer = setTimeout(strike, rand(7000, 18000)); };
  lightningTimer = setTimeout(strike, rand(3500, 9000));
}

function changeLamp() {
  lampOn = !lampOn;
  app.classList.toggle('lamp-off', !lampOn);
  lampButton.setAttribute('aria-pressed', String(lampOn));
  lampControl.textContent = `Lamp · ${lampOn ? 'On' : 'Off'}`;
}

function setWeatherPanel(open) {
  weatherPanel.hidden = !open;
  weatherToggle.setAttribute('aria-expanded', String(open));
}

function cycleBlinds() {
  const levels = [0, 22, 48, 72];
  blindStep = (blindStep + 1) % levels.length;
  app.classList.add('blinds-manual');
  app.style.setProperty('--blind-drop', `${levels[blindStep]}%`);
  blindButton.setAttribute('aria-label', `Adjust blinds, ${levels[blindStep]} percent lowered`);
}

function setRoomDot(index) {
  roomDots.forEach((dot, i) => dot.classList.toggle('active', i === index));
}

function scrollRoomTo(index, smooth = true) {
  if (!roomTrack || window.innerWidth > 900) return;
  roomTrack.scrollTo({ left: roomTrack.clientWidth * index, behavior: smooth ? 'smooth' : 'auto' });
  setRoomDot(index);
}

function scheduleMusicNote(context, destination, frequency, start, duration) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.085, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  gain.connect(destination);
  const fundamental = context.createOscillator();
  fundamental.type = 'sine';
  fundamental.frequency.setValueAtTime(frequency, start);
  fundamental.connect(gain);
  fundamental.start(start);
  fundamental.stop(start + duration + 0.03);
  const overtoneGain = context.createGain();
  overtoneGain.gain.value = 0.22;
  overtoneGain.connect(gain);
  const overtone = context.createOscillator();
  overtone.type = 'triangle';
  overtone.frequency.setValueAtTime(frequency * 2, start);
  overtone.connect(overtoneGain);
  overtone.start(start);
  overtone.stop(start + Math.min(duration, 0.18));
}

function playMusicPhrase() {
  if (!musicPlaying || !musicAudioContext) return;
  const context = musicAudioContext;
  const master = context.createGain();
  master.gain.value = 0.72;
  master.connect(context.destination);
  const melody = [
    [659.25,.22],[622.25,.22],[659.25,.22],[622.25,.22],[659.25,.22],[493.88,.27],[587.33,.22],[523.25,.22],[440,.42],
    [261.63,.22],[329.63,.22],[440,.22],[493.88,.42],[329.63,.22],[415.30,.22],[493.88,.22],[523.25,.42],
    [329.63,.22],[659.25,.22],[622.25,.22],[659.25,.22],[622.25,.22],[659.25,.22],[493.88,.27],[587.33,.22],[523.25,.22],[440,.48]
  ];
  let cursor = context.currentTime + 0.05;
  for (const [frequency, duration] of melody) {
    scheduleMusicNote(context, master, frequency, cursor, duration * 0.88);
    cursor += duration;
  }
  musicLoopTimer = setTimeout(playMusicPhrase, Math.max(200, (cursor - context.currentTime + 0.45) * 1000));
}

async function startMusicBox() {
  if (musicPlaying) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  musicPlaying = true;
  musicAudioContext = new AudioContextClass();
  if (musicAudioContext.state === 'suspended') await musicAudioContext.resume();
  musicBox.classList.add('playing');
  musicBox.setAttribute('aria-pressed', 'true');
  musicBox.setAttribute('aria-label', 'Stop the music box');
  musicControl.textContent = 'Music · On';
  musicControl.setAttribute('aria-pressed', 'true');
  playMusicPhrase();
}

function stopMusicBox() {
  musicPlaying = false;
  clearTimeout(musicLoopTimer);
  musicLoopTimer = null;
  musicBox.classList.remove('playing');
  musicBox.setAttribute('aria-pressed', 'false');
  musicBox.setAttribute('aria-label', 'Start the music box');
  musicControl.textContent = 'Music · Off';
  musicControl.setAttribute('aria-pressed', 'false');
  if (musicAudioContext) {
    musicAudioContext.close().catch(() => {});
    musicAudioContext = null;
  }
}

async function toggleMusicBox() {
  if (musicPlaying) stopMusicBox();
  else await startMusicBox();
}

async function loadRoomLinks() {
  try {
    const response = await fetch(`room-links.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Room links unavailable');
    const data = await response.json();
    const books = data.tableBooks || [];
    const byId = Object.fromEntries(books.map(book => [book.id, book]));
    bookButtons.forEach(button => {
      const book = byId[button.dataset.bookId];
      const label = button.querySelector('.table-book-label');
      if (!book) { button.hidden = true; return; }
      button.hidden = false;
      label.textContent = book.title || '';
      button.title = book.title || '';
      button.classList.remove('tall', 'medium', 'short');
      button.classList.add(['tall','medium','short'].includes(book.height) ? book.height : 'medium');
      const enabled = Boolean(book.enabled && book.url);
      button.classList.toggle('enabled', enabled);
      button.onclick = enabled ? () => window.open(book.url, '_blank', 'noopener,noreferrer') : null;
    });
  } catch (error) {
    console.warn('Room links could not be loaded.', error);
  }
}

function buildFrameParticles(colors, strength) {
  frameEffects.querySelectorAll('.frame-particle').forEach(node => node.remove());
  const count = Math.round(8 + clamp(Number(strength) || 0, 0, 1) * 18);
  for (let i = 0; i < count; i += 1) {
    const particle = document.createElement('i');
    particle.className = 'frame-particle';
    particle.style.left = `${rand(4, 96)}%`;
    particle.style.top = `${rand(4, 96)}%`;
    particle.style.setProperty('--particle-color', colors[i % colors.length]);
    particle.style.setProperty('--particle-speed', `${rand(5.5, 11).toFixed(1)}s`);
    particle.style.animationDelay = `${rand(-8, 0).toFixed(1)}s`;
    frameEffects.appendChild(particle);
  }
}

async function loadRoomFrame() {
  try {
    const response = await fetch(`room-frame.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Frame config unavailable');
    const data = await response.json();
    const frame = data.rightFrame || {};
    photoFrame.hidden = frame.enabled === false;
    const colors = Array.isArray(frame.accentColors) && frame.accentColors.length ? frame.accentColors : ['#d89a63','#7db6d8','#bd83b4','#8cc5a0'];
    colors.slice(0, 4).forEach((color, i) => photoFrame.style.setProperty(`--frame-accent-${i + 1}`, color));
    photoFrame.classList.remove('black', 'light', 'mat-off');
    if (frame.frameStyle === 'black') photoFrame.classList.add('black');
    if (frame.frameStyle === 'light') photoFrame.classList.add('light');
    if (frame.mat === false) photoFrame.classList.add('mat-off');
    if (frame.matColor) photoFrameInner.style.background = frame.matColor;
    photoFrame.dataset.effect = frame.effect || 'particles';
    frameImage.style.objectFit = frame.fit === 'contain' ? 'contain' : 'cover';
    frameImage.alt = frame.title || 'Framed artwork';
    if (frame.imageUrl) {
      frameImage.onload = () => { frameImage.classList.add('show'); frameAbstract.style.display = 'none'; };
      frameImage.onerror = () => { frameImage.classList.remove('show'); frameAbstract.style.display = 'block'; };
      frameImage.src = frame.imageUrl;
    } else {
      frameImage.classList.remove('show');
      frameImage.removeAttribute('src');
      frameAbstract.style.display = 'block';
    }
    buildFrameParticles(colors, frame.effectStrength);
  } catch (error) {
    console.warn('Room frame could not be loaded.', error);
  }
}

lampButton.addEventListener('click', changeLamp);
lampControl.addEventListener('click', changeLamp);
blindButton.addEventListener('click', cycleBlinds);
musicBox.addEventListener('click', toggleMusicBox);
musicControl.addEventListener('click', toggleMusicBox);
clearButton.addEventListener('click', () => {
  manualFog = renderedFogStrength <= 0.005;
  renderFog();
  if (manualFog) {
    hint.style.opacity = '1';
    setTimeout(() => { if (renderedFogStrength > 0.005) hint.style.opacity = '0'; }, 1800);
  }
});
weatherToggle.addEventListener('click', () => setWeatherPanel(weatherPanel.hidden));
weatherClose.addEventListener('click', () => setWeatherPanel(false));
weatherLocationButton.addEventListener('click', () => { setWeatherPanel(false); placePanel.hidden = false; });

dockToggle.addEventListener('click', () => {
  const open = controlDock.classList.toggle('open');
  dockToggle.setAttribute('aria-expanded', String(open));
  dockToggle.setAttribute('aria-label', open ? 'Close controls' : 'Open controls');
});

closePlace.addEventListener('click', () => { placePanel.hidden = true; });
placePanel.addEventListener('click', event => { if (event.target === placePanel) placePanel.hidden = true; });
document.addEventListener('pointerdown', event => { if (!weatherPanel.hidden && !weatherPanel.contains(event.target) && !weatherToggle.contains(event.target)) setWeatherPanel(false); });
roomDots.forEach((dot, index) => dot.addEventListener('click', () => scrollRoomTo(index)));
if (roomTrack) roomTrack.addEventListener('scroll', () => { if (window.innerWidth <= 900) setRoomDot(Math.round(roomTrack.scrollLeft / Math.max(1, roomTrack.clientWidth))); }, { passive: true });

function fillCountries(selected) {
  countrySelect.innerHTML = '';
  Object.entries(catalog.countries).forEach(([code, country]) => { countrySelect.add(new Option(country.name, code, false, code === selected)); });
}

function fillLocations(countryCode, selected) {
  locationSelect.innerHTML = '';
  catalog.countries[countryCode].locations.forEach(location => { locationSelect.add(new Option(location.name, location.id, false, location.id === selected)); });
}

async function loadWeather(countryCode, locationId) {
  try {
    weatherLabel.textContent = 'Loading weather…';
    const response = await fetch(`weather/data/${countryCode}.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Weather cache unavailable');
    const payload = await response.json();
    const weather = payload.locations?.[locationId];
    if (!weather) throw new Error('Location missing from weather cache');
    localStorage.setItem('window-country', countryCode);
    localStorage.setItem('window-location', locationId);
    applyWeather(weather);
  } catch (error) {
    const location = catalog?.countries?.[countryCode]?.locations?.find(item => item.id === locationId);
    applyWeather({ ...fallbackWeather, name: location?.name || 'Sabah', city: location?.city || 'Kota Kinabalu' });
    weatherMeta.textContent = 'Cached weather is not available yet. Showing the fallback scene.';
  }
}

countrySelect.addEventListener('change', () => { const countryCode = countrySelect.value; const first = catalog.countries[countryCode].locations[0]; fillLocations(countryCode, first.id); loadWeather(countryCode, first.id); });
locationSelect.addEventListener('change', () => loadWeather(countrySelect.value, locationSelect.value));

async function initWeather() {
  try {
    const response = await fetch('weather/catalog.json', { cache: 'no-store' });
    catalog = await response.json();
    let country = localStorage.getItem('window-country') || catalog.default.country;
    let location = localStorage.getItem('window-location') || catalog.default.location;
    if (!catalog.countries[country]) country = catalog.default.country;
    if (!catalog.countries[country].locations.some(item => item.id === location)) location = catalog.countries[country].locations[0].id;
    fillCountries(country);
    fillLocations(country, location);
    await loadWeather(country, location);
  } catch (error) { applyWeather(fallbackWeather); }
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { sizeCanvases(); if (window.innerWidth <= 900) scrollRoomTo(1, false); }, 120);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshSceneTime();
});
setInterval(refreshSceneTime, 60 * 1000);

sizeCanvases();
animateRain();
initWeather();
loadRoomLinks();
loadRoomFrame();
requestAnimationFrame(() => { if (window.innerWidth <= 900) scrollRoomTo(1, false); });
