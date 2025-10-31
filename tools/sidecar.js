const drop = document.getElementById('drop');
const fileInput = document.getElementById('fileInput');
const list = document.getElementById('list');
const defaultLocation = document.getElementById('defaultLocation');

function onFiles(files) {
  const arr = Array.from(files).filter(f => /^image\//.test(f.type));
  if (!arr.length) return;
  arr.forEach(async (file) => {
    let exif = {};
    try { exif = await exifr.parse(file) || {}; } catch (_) { exif = {}; }
    const camera = exif.Model || exif.model || '';
    const make = exif.Make || exif.make || '';
    const lens = exif.LensModel || exif.lensModel || '';
    const focal = exif.FocalLength ? (Array.isArray(exif.FocalLength) ? exif.FocalLength[0] : exif.FocalLength) + 'mm' : '';
    const aperture = exif.FNumber ? 'f/' + exif.FNumber : '';
    const shutter = exif.ExposureTime ? (exif.ExposureTime >= 1 ? exif.ExposureTime + 's' : '1/' + Math.round(1/exif.ExposureTime) + 's') : '';
    const iso = exif.ISO || '';

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h4>${file.name}</h4>
      <div class="row"><label>地点</label><input class="loc" placeholder="可选" value="${defaultLocation.value || ''}"></div>
      <div class="row"><label>相机</label><input class="cam" value="${[make, camera].filter(Boolean).join(' ')}"></div>
      <div class="row"><label>镜头</label><input class="lens" value="${lens}"></div>
      <div class="row"><label>焦距</label><input class="focal" value="${focal}"></div>
      <div class="row"><label>光圈</label><input class="aperture" value="${aperture}"></div>
      <div class="row"><label>快门</label><input class="shutter" value="${shutter}"></div>
      <div class="row"><label>ISO</label><input class="iso" value="${iso}"></div>
      <div class="actions">
        <button class="btn primary save">下载 JSON</button>
        <button class="btn preview">预览</button>
      </div>
      <div class="code" hidden></div>
    `;
    list.appendChild(panel);

    const q = (sel) => panel.querySelector(sel);
    const code = q('.code');
    const build = () => {
      const json = {
        location: q('.loc').value || undefined,
        exif: {
          camera: q('.cam').value || undefined,
          lens: q('.lens').value || undefined,
          focal: q('.focal').value || undefined,
          aperture: q('.aperture').value || undefined,
          shutter: q('.shutter').value || undefined,
          iso: q('.iso').value || undefined
        }
      };
      // 清理 undefined 字段
      Object.keys(json.exif).forEach(k => json.exif[k] === undefined && delete json.exif[k]);
      if (!Object.keys(json.exif).length) delete json.exif;
      if (json.location === undefined) delete json.location;
      return json;
    };

    q('.preview').addEventListener('click', () => {
      const json = build();
      code.textContent = JSON.stringify(json, null, 2);
      code.hidden = false;
    });

    q('.save').addEventListener('click', () => {
      const data = build();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  });
}

drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('hover'); });
drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('hover'); onFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => onFiles(e.target.files));


