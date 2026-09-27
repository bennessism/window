(() => {
  const roomTrack = document.getElementById('roomTrack');
  const roomDots = Array.from(document.querySelectorAll('.room-dot'));
  if (!roomTrack) return;

  const coarseTouch = () =>
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches;

  const touchLike = () => coarseTouch() || window.innerWidth <= 900;
  const desktopTouchView = () => coarseTouch() && window.innerWidth > 900;

  const style = document.createElement('style');
  style.textContent = `
    html.touch-desktop-view .room-track{
      --sill-line:12vh;
      display:flex;
      align-items:stretch;
      gap:0;
      padding:0;
      overflow-x:auto;
      overflow-y:hidden;
      scroll-snap-type:x mandatory;
      scroll-behavior:smooth;
      scrollbar-width:none;
    }
    html.touch-desktop-view .room-track::-webkit-scrollbar{display:none}
    html.touch-desktop-view .room-track.drawing-fog{
      overflow-x:hidden;
      scroll-snap-type:none;
    }
    html.touch-desktop-view .room-zone{
      flex:0 0 100%;
      width:100%;
      height:100%;
      min-width:100%;
      scroll-snap-align:start;
      padding:8vh 4vw 6vh;
    }
    html.touch-desktop-view .left-zone,
    html.touch-desktop-view .right-zone{justify-content:center}
    html.touch-desktop-view .main-zone{padding-top:10vh}
    html.touch-desktop-view .room-dots{display:flex}
    html.touch-desktop-view .music-corner{width:min(72vw,440px);height:100%}
    html.touch-desktop-view .side-table{left:2%;right:2%}
    html.touch-desktop-view .table-books{left:6%}
    html.touch-desktop-view .music-box{right:6%}
    html.touch-desktop-view .photo-frame{width:min(42vw,350px);max-height:68vh}
    html.touch-desktop-view .window-recess{max-height:76vh}
  `;
  document.head.appendChild(style);

  const syncMode = () => {
    document.documentElement.classList.toggle('touch-desktop-view', desktopTouchView());
  };

  const setDot = index => {
    roomDots.forEach((dot, i) => dot.classList.toggle('active', i === index));
  };

  const goTo = (index, smooth = true) => {
    if (!touchLike()) return;
    roomTrack.scrollTo({
      left: roomTrack.clientWidth * index,
      behavior: smooth ? 'smooth' : 'auto'
    });
    setDot(index);
  };

  roomDots.forEach((dot, index) => {
    dot.addEventListener('click', event => {
      if (!touchLike()) return;
      event.preventDefault();
      goTo(index);
    });
  });

  roomTrack.addEventListener('scroll', () => {
    if (!touchLike()) return;
    setDot(Math.round(roomTrack.scrollLeft / Math.max(1, roomTrack.clientWidth)));
  }, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      syncMode();
      if (touchLike()) goTo(1, false);
    }, 140);
  });

  syncMode();
  requestAnimationFrame(() => {
    syncMode();
    if (touchLike()) goTo(1, false);
  });
})();

// Match Wind Field: location controls expand inside the master weather card.
(() => {
  const weatherPanel = document.getElementById('weatherPanel');
  const weatherCard = weatherPanel?.querySelector('.weather-card');
  const weatherToggle = document.getElementById('weatherToggle');
  const weatherClose = document.getElementById('weatherClose');
  const weatherLocationButton = document.getElementById('weatherLocationButton');
  const placeButton = document.getElementById('placeButton');
  const placePanel = document.getElementById('placePanel');
  const closePlace = document.getElementById('closePlace');
  const countrySelect = document.getElementById('countrySelect');
  const locationSelect = document.getElementById('locationSelect');
  if (!weatherPanel || !weatherCard || !placePanel || !countrySelect || !locationSelect) return;

  weatherCard.appendChild(placePanel);

  const style = document.createElement('style');
  style.textContent = `
    .weather-panel{display:block!important}
    .weather-panel[hidden]{display:none!important}
    .weather-panel .weather-card{overflow:visible}
    .weather-panel .place-panel{
      position:static!important;
      inset:auto!important;
      z-index:auto!important;
      width:100%!important;
      padding:0!important;
      margin:0!important;
      background:transparent!important;
      backdrop-filter:none!important;
    }
    .weather-panel .place-panel[hidden]{display:none!important}
    .weather-panel .place-card{
      width:100%!important;
      max-height:none!important;
      overflow:visible!important;
      margin-top:12px!important;
      padding:12px 0 0!important;
      border:0!important;
      border-top:1px solid rgba(255,255,255,.08)!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
      backdrop-filter:none!important;
    }
    .weather-panel .place-head{display:none!important}
    .weather-panel .place-card label{
      display:block!important;
      margin:9px 0 0!important;
      font-size:10px!important;
      color:rgba(255,255,255,.62)!important;
    }
    .weather-panel .place-card select{
      width:100%!important;
      margin-top:5px!important;
      padding:9px 10px!important;
      border:1px solid rgba(255,255,255,.11)!important;
      border-radius:9px!important;
      background:#0c1218!important;
      color:#fff!important;
      outline:none!important;
    }
    .weather-panel .weather-meta{display:none!important}
    .window-location-actions{display:flex;gap:7px;margin-top:10px}
    .window-location-actions button{
      flex:1;
      border:1px solid rgba(255,255,255,.11);
      background:rgba(255,255,255,.05);
      border-radius:9px;
      padding:9px;
      color:#fff;
      font:inherit;
      font-size:10px;
      cursor:pointer;
    }
  `;
  document.head.appendChild(style);

  const actions = document.createElement('div');
  actions.className = 'window-location-actions';
  const useButton = document.createElement('button');
  useButton.type = 'button';
  useButton.textContent = 'Use location';
  actions.appendChild(useButton);
  placePanel.querySelector('.place-card')?.appendChild(actions);

  const openPicker = event => {
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    weatherPanel.hidden = false;
    weatherToggle?.setAttribute('aria-expanded', 'true');
    placePanel.hidden = false;
  };

  const closePicker = () => {
    placePanel.hidden = true;
  };

  countrySelect.addEventListener('change', event => {
    event.stopImmediatePropagation();
    const countryCode = countrySelect.value;
    const country = window.catalog?.countries?.[countryCode] || (typeof catalog !== 'undefined' ? catalog?.countries?.[countryCode] : null);
    const first = country?.locations?.[0];
    if (first && typeof fillLocations === 'function') fillLocations(countryCode, first.id);
  }, true);

  locationSelect.addEventListener('change', event => {
    event.stopImmediatePropagation();
  }, true);

  useButton.addEventListener('click', () => {
    if (typeof loadWeather === 'function') loadWeather(countrySelect.value, locationSelect.value);
    closePicker();
  });

  weatherLocationButton?.addEventListener('click', openPicker, true);
  placeButton?.addEventListener('click', openPicker, true);
  closePlace?.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    closePicker();
  }, true);

  weatherClose?.addEventListener('click', closePicker, true);
  weatherToggle?.addEventListener('click', () => {
    requestAnimationFrame(() => {
      if (weatherPanel.hidden) closePicker();
    });
  });
})();

// Give Window the same warm orange-gold daytime sun language as Wind Field.
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .is-day .celestial-body{
      background:#ffd36a!important;
      box-shadow:0 0 18px 8px rgba(245,163,59,.28),0 0 58px 22px rgba(242,139,44,.16)!important;
    }
    .is-morning .celestial-body{
      background:#f7b24b!important;
      box-shadow:0 0 20px 9px rgba(245,163,59,.30),0 0 72px 28px rgba(242,139,44,.16)!important;
    }
    .is-midday .celestial-body{
      background:#ffd36a!important;
      box-shadow:0 0 20px 10px rgba(255,211,106,.30),0 0 82px 32px rgba(245,163,59,.18)!important;
    }
    .is-afternoon .celestial-body{
      background:#f5a33b!important;
      box-shadow:0 0 22px 10px rgba(245,163,59,.34),0 0 88px 34px rgba(242,139,44,.20)!important;
    }
    .is-evening .celestial-body{
      background:#f28b2c!important;
      box-shadow:0 0 22px 10px rgba(242,139,44,.36),0 0 86px 34px rgba(255,103,44,.20)!important;
    }
  `;
  document.head.appendChild(style);
})();

// Keep displayed weather synchronized with the newest repository snapshot.
(() => {
  let lastActiveRefresh = 0;
  let refreshInFlight = false;

  const refreshLatestWeather = async force => {
    if (document.hidden || refreshInFlight) return;
    if (!force && Date.now() - lastActiveRefresh < 60 * 1000) return;
    if (typeof loadWeather !== 'function') return;

    const country = localStorage.getItem('window-country') || countrySelect?.value;
    const location = localStorage.getItem('window-location') || locationSelect?.value;
    if (!country || !location) return;

    refreshInFlight = true;
    try {
      await loadWeather(country, location);
      lastActiveRefresh = Date.now();
    } finally {
      refreshInFlight = false;
    }
  };

  window.addEventListener('focus', () => refreshLatestWeather(true));
  window.addEventListener('pageshow', () => refreshLatestWeather(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshLatestWeather(true);
  });
  setInterval(() => refreshLatestWeather(false), 15 * 60 * 1000);
})();
