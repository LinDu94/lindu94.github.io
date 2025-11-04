document.getElementById("generateBtn").addEventListener("click", () => {
    const fileInput = document.getElementById("imageInput");
    const caption = document.getElementById("captionInput").value.trim();
    const location = document.getElementById("locationInput").value.trim();
    const output = document.getElementById("output");
  
    if (!fileInput.files.length) {
      alert("请先选择一张图片！");
      return;
    }
  
    const file = fileInput.files[0];
    const reader = new FileReader();
  
    reader.onload = function (e) {
      const arrayBuffer = e.target.result;
  
      EXIF.getData(file, function () {
        const allExif = EXIF.getAllTags(this);
        const focalLength = allExif.FocalLength ? `${allExif.FocalLength} mm` : null;
  
        const jsonData = {
          category: "nature",
          src: `./assets/works/nature/${file.name}`,
          alt: "",
          caption: caption || "",
          location: location || null,
          exif: focalLength ? { "Focal Length": focalLength } : null,
        };
  
        output.textContent = JSON.stringify(jsonData, null, 2);
      });
    };
  
    reader.readAsArrayBuffer(file);
  });
  