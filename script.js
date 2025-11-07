// 导航开关（移动端）
const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

// 年份
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// 当前导航高亮
const setActiveNav = () => {
  const links = document.querySelectorAll('.site-nav a');
  const current = location.pathname.split('/').pop() || 'index.html';
  links.forEach((a) => {
    const target = a.getAttribute('href');
    if (!target) return;
    const file = target.split('/').pop();
    a.classList.toggle('active', file === current || (current === 'index.html' && file === 'gallery.html'));
  });
};
setActiveNav();

// 过滤器
let filterButtons = Array.from(document.querySelectorAll('.filters .chip'));
let cards = Array.from(document.querySelectorAll('.gallery .card'));
function applyFilter(category) {
  cards.forEach((card) => {
    const match = category === 'all' || card.dataset.category === category;
    card.style.display = match ? '' : 'none';
  });
}
function bindFilters() {
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });
}
bindFilters();

// 数据渲染：画廊与故事（存在则优先渲染）
function shouldUseFolderScan() {
  const params = new URLSearchParams(location.search);
  if (params.get('scan') === '1') return true; // 手动开启
  // GitHub Pages 或 https 环境下默认关闭目录扫描
  if (location.hostname.endsWith('github.io')) return false;
  return location.protocol === 'http:'; // 本地 http 服务可用
}

async function tryRenderGalleryFromJSON() {
  const galleryEl = document.getElementById('gallery');
  if (!galleryEl) return false;
  try {
    // 仅在允许时尝试目录扫描
    if (shouldUseFolderScan()) {
      const autoOk = await tryRenderGalleryFromFolders(galleryEl);
      if (autoOk) return true;
    }
    const res = await fetch('./data/gallery.json');
    if (!res.ok) return false;
    const items = await res.json();
    if (!Array.isArray(items)) return false;
    galleryEl.innerHTML = items.map(renderCard).join('');
    // 重新绑定筛选与卡片
    filterButtons = Array.from(document.querySelectorAll('.filters .chip'));
    cards = Array.from(document.querySelectorAll('.gallery .card'));
    bindFilters();
    return true;
  } catch (_) {
    return false;
  }
}

function renderCard(it) {
  const exif = it.exif;
  const tags = [];
  if (it.location) tags.push(`<span class="tag">📍 ${it.location}</span>`);
  if (exif && exif.camera) tags.push(`<span class="tag">📷 ${exif.camera}</span>`);
  if (exif && exif.lens) tags.push(`<span class="tag">🔭 ${exif.lens}</span>`);
  const tech = [];
  if (exif && exif.focal) tech.push(exif.focal);
  if (exif && exif.aperture) tech.push(exif.aperture);
  if (exif && exif.shutter) tech.push(exif.shutter);
  if (exif && typeof exif.iso !== 'undefined') tech.push('ISO ' + exif.iso);
  if (tech.length) tags.push(`<span class="tag">⚙️ ${tech.join(' · ')}</span>`);
  // 数据属性，供灯箱读取
  const dataAttrs = [
    ['category', it.category],
    ['location', it.location],
    ['camera', exif && exif.camera],
    ['lens', exif && exif.lens],
    ['focal', exif && exif.focal],
    ['aperture', exif && exif.aperture],
    ['shutter', exif && exif.shutter],
    ['iso', exif && exif.iso]
  ].filter(([,v]) => v !== undefined && v !== null && v !== '').map(([k,v]) => `data-${k}="${String(v).replace(/"/g,'&quot;')}"`).join(' ');
  return `
    <figure class="card" ${dataAttrs}>
      <img loading="lazy" src="${it.src}" alt="${it.alt || ''}" />
      <figcaption>${it.caption || ''}</figcaption>
      ${tags.length ? `<div class="meta">${tags.join('')}</div>` : ''}
    </figure>
  `;
}

async function listImagesFromDirectory(dirUrl, category) {
  try {
    const res = await fetch(dirUrl);
    if (!res.ok) return [];
    const html = await res.text();
    // 解析目录索引中的链接（适用于 python http.server 或常见 web 目录索引）
    const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g)).map(m => m[1]);
    const files = hrefs.filter(h => /\.(jpe?g|png|webp)$/i.test(h));
    const base = dirUrl.replace(/[^/]+$/, '');
    const items = [];
    for (const f of files) {
      const src = dirUrl + (f.startsWith('./') || f.startsWith('/') ? f : f);
      let meta = null;
      try {
        const metaRes = await fetch(src + '.json');
        if (metaRes.ok) meta = await metaRes.json();
      } catch (_) {}
      items.push({
        category,
        src,
        alt: (meta && meta.alt) || '',
        caption: (meta && meta.caption) || '',
        location: meta && meta.location,
        exif: meta && meta.exif
      });
    }
    return items;
  } catch (_) {
    return [];
  }
}

async function tryRenderGalleryFromFolders(galleryEl) {
  try {
    const natureItems = await listImagesFromDirectory('./assets/works/nature/', 'nature');
    const cityItems = await listImagesFromDirectory('./assets/works/city/', 'city');
    const items = [...natureItems, ...cityItems];
    if (!items.length) return false;
    galleryEl.innerHTML = items.map(renderCard).join('');
    filterButtons = Array.from(document.querySelectorAll('.filters .chip'));
    cards = Array.from(document.querySelectorAll('.gallery .card'));
    bindFilters();
    return true;
  } catch (_) {
    return false;
  }
}

async function tryRenderStoriesFromJSON() {
  const feed = document.getElementById('storiesFeed');
  if (!feed) return false;
  try {
    const res = await fetch('./data/stories.json');
    if (!res.ok) return false;
    const stories = await res.json();
    if (!Array.isArray(stories)) return false;
    const html = stories.map(renderStoryCard).join('');
    feed.innerHTML = html;
    return true;
  } catch (_) {
    return false;
  }
}

function renderStoryCard(s) {
  const metaBits = [];
  if (s.time) metaBits.push(s.time);
  // 折叠视图仅显示时间
  const meta = metaBits.map(t => `<span>${escapeHtml(String(t))}</span>`).join('');
  const media = s.image ? `<div class="media"><img src="${escapeAttr(s.image)}" alt="" /></div>` : '';
  const id = computeStoryId(s);
  const date = formatDateYMD(s.date || s.time);
  return `
    <article class="story-card">
      <a class="card-link" href="./story.html?id=${encodeURIComponent(id)}">
        <div class="head">
          <div class="avatar">◎</div>
          <h3 class="title">${escapeHtml(s.title || '')}</h3>
          <div class="meta">${date ? `<span>${escapeHtml(date)}</span>` : ''}</div>
        </div>
      </a>
    </article>
  `;
}

function escapeHtml(s) {
  return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function computeStoryId(s) {
  if (s.id) return String(s.id);
  const base = (s.title || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  const date = formatDateYMD(s.date || s.time) || '';
  return date ? `${base}-${date}` : base || String(Math.random()).slice(2, 8);
}

function formatDateYMD(input) {
  if (!input) return '';
  // 支持 ISO、yyyy/mm/dd、yyyy-mm-dd 等
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function bindStoryToggle() {
  const cards = document.querySelectorAll('.story-card');
  cards.forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      card.classList.toggle('collapsed');
    });
  });
}

// 尝试渲染数据（仅在相应页面生效）
tryRenderGalleryFromJSON().then(() => {
  // 画廊数据就绪后，重新收集元素，初始化灯箱
  cards = Array.from(document.querySelectorAll('.gallery .card'));
  initLightboxIfPresent();
  // 若没有任何图片，给出指引
  const galleryEl = document.getElementById('gallery');
  if (galleryEl && galleryEl.children.length === 0) {
    const hint = document.createElement('div');
    hint.style.color = 'var(--muted)';
    hint.style.padding = '12px 0';
    hint.innerHTML = '未检测到可展示的作品。请确认已启用目录索引，或前往 <a href="./tools/generate-gallery.html" style="color:var(--text)">生成 gallery.json</a>。';
    galleryEl.parentElement.appendChild(hint);
  }
});
tryRenderStoriesFromJSON();

function initLightboxIfPresent() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImage');
  const lightboxInfo = document.getElementById('lightboxInfo');
  const closeBtn = document.querySelector('.lightbox-close');
  const prevBtn = document.querySelector('.lightbox .prev');
  const nextBtn = document.querySelector('.lightbox .next');
  if (!(lightbox && lightboxImg && closeBtn && prevBtn && nextBtn && cards.length)) return;
  let currentIndex = -1;
  const visibleCards = () => cards.filter((c) => c.style.display !== 'none');
  function openLightbox(index) {
    const vc = visibleCards();
    if (!vc.length) return;
    currentIndex = (index + vc.length) % vc.length;
    const fig = vc[currentIndex];
    const img = fig.querySelector('img');
    lightboxImg.src = img.src.replace(/w=\d+/, 'w=1600');
    // 渲染灯箱标签
    if (lightboxInfo) {
      const tags = [];
      const ds = fig.dataset;
      if (ds.location) tags.push(`<span class=\"tag\">📍 ${ds.location}</span>`);
      if (ds.camera) tags.push(`<span class=\"tag\">📷 ${ds.camera}</span>`);
      if (ds.lens) tags.push(`<span class=\"tag\">🔭 ${ds.lens}</span>`);
      const tech = [];
      if (ds.focal) tech.push(ds.focal);
      if (ds.aperture) tech.push(ds.aperture);
      if (ds.shutter) tech.push(ds.shutter);
      if (ds.iso) tech.push('ISO ' + ds.iso);
      if (tech.length) tags.push(`<span class=\"tag\">⚙️ ${tech.join(' · ')}</span>`);
      lightboxInfo.innerHTML = tags.join('');
    }
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  function step(delta) { openLightbox(currentIndex + delta); }
  cards.forEach((card, i) => {
    card.addEventListener('click', () => {
      const vc = visibleCards();
      const indexInVisible = vc.indexOf(card);
      openLightbox(indexInVisible >= 0 ? indexInVisible : i);
    });
  });
  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
}
// 初始尝试（若没通过 JSON 渲染，也可直接初始化）
initLightboxIfPresent();

// 已移除联系表单逻辑

// 故事详情渲染
(async function initStoryDetail() {
  const mount = document.getElementById('storyDetail');
  if (!mount) return;
  try {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const res = await fetch('./data/stories.json');
    if (!res.ok) throw new Error('load');
    const stories = await res.json();
    const findById = (arr) => arr.find(s => computeStoryId(s) === id);
    const story = findById(stories);
    if (!story) {
      mount.innerHTML = `<p style="color:var(--muted)">未找到该故事。</p><p><a class="btn" href="./stories.html">返回列表</a></p>`;
      return;
    }
    const date = formatDateYMD(story.date || story.time);
    const header = `
      <h1>${escapeHtml(story.title || '')}</h1>
      <div class="meta">${date ? escapeHtml(date) : ''}${story.location ? ' · 📍 ' + escapeHtml(story.location) : ''}</div>
    `;
    const media = story.image ? `<div class="media"><img src="${escapeAttr(story.image)}" alt="" /></div>` : '';
    const bodyHtml = story.text ? renderMarkdown(story.text) : '';
    const body = bodyHtml ? `<div class="body" style="color:var(--muted)">${bodyHtml}</div>` : '';
    const idx = stories.findIndex(s => computeStoryId(s) === id);
    const prev = idx > 0 ? stories[idx - 1] : null;
    const next = idx >= 0 && idx < stories.length - 1 ? stories[idx + 1] : null;
    const nav = `
      <div class="story-nav">
        ${prev ? `<a href="./story.html?id=${encodeURIComponent(computeStoryId(prev))}">← 上一篇：${escapeHtml(prev.title || '')}</a>` : '<span></span>'}
        ${next ? `<a href="./story.html?id=${encodeURIComponent(computeStoryId(next))}">下一篇：${escapeHtml(next.title || '')} →</a>` : '<span></span>'}
      </div>
    `;
    mount.innerHTML = header + media + body + nav + `<p style="margin-top:12px"><a class="btn" href="./stories.html">返回故事列表</a></p>`;
  } catch (_) {
    // 静默失败
  }
})();

function renderMarkdown(text) {
  // 简易 Markdown：换行、粗体、斜体、行内代码、链接、图片
  // 先处理图片（在 escapeHtml 之前，因为图片 URL 不需要转义）
  let html = text;
  
  // 处理图片：![alt](url) 或 ![alt](url "title")
  // 先提取图片，用占位符替换
  const images = [];
  html = html.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]+)")?\)/g, (match, alt, url, title) => {
    const idx = images.length;
    images.push({ alt, url, title });
    return `__IMAGE_PLACEHOLDER_${idx}__`;
  });
  
  // 转义 HTML
  html = escapeHtml(html);
  
  // 恢复图片，转换为 HTML
  images.forEach((img, idx) => {
    const titleAttr = img.title ? ` title="${escapeHtml(img.title)}"` : '';
    const imgHtml = `<figure class="story-image"><img src="${escapeAttr(img.url)}" alt="${escapeHtml(img.alt)}"${titleAttr} loading="lazy" /></figure>`;
    html = html.replace(`__IMAGE_PLACEHOLDER_${idx}__`, imgHtml);
  });
  
  // 处理粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 处理斜体：匹配前后不是星号的单个星号对（避免与粗体冲突）
  html = html.replace(/([^*]|^)\*([^*\n]+?)\*([^*]|$)/g, (match, before, content, after) => {
    // 确保 before 和 after 不是星号
    const beforeChar = before === '' ? '' : before[before.length - 1];
    const afterChar = after === '' ? '' : after[0];
    if (beforeChar === '*' || afterChar === '*') return match;
    return (before || '') + '<em>' + content + '</em>' + (after || '');
  });
  // 处理行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 处理链接（但不处理已经是图片的链接）
  html = html.replace(/\[(.+?)\]\((https?:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // 按段落分割（双换行），但保留图片作为独立元素
  const parts = html.split(/\n\n+/);
  const paragraphs = parts.map(part => {
    part = part.trim();
    if (!part) return '';
    // 如果段落只包含图片，直接返回
    if (part.startsWith('<figure')) return part;
    // 否则包装在 <p> 标签中
    return `<p>${part}</p>`;
  }).filter(p => p).join('');
  
  return paragraphs || '<p></p>';
}


