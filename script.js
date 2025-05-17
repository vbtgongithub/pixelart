let img = new Image();
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

document.getElementById("upload").onchange = function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

img.onload = function () {
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
};

function pixelate() {
  const size = parseInt(document.getElementById("pixelSize").value);
  if (!size || size < 1) return;

  const w = canvas.width;
  const h = canvas.height;

  // Draw tiny image
  const temp = document.createElement("canvas");
  const tempCtx = temp.getContext("2d");
  temp.width = Math.ceil(w / size);
  temp.height = Math.ceil(h / size);

  tempCtx.drawImage(img, 0, 0, temp.width, temp.height);

  // Stretch tiny image back to full size
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(temp, 0, 0, temp.width, temp.height, 0, 0, w, h);
}
