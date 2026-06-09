(function () {
  'use strict';

  const MODES = {
    image: { label: '图片搜索', placeholder: '搜索标签...' },
    music: { label: '音乐搜索', placeholder: '搜索歌曲名...' }
  };

  let currentMode = 'image';
  let imageData = [];
  let musicData = [];
  let filtered = [];
  const dom = {
    modeTabs: document.getElementById('modeTabs'),
    search: document.getElementById('search'),
    content: document.getElementById('content'),
    modal: document.getElementById('modal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalImage: document.getElementById('modalImage'),
    modalClose: document.getElementById('modalClose'),
    modalDownload: document.getElementById('modalDownload'),
    modalEdit: document.getElementById('modalEdit'),
    editBar: document.getElementById('editBar'),
    fontSizeRange: document.getElementById('fontSizeRange'),
    fontSizeVal: document.getElementById('fontSizeVal'),
    fontColorPicker: document.getElementById('fontColorPicker'),
    deleteTextBtn: document.getElementById('deleteTextBtn'),
    modalOverlays: document.getElementById('modalOverlays'),
    modalImageWrap: document.getElementById('modalImageWrap')
  };

  async function init() {
    switchMode('image');
  }

  async function switchMode(mode) {
    currentMode = mode;
    const cfg = MODES[mode];
    dom.search.placeholder = cfg.placeholder;
    dom.search.value = '';
    filtered = [];
    dom.search.style.display = '';
    dom.content.innerHTML = '';

    dom.modeTabs.querySelectorAll('.mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    if (mode === 'image') {
      dom.content.innerHTML = '<div class="spinner">加载中...</div>';
      if (imageData.length === 0) {
        try { imageData = await fetch('data/images.json').then(r => r.json()); }
        catch { imageData = []; }
      }
      filtered = [...imageData];
      renderImageGrid();
    } else if (mode === 'music') {
      dom.content.innerHTML = '<div class="spinner">加载中...</div>';
      if (musicData.length === 0) {
        try { musicData = await fetch('data/music.json').then(r => r.json()); }
        catch { musicData = []; }
      }
      filtered = [...musicData];
      renderMusicList();
    }
  }

  // ─── 图片搜索 ───
  function searchImage(q) {
    if (!q) { filtered = [...imageData]; return; }
    filtered = imageData.filter(img => img.tags.some(t => t.toLowerCase().includes(q)));
  }

  function renderImageGrid() {
    if (filtered.length === 0) {
      dom.content.innerHTML = '<div class="no-results">没有找到匹配的图片</div>';
      return;
    }

    dom.content.innerHTML = '<div class="image-grid">' +
      filtered.map((img, idx) => {
        const src = 'assets/images/' + img.filename;
        const tags = img.tags.slice(0, 8);
        return `
          <div class="image-card" data-idx="${idx}">
            <img src="${esc(src)}" alt="${esc(img.id)}" loading="lazy">
            <div class="card-body">
              ${tags.map(t => `<span class="card-tag">${esc(t)}</span>`).join('')}
            </div>
          </div>`;
      }).join('') +
      '</div>';

    document.querySelectorAll('.image-card').forEach(card => {
      card.addEventListener('click', () => openModal(parseInt(card.dataset.idx)));
    });
  }

  // ─── 灯箱 ───
  let editMode = false;
  let selectedTextId = null;
  let textItems = [];
  let textIdCounter = 0;
  let dragState = null; // { id, startX, startY, origX, origY }

  function openModal(idx) {
    const img = filtered[idx];
    if (!img) return;
    dom.modalImage.src = 'assets/images/' + img.filename;
    dom.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    resetEditState();
  }

  function closeModal() {
    dom.modal.classList.add('hidden');
    document.body.style.overflow = '';
    resetEditState();
  }

  function resetEditState() {
    editMode = false;
    selectedTextId = null;
    textItems = [];
    textIdCounter = 0;
    dragState = null;
    dom.modalEdit.classList.remove('active');
    dom.modalEdit.textContent = '✏️ 编辑';
    dom.editBar.classList.add('hidden');
    dom.modalOverlays.innerHTML = '';
  }

  // ─── 编辑模式 ───
  function toggleEditMode() {
    editMode = !editMode;
    dom.modalEdit.classList.toggle('active', editMode);
    dom.modalEdit.textContent = editMode ? '✔ 完成' : '✏️ 编辑';
    dom.editBar.classList.toggle('hidden', !editMode);
    if (!editMode) {
      deselectText();
      // Commit any in-progress edit
      document.querySelectorAll('.text-overlay-item.editing').forEach(el => {
        commitTextEdit(el);
      });
    }
  }

  function getImageContentBounds() {
    const img = dom.modalImage;
    const cw = img.clientWidth;
    const ch = img.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return { left: 0, top: 0, width: cw, height: ch, scale: 1 };
    const scale = Math.min(cw / nw, ch / nh);
    return {
      left: (cw - nw * scale) / 2,
      top: (ch - nh * scale) / 2,
      width: nw * scale,
      height: nh * scale,
      scale
    };
  }

  function addText(xFrac, yFrac) {
    const item = {
      id: ++textIdCounter,
      text: '输入文字',
      x: xFrac,
      y: yFrac,
      fontSize: 36,
      color: '#ffffff'
    };
    textItems.push(item);
    renderTextItem(item, true); // render and focus
    selectText(item.id);
    // Update controls to defaults
    dom.fontSizeRange.value = item.fontSize;
    dom.fontSizeVal.textContent = item.fontSize;
    dom.fontColorPicker.value = item.color;
  }

  function renderTextItem(item, autoFocus) {
    const bounds = getImageContentBounds();
    const wrap = dom.modalOverlays;

    const el = document.createElement('div');
    el.className = 'text-overlay-item';
    el.dataset.textId = item.id;
    el.textContent = item.text;
    el.style.left = (bounds.left + item.x * bounds.width) + 'px';
    el.style.top = (bounds.top + item.y * bounds.height) + 'px';
    el.style.fontSize = item.fontSize + 'px';
    el.style.color = item.color;
    el.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';

    // Drag handle
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    el.appendChild(handle);

    // Mousedown → select or start drag
    el.addEventListener('mousedown', onTextMouseDown);
    // Double-click → edit
    el.addEventListener('dblclick', onTextDblClick);
    // Click (bubbled from content)
    el.addEventListener('click', (e) => e.stopPropagation());

    wrap.appendChild(el);

    if (autoFocus) {
      onTextDblClick({ currentTarget: el, target: el });
    }
  }

  function selectText(id) {
    deselectText();
    selectedTextId = id;
    document.querySelectorAll('.text-overlay-item').forEach(el => {
      if (parseInt(el.dataset.textId) === id) {
        el.classList.add('selected');
      }
    });
    // Update controls from item
    const item = textItems.find(i => i.id === id);
    if (item) {
      dom.fontSizeRange.value = item.fontSize;
      dom.fontSizeVal.textContent = item.fontSize;
      dom.fontColorPicker.value = item.color;
    }
  }

  function deselectText() {
    selectedTextId = null;
    document.querySelectorAll('.text-overlay-item.selected').forEach(el => {
      el.classList.remove('selected');
    });
  }

  function onTextMouseDown(e) {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const id = parseInt(el.dataset.textId);
    const item = textItems.find(i => i.id === id);
    if (!item) return;

    // If editing (content editable), don't drag
    if (el.classList.contains('editing')) return;

    e.stopPropagation();
    selectText(id);

    const rect = dom.modalOverlays.getBoundingClientRect();
    const bounds = getImageContentBounds();
    dragState = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: item.x,
      origY: item.y,
      moved: false,
      rect,
      bounds
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
    if (!dragState.moved) return;

    const bounds = dragState.bounds;
    const item = textItems.find(i => i.id === dragState.id);
    if (!item) return;

    let newX = dragState.origX + dx / bounds.width;
    let newY = dragState.origY + dy / bounds.height;
    // Clamp to [0, 1]
    newX = Math.max(0, Math.min(1, newX));
    newY = Math.max(0, Math.min(1, newY));
    item.x = newX;
    item.y = newY;

    // Update position
    const el = document.querySelector(`.text-overlay-item[data-text-id="${item.id}"]`);
    if (el) {
      el.style.left = (bounds.left + newX * bounds.width) + 'px';
      el.style.top = (bounds.top + newY * bounds.height) + 'px';
    }
  }

  function onDragEnd() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    if (dragState && !dragState.moved) {
      // It was a click, not a drag — if not editing, make editable
      const el = document.querySelector(`.text-overlay-item[data-text-id="${dragState.id}"]`);
      if (el && !el.classList.contains('editing')) {
        onTextDblClick({ currentTarget: el });
      }
    }
    dragState = null;
  }

  function onTextDblClick(e) {
    const el = e.currentTarget;
    if (el.classList.contains('editing')) return;
    el.classList.add('editing');
    el.contentEditable = true;
    el.focus();
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // On blur → commit text and exit editing
    el.addEventListener('blur', function onBlur() {
      el.removeEventListener('blur', onBlur);
      commitTextEdit(el);
    }, { once: true });

    // Enter → commit text
    el.addEventListener('keydown', function onKeydown(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.removeEventListener('keydown', onKeydown);
        el.blur();
      }
    });
  }

  function commitTextEdit(el) {
    const id = parseInt(el.dataset.textId);
    const item = textItems.find(i => i.id === id);
    if (!item) return;
    item.text = el.textContent || '文字';
    el.textContent = item.text; // sync in case it changed
    el.classList.remove('editing');
    el.contentEditable = false;
  }

  // ─── 编辑控件 ───
  function updateFontSize(val) {
    const size = parseInt(val);
    dom.fontSizeVal.textContent = size;
    if (selectedTextId === null) return;
    const item = textItems.find(i => i.id === selectedTextId);
    if (!item) return;
    item.fontSize = size;
    const el = document.querySelector(`.text-overlay-item[data-text-id="${item.id}"]`);
    if (el) el.style.fontSize = size + 'px';
  }

  function updateFontColor(val) {
    if (selectedTextId === null) return;
    const item = textItems.find(i => i.id === selectedTextId);
    if (!item) return;
    item.color = val;
    const el = document.querySelector(`.text-overlay-item[data-text-id="${item.id}"]`);
    if (el) el.style.color = val;
  }

  function deleteSelectedText() {
    if (selectedTextId === null) return;
    textItems = textItems.filter(i => i.id !== selectedTextId);
    const el = document.querySelector(`.text-overlay-item[data-text-id="${selectedTextId}"]`);
    if (el) el.remove();
    selectedTextId = null;
  }

  // ─── 点击图片添加文字 ───
  function onImageWrapClick(e) {
    if (!editMode) return;
    // Ignore clicks on text items
    if (e.target.closest('.text-overlay-item')) return;

    const rect = dom.modalOverlays.getBoundingClientRect();
    const bounds = getImageContentBounds();
    const x = (e.clientX - rect.left - bounds.left) / bounds.width;
    const y = (e.clientY - rect.top - bounds.top) / bounds.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return; // clicked outside image content
    addText(Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y)));
  }

  // ─── 更新文字位置（窗口大小变化时） ───
  function repositionTextItems() {
    const bounds = getImageContentBounds();
    if (bounds.width === 0 || bounds.height === 0) return;
    textItems.forEach(item => {
      const el = document.querySelector(`.text-overlay-item[data-text-id="${item.id}"]`);
      if (el) {
        el.style.left = (bounds.left + item.x * bounds.width) + 'px';
        el.style.top = (bounds.top + item.y * bounds.height) + 'px';
      }
    });
  }

  async function doDownload() {
    try {
      const r = await fetch(dom.modalImage.src);
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = u; a.download = 'image.jpg'; a.click();
      URL.revokeObjectURL(u);
    } catch { window.open(dom.modalImage.src, '_blank'); }
  }

  // ─── 音乐搜索 ───
  function searchMusic(q) {
    if (!q) { filtered = [...musicData]; return; }
    filtered = musicData.filter(m => {
      return m.title.toLowerCase().includes(q);
    });
  }

  function renderMusicList() {
    dom.content.innerHTML = '';

    if (filtered.length === 0) {
      dom.content.innerHTML = '<div class="no-results">没有找到匹配的歌曲</div>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'music-list';

    filtered.forEach((m, idx) => {
      const card = document.createElement('div');
      card.className = 'music-card';
      card.innerHTML = `
        <div class="music-card-info">
          <div class="music-card-title">${esc(m.title)}</div>
        </div>
        <div class="music-card-actions">
          <button class="mu-btn mu-btn-dl" data-idx="${idx}" data-speed="1x">
            <span class="mu-icon">⬇</span> 1x
          </button>
          <button class="mu-btn mu-btn-dl" data-idx="${idx}" data-speed="2x">
            <span class="mu-icon">⬇</span> 2x
          </button>
        </div>
      `;
      list.appendChild(card);
    });

    dom.content.appendChild(list);

    // 下载按钮
    list.querySelectorAll('.mu-btn-dl').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const speed = btn.dataset.speed;
        const song = filtered[idx];
        const src = speed === '2x' ? song.file2x : song.file1x;
        downloadFile(joinPath(src), song.title + (speed === '2x' ? '_2x.mp3' : '.mp3'));
      });
    });
  }

  async function downloadFile(url, filename) {
    try {
      const r = await fetch(url);
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = u; a.download = filename; a.click();
      URL.revokeObjectURL(u);
    } catch { window.open(url, '_blank'); }
  }

  // ─── 搜索事件 ───
  let timer;
  dom.search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = dom.search.value.trim().toLowerCase();
      if (currentMode === 'image') {
        searchImage(q);
        renderImageGrid();
      } else if (currentMode === 'music') {
        searchMusic(q);
        renderMusicList();
      }
    }, 200);
  });

  dom.modeTabs.addEventListener('click', e => {
    const tab = e.target.closest('.mode-tab');
    if (!tab || tab.dataset.mode === currentMode) return;
    switchMode(tab.dataset.mode);
  });

  dom.modalClose.addEventListener('click', closeModal);
  dom.modalBackdrop.addEventListener('click', closeModal);
  dom.modalDownload.addEventListener('click', doDownload);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !dom.modal.classList.contains('hidden')) closeModal();
  });

  // ─── 编辑事件 ───
  dom.modalEdit.addEventListener('click', toggleEditMode);
  dom.fontSizeRange.addEventListener('input', () => updateFontSize(dom.fontSizeRange.value));
  dom.fontColorPicker.addEventListener('input', () => updateFontColor(dom.fontColorPicker.value));
  dom.deleteTextBtn.addEventListener('click', deleteSelectedText);
  dom.modalImageWrap.addEventListener('click', onImageWrapClick);

  // Image load → reposition overlays
  dom.modalImage.addEventListener('load', () => {
    // Wait for layout to settle
    requestAnimationFrame(() => repositionTextItems());
  });

  // Window resize → reposition overlays
  window.addEventListener('resize', () => {
    if (!dom.modal.classList.contains('hidden')) {
      repositionTextItems();
    }
  });

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function joinPath(p) { return p.split('/').map(encodeURIComponent).join('/'); }

  // ─── 背景音乐 ───
  const bgm = new Audio('assets/bg.mp3');
  bgm.loop = true;
  bgm.volume = 0.5;
  let bgmPlaying = false;
  const bgmBtn = document.getElementById('bgmBtn');

  function playBgm() {
    bgm.play().then(() => {
      bgmPlaying = true;
      bgmBtn.classList.remove('muted');
      bgmBtn.textContent = '🎵';
      bgmBtn.title = '关闭背景音乐';
    }).catch(() => {});
  }

  function pauseBgm() {
    bgm.pause();
    bgmPlaying = false;
    bgmBtn.classList.add('muted');
    bgmBtn.textContent = '🔇';
    bgmBtn.title = '开启背景音乐';
  }

  // 尝试自动播放
  playBgm();

  // 如果浏览器阻止自动播放，在首次用户交互时播放
  function tryAutoPlay() {
    if (!bgmPlaying) { playBgm(); }
    document.removeEventListener('click', tryAutoPlay);
    document.removeEventListener('keydown', tryAutoPlay);
  }
  document.addEventListener('click', tryAutoPlay);
  document.addEventListener('keydown', tryAutoPlay);

  bgmBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (bgmPlaying) { pauseBgm(); } else { playBgm(); }
  });

  init();
})();
