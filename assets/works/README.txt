作品与部署说明（GitHub Pages + iPic）

1) GitHub Pages 部署时，目录扫描默认关闭，画廊依赖 data/gallery.json 渲染。
   - 你可以用 tools/generate-gallery.html 生成并下载 gallery.json，或手动编辑。
   - gallery.json 的 src 支持 iPic 等任意 https 图床链接。

2) 使用 iPic：
   - 上传图片到 iPic，复制 https 链接，写入 website/data/gallery.json：
     [
       { "category": "nature", "src": "https://your-ipic/xxx.jpg", "alt": "标题", "caption": "标题", "location": "地点" }
     ]

3) 本地开发如需启用“目录扫描”（自动读取本文件夹图片），请使用：
   - 本地启动：python3 -m http.server 8000
   - 访问 URL 时添加 ?scan=1 参数，例如：
     http://localhost:8000/gallery.html?scan=1

4) 可选侧车 JSON（仍支持）
   - 某图片同目录可放同名 .json（如 mountain.jpg.json），用于 EXIF 与地点标签。
   - 示例：
     { "location": "青海湖", "exif": { "camera": "A7R IV", "lens": "24-70mm", "focal": "35mm", "aperture": "f/8", "shutter": "1/4s", "iso": 100 } }
