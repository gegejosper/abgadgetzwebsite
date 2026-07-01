(function () {
  "use strict";

  /* ---------------- navbar scroll state ---------------- */
  var nav = document.getElementById('mainNav');
  var goTop = document.getElementById('goTop');
  function onScroll() {
    var scrolled = window.scrollY > 40;
    if (nav) nav.classList.toggle('is-scrolled', scrolled);
    if (goTop) goTop.classList.toggle('show', window.scrollY > 500);
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (goTop) {
    goTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* collapse mobile nav after a link is tapped */
  document.querySelectorAll('#navMain .nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      var collapseEl = document.getElementById('navMain');
      if (collapseEl && collapseEl.classList.contains('show') && window.bootstrap) {
        window.bootstrap.Collapse.getOrCreateInstance(collapseEl).hide();
      }
    });
  });

  /* footer year */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------- capability checks ----------------
     One code path drives both touch and pointer devices: IntersectionObserver
     fires from real scroll position on mobile and desktop alike, so the same
     reveal/count-up logic below needs no hover or press gesture to work.
  ------------------------------------------------------------------------- */
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var supportsObserver = 'IntersectionObserver' in window;

  /* ---------------- scroll-reveal animations ----------------
     .reveal elements start hidden/offset in CSS. If JS is blocked or fails,
     the <noscript> fallback in <head> forces them visible, so content never
     depends on script execution to be readable.
  ------------------------------------------------------------------------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !supportsObserver) {
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------------- parallax decorative icons (dark sections) ----------------
     Pure CSS-transform parallax driven by scroll position: each .parallax-icon
     carries a data-speed multiplier and drifts opposite/with scroll based on
     its distance from viewport center. Because it reads window.scrollY /
     getBoundingClientRect() on every scroll+resize tick (throttled to one
     requestAnimationFrame each), it behaves identically on touch-scroll
     (mobile) and mouse/trackpad scroll (desktop) - no hover state involved.
     Skipped entirely under prefers-reduced-motion, leaving icons static.
  ------------------------------------------------------------------------- */
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll('.parallax-icon'));
  if (parallaxEls.length && !reduceMotion) {
    var parallaxTicking = false;

    function updateParallax() {
      var viewportMid = window.innerHeight / 2;
      parallaxEls.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-speed'));
        if (!isFinite(speed)) speed = 0.12;
        var rect = el.getBoundingClientRect();
        var offsetFromCenter = (rect.top + rect.height / 2) - viewportMid;
        var shift = (offsetFromCenter * -speed).toFixed(1);
        el.style.transform = 'translate3d(0,' + shift + 'px,0)';
      });
      parallaxTicking = false;
    }

    function onParallaxScroll() {
      if (!parallaxTicking) {
        window.requestAnimationFrame(updateParallax);
        parallaxTicking = true;
      }
    }

    document.addEventListener('scroll', onParallaxScroll, { passive: true });
    window.addEventListener('resize', onParallaxScroll, { passive: true });
    updateParallax();
  }

  /* ---------------- live stat counters ----------------
     Security notes:
     - API_BASE is a single, explicit config value (no hardcoded
       protocol-mismatched localhost URL baked into markup).
     - Requests use HTTPS in production; localhost is only a dev fallback.
     - Every response is validated as a finite number before it touches
       the DOM, and is written with textContent (never innerHTML) to
       rule out stored/reflected XSS from a compromised or spoofed API.
     - A short timeout (AbortController) prevents a hung request from
       leaving the UI in a broken state indefinitely.

     Count-up animation:
     - Numbers animate up from 0 only once their section scrolls into view,
       driven purely by requestAnimationFrame (no animation library).
     - Respects prefers-reduced-motion by jumping straight to the final value.
  --------------------------------------------------------- */
  var API_BASE = window.ABGADGETZ_API_BASE ||
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://127.0.0.1:8000'
      : 'https://api.abgadgetz.com.ph'); // TODO: replace with your production Laravel API domain (HTTPS only)

  var statTargets = {};   // id -> validated numeric target
  var statsRevealed = false;

  function animateCount(el, target) {
    if (reduceMotion) {
      el.textContent = target.toLocaleString('en-PH');
      return;
    }
    var duration = 1200;
    var startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(target * eased).toLocaleString('en-PH');
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function paintStat(id) {
    var el = document.getElementById(id);
    var target = statTargets[id];
    if (!el || typeof target !== 'number') return;
    if (statsRevealed) animateCount(el, target);
  }

  function revealStats() {
    if (statsRevealed) return;
    statsRevealed = true;
    Object.keys(statTargets).forEach(paintStat);
  }

  // Counters that sit above the fold (e.g. inside the hero) are visible on
  // load; everything else waits for its container to scroll into view.
  var statContainers = document.querySelectorAll('.hero-frame, .stat-band');
  if (statContainers.length && supportsObserver && !reduceMotion) {
    var statObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          revealStats();
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    statContainers.forEach(function (el) { statObserver.observe(el); });
  } else {
    // No observer support, or user prefers reduced motion: show values immediately.
    statsRevealed = true;
  }

  function setCount(ids, value) {
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (typeof value === 'number' && isFinite(value)) {
        statTargets[id] = value;
        paintStat(id);
      } else {
        el.textContent = '—'; // textContent only: never innerHTML with remote data
      }
    });
  }

  function fetchCount(endpoint, ids) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 6000);

    fetch(API_BASE + '/api/' + endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'omit',
      mode: 'cors',
      signal: controller.signal
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Request failed: ' + response.status);
        return response.json();
      })
      .then(function (data) {
        var value = typeof data === 'number' ? data : Number(data && data.count);
        setCount(ids, value);
      })
      .catch(function (error) {
        console.error('[' + endpoint + '] fetch error:', error);
        setCount(ids, null);
      })
      .finally(function () {
        clearTimeout(timeout);
      });
  }

  fetchCount('branches_count', ['branches-count', 'branches-count-2']);
  fetchCount('customers_count', ['customers-count', 'customers-count-2']);
  fetchCount('installments_count', ['installments-count']);

  /* ---------------- lightweight lightbox (native <dialog>) ---------------- */
  var lightbox = document.getElementById('lightbox');
  if (lightbox) {
    var lightboxImg = document.getElementById('lightboxImg');
    var lightboxCaption = document.getElementById('lightboxCaption');
    var lightboxCloseBtn = document.getElementById('lightboxClose');

    document.querySelectorAll('.g-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var full = item.getAttribute('data-full');
        var caption = item.getAttribute('data-caption') || '';
        if (!full) return;
        lightboxImg.src = full;
        lightboxImg.alt = caption;
        lightboxCaption.textContent = caption; // textContent: safe even if caption ever becomes dynamic
        if (typeof lightbox.showModal === 'function') {
          lightbox.showModal();
        }
      });
    });
    if (lightboxCloseBtn) {
      lightboxCloseBtn.addEventListener('click', function () { lightbox.close(); });
    }
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) lightbox.close();
    });
  }
})();
