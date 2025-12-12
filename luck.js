// Try your luck 页面逻辑
let allGalleryItems = [];
let luckMap = null;

// 加载画廊数据
async function loadGalleryData() {
  try {
    const res = await fetch('./data/gallery.json');
    if (!res.ok) throw new Error('Failed to load gallery data');
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No gallery items found');
    }
    allGalleryItems = items;
    return true;
  } catch (error) {
    console.error('Error loading gallery data:', error);
    return false;
  }
}

// 获取原图URL
function getOriginalUrl(url) {
  if (!url) return '';
  return url.replace(/[?&]w=\d+/g, '').replace(/[?&]$/, '');
}

// 获取相机品牌logo
function getCameraBrandLogo(cameraName) {
  if (!cameraName) return null;
  const name = String(cameraName).toLowerCase().trim();
  
  let brand = null;
  if (name.includes('l2d-20c') || name.includes('l3d-100c')) {
    brand = 'dji';
  } else if (name.includes('dji')) {
    brand = 'dji';
  } else if (name.includes('nikon')) brand = 'nikon';
  else if (name.includes('canon')) brand = 'canon';
  else if (name.includes('sony')) brand = 'sony';
  else if (name.includes('fujifilm') || name.includes('fuji')) brand = 'fujifilm';
  else if (name.includes('hasselblad')) brand = 'hasselblad';
  else if (name.includes('leica')) brand = 'leica';
  else if (name.includes('panasonic') || name.includes('lumix')) brand = 'panasonic';
  else if (name.includes('olympus') || name.includes('om-')) brand = 'olympus';
  else if (name.includes('pentax')) brand = 'pentax';
  
  if (brand) {
    return `./assets/brands/${brand}.svg`;
  }
  return null;
}

// 渲染相机品牌logo HTML
function renderCameraBrandLogo(cameraName) {
  const logoPath = getCameraBrandLogo(cameraName);
  if (logoPath) {
    const brandName = String(cameraName).split(' ')[0];
    return `<img src="${escapeAttr(logoPath)}" alt="${escapeHtml(brandName)}" class="camera-brand-logo" onerror="this.style.display='none';" />`;
  }
  return '';
}

// 转义HTML
function escapeHtml(s) {
  return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
}

function escapeAttr(s) { 
  return escapeHtml(s); 
}

// 解析坐标
function parseCoordinates(locationStr) {
  if (!locationStr) return null;
  
  const dmsMatch = locationStr.match(/N([\d.]+)°\s*([\d.]+)'\s*([\d.]+)"\s*E([\d.]+)°\s*([\d.]+)'\s*([\d.]+)"/);
  if (dmsMatch) {
    const lat = parseFloat(dmsMatch[1]) + parseFloat(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600;
    const lng = parseFloat(dmsMatch[4]) + parseFloat(dmsMatch[5]) / 60 + parseFloat(dmsMatch[6]) / 3600;
    return [lat, lng];
  }
  
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

// 地理编码（使用缓存）
const GEOCODE_CACHE_KEY = 'lindu_geocode_cache';
let geocodeCache = {};

try {
  const cached = localStorage.getItem(GEOCODE_CACHE_KEY);
  if (cached) {
    geocodeCache = JSON.parse(cached);
  }
} catch (e) {
  console.warn('Failed to load geocode cache:', e);
}

async function geocodeLocation(locationStr) {
  if (!locationStr) return null;
  
  const coords = parseCoordinates(locationStr);
  if (coords) return coords;
  
  const placeName = locationStr.replace(/N[\d.]+°[\s\d.'"]+E[\d.]+°[\s\d.'"]+/g, '').trim();
  if (!placeName) return null;
  
  if (geocodeCache[placeName]) {
    const cached = geocodeCache[placeName];
    if (Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
      return cached.coords;
    }
  }
  
  try {
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
      geocodeCache[placeName] = {
        coords: coords,
        timestamp: Date.now()
      };
      try {
        localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(geocodeCache));
      } catch (e) {
        console.warn('Failed to save geocode cache:', e);
      }
      return coords;
    }
  } catch (error) {
    console.warn('Geocoding failed:', error);
  }
  
  return null;
}

// 初始化地图
async function initLuckMap(coords) {
  const mapContainer = document.getElementById('luckMap');
  if (!mapContainer || !coords) return;
  
  if (typeof L === 'undefined' || !L.map) {
    console.warn('Leaflet.js not loaded');
    return;
  }
  
  // 清理旧地图
  if (luckMap) {
    try {
      luckMap.remove();
    } catch (e) {
      console.warn('Error removing old map:', e);
    }
    luckMap = null;
  }
  
  // 等待容器有尺寸
  if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
    setTimeout(() => initLuckMap(coords), 200);
    return;
  }
  
  try {
    luckMap = L.map(mapContainer, {
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false
    }).setView(coords, 13);
    
    // 添加地图图层
    const tileLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '© <a href="https://www.google.com/maps">Google Maps</a>',
      subdomains: '0123',
      maxZoom: 20
    });
    tileLayer.addTo(luckMap);
    
    // 添加标记
    const icon = L.divIcon({
      className: 'photo-marker',
      html: `<div style="background: #7cc4ff; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #0b0c0d; box-shadow: 0 0 0 2px rgba(124,196,255,0.5);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    
    L.marker(coords, { icon: icon }).addTo(luckMap);
    
    setTimeout(() => {
      if (luckMap) {
        luckMap.invalidateSize();
      }
    }, 300);
  } catch (e) {
    console.error('Error creating map:', e);
  }
}

// 加载随机图片
async function loadRandomImage() {
  if (allGalleryItems.length === 0) {
    const loaded = await loadGalleryData();
    if (!loaded) {
      document.getElementById('luckInfo').innerHTML = '<div class="luck-error">无法加载图片数据</div>';
      return;
    }
  }
  
  // 随机选择一张图片
  const randomIndex = Math.floor(Math.random() * allGalleryItems.length);
  const item = allGalleryItems[randomIndex];
  
  // 显示图片
  const imageEl = document.getElementById('luckImage');
  const originalUrl = getOriginalUrl(item.src);
  imageEl.src = originalUrl;
  imageEl.alt = item.alt || '';
  
  // 显示信息
  const infoEl = document.getElementById('luckInfo');
  const exif = item.exif || {};
  
  // 解析位置信息
  let locationText = '';
  let locationCoords = null;
  if (item.location) {
    locationText = String(item.location).trim().replace(/N[\d.]+°[\s\d.'"]+E[\d.]+°[\s\d.'"]+/g, '').trim();
    locationCoords = parseCoordinates(item.location);
    
    // 如果没有坐标，尝试地理编码
    if (!locationCoords && locationText) {
      locationCoords = await geocodeLocation(item.location);
    }
  }
  
  // 构建信息HTML
  let infoHTML = '';
  
  // 图片名称
  const imageName = item.alt || item.caption || '未命名';
  infoHTML += `
    <div class="luck-info-title">
      <h3>${escapeHtml(imageName)}</h3>
    </div>
  `;
  
  // 位置信息
  if (locationText) {
    infoHTML += `
      <div class="luck-info-location">
        <strong>位置：</strong>${escapeHtml(locationText)}
      </div>
    `;
  }
  
  // 相机和镜头
  if (exif.camera || exif.lens) {
    infoHTML += `<div class="luck-info-camera">`;
    if (exif.camera) {
      const cameraName = String(exif.camera).trim();
      const logoHtml = renderCameraBrandLogo(cameraName);
      infoHTML += `<div><strong>相机：</strong>${logoHtml}${escapeHtml(cameraName)}</div>`;
    }
    if (exif.lens) {
      infoHTML += `<div><strong>镜头：</strong>${escapeHtml(String(exif.lens).trim())}</div>`;
    }
    infoHTML += `</div>`;
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
    infoHTML += `
      <div class="luck-info-exif">
        <strong>曝光设置：</strong>${exposure.join(' | ')}
      </div>
    `;
  }
  
  // 地图
  if (locationText) {
    infoHTML += `
      <div class="luck-map-container">
        <div id="luckMap" class="luck-map"></div>
      </div>
    `;
  }
  
  infoEl.innerHTML = infoHTML || '<div class="luck-info-empty">无信息</div>';
  
  // 初始化地图
  if (locationCoords) {
    setTimeout(() => {
      initLuckMap(locationCoords);
    }, 200);
  }
}

// 页面加载时初始化
(async function() {
  await loadGalleryData();
  loadRandomImage();
})();






