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
let currentFilter = 'all';

function applyFilter(category) {
  currentFilter = category;

  // 若数据尚未加载完成，退回 DOM 隐藏逻辑以保证基本可用
  if (!allGalleryItems.length) {
    cards.forEach((card) => {
      const match = category === 'all' || card.dataset.category === category;
      card.style.display = match ? '' : 'none';
    });
    requestAnimationFrame(() => {
      layoutMasonry();
    });
    return;
  }

  const galleryEl = document.getElementById('gallery');
  if (!galleryEl) return;

  const filteredItems = category === 'all'
    ? allGalleryItems
    : allGalleryItems.filter((item) => item.category === category);

  activeGalleryItems = filteredItems;
  currentRenderedCount = 0;
  isLoadingMore = false;

  window.removeEventListener('scroll', handleScroll);

  const initialCount = category === 'all'
    ? Math.min(INITIAL_LOAD_COUNT, filteredItems.length)
    : filteredItems.length;

  renderGalleryItems(filteredItems, 0, initialCount);
  currentRenderedCount = initialCount;

  if (category === 'all' && currentRenderedCount < filteredItems.length) {
    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  if (!filteredItems.length) {
    galleryEl.innerHTML = '<div class="gallery-empty" style="padding:24px 0;color:var(--muted);text-align:center;">当前分类暂无作品。</div>';
    galleryEl.style.height = 'auto';
  }
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

// 全局变量：存储所有图片数据和当前状态
let allGalleryItems = [];
let activeGalleryItems = [];
let currentRenderedCount = 0;
let isLoadingMore = false;
const INITIAL_LOAD_COUNT = 30; // 初始加载数量
const LOAD_MORE_COUNT = 20; // 每次加载更多时的数量

// 渲染指定范围的图片
function renderGalleryItems(items, startIndex, endIndex) {
  const galleryEl = document.getElementById('gallery');
  if (!galleryEl) return;
  
  const itemsToRender = items.slice(startIndex, endIndex);
  const html = itemsToRender.map(renderCard).join('');
  
  if (startIndex === 0) {
    // 首次渲染，替换所有内容
    galleryEl.innerHTML = html;
  } else {
    // 追加渲染
    galleryEl.insertAdjacentHTML('beforeend', html);
  }
  
  // 更新卡片列表
  cards = Array.from(document.querySelectorAll('.gallery .card'));
  
  // 重新绑定筛选和灯箱事件
  filterButtons = Array.from(document.querySelectorAll('.filters .chip'));
  bindFilters();
  initLightboxIfPresent();
  
  // 更新瀑布流布局
  requestAnimationFrame(() => {
    layoutMasonry();
  });
}

// 加载更多图片
function loadMoreItems() {
  if (isLoadingMore) return;
  if (currentFilter !== 'all') return;
  if (currentRenderedCount >= activeGalleryItems.length) return;
  
  isLoadingMore = true;
  const nextCount = Math.min(currentRenderedCount + LOAD_MORE_COUNT, activeGalleryItems.length);
  
  // 渲染新图片
  renderGalleryItems(activeGalleryItems, currentRenderedCount, nextCount);
  currentRenderedCount = nextCount;
  
  isLoadingMore = false;
  
  // 如果已经加载完所有图片，移除滚动监听
  if (currentRenderedCount >= activeGalleryItems.length) {
    window.removeEventListener('scroll', handleScroll);
  }
}

// 滚动事件处理
let scrollTimer = null;
function handleScroll() {
  if (scrollTimer) return;
  
  scrollTimer = setTimeout(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // 当滚动到距离底部200px时，加载更多
    if (scrollTop + windowHeight >= documentHeight - 200) {
      loadMoreItems();
    }
    
    scrollTimer = null;
  }, 100);
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
    
    // 存储所有图片数据
    allGalleryItems = items;
    activeGalleryItems = items;
    currentRenderedCount = 0;
    
    // 调试：检查EXIF数据
    if (items.length > 0 && items[0].exif) {
      console.log('Sample EXIF data:', items[0].exif);
    }
    
    // 初始只渲染一部分
    const initialCount = Math.min(INITIAL_LOAD_COUNT, items.length);
    renderGalleryItems(activeGalleryItems, 0, initialCount);
    currentRenderedCount = initialCount;
    
    // 如果还有更多图片，添加滚动监听
    if (currentRenderedCount < items.length) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    return true;
  } catch (_) {
    return false;
  }
}

// 生成压缩图片URL（用于列表显示）
function getThumbnailUrl(originalUrl, width = 800) {
  if (!originalUrl) return '';
  
  // 先移除所有现有的尺寸参数
  let cleanUrl = originalUrl.replace(/[?&]w=\d+/g, '');
  // 清理末尾的 ? 或 &
  cleanUrl = cleanUrl.replace(/[?&]$/, '');
  
  // 添加新的尺寸参数
  const separator = cleanUrl.includes('?') ? '&' : '?';
  return cleanUrl + separator + `w=${width}`;
}

// 获取原图URL（用于灯箱显示）
function getOriginalUrl(url) {
  if (!url) return '';
  
  // 移除所有尺寸参数，返回原图
  return url.replace(/[?&]w=\d+/g, '').replace(/[?&]$/, '');
}

// 获取相机品牌logo图片路径
function getCameraBrandLogo(cameraName) {
  if (!cameraName) return null;
  
  const name = String(cameraName).toLowerCase().trim();
  
  // 品牌识别（按优先级）
  let brand = null;
  
  // 特殊处理：Hasselblad L2D-20c 和 L3D-100C 是大疆产品
  if (name.includes('l2d-20c') || name.includes('l3d-100c')) {
    brand = 'dji';
  }
  // DJI 产品识别（优先于 Hasselblad）
  else if (name.includes('dji')) {
    brand = 'dji';
  }
  else if (name.includes('nikon')) brand = 'nikon';
  else if (name.includes('canon')) brand = 'canon';
  else if (name.includes('sony')) brand = 'sony';
  else if (name.includes('fujifilm') || name.includes('fuji')) brand = 'fujifilm';
  else if (name.includes('hasselblad')) brand = 'hasselblad';
  else if (name.includes('leica')) brand = 'leica';
  else if (name.includes('panasonic') || name.includes('lumix')) brand = 'panasonic';
  else if (name.includes('olympus') || name.includes('om-')) brand = 'olympus';
  else if (name.includes('pentax')) brand = 'pentax';
  
  if (brand) {
    // 返回logo图片路径（SVG格式）
    const logoPath = `./assets/brands/${brand}.svg`;
    return logoPath;
  }
  
  return null;
}

// 生成相机品牌logo HTML
function renderCameraBrandLogo(cameraName) {
  const logoPath = getCameraBrandLogo(cameraName);
  if (logoPath) {
    const brandName = String(cameraName).split(' ')[0];
    return `<img src="${escapeAttr(logoPath)}" alt="${escapeHtml(brandName)}" class="camera-brand-logo" onerror="this.style.display='none';" />`;
  }
  return '';
}

function renderCard(it) {
  const exif = it.exif || {};
  
  // 生成压缩图URL（用于列表显示）
  const thumbnailUrl = getThumbnailUrl(it.src, 800);
  // 原图URL（用于灯箱）
  const originalUrl = it.originalSrc || getOriginalUrl(it.src);
  
  // 数据属性，供灯箱读取
  const dataAttrs = [
    ['category', it.category],
    ['location', it.location],
    ['camera', exif.camera],
    ['lens', exif.lens],
    ['focal', exif.focal],
    ['aperture', exif.f || exif.aperture], // 优先使用 f，如果没有则使用 aperture
    ['shutter', exif.shutter],
    ['iso', exif.iso],
    ['date', exif.date || exif.datetime || it.date], // 拍摄时间
    ['original-src', originalUrl] // 存储原图URL
  ].filter(([,v]) => v !== undefined && v !== null && v !== '').map(([k,v]) => `data-${k}="${String(v).replace(/"/g,'&quot;')}"`).join(' ');
  
  // 获取图片名称（优先使用alt，如果没有则使用caption）
  const imageName = it.alt || it.caption || '';
  
  return `
    <figure class="card" ${dataAttrs} style="position: absolute; opacity: 0;">
      <div class="card-image">
        <img loading="lazy" src="${escapeAttr(thumbnailUrl)}" alt="${escapeHtml(it.alt || '')}" onload="this.closest('.card').style.opacity='1'; if(window.updateMasonryLayout) window.updateMasonryLayout(this.closest('.card'));" />
      </div>
      <div class="card-info">
        ${imageName ? `<div class="card-location">${escapeHtml(imageName)}</div>` : ''}
      </div>
    </figure>
  `;
}

// 瀑布流布局函数（支持增量更新）
function layoutMasonry(specificCard = null) {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;
  
  const allCards = Array.from(gallery.querySelectorAll('.card'));
  if (allCards.length === 0) return;

  const visibleCards = allCards.filter(card => card.style.display !== 'none');
  if (!visibleCards.length) {
    gallery.style.height = '0px';
    return;
  }
  
  // 获取容器宽度和卡片宽度
  const containerWidth = gallery.offsetWidth;
  const cardWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-width') || '320');
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--masonry-gap') || '24');
  
  // 计算列数
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));
  
  // 如果指定了特定卡片，只更新该卡片及其后的卡片
  let cardsToLayout = visibleCards;
  if (specificCard) {
    if (specificCard.style.display === 'none') {
      specificCard = null;
    }
  }
  if (specificCard) {
    const cardIndex = visibleCards.indexOf(specificCard);
    if (cardIndex >= 0) {
      // 从该卡片开始重新布局
      cardsToLayout = visibleCards.slice(cardIndex);
      // 需要重新计算该卡片之前所有卡片的位置，以获取正确的列高度
      const beforeCards = visibleCards.slice(0, cardIndex);
      const columnHeights = new Array(columns).fill(0);
      
      beforeCards.forEach((card) => {
        const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
        card.style.left = `${shortestColumnIndex * (cardWidth + gap)}px`;
        card.style.top = `${columnHeights[shortestColumnIndex]}px`;
        card.style.width = `${cardWidth}px`;
        const cardHeight = card.offsetHeight || 400; // 使用实际高度或估算高度
        columnHeights[shortestColumnIndex] += cardHeight + gap;
      });
      
      // 继续布局后续卡片
      cardsToLayout.forEach((card) => {
        const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
        card.style.left = `${shortestColumnIndex * (cardWidth + gap)}px`;
        card.style.top = `${columnHeights[shortestColumnIndex]}px`;
        card.style.width = `${cardWidth}px`;
        const cardHeight = card.offsetHeight || 400;
        columnHeights[shortestColumnIndex] += cardHeight + gap;
      });
      
      const maxHeight = Math.max(...columnHeights);
      gallery.style.height = `${maxHeight}px`;
      return;
    }
  }
  
  // 完整布局
  const columnHeights = new Array(columns).fill(0);
  
  cardsToLayout.forEach((card) => {
    const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
    card.style.left = `${shortestColumnIndex * (cardWidth + gap)}px`;
    card.style.top = `${columnHeights[shortestColumnIndex]}px`;
    card.style.width = `${cardWidth}px`;
    // 使用实际高度，如果还没有加载则使用估算高度（基于宽高比）
    let cardHeight = card.offsetHeight;
    if (!cardHeight || cardHeight < 100) {
      // 估算高度：假设图片宽高比约为 3:4，加上卡片信息区域高度
      const img = card.querySelector('img');
      if (img && img.naturalWidth && img.naturalHeight) {
        const aspectRatio = img.naturalHeight / img.naturalWidth;
        cardHeight = cardWidth * aspectRatio + 80; // 80px 为卡片信息区域估算高度
      } else {
        cardHeight = 400; // 默认估算高度
      }
    }
    columnHeights[shortestColumnIndex] += cardHeight + gap;
  });
  
  const maxHeight = Math.max(...columnHeights);
  gallery.style.height = `${maxHeight}px`;
}

// 全局函数，供图片 onload 事件调用
window.updateMasonryLayout = function(card) {
  if (card && card.classList.contains('card')) {
    // 使用 requestAnimationFrame 优化性能
    requestAnimationFrame(() => {
      layoutMasonry(card);
    });
  }
};

// 等待所有图片加载完成后重新布局
function layoutMasonryAfterImagesLoad() {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;
  
  const cards = Array.from(gallery.querySelectorAll('.card'));
  const images = cards.map(card => card.querySelector('img')).filter(img => img);
  
  let loadedCount = 0;
  const totalImages = images.length;
  
  if (totalImages === 0) {
    layoutMasonry();
    return;
  }
  
  const checkAndLayout = () => {
    loadedCount++;
    if (loadedCount === totalImages) {
      // 所有图片加载完成，重新布局
      setTimeout(() => {
        layoutMasonry();
      }, 50);
    }
  };
  
  images.forEach(img => {
    if (img.complete) {
      checkAndLayout();
    } else {
      img.addEventListener('load', checkAndLayout, { once: true });
      img.addEventListener('error', checkAndLayout, { once: true });
    }
  });
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
        originalSrc: src, // 保存原图URL
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
    
    // 存储所有图片数据
    allGalleryItems = items;
    activeGalleryItems = items;
    currentRenderedCount = 0;
    
    // 初始只渲染一部分
    const initialCount = Math.min(INITIAL_LOAD_COUNT, items.length);
    renderGalleryItems(activeGalleryItems, 0, initialCount);
    currentRenderedCount = initialCount;
    
    // 如果还有更多图片，添加滚动监听
    if (currentRenderedCount < items.length) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
    
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
  
  // 监听窗口大小变化
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      layoutMasonry();
    }, 250);
  });
  
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
function initMapWhenReady() {
  const mapContainer = document.getElementById('photoMap');
  if (!mapContainer) {
    // 不在地图页面，直接返回
    return;
  }
  
  // 确保容器有高度
  if (mapContainer.offsetHeight === 0) {
    console.warn('Map container has no height, waiting...');
    setTimeout(initMapWhenReady, 200);
    return;
  }
  
  // 检查 Leaflet 是否已加载
  if (typeof L !== 'undefined' && L.map) {
    console.log('Initializing map...');
    initPhotoMap();
  } else {
    // 如果还没加载，等待一下再试（最多等待5秒）
    let attempts = 0;
    const maxAttempts = 50;
    const checkInterval = setInterval(() => {
      attempts++;
      if (typeof L !== 'undefined' && L.map) {
        clearInterval(checkInterval);
        console.log('Leaflet.js loaded, initializing map...');
        initPhotoMap();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.error('Leaflet.js failed to load after 5 seconds');
        // 显示错误提示
        const mapContainer = document.getElementById('photoMap');
        if (mapContainer) {
          mapContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">地图加载失败，请刷新页面重试。</div>';
        }
      }
    }, 100);
  }
}

// 等待页面和脚本都加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // 再等待一下确保 Leaflet 已加载
    setTimeout(initMapWhenReady, 200);
  });
} else {
  // 如果文档已加载，等待一下确保 Leaflet 已加载
  setTimeout(initMapWhenReady, 200);
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
    
    // 使用原图URL（从data属性获取，如果没有则使用原始src）
    const originalSrc = fig.dataset.originalSrc || getOriginalUrl(img.src);
    // 移除所有尺寸限制，显示原图
    lightboxImg.src = getOriginalUrl(originalSrc);
    
    // 渲染灯箱信息（表格格式）
    if (lightboxInfo) {
      const ds = fig.dataset;
      const img = fig.querySelector('img');
      const imageTitle = img ? img.alt || '' : '';
      
      // 解析地点信息
      let locationText = '';
      let locationCoords = null;
      if (ds.location) {
        locationText = String(ds.location).trim().replace(/N[\d.]+°[\s\d.'"]+E[\d.]+°[\s\d.'"]+/g, '').trim();
        locationCoords = parseCoordinates(ds.location);
        // 如果解析失败，尝试从缓存获取
        if (!locationCoords && locationText) {
          if (geocodeCache[locationText]) {
            const cached = geocodeCache[locationText];
            if (Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
              locationCoords = cached.coords;
            }
          }
        }
        // 如果仍然没有坐标，异步尝试地理编码
        if (!locationCoords && locationText) {
          geocodeLocation(ds.location).then(coords => {
            if (coords) {
              // 等待DOM更新完成后再初始化地图
              setTimeout(() => {
                const mapContainer = document.getElementById('lightboxMap');
                if (mapContainer) {
                  // 如果地图已存在，先清理
                  if (lightboxMap) {
                    try {
                      lightboxMap.remove();
                    } catch (e) {
                      console.warn('Error removing old lightbox map:', e);
                    }
                    lightboxMap = null;
                  }
                  initLightboxMap(coords);
                }
              }, 200);
            }
          });
        }
      }
      
      // 格式化日期（按照图片格式：7/13 17:53 (GMT+09:00)）
      let dateText = '';
      if (ds.date) {
        const dateStr = String(ds.date).trim();
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            // 格式：M/d HH:mm (GMT+09:00)
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            // 获取时区偏移
            const timezoneOffset = -date.getTimezoneOffset() / 60;
            const timezoneSign = timezoneOffset >= 0 ? '+' : '';
            const timezoneStr = `GMT${timezoneSign}${String(timezoneOffset).padStart(2, '0')}:00`;
            dateText = `${month}/${day} ${hours}:${minutes} (${timezoneStr})`;
          } else {
            dateText = dateStr;
          }
        } catch (e) {
          dateText = dateStr;
        }
      }
      
      // 构建信息HTML（按照图片布局）
      let infoHTML = '';
      
      // 顶部：日期时间（右侧对齐）
      if (dateText) {
        infoHTML += `
          <div class="lightbox-date">
            ${escapeHtml(dateText)}
          </div>
        `;
      }
      
      // 位置信息（如果有）
      if (locationText) {
        infoHTML += `
          <div class="lightbox-location">
            ${escapeHtml(locationText)}
          </div>
        `;
      }
      
      // 相机和镜头
      if (ds.camera || ds.lens) {
        infoHTML += `<div class="lightbox-camera-lens">`;
        if (ds.camera) {
          const cameraName = String(ds.camera).trim();
          const logoHtml = renderCameraBrandLogo(cameraName);
          infoHTML += `<div class="lightbox-camera">${logoHtml}${escapeHtml(cameraName)}</div>`;
        }
        if (ds.lens) {
          infoHTML += `<div class="lightbox-lens">${escapeHtml(String(ds.lens).trim())}</div>`;
        }
        infoHTML += `</div>`;
      }
      
      // 曝光设置（ISO | f/5.6 | 1/100 s | 70 mm）
      const exposure = [];
      if (ds.iso) {
        exposure.push(`ISO ${escapeHtml(String(ds.iso).trim())}`);
      }
      if (ds.aperture) {
        const aperture = String(ds.aperture).trim();
        if (aperture.startsWith('f/')) {
          exposure.push(escapeHtml(aperture));
        } else {
          exposure.push(`f/${escapeHtml(aperture)}`);
        }
      }
      if (ds.shutter) {
        exposure.push(escapeHtml(String(ds.shutter).trim()));
      }
      if (ds.focal) {
        exposure.push(escapeHtml(String(ds.focal).trim()));
      }
      
      if (exposure.length > 0) {
        infoHTML += `
          <div class="lightbox-exposure">
            ${exposure.join(' | ')}
          </div>
        `;
      }
      
      // 添加地图区域（如果有位置信息，即使坐标还未获取）
      if (locationText) {
        infoHTML += `
          <div class="lightbox-map-container">
            <div id="lightboxMap" class="lightbox-map"></div>
          </div>
        `;
      }
      
      // 在更新内容之前，先清理旧的地图实例（因为innerHTML会删除容器）
      if (lightboxMap) {
        try {
          lightboxMap.remove();
        } catch (e) {
          console.warn('Error removing old lightbox map:', e);
        }
        lightboxMap = null;
      }
      
      lightboxInfo.innerHTML = infoHTML || '<div class="lightbox-info-empty">无信息</div>';
      
      // 初始化地图（如果有坐标）
      if (locationCoords) {
        // 等待DOM更新后再初始化地图
        setTimeout(() => {
          initLightboxMap(locationCoords);
        }, 150);
      } else if (locationText) {
        // 如果没有坐标但有位置文本，地图容器已创建，等待异步地理编码完成
        // 地理编码会在上面的代码中完成并更新地图
        // 但需要确保地图容器存在后再初始化
        setTimeout(() => {
          const mapContainer = document.getElementById('lightboxMap');
          if (mapContainer && !lightboxMap) {
            // 地图容器已创建，等待地理编码完成
            // 地理编码会在上面的代码中调用initLightboxMap
          }
        }, 150);
      }
    }
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // 清理地图
    if (lightboxMap) {
      lightboxMap.remove();
      lightboxMap = null;
    }
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
// 灯箱地图实例
let lightboxMap = null;

// 初始化灯箱中的地图（使用坐标）
async function initLightboxMap(coords) {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) {
    console.warn('Invalid coordinates for lightbox map:', coords);
    return;
  }
  
  const lightboxMapContainer = document.getElementById('lightboxMap');
  if (!lightboxMapContainer) {
    console.warn('Lightbox map container not found');
    return;
  }
  
  // 检查容器是否有尺寸
  if (lightboxMapContainer.offsetWidth === 0 || lightboxMapContainer.offsetHeight === 0) {
    console.warn('Lightbox map container has no size, retrying...');
    setTimeout(() => initLightboxMap(coords), 200);
    return;
  }
  
  // 检查 Leaflet 是否已加载
  if (typeof L === 'undefined' || !L.map) {
    console.warn('Leaflet.js not loaded, cannot show map in lightbox');
    return;
  }
  
  // 如果地图已存在，更新位置
  if (lightboxMap) {
    try {
      lightboxMap.setView(coords, 13);
      // 清除旧标记
      lightboxMap.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          lightboxMap.removeLayer(layer);
        }
      });
    } catch (e) {
      console.error('Error updating lightbox map:', e);
      // 如果更新失败，重新创建地图
      lightboxMap.remove();
      lightboxMap = null;
    }
  }
  
  // 如果地图不存在或已被移除，创建新地图
  if (!lightboxMap) {
    try {
      // 创建新地图
      lightboxMap = L.map(lightboxMapContainer, {
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false
      }).setView(coords, 13);
      
      // 检测用户位置并选择合适的地图服务
      const mapProvider = await detectUserLocation();
      const tileLayer = addMapTileLayer(mapProvider);
      tileLayer.addTo(lightboxMap);
      
      // 监听tile错误，如果主要服务失败则使用备用服务
      let errorCount = 0;
      tileLayer.on('tileerror', function() {
        errorCount++;
        if (errorCount >= 3) {
          console.warn('Primary map service failed, trying alternative...');
          let altProvider = 'googleSatellite';
          if (mapProvider === 'google') {
            // 如果 Google Maps 失败，尝试 Google Maps 卫星图
            altProvider = 'googleSatellite';
          } else if (mapProvider === 'googleSatellite') {
            // 如果 Google Maps 卫星图失败，尝试 Google Maps 混合图
            altProvider = 'googleHybrid';
          }
          const altLayer = addMapTileLayer(altProvider);
          altLayer.addTo(lightboxMap);
          lightboxMap.removeLayer(tileLayer);
        }
      });
      
      // 确保地图正确渲染（延迟以确保容器已显示）
      setTimeout(() => {
        if (lightboxMap) {
          lightboxMap.invalidateSize();
          // 再次设置视图以确保正确显示
          lightboxMap.setView(coords, 13);
        }
      }, 300);
    } catch (e) {
      console.error('Error creating lightbox map:', e);
      return;
    }
  }
  
  // 添加标记
  const icon = L.divIcon({
    className: 'photo-marker',
    html: `<div style="background: #7cc4ff; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #0b0c0d; box-shadow: 0 0 0 2px rgba(124,196,255,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
  
  // 清除旧标记并添加新标记
  if (lightboxMap) {
    lightboxMap.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        lightboxMap.removeLayer(layer);
      }
    });
    // 添加新标记
    try {
      L.marker(coords, { icon: icon }).addTo(lightboxMap);
    } catch (e) {
      console.error('Error adding marker to lightbox map:', e);
    }
  }
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

// 地图服务配置
const mapTileProviders = {
  // Google Maps（默认）
  google: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '© <a href="https://www.google.com/maps">Google Maps</a>',
    subdomains: '0123',
    maxZoom: 20
  },
  // Google Maps 卫星图（备用）
  googleSatellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '© <a href="https://www.google.com/maps">Google Maps</a>',
    subdomains: '0123',
    maxZoom: 20
  },
  // Google Maps 混合图（备用）
  googleHybrid: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '© <a href="https://www.google.com/maps">Google Maps</a>',
    subdomains: '0123',
    maxZoom: 20
  }
};

// 检测用户地理位置并选择合适的地图服务
async function detectUserLocation() {
  // 统一使用 Google Maps
  return 'google';
}

// 添加地图图层
function addMapTileLayer(providerKey) {
  const provider = mapTileProviders[providerKey] || mapTileProviders.google;
  
  // 统一处理所有地图服务
  return L.tileLayer(provider.url, {
    attribution: provider.attribution,
    subdomains: provider.subdomains || '',
    maxZoom: provider.maxZoom
  });
}

// 初始化地图
async function initPhotoMap() {
  const mapContainer = document.getElementById('photoMap');
  if (!mapContainer) {
    console.warn('Map container not found');
    return;
  }
  
  if (typeof L === 'undefined' || !L.map) {
    console.error('Leaflet.js is not loaded');
    return;
  }
  
  // 先初始化地图，即使没有数据也要显示地图
  try {
    // 初始化地图（默认中心点：中国）
    photoMap = L.map('photoMap', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([35.0, 105.0], 4);
    
    // 检测用户位置并选择合适的地图服务
    const mapProvider = await detectUserLocation();
    const tileLayer = addMapTileLayer(mapProvider);
    tileLayer.addTo(photoMap);
    
    // 如果主要服务失败，尝试备用服务
    let errorCount = 0;
    tileLayer.on('tileerror', function() {
      errorCount++;
      // 如果错误次数超过3次，切换到备用服务
      if (errorCount >= 3) {
        console.warn('Primary map service failed, trying alternative...');
        let altProvider = 'googleSatellite';
        if (mapProvider === 'google') {
          // 如果 Google Maps 失败，尝试 Google Maps 卫星图
          altProvider = 'googleSatellite';
        } else if (mapProvider === 'googleSatellite') {
          // 如果 Google Maps 卫星图失败，尝试 Google Maps 混合图
          altProvider = 'googleHybrid';
        }
        const altLayer = addMapTileLayer(altProvider);
        altLayer.addTo(photoMap);
        photoMap.removeLayer(tileLayer);
      }
    });
    
    // 确保地图正确渲染（处理可能的尺寸问题）
    setTimeout(() => {
      if (photoMap) {
        photoMap.invalidateSize();
      }
    }, 100);
  } catch (error) {
    console.error('Failed to initialize map:', error);
    return;
  }
  
  // 获取画廊数据（即使失败也要显示地图）
  try {
    const res = await fetch('./data/gallery.json');
    if (!res.ok) {
      console.warn('Failed to load gallery data');
      return;
    }
    galleryItems = await res.json();
    if (!Array.isArray(galleryItems) || galleryItems.length === 0) {
      console.warn('No gallery items found');
      return;
    }
  } catch (error) {
    console.warn('Error loading gallery data:', error);
    return;
  }
  
  // 处理所有图片的位置（先显示已有坐标的，然后异步加载需要地理编码的）
  const locationGroups = new Map(); // key: "lat,lng", value: {coords, items, locationName}
  const itemsNeedingGeocode = [];
  
  // 第一遍：快速处理已有坐标的（同步解析，不调用API）
  for (const item of galleryItems) {
    // 跳过没有位置信息的项目
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
      // 只有当有实际照片数据时才添加到 items
      locationGroups.get(key).items.push(item);
    } else {
      // 需要地理编码的，加入队列
      itemsNeedingGeocode.push(item);
    }
  }
  
  // 立即显示已有坐标的标记（只显示有照片的地点）
  addMarkersToMap(locationGroups);
  
  // 如果有已显示的标记，先调整地图视图（只包含有照片的地点）
  const validGroups = Array.from(locationGroups.values()).filter(g => g.items && g.items.length > 0);
  if (validGroups.length > 0) {
    const bounds = validGroups.map(g => g.coords);
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
        }
        // 添加照片到该地点
        locationGroups.get(key).items.push(item);
        
        // 只有当该地点有照片时才添加或更新标记
        if (locationGroups.get(key).items.length > 0) {
          if (!locationGroups.get(key).marker) {
            // 立即添加新标记
            addMarkersToMap(new Map([[key, locationGroups.get(key)]]));
          } else {
            // 更新已有标记的弹出窗口
            updateMarkerPopup(key, locationGroups.get(key));
          }
        }
      }
    }
    
    // 最后重新调整视图以包含所有标记（只包含有照片的地点）
    const validGroups = Array.from(locationGroups.values()).filter(g => g.items && g.items.length > 0);
    if (validGroups.length > 0) {
      const bounds = validGroups.map(g => g.coords);
      photoMap.fitBounds(bounds, { padding: [50, 50] });
    }
  }
}

// 添加标记到地图
function addMarkersToMap(locationGroups) {
  locationGroups.forEach((group, key) => {
    const { coords, items, locationName } = group;
    
    // 只有当该地点有照片时才添加标记
    if (!items || items.length === 0) {
      return;
    }
    
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
      maxWidth: 500,
      maxHeight: 600,
      className: 'photo-map-popup'
    }).setContent(popupContent);
    
    marker.bindPopup(popup);
    
    // 绑定弹出窗口打开后的事件
    marker.on('popupopen', function() {
      const popupEl = this.getPopup().getElement();
      if (!popupEl) return;
      
      // 绑定图片点击事件（包括照片容器和图片本身）
      const photoElements = popupEl.querySelectorAll('.map-popup-photo-item, .map-popup-photo');
      photoElements.forEach(photoEl => {
        photoEl.addEventListener('click', function() {
          // 获取原图URL
          const item = this.closest('.map-popup-photo-item');
          const src = (item && item.dataset.originalSrc) || this.dataset.src || this.dataset.originalSrc;
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
  
  const photosHtml = sortedItems.slice(0, 6).map((item, idx) => {
    const exif = item.exif || {};
    const thumbnailUrl = getThumbnailUrl(item.src, 300);
    const originalUrl = item.originalSrc || getOriginalUrl(item.src);
    const imageTitle = item.alt || '未命名';
    
    // 构建信息表格
    let infoRows = [];
    
    // 作品标题
    infoRows.push(`
      <tr class="map-popup-info-row">
        <td class="map-popup-info-label">作品标题</td>
        <td class="map-popup-info-value">${escapeHtml(imageTitle)}</td>
      </tr>
    `);
    
    // 相机和镜头
    if (exif.camera || exif.lens) {
      let cameraLens = '';
      if (exif.camera) {
        const cameraName = String(exif.camera).trim();
        const logoHtml = renderCameraBrandLogo(cameraName);
        cameraLens = `${logoHtml}${escapeHtml(cameraName)}`;
      }
      if (exif.lens) {
        if (cameraLens) cameraLens += '<br>';
        cameraLens += escapeHtml(String(exif.lens).trim());
      }
      if (cameraLens) {
        infoRows.push(`
          <tr class="map-popup-info-row">
            <td class="map-popup-info-label">相机 / 镜头</td>
            <td class="map-popup-info-value">${cameraLens}</td>
          </tr>
        `);
      }
    }
    
    // 曝光设置
    const exposure = [];
    if (exif.iso) {
      exposure.push(`ISO ${escapeHtml(String(exif.iso).trim())}`);
    }
    if (exif.f !== undefined && exif.f !== null) {
      exposure.push(`f/${escapeHtml(String(exif.f).trim())}`);
    } else if (exif.aperture !== undefined && exif.aperture !== null) {
      const aperture = String(exif.aperture).trim();
      if (aperture.startsWith('f/')) {
        exposure.push(escapeHtml(aperture));
      } else {
        exposure.push(`f/${escapeHtml(aperture)}`);
      }
    }
    if (exif.shutter) {
      exposure.push(escapeHtml(String(exif.shutter).trim()));
    }
    if (exif.focal) {
      exposure.push(escapeHtml(String(exif.focal).trim()));
    }
    
    if (exposure.length > 0) {
      infoRows.push(`
        <tr class="map-popup-info-row">
          <td class="map-popup-info-label">曝光设置</td>
          <td class="map-popup-info-value">${exposure.join(' | ')}</td>
        </tr>
      `);
    }
    
    return `
      <div class="map-popup-photo-item" data-index="${idx}" data-src="${escapeAttr(originalUrl)}" data-original-src="${escapeAttr(originalUrl)}">
        <div class="map-popup-photo">
          <img src="${escapeAttr(thumbnailUrl)}" alt="${escapeHtml(imageTitle)}" loading="lazy" />
          ${sortedItems.length > 6 && idx === 5 ? `<div class="map-popup-photo-count">+${sortedItems.length - 6}</div>` : ''}
        </div>
        <div class="map-popup-photo-info">
          <table class="map-popup-info-table">
            <tbody>
              ${infoRows.join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="map-popup-content">
      <div class="map-popup-title">${escapeHtml(locationName)}</div>
      <div style="color: var(--muted); font-size: 12px; margin-bottom: 12px;">${sortedItems.length} 张照片</div>
      <div class="map-popup-photos-list">${photosHtml}</div>
    </div>
  `;
}



