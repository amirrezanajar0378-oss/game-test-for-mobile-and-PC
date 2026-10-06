const $=s=>document.querySelector(s);
const dropzone=$('#dropzone'),input=$('#fileInput'),workspace=$('#workspace'),quality=$('#quality'),format=$('#format');
const beforeImage=$('#beforeImage'),afterImage=$('#afterImage'),beforeSize=$('#beforeSize'),afterSize=$('#afterSize');
const qualityValue=$('#qualityValue'),saving=$('#saving'),savingText=$('#savingText'),downloadBtn=$('#downloadBtn'),inputStats=$('#inputStats'),newBtn=$('#newBtn');
let sourceFile=null,outputBlob=null,outputUrl=null,sourceUrl=null;
const fmt=n=>{if(!Number.isFinite(n))return '—';const u=['B','KB','MB','GB'];let i=0,v=n;while(v>=1024&&i<u.length-1){v/=1024;i++}return (v<10&&i?v.toFixed(2):v.toFixed(1))+' '+u[i]};
const escName=s=>s.replace(/[^a-z0-9._-]/gi,'_');
function reset(){sourceFile=null;outputBlob=null;downloadBtn.disabled=true;workspace.classList.add('hidden');dropzone.classList.remove('hidden');if(sourceUrl)URL.revokeObjectURL(sourceUrl);if(outputUrl)URL.revokeObjectURL(outputUrl);sourceUrl=outputUrl=null;input.value=''}
newBtn.onclick=reset;dropzone.onclick=()=>input.click();
dropzone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};
['dragenter','dragover'].forEach(e=>dropzone.addEventListener(e,ev=>{ev.preventDefault();dropzone.classList.add('drag')}));
['dragleave','drop'].forEach(e=>dropzone.addEventListener(e,ev=>{ev.preventDefault();dropzone.classList.remove('drag')}));
dropzone.addEventListener('drop',e=>{const f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f)loadFile(f)});
input.onchange=e=>{if(e.target.files&&e.target.files[0])loadFile(e.target.files[0])};
quality.oninput=()=>{qualityValue.textContent=quality.value+'%';if(sourceFile)compress()};
format.onchange=()=>{if(sourceFile)compress()};
async function loadFile(file){if(!file.type.startsWith('image/'))return alert('لطفاً یک فایل تصویری انتخاب کن.');if(file.size>100*1024*1024)return alert('برای عملکرد بهتر، عکس‌های زیر 100MB را انتخاب کن.');sourceFile=file;sourceUrl=URL.createObjectURL(file);beforeImage.src=sourceUrl;beforeSize.textContent=fmt(file.size);inputStats.textContent=file.name+' • '+fmt(file.size);dropzone.classList.add('hidden');workspace.classList.remove('hidden');saving.textContent='در حال آماده‌سازی…';savingText.textContent='';await compress()}
function chooseMime(){if(format.value!=='auto')return format.value;return 'image/webp'}
function extension(m){return m==='image/png'?'png':m==='image/jpeg'?'jpg':'webp'}
async function decode(file){if('createImageBitmap' in window){try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){}}return await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(file)})}
function canvasBlob(canvas,mime,q){return new Promise(resolve=>canvas.toBlob(resolve,mime,q))}
async function compress(){if(!sourceFile)return;downloadBtn.disabled=true;saving.textContent='در حال فشرده‌سازی…';const img=await decode(sourceFile);const w=img.width,h=img.height;const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:true});ctx.drawImage(img,0,0,w,h);const mime=chooseMime();const q=Number(quality.value)/100;let blob=await canvasBlob(canvas,mime,mime==='image/png'?undefined:q);if(!blob)return;if(blob.size>=sourceFile.size&&mime!=='image/png')blob=sourceFile;if(outputUrl)URL.revokeObjectURL(outputUrl);outputBlob=blob;outputUrl=URL.createObjectURL(blob);afterImage.src=outputUrl;afterSize.textContent=fmt(blob.size);const saved=Math.max(0,sourceFile.size-blob.size),pct=sourceFile.size?Math.round(saved/sourceFile.size*100):0;if(blob.size<sourceFile.size){saving.textContent=pct+'% حجم کمتر';savingText.textContent=fmt(sourceFile.size)+' → '+fmt(blob.size)+' • ابعاد '+w+'×'+h+' حفظ شد'}else{saving.textContent='بهترین نتیجه همین فایل اصلی است';savingText.textContent='این تنظیم حجم را کمتر نکرد؛ فایل اصلی نگه داشته شد تا کیفیت و حجم بدتر نشود.'}downloadBtn.disabled=false;if(img.close)img.close()}
downloadBtn.onclick=()=>{if(!outputBlob)return;const ext=extension(outputBlob.type),base=escName(sourceFile.name.replace(/\.[^.]+$/,''));const a=document.createElement('a');a.href=outputUrl;a.download=base+'-tinypix.'+ext;document.body.appendChild(a);a.click();a.remove()};