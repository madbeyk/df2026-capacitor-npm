import Swiper from 'swiper';
import { Navigation, Keyboard } from 'swiper/modules';
import 'swiper/swiper-bundle.min.css';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { NotificationService } from './notificationService.js';


if (Capacitor.isNativePlatform()) {
  // Vypne překrývání WebView pod stavovou lištu
  StatusBar.setOverlaysWebView({ overlay: false });
  // Nastaví barvu pozadí stavové lišty
  StatusBar.setBackgroundColor({ color: '#000000' });
  // Nastaví světlé ikony (čas, baterie) na tmavém pozadí
  StatusBar.setStyle({ style: Style.Dark });
}

const infoBtn = document.getElementById('info-btn');
const infoModal = document.getElementById('info-modal');
const infoCloseBtn = document.getElementById('info-close-btn');

// Otevření okna
infoBtn.addEventListener('click', () => {
  infoModal.classList.remove('hidden');
});

// Zavření okna křížkem
const closeModal = () => {
  infoModal.classList.add('hidden');
};

infoCloseBtn.addEventListener('click', closeModal);

// Zavření okna kliknutím mimo jeho obsah (na pozadí)
infoModal.addEventListener('click', (e) => {
  if (e.target === infoModal) {
    closeModal();
  }
});


// ==========================================================================
// REGISTRACE SERVICE WORKERA (pro webový fallback)
// ==========================================================================
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 1) {
        console.warn('[SW] Detekováno více instancí, provádím úklid...');
        for (let reg of registrations) {
          await reg.unregister();
        }
      }

      const reg = await navigator.serviceWorker.register(
        new URL('./sw.js', import.meta.url)
      );
      console.log('[SW] Úspěšně aktivován se scopem:', reg.scope);
    } catch (err) {
      console.error('[SW] Chyba při instalaci/registraci:', err);
    }
  });
}

let deferredPrompt;
const installBanner = document.getElementById('pwa-install-banner');
const installBtn = document.getElementById('pwa-install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBanner) installBanner.style.display = 'flex';
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    installBanner.style.display = 'none';
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Uživatel reagoval na instalaci: ${outcome}`);
    deferredPrompt = null;
  });
}

window.addEventListener('appinstalled', () => {
  console.log('[PWA] Aplikace byla úspěšně nainstalována.');
  if (installBanner) installBanner.style.display = 'none';
});

// ==========================================================================
// CONFIG & INVALIDACE CACHE
// ==========================================================================
const TESTING = true;

const FESTIVAL_ID = 'ozora_2026';
const DATA_VERSION = 'v1.0';
const CACHE_KEY = `festival_data_${FESTIVAL_ID}_${DATA_VERSION}`;

let favorites = JSON.parse(localStorage.getItem('fav_artists')) || [];
let cachedParallaxItems = [];
let lastFetchedData = [];

let isUserInteracting = false;
let interactionTimeout;

function handleUserInteraction() {
  isUserInteracting = true;
  clearTimeout(interactionTimeout);
  
  interactionTimeout = setTimeout(() => {
    isUserInteracting = false;
  }, 60000); 
}

function getValidCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed.festivalId === FESTIVAL_ID && parsed.version === DATA_VERSION) {
      return parsed.data;
    }
  } catch (e) {
    console.warn('Chyba při čtení z localStorage:', e);
  }
  return null;
}

function saveToCache(data) {
  try {
    const payload = {
      festivalId: FESTIVAL_ID,
      version: DATA_VERSION,
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    cleanLegacyStorage();
  } catch (e) {
    console.warn('Uložení do localStorage selhalo:', e);
  }
}

function cleanLegacyStorage() {
  Object.keys(localStorage).forEach(key => {
    if ((key.startsWith('festival_data_') || key === 'jsonData_df2026') && key !== CACHE_KEY) {
      console.log(`[Cache Cleanup] Odstraňuji zastaralý klíč: ${key}`);
      localStorage.removeItem(key);
    }
  });
}

cleanLegacyStorage();

// ==========================================================================
// SWIPER INIT
// ==========================================================================
var swiper = new Swiper('.swiper-container', {
    modules: [Navigation, Keyboard],
    slidesPerView: 1,
    spaceBetween: 0,
    speed: 250,
    watchSlidesProgress: true,
    keyboard: {
      enabled: true,
      onlyInViewport: false,
    },
    noSwiping: true,
    noSwipingClass: 'fav-btn', 
  
    breakpoints: {
      360: { slidesPerView: 2, spaceBetween: 6 },
      600: { slidesPerView: 3, spaceBetween: 6 },
      900: { slidesPerView: 4, spaceBetween: 6 },
      //1200: { slidesPerView: 5, spaceBetween: 8 },
    },    
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    slideToClickedSlide: true,
    on: {
      sliderMove: handleUserInteraction,
      slideChange: () => {
        handleUserInteraction();
        onScrollThrottled();
      }
    }
});
  
var menuItems = document.querySelectorAll('.menu__item');
menuItems.forEach(function(item) {
  item.addEventListener('click', function() {
    handleUserInteraction();
    var slide = item.closest('.swiper-slide');
    if (slide) {
      var slides = Array.from(document.querySelectorAll('.swiper-slide'));
      var index = slides.indexOf(slide);
      if (index !== -1) swiper.slideTo(index);
    }
  });
});

// ==========================================================================
// POMOCNÉ FUNKCE & ČAS
// ==========================================================================

function toTS(iDate, iTime) {
  const [year, month, day] = iDate.split('/');
  const [hours, minutes] = iTime.split(':');
  const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00+02:00`;
  return Math.floor(new Date(isoStr).getTime() / 1000);
}

function getFormattedDateTag(timestamp) {
  const currentDate = new Date(timestamp * 1000);
  
  const dayName = currentDate.toLocaleDateString('cs-CZ', { 
    weekday: 'short', 
    timeZone: 'Europe/Budapest' 
  }).toUpperCase().replace('.', '');

  const dayNum = currentDate.toLocaleDateString('cs-CZ', { 
    day: 'numeric', 
    timeZone: 'Europe/Budapest' 
  });

  return `${dayName} ${dayNum}`;
}

const bDate = "2026/08/20"; const bTime = "17:30";
const eDate = "2026/08/23"; const eTime = "08:00";

const tRatio = 78;

const bTS = toTS(bDate, bTime);
const fTS = toTS(eDate, eTime);

const colorsRGB = {
  'Mainstage': [120, 28, 129, 0.96],
  'Groovy Techno Stage': [72, 139, 194, 0.96],
  'Chill-out': [107, 178, 140, 0.96],
  'Workshopy': [210, 110, 35, 0.96],
};

var totalHeight = (fTS - bTS) / tRatio;

function fetchJsonData() {
  fetch('https://digitalforest.mfnet.cz/digitalforest_2026_json.php')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP chyba ${response.status}`);
      return response.json();
    })
    .then(jsonData => {
      saveToCache(jsonData);
      processData(jsonData);
    })
    .catch(error => {
      console.warn('Network fetch selhal, zkouším offline cache/localStorage:', error);
      const cachedData = getValidCachedData();
      if (cachedData) {
        processData(cachedData);
      } else {
        fetch('data.json')
          .then(res => res.json())
          .then(jsonData => processData(jsonData))
          .catch(err => console.error('Nelze načíst žádná data ze sítě, cache ani data.json:', err));
      }
    });
}

fetchJsonData();

async function toggleFavorite(itemWithMeta, stageName, element) {
  const itemId = itemWithMeta.itemId;
  const index = favorites.indexOf(itemId);

  if (index > -1) {
    favorites.splice(index, 1);
    element.classList.remove('is-fav');
    await NotificationService.cancelForArtist(itemId, itemWithMeta.name);
  } else {
    favorites.push(itemId);
    element.classList.add('is-fav');
    await NotificationService.scheduleForArtist(itemWithMeta, stageName);
  }

  localStorage.setItem('fav_artists', JSON.stringify(favorites));
}
// ==========================================================================
// RENDER POZADÍ DNŮ
// ==========================================================================
function renderDaysBackground(block) {
  const oldBg = block.querySelector('.days-background');
  if (oldBg) oldBg.remove();

  const bgContainer = document.createElement('div');
  bgContainer.className = 'days-background';

  const CEST_OFFSET = 2 * 3600;

  let currentMidnight = (Math.floor((bTS + CEST_OFFSET) / 86400) + 1) * 86400 - CEST_OFFSET;
  let dayIndex = 0;

  if (currentMidnight > bTS) {
    const firstTop = (currentMidnight - bTS) / tRatio;
    const strip = document.createElement('div');
    strip.className = `day-strip ${dayIndex % 2 === 0 ? 'even' : 'odd'}`;
    strip.style.top = '0px';
    strip.style.height = `${firstTop}px`;
    
    bgContainer.appendChild(strip);
    dayIndex++;
  }

  while (currentMidnight < fTS) {
    const startTS = currentMidnight;
    const nextMidnight = startTS + 86400;
    const endTS = Math.min(nextMidnight, fTS);

    const top = (startTS - bTS) / tRatio;
    const height = (endTS - startTS) / tRatio;

    const strip = document.createElement('div');
    strip.className = `day-strip ${dayIndex % 2 === 0 ? 'even' : 'odd'}`;
    strip.style.top = `${top}px`;
    strip.style.height = `${height}px`;

    bgContainer.appendChild(strip);

    currentMidnight = nextMidnight;
    dayIndex++;
  }

  block.insertBefore(bgContainer, block.firstChild);
}

// ==========================================================================
// AKTUALIZACE ČASU A ČÁRY
// ==========================================================================
function updateCurrentTimeTracker(allowScroll = true) {
  let nowTS;

  if (TESTING) {
    const fiveDaysInSeconds = 3 * 24 * 60 * 60;
    nowTS = Math.floor(Date.now() / 1000) + fiveDaysInSeconds;
  } else {
    nowTS = Math.floor(Date.now() / 1000);
  }
  
  document.querySelectorAll('.item2').forEach(el => el.classList.remove('is-current'));

  if (nowTS >= bTS && nowTS <= fTS) {
    const pTop = (nowTS - bTS) / tRatio;
    
    var contentBlocks = document.querySelectorAll('.swiper-slide');
    contentBlocks.forEach(function(block) {
      let timeLine = block.querySelector('.current-time-line');
      if (!timeLine) {
        timeLine = document.createElement('div');
        timeLine.className = 'current-time-line';
        block.appendChild(timeLine);
      }
      timeLine.style.top = pTop + 'px';

      const events = block.querySelectorAll('.item2');
      events.forEach(ev => {
        const start = parseInt(ev.getAttribute('data-start'));
        const end = parseInt(ev.getAttribute('data-end'));
        if (nowTS >= start && nowTS < end) {
          ev.classList.add('is-current');
        }
      });
    });

    if (allowScroll && !isUserInteracting) {
      const swrapper = document.querySelector('.swrapper');
      if (swrapper) {
        const scrollPosition = Math.max(0, pTop - 100);
        swrapper.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  } else {
    if (allowScroll && !isUserInteracting) {
      window.scrollTo(0, 0);
    }
  }
}

// ==========================================================================
// SPRACOVÁNÍ DAT A RENDER
// ==========================================================================
function processData(data) {
  lastFetchedData = data;
  cachedParallaxItems = [];

  var contentBlock = document.querySelectorAll('.content');
  if (contentBlock[0]) {
    contentBlock[0].style.height = totalHeight + "px";
  }

  var contentBlocks = document.querySelectorAll('.swiper-slide');
  contentBlocks.forEach(function(block) {
    var tabName = block.getAttribute('data-id');
    if (colorsRGB[tabName]) {
      block.style.backgroundColor = `rgba(${colorsRGB[tabName]})`;
    }
    
    renderDaysBackground(block);

    var filteredData = data.filter(item => item.tab === tabName);
    var hout = "";

    filteredData.forEach(function(item) {
      var sTS = toTS(item.date_start, item.time_start);
      var eTS = toTS(item.date_start, item.time_end);
      if (eTS < sTS) eTS += 60 * 60 * 24;
      var pTop = (sTS - bTS) / tRatio;
      var height = (eTS - sTS) / tRatio;

      var itData = item.info != "" ? item.name + "<br/><span style='font-size:10px;'>" + item.info + "</span>" : item.name;

      const itemId = btoa(encodeURIComponent(item.name + '_' + item.time_start)).replace(/=/g, '');
      const isFav = favorites.includes(itemId) ? 'is-fav' : '';

      hout += `
      <div class='item2 ${tabName}' data-start='${sTS}' data-end='${eTS}' style='position:absolute; top:${pTop}px; height:${height}px; display:grid; grid-template-columns: minmax(36px, 1fr) 4fr;'>
          <div class='time' style='display:grid; grid-template-columns: 1fr;'>
            <div class='timeslot' style='align-self: start;'>${item.time_start}</div>
          </div>
          <div class='subitem' style='display:grid; position: relative;'>
            <div class='subitemslot' data-ptop='${pTop}' data-height='${height}' style='justify-self: center; align-self: center;'>${itData}</div>
            <div class='fav-btn ${isFav}' data-id='${itemId}' data-name='${encodeURIComponent(item.name)}' data-start-time='${item.time_start}' data-date-start='${item.date_start}' data-tab='${tabName}'>
              <span class='star-icon'>★</span>
            </div>
          </div>
      </div>
      `;
    });

    block.innerHTML = block.innerHTML + hout;

    block.querySelectorAll('.subitemslot').forEach(slot => {
      cachedParallaxItems.push({
        pTop: parseFloat(slot.getAttribute('data-ptop')),
        height: parseFloat(slot.getAttribute('data-height')),
        element: slot,
        slideEl: block,
        currentOffset: 0
      });
    });
  });

  document.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      handleUserInteraction();

      const itemId = this.getAttribute('data-id');
      const name = decodeURIComponent(this.getAttribute('data-name'));
      const time_start = this.getAttribute('data-start-time');
      const date_start = this.getAttribute('data-date-start');
      const tab = this.getAttribute('data-tab');
      const sTS = toTS(date_start, time_start);

      const itemWithMeta = {
        itemId,
        name,
        time_start,
        date_start,
        sTS,
        tab
      };

      toggleFavorite(itemWithMeta, tab, this);
    });
  });

  onScrollThrottled();
  updateCurrentTimeTracker(true);

  // Synchronizace notifikací v OS po vykreslení dat
  NotificationService.syncNotifications(data, favorites, toTS);

  setInterval(() => {
    updateCurrentTimeTracker(true);
  }, 60000);
}

// ==========================================================================
// PARALLAX & HEADER ENGINE
// ==========================================================================
let ticking = false;

function updateParallaxAndHeaders() {
  const sw = document.querySelector('.swrapper');
  if (!sw) return;

  const off = sw.scrollTop;
  const winHeight = window.innerHeight;
  const winWidth = window.innerWidth;

  const currentViewTS = bTS + (off * tRatio);
  const formattedDateTag = getFormattedDateTag(currentViewTS);

  document.querySelectorAll('.swiper-slide').forEach((slide) => {
    const dateTagEl = slide.querySelector('.header-date-tag');
    if (dateTagEl && dateTagEl.textContent !== formattedDateTag) {
      dateTagEl.textContent = formattedDateTag;
    }
  });

  cachedParallaxItems.forEach((item) => {
    const slideRect = item.slideEl.getBoundingClientRect();
    const isSlideHorizontallyVisible = slideRect.right > 0 && slideRect.left < winWidth;

    if (!isSlideHorizontallyVisible) {
      if (item.currentOffset !== 0) {
        item.element.style.transform = 'translate3d(0, 0, 0)';
        item.currentOffset = 0;
      }
      return;
    }

    const top = item.pTop - off;
    const bottom = top + item.height;

    let offset = 0;
    if (top < winHeight && bottom >= 0) {
      if (top < 0) {
        offset = Math.abs(top / 2);
      } else if (bottom > winHeight) {
        offset = -Math.abs((winHeight - bottom) / 2);
      }
    }

    if (Math.abs(item.currentOffset - offset) > 0.1) {
      item.element.style.transform = offset !== 0 ? `translate3d(0, ${offset.toFixed(1)}px, 0)` : 'translate3d(0, 0, 0)';
      item.currentOffset = offset;
    }
  });

  ticking = false;
}

function onScrollThrottled() {
  if (!ticking) {
    requestAnimationFrame(updateParallaxAndHeaders);
    ticking = true;
  }
}

// LISTENERY A REFRESH PŘI PROBUZENÍ NATIVNÍ APLIKACE
const swrapper = document.querySelector('.swrapper');
if (swrapper) {
  swrapper.addEventListener('scroll', () => {
    onScrollThrottled();
    handleUserInteraction();
  }, { passive: true });
}

if (Capacitor.isNativePlatform()) {
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      updateCurrentTimeTracker(false);
      if (lastFetchedData.length > 0) {
        NotificationService.syncNotifications(lastFetchedData, favorites, toTS);
      }
    }
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateCurrentTimeTracker(false);
  }
});

window.addEventListener('focus', () => {
  updateCurrentTimeTracker(false);
});

window.addEventListener('touchstart', handleUserInteraction, { passive: true });
window.addEventListener('touchmove', handleUserInteraction, { passive: true });
window.addEventListener('wheel', handleUserInteraction, { passive: true });
window.addEventListener('click', handleUserInteraction, { passive: true });

window.addEventListener("load", onScrollThrottled);
window.addEventListener("resize", onScrollThrottled);