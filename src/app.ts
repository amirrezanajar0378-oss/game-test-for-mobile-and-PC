import { formatBytes, percentageSaved, outputExtension } from "./utils.js";
import type { OutputMime, CompressionResult } from "./types.js";

const $ = <T extends Element>(s:string) => document.querySelector(s) as T;
const dropzone=$("#dropzone") as HTMLElement, input=$("#fileInput") as HTMLInputElement;
const workspace=$("#workspace") as HTMLElement, quality=$("#quality") as HTMLInputElement;
const format=$("#format") as HTMLSelectElement, scale=$("#scale") as HTMLSelectElement;
const maxWidth=$("#maxWidth") as HTMLInputElement;
const beforeImage=$("#beforeImage") as HTMLImageElement, afterImage=$("#afterImage") as HTMLImageElement;
const beforeSize=$("#beforeSize") as HTMLElement, afterSize=$("#afterSize") as HTMLElement;
const qualityValue=$("#qualityValue") as HTMLElement, saving=$("#saving") as HTMLElement;
const savingText=$("#savingText") as HTMLElement, downloadBtn=$("#downloadBtn") as HTMLButtonElement;
const inputStats=$("#inputStats") as HTMLElement, newBtn=$("#newBtn") as HTMLButtonElement;

let sourceFile:File|null=null, outputBlob:Blob|null=null, outputUrl:string|null=null, sourceUrl:string|null=null, fallbackDecodeUrl:string|null=null;
let compressionId=0;

type DecodedImage=ImageBitmap|HTMLImageElement;
function closeDecodedImage(image:DecodedImage){if("close" in image) image.close();}
function revokeUrls(){if(sourceUrl)URL.revokeObjectURL(sourceUrl);if(outputUrl)URL.revokeObjectURL(outputUrl);if(fallbackDecodeUrl)URL.revokeObjectURL(fallbackDecodeUrl);sourceUrl=outputUrl=fallbackDecodeUrl=null;}
function reset(){compressionId++;sourceFile=null;outputBlob=null;downloadBtn.disabled=true;workspace.classList.add("hidden");dropzone.classList.remove("hidden");revokeUrls();beforeImage.removeAttribute("src");afterImage.removeAttribute("src");input.value="";}
newBtn.onclick=reset;
dropzone.onclick=()=>input.click();
dropzone.onkeydown=(e:KeyboardEvent)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();input.click();}};
for(const name of ["dragenter","dragover"]){dropzone.addEventListener(name,(e:Event)=>{e.preventDefault();dropzone.classList.add("drag");});}
dropzone.addEventListener("dragleave",(e:DragEvent)=>{e.preventDefault();dropzone.classList.remove("drag");});
dropzone.addEventListener("drop",(e:DragEvent)=>{e.preventDefault();dropzone.classList.remove("drag");const file=e.dataTransfer?.files?.[0];if(file)loadFile(file);});
input.onchange=(e:Event)=>{const file=(e.currentTarget as HTMLInputElement).files?.[0];if(file)loadFile(file);};
quality.oninput=()=>{qualityValue.textContent=quality.value+"%";if(sourceFile)compress();};
format.onchange=()=>{if(sourceFile)compress();};
scale.onchange=()=>{if(sourceFile)compress();};
maxWidth.oninput=()=>{if(sourceFile)compress();};

function isSupportedImage(file:File){return ["image/jpeg","image/png","image/webp","image/avif"].includes(file.type);}
async function loadFile(file:File):Promise<void>{
 if(!isSupportedImage(file)){alert("لطفاً یک فایل JPG، PNG، WebP یا AVIF انتخاب کن.");return;}
 if(file.size>100*1024*1024){alert("برای عملکرد بهتر، عکس‌های زیر 100MB را انتخاب کن.");return;}
 compressionId++;sourceFile=file;outputBlob=null;downloadBtn.disabled=true;
 if(sourceUrl)URL.revokeObjectURL(sourceUrl);if(outputUrl)URL.revokeObjectURL(outputUrl);if(fallbackDecodeUrl)URL.revokeObjectURL(fallbackDecodeUrl);
 outputUrl=fallbackDecodeUrl=null;sourceUrl=URL.createObjectURL(file);beforeImage.src=sourceUrl;
 beforeSize.textContent=formatBytes(file.size);inputStats.textContent=file.name+" • "+formatBytes(file.size);
 dropzone.classList.add("hidden");workspace.classList.remove("hidden");saving.textContent="در حال آماده‌سازی…";savingText.textContent="";await compress();
}
function chooseMime():OutputMime{return (format.value==="auto"?"image/webp":format.value) as OutputMime;}
async function decode(file:File):Promise<DecodedImage>{
 if("createImageBitmap" in window){try{return await createImageBitmap(file,{imageOrientation:"from-image"});}catch(_){}}
 const url=URL.createObjectURL(file);fallbackDecodeUrl=url;
 return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{URL.revokeObjectURL(url);if(fallbackDecodeUrl===url)fallbackDecodeUrl=null;resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);if(fallbackDecodeUrl===url)fallbackDecodeUrl=null;reject(new Error("IMAGE_DECODE_FAILED"));};image.src=url;});
}
function canvasBlob(canvas:HTMLCanvasElement,mime:OutputMime,q?:number):Promise<Blob|null>{return new Promise(resolve=>canvas.toBlob(resolve,mime,q));}
async function compress():Promise<void>{
 if(!sourceFile)return;
 const currentId=++compressionId,file=sourceFile;downloadBtn.disabled=true;saving.textContent="در حال فشرده‌سازی…";savingText.textContent="";
 let image:DecodedImage;try{image=await decode(file);}catch(_){if(currentId!==compressionId)return;saving.textContent="پردازش تصویر انجام نشد";savingText.textContent="این فایل در مرورگر شما قابل پردازش نیست.";return;}
 if(currentId!==compressionId||file!==sourceFile){closeDecodedImage(image);return;}
 const originalWidth=image.width,originalHeight=image.height;
 let targetWidth=Math.max(1,Math.round(originalWidth*Number(scale.value)));
 const custom=Number(maxWidth.value);
 if(Number.isFinite(custom)&&custom>0)targetWidth=Math.min(targetWidth,Math.floor(custom));
 const targetHeight=Math.max(1,Math.round(originalHeight*(targetWidth/originalWidth)));
 const canvas=document.createElement("canvas");canvas.width=targetWidth;canvas.height=targetHeight;
 const ctx=canvas.getContext("2d",{alpha:true});if(!ctx){closeDecodedImage(image);saving.textContent="خطا در ساخت تصویر";return;}
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
 const mime=chooseMime(),q=Number(quality.value)/100;
 if(mime==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,targetWidth,targetHeight);}
 ctx.drawImage(image,0,0,targetWidth,targetHeight);let blob=await canvasBlob(canvas,mime,mime==="image/png"?undefined:q);closeDecodedImage(image);
 if(!blob||currentId!==compressionId||file!==sourceFile)return;
 if(blob.size>=file.size&&mime!=="image/png"&&targetWidth===originalWidth)blob=file;
 if(blob.size>=file.size&&mime==="image/png"&&targetWidth===originalWidth)blob=file;
 if(outputUrl)URL.revokeObjectURL(outputUrl);
 const result:CompressionResult={blob,width:targetWidth,height:targetHeight,savedPercent:percentageSaved(file.size,blob.size)};
 outputBlob=result.blob;outputUrl=URL.createObjectURL(result.blob);afterImage.src=outputUrl;afterSize.textContent=formatBytes(result.blob.size);
 if(result.blob.size<file.size){saving.textContent=result.savedPercent+"% حجم کمتر";savingText.textContent=formatBytes(file.size)+" → "+formatBytes(result.blob.size)+" • ابعاد "+targetWidth+"×"+targetHeight;}else{saving.textContent="خروجی آماده است";savingText.textContent=formatBytes(result.blob.size)+" • ابعاد "+targetWidth+"×"+targetHeight;}
 downloadBtn.disabled=false;
}
downloadBtn.onclick=()=>{if(!outputBlob||!outputUrl||!sourceFile)return;const ext=outputExtension(outputBlob.type),base=sourceFile.name.replace(/\.[^.]+$/,"").replace(/[^a-z0-9._-]/gi,"_"),link=document.createElement("a");link.href=outputUrl;link.download=base+"-tinypix."+ext;document.body.appendChild(link);link.click();link.remove();};
