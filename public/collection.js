(function () {
  'use strict';

  var dataEl = document.getElementById('collection-data');
  var data = JSON.parse(dataEl.textContent);
  var works = data.works || [];
  var visibleFields = data.visibleFields || {};

  function isFieldVisible(key) {
    return !visibleFields || visibleFields[key] !== false;
  }

  function formatPrice(price) {
    var num = Number(price);
    if (Number.isNaN(num)) return price;
    return new Intl.NumberFormat('ru-RU').format(num) + ' ₽';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // ================= Тема =================
  var THEME_KEY = 'collectionLandingTheme';
  var themeToggle = document.getElementById('themeToggle');

  themeToggle.addEventListener('click', function () {
    var current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  });

  // ================= Плашка артиста при прокрутке =================
  var artistBar = document.getElementById('artistBar');
  var SCROLL_BAR_THRESHOLD = 24;

  function handleScroll() {
    if (!artistBar) return;
    if (window.scrollY > SCROLL_BAR_THRESHOLD) {
      artistBar.classList.add('scrolled');
    } else {
      artistBar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // ================= Reveal-on-scroll =================
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.reveal-on-scroll').forEach(function (el) {
    revealObserver.observe(el);
  });

  // ================= Полноэкранный просмотрщик =================
  var workModal = document.getElementById('workModal');
  var workModalContent = document.getElementById('workModalContent');
  var viewerClose = document.getElementById('viewerClose');
  var viewerPrev = document.getElementById('viewerPrev');
  var viewerNext = document.getElementById('viewerNext');
  var swipeViewer = document.getElementById('swipeViewer');
  var slidePrevEl = document.getElementById('slidePrev');
  var slidePrevImg = document.getElementById('slidePrevImg');
  var slideCurrentImg = document.getElementById('slideCurrentImg');
  var slideCurrentPlaceholder = document.getElementById('slideCurrentPlaceholder');
  var slideNextEl = document.getElementById('slideNext');
  var slideNextImg = document.getElementById('slideNextImg');
  var thumbRow = document.getElementById('thumbRow');
  var workModalDetailsWrap = document.getElementById('workModalDetailsWrap');
  var workModalDetails = document.getElementById('workModalDetails');
  var toggleInfoBtn = document.getElementById('toggleInfoBtn');
  var toggleZoomBtn = document.getElementById('toggleZoomBtn');

  var activeIndex = -1;
  var activeImageIndex = 0;
  var infoHidden = false;
  var viewerOpen = false;

  // --- зум/пан текущей картинки ---
  var ZOOM_LEVELS = [1, 1.5, 2, 3];
  var zoomLevel = 1;
  var pan = { x: 0, y: 0 };
  var panDrag = { active: false, pointerId: null, startX: 0, startY: 0, startPanX: 0, startPanY: 0 };

  function isMaxZoom() {
    return zoomLevel === ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  }

  function applyImageStyle() {
    if (zoomLevel <= 1) {
      slideCurrentImg.style.transform = '';
      slideCurrentImg.style.cursor = '';
      slideCurrentImg.style.transition = '';
      return;
    }
    slideCurrentImg.style.transform = 'translate(' + pan.x + 'px, ' + pan.y + 'px) scale(' + zoomLevel + ')';
    slideCurrentImg.style.cursor = panDrag.active ? 'grabbing' : 'grab';
    slideCurrentImg.style.transition = panDrag.active ? 'none' : '';
  }

  function cycleZoom() {
    var idx = ZOOM_LEVELS.indexOf(zoomLevel);
    zoomLevel = ZOOM_LEVELS[(idx + 1) % ZOOM_LEVELS.length];
    pan.x = 0;
    pan.y = 0;
    applyImageStyle();
    swipeViewer.classList.toggle('zoomed', zoomLevel > 1);
    toggleZoomBtn.classList.toggle('toggled', isMaxZoom());
  }

  function resetZoom() {
    zoomLevel = 1;
    pan.x = 0;
    pan.y = 0;
    applyImageStyle();
    swipeViewer.classList.remove('zoomed');
    toggleZoomBtn.classList.remove('toggled');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clampPan() {
    var maxX = (swipeViewer.clientWidth * (zoomLevel - 1)) / 2;
    var maxY = (swipeViewer.clientHeight * (zoomLevel - 1)) / 2;
    pan.x = clamp(pan.x, -maxX, maxX);
    pan.y = clamp(pan.y, -maxY, maxY);
  }

  // --- соседние работы ---
  function prevWork() { return activeIndex > 0 ? works[activeIndex - 1] : null; }
  function nextWork() { return activeIndex >= 0 && activeIndex < works.length - 1 ? works[activeIndex + 1] : null; }
  function workImage(work) { return (work && work.avatar && work.avatar.url) || ''; }

  function thumbnails() {
    var work = works[activeIndex];
    if (!work) return [];
    var list = [];
    if (work.avatar && work.avatar.url) list.push(work.avatar);
    if (Array.isArray(work.images)) list = list.concat(work.images);
    return list;
  }

  function renderThumbnails() {
    var thumbs = thumbnails();
    thumbRow.innerHTML = '';
    if (thumbs.length <= 1) return;

    thumbs.forEach(function (thumb, idx) {
      var btn = document.createElement('button');
      btn.className = 'thumb-btn' + (idx === activeImageIndex ? ' active' : '');
      btn.type = 'button';
      var img = document.createElement('img');
      img.src = thumb.url;
      img.alt = (works[activeIndex].name || '') + ' ' + (idx + 1);
      btn.appendChild(img);
      btn.addEventListener('click', function () {
        activeImageIndex = idx;
        updateActiveImage();
        renderThumbnails();
      });
      thumbRow.appendChild(btn);
    });
  }

  function updateActiveImage() {
    var thumbs = thumbnails();
    var url = (thumbs[activeImageIndex] && thumbs[activeImageIndex].url) || '';
    resetZoom();
    if (url) {
      slideCurrentImg.src = url;
      slideCurrentImg.style.display = '';
      slideCurrentPlaceholder.style.display = 'none';
    } else {
      slideCurrentImg.style.display = 'none';
      slideCurrentPlaceholder.style.display = 'flex';
    }
  }

  function renderDetails() {
    var work = works[activeIndex];
    if (!work) return;

    var html = '';
    if (work.artist_name) {
      html += '<p class="work-modal-artist">' + escapeHtml(work.artist_name) + '</p>';
    }
    html += '<h2 class="work-modal-title">' + escapeHtml(work.name || 'Без названия');
    if (work.year && isFieldVisible('year')) html += ', ' + escapeHtml(work.year);
    html += '</h2>';

    html += '<dl class="detail-list">';
    if (work.technique && isFieldVisible('technique')) {
      html += '<div class="detail-row"><dt>Техника</dt><dd>' + escapeHtml(work.technique) + '</dd></div>';
    }
    if (work.size && isFieldVisible('size')) {
      html += '<div class="detail-row"><dt>Размер</dt><dd>' + escapeHtml(work.size) + '</dd></div>';
    }
    if (work.seria_name && isFieldVisible('seria')) {
      html += '<div class="detail-row"><dt>Серия</dt><dd>' + escapeHtml(work.seria_name) + '</dd></div>';
    }
    if (work.media_name && isFieldVisible('media')) {
      html += '<div class="detail-row"><dt>Медиа</dt><dd>' + escapeHtml(work.media_name) + '</dd></div>';
    }
    if (work.location_name && isFieldVisible('location')) {
      html += '<div class="detail-row"><dt>Локация</dt><dd>' + escapeHtml(work.location_name) + '</dd></div>';
    }
    html += '</dl>';

    if (work.status_name && isFieldVisible('status')) {
      html += '<span class="work-status-text">' + escapeHtml(work.status_name) + '</span>';
    }
    if (work.description) {
      html += '<p class="work-description">' + escapeHtml(work.description) + '</p>';
    }
    if (work.price && isFieldVisible('price')) {
      html += '<div class="work-price">' + escapeHtml(formatPrice(work.price)) + '</div>';
    }
    html += '<div class="details-divider"></div>';

    // Лёгкий кроссфейд при смене работы — аналог Vue <transition name="details-fade">
    workModalDetails.style.opacity = '0';
    setTimeout(function () {
      workModalDetails.innerHTML = html;
      workModalDetails.style.opacity = '1';
    }, 120);
  }

  function updateNavButtons() {
    viewerPrev.hidden = !prevWork();
    viewerNext.hidden = !nextWork();
  }

  function renderViewer() {
    var pw = prevWork();
    var nw = nextWork();

    if (pw) {
      slidePrevEl.style.display = '';
      slidePrevImg.src = workImage(pw);
      slidePrevImg.alt = pw.name || '';
    } else {
      slidePrevEl.style.display = 'none';
    }

    if (nw) {
      slideNextEl.style.display = '';
      slideNextImg.src = workImage(nw);
      slideNextImg.alt = nw.name || '';
    } else {
      slideNextEl.style.display = 'none';
    }

    updateActiveImage();
    renderThumbnails();
    renderDetails();
    updateNavButtons();
    applyTransforms();
  }

  function openViewer(index) {
    activeIndex = index;
    activeImageIndex = 0;
    infoHidden = false;
    workModalContent.classList.remove('info-hidden');
    workModalDetailsWrap.classList.remove('collapsed');
    toggleInfoBtn.classList.remove('toggled');
    resetZoom();

    swipe.x = 0; swipe.v = 0; swipe.target = 0; swipe.pendingDirection = 0; swipe.dragging = false;
    cancelAnimationFrame(swipe.raf);

    viewerOpen = true;
    workModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleViewerKeydown);

    renderViewer();

    requestAnimationFrame(function () {
      swipe.width = swipeViewer.clientWidth || 1;
      applyTransforms();
    });
  }

  function closeViewer() {
    viewerOpen = false;
    workModal.classList.remove('open');
    document.body.style.overflow = '';
    window.removeEventListener('keydown', handleViewerKeydown);
  }

  function handleViewerKeydown(event) {
    if (event.key === 'Escape') closeViewer();
  }

  document.querySelectorAll('.art-card').forEach(function (card) {
    card.addEventListener('click', function () {
      openViewer(Number(card.dataset.workIndex));
    });
  });

  viewerClose.addEventListener('click', closeViewer);
  toggleInfoBtn.addEventListener('click', function () {
    infoHidden = !infoHidden;
    workModalContent.classList.toggle('info-hidden', infoHidden);
    workModalDetailsWrap.classList.toggle('collapsed', infoHidden);
    toggleInfoBtn.classList.toggle('toggled', infoHidden);
  });
  toggleZoomBtn.addEventListener('click', cycleZoom);

  // ================================================================
  // СВАЙП МЕЖДУ РАБОТАМИ — пружинный интегратор (демпфированный
  // гармонический осциллятор), перенесено 1:1 из Vue-версии.
  // ================================================================
  var swipe = {
    dragging: false,
    pointerId: null,
    width: 0,
    startX: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    x: 0,
    v: 0,
    target: 0,
    raf: 0,
    pendingDirection: 0
  };

  var SPRING_STIFFNESS = 210;
  var SPRING_DAMPING = 26;
  var FLING_VELOCITY_THRESHOLD = 0.5;
  var DISTANCE_THRESHOLD_RATIO = 0.32;
  var RUBBER_BAND_FACTOR = 0.55;
  var SETTLE_EPSILON = 0.5;

  function interpolate(value, inMin, inMax, outMin, outMax) {
    var t = clamp((value - inMin) / (inMax - inMin), 0, 1);
    return outMin + (outMax - outMin) * t;
  }

  function rubberBand(delta, width) {
    var sign = delta < 0 ? -1 : 1;
    var abs = Math.abs(delta);
    return sign * (width * RUBBER_BAND_FACTOR * (1 - 1 / (abs / width + 1)));
  }

  function goToPrev() {
    if (!prevWork() || swipe.dragging) return;
    cancelAnimationFrame(swipe.raf);
    swipe.width = swipeViewer.clientWidth || 1;
    swipe.pendingDirection = 1;
    swipe.target = swipe.width;
    swipe.v = 0;
    runSpring();
  }

  function goToNext() {
    if (!nextWork() || swipe.dragging) return;
    cancelAnimationFrame(swipe.raf);
    swipe.width = swipeViewer.clientWidth || 1;
    swipe.pendingDirection = -1;
    swipe.target = -swipe.width;
    swipe.v = 0;
    runSpring();
  }

  viewerPrev.addEventListener('click', goToPrev);
  viewerNext.addEventListener('click', goToNext);

  function onPointerDown(event) {
    if (activeIndex < 0) return;

    if (zoomLevel > 1) {
      panDrag.active = true;
      panDrag.pointerId = event.pointerId;
      panDrag.startX = event.clientX;
      panDrag.startY = event.clientY;
      panDrag.startPanX = pan.x;
      panDrag.startPanY = pan.y;
      swipeViewer.setPointerCapture(event.pointerId);
      return;
    }

    cancelAnimationFrame(swipe.raf);
    swipe.dragging = true;
    swipe.pointerId = event.pointerId;
    swipe.width = swipeViewer.clientWidth || 1;
    swipe.startX = event.clientX;
    swipe.lastX = event.clientX;
    swipe.lastT = performance.now();
    swipe.velocity = 0;
    swipeViewer.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (panDrag.active) {
      if (event.pointerId !== panDrag.pointerId) return;
      pan.x = panDrag.startPanX + (event.clientX - panDrag.startX);
      pan.y = panDrag.startPanY + (event.clientY - panDrag.startY);
      clampPan();
      applyImageStyle();
      return;
    }

    if (!swipe.dragging || event.pointerId !== swipe.pointerId) return;

    var now = performance.now();
    var dt = Math.max(now - swipe.lastT, 1);
    var instantVelocity = (event.clientX - swipe.lastX) / dt;
    swipe.velocity = swipe.velocity * 0.75 + instantVelocity * 0.25;
    swipe.lastX = event.clientX;
    swipe.lastT = now;

    var delta = event.clientX - swipe.startX;
    if (delta > 0 && !prevWork()) delta = rubberBand(delta, swipe.width);
    if (delta < 0 && !nextWork()) delta = rubberBand(delta, swipe.width);

    swipe.x = delta;
    applyTransforms();
  }

  function onPointerUp(event) {
    if (panDrag.active) {
      if (event.pointerId !== panDrag.pointerId) return;
      panDrag.active = false;
      swipeViewer.releasePointerCapture(event.pointerId);
      applyImageStyle();
      return;
    }

    if (!swipe.dragging || event.pointerId !== swipe.pointerId) return;
    swipe.dragging = false;
    swipeViewer.releasePointerCapture(event.pointerId);

    var progress = swipe.x / swipe.width;
    var direction = 0;

    if (Math.abs(swipe.velocity) > FLING_VELOCITY_THRESHOLD) {
      direction = swipe.velocity < 0 ? -1 : 1;
    } else if (Math.abs(progress) > DISTANCE_THRESHOLD_RATIO) {
      direction = progress < 0 ? -1 : 1;
    }

    if (direction === -1 && !nextWork()) direction = 0;
    if (direction === 1 && !prevWork()) direction = 0;

    swipe.pendingDirection = direction;
    swipe.target = direction === 0 ? 0 : direction * swipe.width;
    swipe.v = swipe.velocity * 1000;

    runSpring();
  }

  function runSpring() {
    cancelAnimationFrame(swipe.raf);
    var lastTime = performance.now();

    function step(now) {
      var dt = Math.min((now - lastTime) / 1000, 0.032);
      lastTime = now;

      var displacement = swipe.x - swipe.target;
      var springForce = -SPRING_STIFFNESS * displacement;
      var dampingForce = -SPRING_DAMPING * swipe.v;
      var acceleration = springForce + dampingForce;

      swipe.v += acceleration * dt;
      swipe.x += swipe.v * dt;

      applyTransforms();

      var settled = Math.abs(swipe.x - swipe.target) < SETTLE_EPSILON && Math.abs(swipe.v) < SETTLE_EPSILON * 10;
      if (!settled) {
        swipe.raf = requestAnimationFrame(step);
      } else {
        swipe.x = swipe.target;
        applyTransforms();
        onSpringSettled();
      }
    }

    swipe.raf = requestAnimationFrame(step);
  }

  function onSpringSettled() {
    if (swipe.pendingDirection !== 0) {
      var newIndex = activeIndex - swipe.pendingDirection;
      if (works[newIndex]) {
        activeIndex = newIndex;
        activeImageIndex = 0;
        resetZoom();
        renderViewer();
      }
    }

    swipe.x = 0;
    swipe.v = 0;
    swipe.target = 0;
    swipe.pendingDirection = 0;

    requestAnimationFrame(function () {
      applyTransforms();
    });
  }

  function applyTransforms() {
    var width = swipe.width || 1;
    var x = swipe.x;
    var t = clamp(x / width, -1, 1);

    var currentScale = interpolate(Math.abs(t), 0, 1, 1, 0.94);
    var currentOpacity = interpolate(Math.abs(t), 0, 1, 1, 0.85);
    setLayer(document.getElementById('slideCurrent'), x, currentScale, currentOpacity);

    var revealScale = interpolate(Math.abs(t), 0, 1, 0.96, 1);
    var revealOpacity = interpolate(Math.abs(t), 0, 1, 0.9, 1);

    if (slidePrevEl) setLayer(slidePrevEl, x - width, revealScale, x > 0 ? revealOpacity : 0);
    if (slideNextEl) setLayer(slideNextEl, x + width, revealScale, x < 0 ? revealOpacity : 0);
  }

  function setLayer(el, translateX, scale, opacity) {
    if (!el) return;
    el.style.transform = 'translate3d(' + translateX + 'px, 0, 0) scale(' + scale + ')';
    el.style.opacity = String(opacity);
  }

  swipeViewer.addEventListener('pointerdown', onPointerDown);
  swipeViewer.addEventListener('pointermove', onPointerMove);
  swipeViewer.addEventListener('pointerup', onPointerUp);
  swipeViewer.addEventListener('pointercancel', onPointerUp);

  window.addEventListener('resize', function () {
    if (viewerOpen) swipe.width = swipeViewer.clientWidth || 1;
  });
})();
