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
  
  // 检查是否需要处理从地图跳转过来的情况
  const params = new URLSearchParams(location.search);
  const highlightFile = params.get('highlight');
  const imageUrl = params.get('imageUrl');
  
  if (highlightFile || imageUrl) {
    // 等待图片加载完成
    const images = Array.from(document.querySelectorAll('.gallery .card img'));
    let loadedCount = 0;
    const totalImages = images.length;
    
    if (totalImages === 0) {
      // 如果没有图片，直接尝试匹配
      handleMapHighlight(highlightFile, imageUrl);
    } else {
      // 等待所有图片加载完成
      images.forEach(img => {
        if (img.complete) {
          loadedCount++;
        } else {
          img.addEventListener('load', () => {
            loadedCount++;
            if (loadedCount === totalImages) {
              handleMapHighlight(highlightFile, imageUrl);
            }
          });
          img.addEventListener('error', () => {
            loadedCount++;
            if (loadedCount === totalImages) {
              handleMapHighlight(highlightFile, imageUrl);
            }
          });
        }
      });
      
      // 如果所有图片已经加载完成
      if (loadedCount === totalImages) {
        handleMapHighlight(highlightFile, imageUrl);
      }
    }
  }
  
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

// 处理从地图跳转过来的高亮和打开灯箱
function handleMapHighlight(highlightFile, imageUrl) {
  setTimeout(() => {
    // 确保灯箱已初始化
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll('.gallery .card'));
      initLightboxIfPresent();
    }
    
    let targetCard = null;
    
    // 优先使用完整URL匹配
    if (imageUrl) {
      const decodedUrl = decodeURIComponent(imageUrl);
      targetCard = cards.find(card => {
        const img = card.querySelector('img');
        if (!img) return false;
        // 比较完整URL（忽略协议和参数）
        const cardUrl = img.src.split('?')[0];
        const targetUrl = decodedUrl.split('?')[0];
        return cardUrl === targetUrl || cardUrl.includes(targetUrl.split('/').pop());
      });
    }
    
    // 如果URL匹配失败，尝试文件名匹配
    if (!targetCard && highlightFile) {
      const decodedFile = decodeURIComponent(highlightFile);
      targetCard = cards.find(card => {
        const img = card.querySelector('img');
        if (!img) return false;
        // 匹配文件名或alt文本
        const imgFileName = img.src.split('/').pop().split('?')[0];
        return imgFileName.includes(decodedFile) || 
               decodedFile.includes(imgFileName) ||
               (img.alt && img.alt.includes(decodedFile));
      });
    }
    
    if (targetCard) {
      // 滚动到目标卡片
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 高亮显示
      targetCard.style.outline = '2px solid var(--primary)';
      targetCard.style.outlineOffset = '4px';
      
      // 等待滚动完成后再打开灯箱
      setTimeout(() => {
        // 确保灯箱已初始化
        initLightboxIfPresent();
        // 触发点击打开灯箱
        targetCard.click();
        // 清除URL参数
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }, 800);
    }
  }, 100);
}
tryRenderStoriesFromJSON();

// 初始化地图（仅在map.html页面）
if (document.getElementById('photoMap') && typeof L !== 'undefined') {
  initPhotoMap();
}

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

// 地图功能
let photoMap = null;
let galleryItems = [];

// 解析坐标：支持 "N33° 4' 34.747\" E101° 8' 54.247\"" 格式
function parseCoordinates(locationStr) {
  if (!locationStr) return null;
  
  // 尝试解析度分秒格式：N33° 4' 34.747" E101° 8' 54.247"
  const dmsMatch = locationStr.match(/N([\d.]+)°\s*([\d.]+)'\s*([\d.]+)"\s*E([\d.]+)°\s*([\d.]+)'\s*([\d.]+)"/);
  if (dmsMatch) {
    const lat = parseFloat(dmsMatch[1]) + parseFloat(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600;
    const lng = parseFloat(dmsMatch[4]) + parseFloat(dmsMatch[5]) / 60 + parseFloat(dmsMatch[6]) / 3600;
    return [lat, lng];
  }
  
  // 尝试解析简单坐标格式：lat, lng 或 [lat, lng]
  const coordMatch = locationStr.match(/([\d.]+)[,\s]+([\d.]+)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }
  
  return null;
}

// 地理编码缓存（使用localStorage）
const GEOCODE_CACHE_KEY = 'lindu_geocode_cache';
let geocodeCache = {};

// 加载缓存
try {
  const cached = localStorage.getItem(GEOCODE_CACHE_KEY);
  if (cached) {
    geocodeCache = JSON.parse(cached);
  }
} catch (e) {
  console.warn('Failed to load geocode cache:', e);
}

// 保存缓存
function saveGeocodeCache() {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(geocodeCache));
  } catch (e) {
    console.warn('Failed to save geocode cache:', e);
  }
}

// 地理编码队列，用于控制API调用频率
let geocodeQueue = [];
let geocodeProcessing = false;

// 使用Nominatim API将地名转换为坐标
async function geocodeLocation(locationStr) {
  if (!locationStr) return null;
  
  // 先尝试解析坐标
  const coords = parseCoordinates(locationStr);
  if (coords) return coords;
  
  // 提取地名（去除坐标部分）
  const placeName = locationStr.replace(/N[\d.]+°[\s\d.'"]+E[\d.]+°[\s\d.'"]+/g, '').trim();
  if (!placeName) return null;
  
  // 检查缓存
  if (geocodeCache[placeName]) {
    const cached = geocodeCache[placeName];
    // 检查缓存是否过期（30天）
    if (Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
      return cached.coords;
    }
  }
  
  // 使用队列处理地理编码请求，避免过快调用API
  return new Promise((resolve) => {
    geocodeQueue.push({ placeName, resolve });
    processGeocodeQueue();
  });
}

// 处理地理编码队列（每500ms最多1个请求，更快但仍遵守API限制）
async function processGeocodeQueue() {
  if (geocodeProcessing || geocodeQueue.length === 0) return;
  
  geocodeProcessing = true;
  const { placeName, resolve } = geocodeQueue.shift();
  
  try {
    // 再次检查缓存（可能在队列等待期间被其他请求缓存）
    if (geocodeCache[placeName]) {
      const cached = geocodeCache[placeName];
      if (Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
        resolve(cached.coords);
        geocodeProcessing = false;
        if (geocodeQueue.length > 0) {
          setTimeout(processGeocodeQueue, 100);
        }
        return;
      }
    }
    
    // 延迟500ms以避免API限制（比1秒快但仍遵守限制）
    await new Promise(r => setTimeout(r, 500));
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=1`,
      {
        headers: {
          'User-Agent': 'LinduGallery/1.0'
        }
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      // 缓存结果
      geocodeCache[placeName] = {
        coords: coords,
        timestamp: Date.now()
      };
      saveGeocodeCache();
      resolve(coords);
    } else {
      resolve(null);
    }
  } catch (error) {
    console.warn('Geocoding failed:', error);
    resolve(null);
  } finally {
    geocodeProcessing = false;
    // 继续处理队列
    if (geocodeQueue.length > 0) {
      setTimeout(processGeocodeQueue, 500);
    }
  }
}

// 计算两点之间的距离（公里）
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 初始化地图
async function initPhotoMap() {
  const mapContainer = document.getElementById('photoMap');
  if (!mapContainer || typeof L === 'undefined') return;
  
  // 获取画廊数据
  try {
    const res = await fetch('./data/gallery.json');
    if (!res.ok) return;
    galleryItems = await res.json();
    if (!Array.isArray(galleryItems) || galleryItems.length === 0) return;
  } catch (_) {
    return;
  }
  
  // 初始化地图（默认中心点：中国）
  photoMap = L.map('photoMap', {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([35.0, 105.0], 4);
  
  // 添加深色主题的瓦片图层
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(photoMap);
  
  // 处理所有图片的位置（先显示已有坐标的，然后异步加载需要地理编码的）
  const locationGroups = new Map(); // key: "lat,lng", value: {coords, items, locationName}
  const itemsNeedingGeocode = [];
  
  // 第一遍：快速处理已有坐标的（同步解析，不调用API）
  for (const item of galleryItems) {
    if (!item.location) continue;
    
    // 先尝试快速解析坐标（不调用API）
    let coords = parseCoordinates(item.location);
    
    // 如果解析失败，检查缓存（同步）
    if (!coords) {
      const placeName = item.location.replace(/N[\d.]+°[\s\d.'"]+E[\d.]+°[\s\d.'"]+/g, '').trim();
      if (placeName && geocodeCache[placeName]) {
        const cached = geocodeCache[placeName];
        if (Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
          coords = cached.coords;
        }
      }
    }
    
    if (coords) {
      const key = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
      if (!locationGroups.has(key)) {
        locationGroups.set(key, {
          coords: coords,
          items: [],
          locationName: item.location.replace(/N[\d.]+°[\s\d.'"]+E[\d.]+°[\s\d.'"]+/g, '').trim() || item.location
        });
      }
      locationGroups.get(key).items.push(item);
    } else {
      // 需要地理编码的，加入队列
      itemsNeedingGeocode.push(item);
    }
  }
  
  // 立即显示已有坐标的标记
  addMarkersToMap(locationGroups);
  
  // 如果有已显示的标记，先调整地图视图
  if (locationGroups.size > 0) {
    const bounds = Array.from(locationGroups.values()).map(g => g.coords);
    photoMap.fitBounds(bounds, { padding: [50, 50] });
  }
  
  // 异步处理需要地理编码的（不阻塞初始显示）
  if (itemsNeedingGeocode.length > 0) {
    // 批量处理，每完成一个就立即显示
    for (const item of itemsNeedingGeocode) {
      const coords = await geocodeLocation(item.location);
      if (coords) {
        const key = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
        if (!locationGroups.has(key)) {
          locationGroups.set(key, {
            coords: coords,
            items: [],
            locationName: item.location.replace(/N[\d.]+°[\s\d.'"]+E[\d.]+°[\s\d.'"]+/g, '').trim() || item.location
          });
          // 立即添加新标记
          addMarkersToMap(new Map([[key, locationGroups.get(key)]]));
        } else {
          locationGroups.get(key).items.push(item);
          // 更新已有标记的弹出窗口
          updateMarkerPopup(key, locationGroups.get(key));
        }
      }
    }
    
    // 最后重新调整视图以包含所有标记
    if (locationGroups.size > 0) {
      const bounds = Array.from(locationGroups.values()).map(g => g.coords);
      photoMap.fitBounds(bounds, { padding: [50, 50] });
    }
  }
}

// 添加标记到地图
function addMarkersToMap(locationGroups) {
  locationGroups.forEach((group, key) => {
    const { coords, items, locationName } = group;
    
    // 检查标记是否已存在
    if (group.marker) return;
    
    // 创建自定义图标
    const icon = L.divIcon({
      className: 'photo-marker',
      html: `<div style="background: #7cc4ff; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #0b0c0d; box-shadow: 0 0 0 2px rgba(124,196,255,0.5);"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    
    // 创建标记
    const marker = L.marker(coords, { icon: icon }).addTo(photoMap);
    group.marker = marker;
    
    // 创建弹出窗口内容
    const popupContent = createMapPopupContent(locationName, items, coords);
    const popup = L.popup({
      maxWidth: 400,
      className: 'photo-map-popup'
    }).setContent(popupContent);
    
    marker.bindPopup(popup);
    
    // 绑定弹出窗口打开后的事件
    marker.on('popupopen', function() {
      const popupEl = this.getPopup().getElement();
      if (!popupEl) return;
      
      // 绑定图片点击事件
      const photoElements = popupEl.querySelectorAll('.map-popup-photo');
      photoElements.forEach(photoEl => {
        photoEl.addEventListener('click', function() {
          const src = this.dataset.src;
          if (!src) return;
          
          // 如果在gallery页面，尝试找到对应的卡片并触发点击（打开灯箱）
          const cards = Array.from(document.querySelectorAll('.gallery .card'));
          if (cards.length > 0) {
            const targetCard = cards.find(card => {
              const img = card.querySelector('img');
              return img && (img.src === src || img.src.includes(src.split('/').pop()));
            });
            
            if (targetCard) {
              targetCard.click();
              // 关闭弹出窗口
              marker.closePopup();
              return;
            }
          }
          
          // 如果不在gallery页面或找不到卡片，跳转到gallery页面并尝试定位到该图片
          // 通过URL参数传递图片的完整URL或文件名
          const fileName = src.split('/').pop();
          // 使用完整URL的base64编码，或者使用文件名
          const imageUrl = encodeURIComponent(src);
          window.location.href = `./gallery.html?highlight=${encodeURIComponent(fileName)}&imageUrl=${imageUrl}`;
        });
      });
    });
  });
}

// 更新已有标记的弹出窗口内容
function updateMarkerPopup(key, group) {
  if (!group.marker) return;
  const { coords, items, locationName } = group;
  const popupContent = createMapPopupContent(locationName, items, coords);
  group.marker.setPopupContent(popupContent);
}

// 创建地图弹出窗口内容
function createMapPopupContent(locationName, items, centerCoords) {
  // 按距离排序（最近的在前）
  const sortedItems = items.map(item => {
    const itemCoords = parseCoordinates(item.location);
    let distance = 0;
    if (itemCoords) {
      distance = getDistance(centerCoords[0], centerCoords[1], itemCoords[0], itemCoords[1]);
    }
    return { ...item, distance };
  }).sort((a, b) => a.distance - b.distance);
  
  const photosHtml = sortedItems.slice(0, 9).map((item, idx) => {
    return `
      <div class="map-popup-photo" data-index="${idx}" data-src="${escapeAttr(item.src)}">
        <img src="${escapeAttr(item.src)}" alt="${escapeHtml(item.alt || '')}" loading="lazy" />
        ${sortedItems.length > 9 && idx === 8 ? `<div class="map-popup-photo-count">+${sortedItems.length - 9}</div>` : ''}
      </div>
    `;
  }).join('');
  
  return `
    <div class="map-popup-content">
      <div class="map-popup-title">📍 ${escapeHtml(locationName)}</div>
      <div style="color: var(--muted); font-size: 12px; margin-bottom: 8px;">${sortedItems.length} 张照片</div>
      <div class="map-popup-photos">${photosHtml}</div>
    </div>
  `;
}



