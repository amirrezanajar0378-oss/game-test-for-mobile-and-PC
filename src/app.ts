import { formatBytes, percentageSaved, outputExtension } from "./utils.js";
import type { OutputMime, CompressionResult } from "./types.js";

const $ = <T extends Element>(s: string) => document.querySelector(s) as T;

const dropzone = $("#dropzone") as HTMLElement;
const input = $("#fileInput") as HTMLInputElement;
const workspace = $("#workspace") as HTMLElement;
const quality = $("#quality") as HTMLInputElement;
const format = $("#format") as HTMLSelectElement;

const beforeImage = $("#beforeImage") as HTMLImageElement;
const afterImage = $("#afterImage") as HTMLImageElement;
const beforeSize = $("#beforeSize") as HTMLElement;
const afterSize = $("#afterSize") as HTMLElement;
const qualityValue = $("#qualityValue") as HTMLElement;
const saving = $("#saving") as HTMLElement;
const savingText = $("#savingText") as HTMLElement;
const downloadBtn = $("#downloadBtn") as HTMLButtonElement;
const inputStats = $("#inputStats") as HTMLElement;
const newBtn = $("#newBtn") as HTMLButtonElement;

let sourceFile = null;
let outputBlob = null;
let outputUrl = null;
let sourceUrl = null;
let fallbackDecodeUrl = null;
let compressionId = 0;

type DecodedImage = ImageBitmap | HTMLImageElement;

function closeDecodedImage(image: DecodedImage) {
  if ("close" in image) image.close();
}

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

dropzone.onkeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    input.click();
  }
};

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event: DragEvent) => {
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

dropzone.addEventListener("drop", (event: DragEvent) => {
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) loadFile(file);
});

input.onchange = (event: Event) => {
  const target = event.currentTarget as HTMLInputElement;
  const file = target.files && target.files[0];
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
  beforeSize.textContent = formatBytes(file.size);
  inputStats.textContent = file.name + " • " + formatBytes(file.size);

  dropzone.classList.add("hidden");
  workspace.classList.remove("hidden");

  saving.textContent = "در حال آماده‌سازی…";
  savingText.textContent = "";

  await compress();
}

function chooseMime(): OutputMime {
  return (format.value === "auto" ? "image/webp" : format.value) as OutputMime;
}

async function decode(file: File): Promise<DecodedImage> {
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

function canvasBlob(canvas: HTMLCanvasElement, mime: OutputMime, qualityValue?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mime, qualityValue);
  });
}

async function compress(): Promise<void> {
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
    closeDecodedImage(image);
    return;
  }

  const width = image.width;
  const height = image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: true });

  if (!ctx) {
    closeDecodedImage(image);
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

  closeDecodedImage(image);

  if (!blob || currentId !== compressionId || file !== sourceFile) return;

  // Never replace the original with a larger lossy output.
  if (blob.size >= file.size && mime !== "image/png") {
    blob = file;
  }

  if (blob.size >= file.size && mime === "image/png") {
    blob = file;
  }

  if (outputUrl) URL.revokeObjectURL(outputUrl);

  const result: CompressionResult = {
    blob,
    width,
    height,
    savedPercent: percentageSaved(file.size, blob.size)
  };

  outputBlob = result.blob;
  outputUrl = URL.createObjectURL(result.blob);
  afterImage.src = outputUrl;
  afterSize.textContent = formatBytes(result.blob.size);

  if (result.blob.size < file.size) {
    saving.textContent = result.savedPercent + "% حجم کمتر";
    savingText.textContent =
      formatBytes(file.size) + " → " + formatBytes(result.blob.size) +
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

  const ext = outputExtension(outputBlob.type);
  const base = sourceFile.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]/gi, "_");
  const link = document.createElement("a");

  link.href = outputUrl;
  link.download = base + "-tinypix." + ext;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

