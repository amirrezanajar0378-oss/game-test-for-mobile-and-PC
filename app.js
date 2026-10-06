const $ = (s) => document.querySelector(s);

const dropzone = $("#dropzone");
const input = $("#fileInput");
const workspace = $("#workspace");
const quality = $("#quality");
const format = $("#format");

const beforeImage = $("#beforeImage");
const afterImage = $("#afterImage");
const beforeSize = $("#beforeSize");
const afterSize = $("#afterSize");
const qualityValue = $("#qualityValue");
const saving = $("#saving");
const savingText = $("#savingText");
const downloadBtn = $("#downloadBtn");
const inputStats = $("#inputStats");
const newBtn = $("#newBtn");

let sourceFile = null;
let outputBlob = null;
let outputUrl = null;
let sourceUrl = null;
let fallbackDecodeUrl = null;
let compressionId = 0;

const fmt = (n) => {
  if (!Number.isFinite(n)) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let value = n;

  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }

  return (value < 10 && i ? value.toFixed(2) : value.toFixed(1)) + " " + units[i];
};

const safeName = (name) => name.replace(/[^a-z0-9._-]/gi, "_");

function revokeUrls() {
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  if (fallbackDecodeUrl) URL.revokeObjectURL(fallbackDecodeUrl);

  sourceUrl = null;
  outputUrl = null;
  fallbackDecodeUrl = null;
}

function reset() {
  compressionId++;
  sourceFile = null;
  outputBlob = null;
  downloadBtn.disabled = true;
  workspace.classList.add("hidden");
  dropzone.classList.remove("hidden");
  revokeUrls();
  beforeImage.removeAttribute("src");
  afterImage.removeAttribute("src");
  input.value = "";
}

newBtn.onclick = reset;

dropzone.onclick = () => input.click();

dropzone.onkeydown = (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    input.click();
  }
};

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("drag");
  });
});

dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) loadFile(file);
});

input.onchange = (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) loadFile(file);
};

quality.oninput = () => {
  qualityValue.textContent = quality.value + "%";
  if (sourceFile) compress();
};

format.onchange = () => {
  if (sourceFile) compress();
};

function isSupportedImage(file) {
  return [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif"
  ].includes(file.type);
}

async function loadFile(file) {
  if (!isSupportedImage(file)) {
    alert("لطفاً یک فایل JPG، PNG، WebP یا AVIF انتخاب کن.");
    return;
  }

  if (file.size > 100 * 1024 * 1024) {
    alert("برای عملکرد بهتر، عکس‌های زیر 100MB را انتخاب کن.");
    return;
  }

  compressionId++;
  sourceFile = file;
  outputBlob = null;
  downloadBtn.disabled = true;

  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  if (fallbackDecodeUrl) URL.revokeObjectURL(fallbackDecodeUrl);

  outputUrl = null;
  fallbackDecodeUrl = null;
  sourceUrl = URL.createObjectURL(file);

  beforeImage.src = sourceUrl;
  beforeSize.textContent = fmt(file.size);
  inputStats.textContent = file.name + " • " + fmt(file.size);

  dropzone.classList.add("hidden");
  workspace.classList.remove("hidden");

  saving.textContent = "در حال آماده‌سازی…";
  savingText.textContent = "";

  await compress();
}

function chooseMime() {
  return format.value === "auto" ? "image/webp" : format.value;
}

function extension(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  return "webp";
}

async function decode(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (_) {
      // Fall through to the Image() decoder.
    }
  }

  fallbackDecodeUrl = URL.createObjectURL(file);

  return await new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
    image.src = fallbackDecodeUrl;
  });
}

function canvasBlob(canvas, mime, qualityValue) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mime, qualityValue);
  });
}

async function compress() {
  if (!sourceFile) return;

  const currentId = ++compressionId;
  const file = sourceFile;

  downloadBtn.disabled = true;
  saving.textContent = "در حال فشرده‌سازی…";
  savingText.textContent = "";

  let image;

  try {
    image = await decode(file);
  } catch (_) {
    if (currentId !== compressionId) return;
    saving.textContent = "پردازش تصویر انجام نشد";
    savingText.textContent = "این فرمت یا این فایل در مرورگر شما قابل پردازش نیست.";
    return;
  }

  if (currentId !== compressionId || file !== sourceFile) {
    if (image.close) image.close();
    return;
  }

  const width = image.width;
  const height = image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: true });

  if (!ctx) {
    if (image.close) image.close();
    saving.textContent = "خطا در ساخت تصویر";
    savingText.textContent = "مرورگر نتوانست بوم تصویر را ایجاد کند.";
    return;
  }

  const mime = chooseMime();
  const q = Number(quality.value) / 100;

  // JPEG does not support transparency. Use a white background
  // so transparent PNG/WebP images do not turn black.
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(image, 0, 0, width, height);

  let blob = await canvasBlob(
    canvas,
    mime,
    mime === "image/png" ? undefined : q
  );

  if (image.close) image.close();

  if (!blob || currentId !== compressionId || file !== sourceFile) return;

  // Never replace the original with a larger lossy output.
  if (blob.size >= file.size && mime !== "image/png") {
    blob = file;
  }

  if (blob.size >= file.size && mime === "image/png") {
    blob = file;
  }

  if (outputUrl) URL.revokeObjectURL(outputUrl);

  outputBlob = blob;
  outputUrl = URL.createObjectURL(blob);
  afterImage.src = outputUrl;
  afterSize.textContent = fmt(blob.size);

  const saved = Math.max(0, file.size - blob.size);
  const percent = file.size ? Math.round((saved / file.size) * 100) : 0;

  if (blob.size < file.size) {
    saving.textContent = percent + "% حجم کمتر";
    savingText.textContent =
      fmt(file.size) + " → " + fmt(blob.size) +
      " • ابعاد " + width + "×" + height + " حفظ شد";
  } else {
    saving.textContent = "فایل اصلی بهتر است";
    savingText.textContent =
      "این تنظیم حجم را کمتر نکرد؛ فایل اصلی نگه داشته شد تا حجم یا کیفیت بدتر نشود.";
  }

  downloadBtn.disabled = false;
}

downloadBtn.onclick = () => {
  if (!outputBlob || !outputUrl || !sourceFile) return;

  const ext = extension(outputBlob.type);
  const base = safeName(sourceFile.name.replace(/\.[^.]+$/, ""));
  const link = document.createElement("a");

  link.href = outputUrl;
  link.download = base + "-tinypix." + ext;
  document.body.appendChild(link);
  link.click();
  link.remove();
};
