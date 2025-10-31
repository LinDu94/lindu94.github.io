const dirNature = document.getElementById('dirNature');
const dirCity = document.getElementById('dirCity');
const baseNature = document.getElementById('baseNature');
const baseCity = document.getElementById('baseCity');
const genBtn = document.getElementById('gen');
const downloadBtn = document.getElementById('download');
const output = document.getElementById('output');

function collect(files, basePath, category) {
  const list = [];
  const map = new Map();
  Array.from(files).forEach(f => map.set(f.webkitRelativePath || f.name, f));
  for (const [rel, file] of map) {
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) continue;
    const jsonName = file.name + '.json';
    const jsonRel = rel.replace(file.name, jsonName);
    const metaFile = map.get(jsonRel);
    list.push({ file, metaFile, category, basePath });
  }
  return list;
}

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function buildItem(entry) {
  const src = entry.basePath + entry.file.name;
  let meta = null;
  if (entry.metaFile) {
    try { meta = JSON.parse(entry.metaContent || '{}'); } catch (_) { meta = null; }
  }
  return {
    category: entry.category,
    src,
    alt: (meta && meta.alt) || '',
    caption: (meta && meta.caption) || '',
    location: meta && meta.location,
    exif: meta && meta.exif
  };
}

genBtn.addEventListener('click', async () => {
  const nat = collect(dirNature.files || [], baseNature.value || './assets/works/nature/', 'nature');
  const cty = collect(dirCity.files || [], baseCity.value || './assets/works/city/', 'city');
  const all = [...nat, ...cty];
  for (const e of all) {
    if (e.metaFile) e.metaContent = await readFileAsText(e.metaFile).catch(() => '');
  }
  const items = all.map(buildItem);
  const json = JSON.stringify(items, null, 2);
  output.textContent = json;
});

downloadBtn.addEventListener('click', () => {
  const text = output.textContent.trim();
  if (!text) return;
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gallery.json';
  a.click();
  URL.revokeObjectURL(a.href);
});


