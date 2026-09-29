const viewer=document.querySelector('dialog');
let origin=null;
function enlarge(img) { origin=img;const large=viewer.querySelector('img');large.src=img.src;large.alt=img.alt;viewer.showModal(); }
document.querySelectorAll('figure img').forEach(img=>{
 img.addEventListener('click',()=>enlarge(img));
 img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();enlarge(img)}});
});
viewer.querySelector('button').addEventListener('click',()=>viewer.close());
viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close()});
viewer.addEventListener('close',()=>origin?.focus({preventScroll:true}));
