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
    modalDownload: document.getElementById('modalDownload')
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
  function openModal(idx) {
    const img = filtered[idx];
    if (!img) return;
    dom.modalImage.src = 'assets/images/' + img.filename;
    dom.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    dom.modal.classList.add('hidden');
    document.body.style.overflow = '';
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
