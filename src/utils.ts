export function formatBytes(bytes:number):string{
  if(!Number.isFinite(bytes)) return "—";
  const units=["B","KB","MB","GB"];
  let value=bytes, index=0;
  while(value>=1024 && index<units.length-1){value/=1024;index++;}
  return (value<10 && index ? value.toFixed(2) : value.toFixed(1))+" "+units[index];
}

export function percentageSaved(original:number, output:number):number{
  if(original<=0) return 0;
  return Math.max(0,Math.round(((original-output)/original)*100));
}

export function outputExtension(mime:string):string{
  if(mime==="image/png") return "png";
  if(mime==="image/jpeg") return "jpg";
  return "webp";
}
