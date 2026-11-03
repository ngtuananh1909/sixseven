/** Share sheet on supported phones; standard PNG download as fallback. */
export async function saveCanvas(canvas, filename) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Không tạo được ảnh PNG.');
  const file = new File([blob], filename, {type:'image/png'});
  if (typeof navigator.share === 'function' && navigator.canShare?.({files:[file]})) {
    try { await navigator.share({files:[file],title:'Six Seven'}); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
