
const $=id=>document.getElementById(id), query=new URLSearchParams(location.search), initialSummary=false;
const color={x:'#007f8b',y:'#b16713',lfp:'#3160b1',remote:'#7b4caf',raw:'#83939b',ink:'#172c39'};
const config={responsive:true,displaylogo:false,modeBarButtonsToRemove:['select2d','lasso2d']};
let M=null,C=null,S=null,ordinal=Number(query.get('fixation')||0),unit=Number(query.get('unit')||59),contact=Number(query.get('contact')||30),request=0,statsTimer=null,playTimer=null,sceneImage=new Image(),sprite=new Image(),unitPage=0,tab='browse',loading=false;
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error)}
function option(value,text){return new Option(text,value)}
function opts(el,entries,value){el.replaceChildren(...entries.map(x=>option(x[0],x[1])));if(value!==undefined)el.value=value}
const dataCache=new Map();
async function readData(path){
 if(!dataCache.has(path))dataCache.set(path,savedJSON('../data/'+path+'.json.gz'));
 try{return await dataCache.get(path)}catch(e){dataCache.delete(path);throw e}
}
async function api(path,p={}){
 const root='fixations/'+p.session;
 if(path==='/api/sessions')return readData('fixations/manifest');
 if(path==='/api/session')return readData(root+'/session');
 if(path==='/api/rf')return (await readData(root+'/rf'))[p.unit]||{available:false,reason:'No saved map for this unit.'};
 if(path==='/api/clip'){
  const prefix=root+'/'+p.fixation+'/'+p.reference+'/'+p.contact;
  const [common,trace,tf,eye,phase]=await Promise.all([readData(root+'/'+p.fixation+'/common'),readData(prefix+'/trace'),readData(prefix+'/tf-'+p['tf-window']+'-'+p['tf-method']),readData(root+'/'+p.fixation+'/eye-'+p['tf-window']+'-'+p['tf-method']),readData(prefix+'/phase-'+p['phase-band'])]);
  return {...common,...trace,time_frequency:{...tf,eye},spike_phase:phase};
 }
 throw Error('This operation is not part of the public export.');
}
function params(){return {session:$('session').value,reference:$('reference').value}}
function save(){let q=new URLSearchParams({...params(),fixation:ordinal,unit,contact,context:$('context').value,...tfSettings(),...phaseSettings()});history.replaceState(null,'',location.pathname+'?'+q+(tab==='summary'?'#averages':''))}
function axis(title){return {title:{text:title,standoff:8},showgrid:true,gridcolor:'#e5ecef',zerolinecolor:'#c2d1d8',automargin:true}}
function layout(height){return {height,paper_bgcolor:'white',plot_bgcolor:'white',font:{family:'system-ui, sans-serif',size:12,color:color.ink},margin:{l:85,r:30,t:35,b:50},hovermode:'x unified',showlegend:false}}
function median(x){let a=x.filter(v=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:0}
function finite(x){return x!==null&&Number.isFinite(x)}
function percentile(a,p){a=a.filter(finite).sort((a,b)=>a-b);return a.length?a[Math.min(a.length-1,Math.floor(p*a.length))]:1}
let contactNotice='';
function availableContacts(){return M.available_contacts?.[$('reference').value]||M.good_contacts}
function contactOptions(wanted){
 const usable=availableContacts(),all=M.public_contacts,source=all.includes(wanted)?wanted:(selectedUnit()?.channel??all[0]);
 contactNotice='';contact=source;
 if(!usable.includes(source)&&usable.length){
  const shank=M.shanks.find(s=>s.includes(source)),near=usable.filter(c=>shank.includes(c)),pool=near.length?near:usable;
  contact=pool.slice().sort((a,b)=>Math.abs(M.geometry[a][1]-M.geometry[source][1])-Math.abs(M.geometry[b][1]-M.geometry[source][1])||a-b)[0];
  contactNotice=`Contact ${source} is unavailable for this reference${M.good_contacts.includes(source)?' because its required channel pair is excluded':' because it is excluded by the saved LFP quality mask'}. Showing contact ${contact}, ${Math.abs(M.geometry[contact][1]-M.geometry[source][1])} µm away${near.length?' on the same shank':' on the other shank'}. The selected spike unit is unchanged.`;
 }
 opts($('contact'),all.map(c=>[c,`Ch ${c} · shank ${M.shanks.findIndex(s=>s.includes(c))+1} · ${M.geometry[c][1]} µm${usable.includes(c)?'':' · unavailable'}`]),contact);
 for(const option of $('contact').options)option.disabled=!usable.includes(Number(option.value));
 showContactNotice();
}
function showContactNotice(){const issue=C?.session===M?.session&&C?.channel===contact?C.quality.selected_unavailable_reason:'';const note=[contactNotice,issue].filter(Boolean).join(' ');$('contact-note').textContent=note;$('contact-note').classList.toggle('hidden',!note)}
function selectedUnit(){return M?.units.find(u=>u.id===unit)}
async function loadSession(){
 const ticket=++request;stopPlay();clearTimeout(statsTimer);M=null;C=null;S=null;status('Loading saved session examples…');
 try{const m=await api('/api/session',{session:$('session').value});if(ticket!==request)return;M=m;if(!query.has('unit')||!m.units.some(u=>u.id===unit))unit=m.default_unit;ordinal=Math.max(0,Math.min(ordinal,m.fixations.length-1));
 opts($('unit'),m.units.slice().sort((a,b)=>a.shank-b.shank||a.depth-b.depth||a.id-b.id).map(u=>[u.id,`Unit ${u.id} · ${u.label} · shank ${u.shank+1} · ch ${u.channel}`]),unit);
 if(!$('unit').value){unit=m.units.find(u=>u.label==='good')?.id??m.units[0].id;$('unit').value=unit}
 contactOptions(contact);
 const trials=[...new Set(m.fixations.map(f=>f.trial))];opts($('trial'),trials.map(t=>[t,`Trial ${t}`]));
 await loadClip();loadRF();
 }catch(e){status(e.message,true)}
}
function fixationControls(){let f=M.fixations[ordinal];$('trial').value=f.trial;opts($('fixation'),M.fixations.filter(x=>x.trial===f.trial).map(x=>[x.ordinal,`${x.within_trial} · ${Math.round(x.duration*1000)} ms`]),ordinal);$('prev').disabled=ordinal===0;$('next').disabled=ordinal===M.fixations.length-1}
async function loadClip(){if(!M)return;if(!availableContacts().includes(contact))contactOptions(contact);const ticket=++request;stopPlay();fixationControls();status('Loading saved fixation…');save();
 try{let c=await api('/api/clip',{...params(),fixation:ordinal,unit,contact,context:$('context').value,...tfSettings(),...phaseSettings()});if(ticket!==request)return;C=c;showContactNotice();
 $('clip-title').textContent=`Trial ${c.fixation.trial} · fixation ${c.fixation.within_trial} · ${Math.round(c.fixation.duration*1000)} ms`;
 $('clip-description').textContent=`${M.session} · saved example ${ordinal+1} of ${M.fixations.length.toLocaleString()} · ${c.image.filename}`;
 $('patch-description').textContent=`${c.crop.width} × ${c.crop.height} pixels · ${c.crop.side_degrees.toFixed(2)}° wide. This region covers the mapped RF population.`;
 $('scene').parentElement.style.aspectRatio=(c.screen[2]-c.screen[0])+'/'+(c.screen[3]-c.screen[1]);
 sceneImage=new Image();sprite=new Image();await Promise.all([new Promise((resolve,reject)=>{sceneImage.onload=resolve;sceneImage.onerror=()=>reject(Error('Image unavailable'));sceneImage.src='../data/fixations/'+M.session+'/'+ordinal+'/image.png'}),new Promise((resolve,reject)=>{sprite.onload=resolve;sprite.onerror=()=>reject(Error('Saved image crops unavailable'));sprite.src=c.crop.sprite})]);if(ticket!==request)return;
 $('cursor').min=0;$('cursor').max=Math.max(0,c.crop.t.length-1);$('cursor').value=c.crop.t.reduce((best,t,i)=>Math.abs(t-c.fixation.duration*500)<Math.abs(c.crop.t[best]-c.fixation.duration*500)?i:best,0);
 await plotClip();if(ticket!==request)return;drawFrame(Number($('cursor').value));status(`${M.fixations.length} saved examples from ${M.total_fixations.toLocaleString()} image fixations · ${M.units.length} sorted units · ${Math.round(M.eye.native_median_hz)} Hz native eye tracking. Use the arrows to browse.`);
 }catch(e){if(ticket===request)status(e.message,true)}
}
async function loadRF(){if(!M)return;const uid=unit,sn=M.session;$('rf-title').textContent=`Unit ${uid} · measured RF map`;
 try{let rf=await api('/api/rf',{session:sn,unit:uid});if(unit!==uid||M.session!==sn)return;$('rf-image').style.display=rf.available?'block':'none';if(rf.available)$('rf-image').src=rf.image;$('rf-description').textContent=rf.available?'Saved spike-triggered image at its strongest lag, in the same crop coordinates. Red / blue: opposite luminance signs.':rf.reason;}catch(e){$('rf-description').textContent=e.message}
}
function cursorShapes(ms){if(!C)return[];const end=C.fixation.duration*1000,lo=C.t[0],hi=C.t.at(-1);return [
 {type:'rect',xref:'x',yref:'paper',x0:lo,x1:0,y0:0,y1:1,fillcolor:'#b7c4cb',opacity:.18,line:{width:0},layer:'below'},
 {type:'rect',xref:'x',yref:'paper',x0:end,x1:hi,y0:0,y1:1,fillcolor:'#b7c4cb',opacity:.18,line:{width:0},layer:'below'},
 ...[0,end].map(x=>({type:'line',xref:'x',yref:'paper',x0:x,x1:x,y0:0,y1:1,line:{color:'#627b88',width:1,dash:'dash'}})),
 {type:'line',xref:'x',yref:'paper',x0:ms,x1:ms,y0:0,y1:1,line:{color:'#b16713',width:1}}]}
function drawFrame(i,updatePlot=true){if(!C||!C.crop.t.length)return;i=Math.max(0,Math.min(C.crop.t.length-1,i));$('cursor').value=i;const t=C.crop.t[i],roi=C.crop.roi[i];
 const canvas=$('scene'),ctx=canvas.getContext('2d'),screen=C.screen;canvas.width=screen[2]-screen[0];canvas.height=screen[3]-screen[1];ctx.fillStyle='#808080';ctx.fillRect(0,0,canvas.width,canvas.height);const r=C.image.rect;ctx.drawImage(sceneImage,r[0],r[1],r[2]-r[0],r[3]-r[1]);
 ctx.lineWidth=3;ctx.strokeStyle='#00c3cb';ctx.beginPath();let begun=false;
 for(let j=0;j<C.eye_t.length;j++){if(C.eye_t[j]<0||C.eye_t[j]>C.fixation.duration*1000)continue;const p=C.eye_pixels[j];if(!p.every(finite)){begun=false;continue}if(!begun){ctx.moveTo(p[0],p[1]);begun=true}else ctx.lineTo(p[0],p[1])}ctx.stroke();
 let nearest=C.eye_t.reduce((b,v,j)=>Math.abs(v-t)<Math.abs(C.eye_t[b]-t)?j:b,0),g=C.eye_pixels[nearest];if(g.every(finite)){ctx.fillStyle='#04eced';ctx.beginPath();ctx.arc(g[0],g[1],5,0,Math.PI*2);ctx.fill()}
 ctx.strokeStyle='#ffce55';ctx.lineWidth=3;ctx.strokeRect(roi[1][0],roi[0][0],roi[1][1]-roi[1][0],roi[0][1]-roi[0][0]);
 let patch=$('patch'),pc=patch.getContext('2d');patch.width=C.crop.width;patch.height=C.crop.height;pc.imageSmoothingEnabled=false;let columns=C.crop.columns||C.crop.t.length;pc.drawImage(sprite,(i%columns)*C.crop.width,Math.floor(i/columns)*C.crop.height,C.crop.width,C.crop.height,0,0,C.crop.width,C.crop.height);
 if(!C.crop.valid[i]){pc.fillStyle='#b52c2c88';pc.fillRect(0,0,patch.width,patch.height)}
 $('cursor-time').textContent=`${Math.round(t)} ms after saccade end${C.crop.valid[i]?'':' · tracking invalid'}`;
 if(updatePlot&&$('traces').data)Plotly.relayout('traces',{shapes:unifiedShapes(t)});
}
async function plotClip(){const c=C, traces=[],pos=c.eye_xy.map(a=>{const inside=a.filter((v,j)=>c.eye_t[j]>=0&&c.eye_t[j]<c.fixation.duration*1000);let m=median(inside);return a.map(v=>v===null?null:v-m)});
 function line(x,y,row,name,clr,width=1.4){traces.push({type:'scatter',mode:'lines',x,y,name,line:{color:clr,width},xaxis:'x',yaxis:row===1?'y':`y${row}`,connectgaps:false,hovertemplate:`%{y:.2f}<extra>${name}</extra>`})}
 line(c.eye_t,pos[0],1,'Horizontal position',color.x);line(c.eye_t,pos[1],1,'Vertical position',color.y);
 line(c.velocity_t,c.velocity[0],2,'Horizontal velocity',color.x);line(c.velocity_t,c.velocity[1],2,'Vertical velocity',color.y);
 let ci=c.channels.indexOf(contact);line(c.t,c.field[ci],3,`Ch ${contact} · full LFP`,color.raw);line(c.t,c.fast[ci],3,`Ch ${contact} · >30 Hz`,color.lfp,1.7);
 const units=M.units.slice().sort((a,b)=>a.shank-b.shank||a.depth-b.depth||a.id-b.id),rows=new Map(units.map((u,i)=>[u.id,i]));
 const sx=[],sy=[],txt=[],sc=[],ss=[],sw=[];c.spike_t.forEach((t,i)=>{let id=c.spike_units[i];if(rows.has(id)){sx.push(t);sy.push(rows.get(id));const phase=phaseEnabled()?spikePhasePoint(i):null;txt.push(`Unit ${id} · ${M.units.find(u=>u.id===id).label}${phase?'<br>'+phase.description:''}`);sc.push(phase?phase.color:id===unit?'#c66813':'#738692');ss.push(id===unit?10:7);sw.push(id===unit?2.5:1.4)}});
 traces.push({type:'scatter',mode:'markers',x:sx,y:sy,text:txt,marker:{symbol:'line-ns',size:ss,color:sc,line:{width:sw,color:sc}},yaxis:'y4',name:'Spikes',hovertemplate:'%{x:.2f} ms<br>%{text}<extra></extra>'});
 const ly=layout(730);ly.margin={l:75,r:15,t:27,b:50};ly.xaxis={...axis('Time from saccade end (ms)'),domain:[0,1],anchor:'y4',range:[c.t[0],c.t.at(-1)]};
 ly.yaxis={...axis('Eye position<br>(arcmin)'),domain:[.81,1]};ly.yaxis2={...axis('Eye velocity<br>(arcmin/s)'),domain:[.57,.75]};ly.yaxis3={...axis(`LFP · ch ${contact}<br>(µV)`),domain:[.30,.51]};
 ly.yaxis4={...axis('Spikes<br>(units by depth)'),domain:[0,.23],range:[-.8,units.length],tickvals:[0,units.length-1],ticktext:[`Unit ${units[0].id}`,`Unit ${units.at(-1).id}`]};
 if(rows.has(unit)){const r=rows.get(unit);ly.yaxis4.tickvals=[...new Set([0,r,units.length-1])].sort((a,b)=>a-b);ly.yaxis4.ticktext=ly.yaxis4.tickvals.map(i=>`Unit ${units[i].id}${units[i].id===unit?' ◀':''}`)}
 if($('eye-scale').value==='fixation'){
 const p=pos.flatMap(a=>a.filter((v,j)=>c.eye_t[j]>=0&&c.eye_t[j]<c.fixation.duration*1000&&finite(v))).map(Math.abs),v=c.velocity.flatMap(a=>a.filter((v,j)=>c.velocity_t[j]>=5&&c.velocity_t[j]<c.fixation.duration*1000-5&&finite(v))).map(Math.abs);
 const pr=Math.max(.5,percentile(p,.99)*1.18),vr=Math.max(50,percentile(v,.99)*1.18);ly.yaxis.range=[-pr,pr];ly.yaxis2.range=[-vr,vr];
 }
 ly.annotations=[{xref:'paper',yref:'paper',x:1,y:1.035,xanchor:'right',text:$('eye-scale').value==='fixation'?'Scale shows fixation detail; large context saccades are clipped.':'Position relative to fixation median; velocity unsmoothed.',showarrow:false,font:{size:11,color:'#526876'}}];
 addSpectralPanels(traces,ly);addPhasePanel(traces,ly);ly.shapes=unifiedShapes(c.crop.t[Number($('cursor').value)]||0);await Plotly.react('traces',traces,ly,config);
 $('traces').removeAllListeners('plotly_hover');$('traces').on('plotly_hover',event=>{let ms=event.points[0].x;if(c.crop.t.length){let best=c.crop.t.reduce((b,v,i)=>Math.abs(v-ms)<Math.abs(c.crop.t[b]-ms)?i:b,0);drawFrame(best)}});
 $('trace-note').textContent=`${$('reference').selectedOptions[0].text}. ${phaseEnabled()?`HSV ticks: LFP phase; taller ticks: unit ${unit}.`:`Orange ticks: selected unit ${unit}; gray ticks: other units from both shanks.`} Selected LFP contact ${contact}: ${c.quality.selected_accepted_samples.toLocaleString()} of ${c.quality.selected_total_samples.toLocaleString()} samples accepted; rejected samples appear as gaps. No time shift has been applied.`;
}
function stopPlay(){clearInterval(playTimer);playTimer=null;$('play').textContent='▶ Play slowly'}
$('session').onchange=()=>{ordinal=0;loadSession()};
$('reference').onchange=()=>{contactOptions(contact);loadClip()};
$('unit').onchange=()=>{unit=Number($('unit').value);loadRF();if(C)plotClip();save()};
$('contact').onchange=()=>{contact=Number($('contact').value);contactNotice='';loadClip()};
$('prev').onclick=()=>{if(!M||ordinal<=0)return;ordinal--;loadClip()};
$('next').onclick=()=>{if(!M||ordinal>=M.fixations.length-1)return;ordinal++;loadClip()};
$('trial').onchange=()=>{ordinal=M.fixations.find(f=>f.trial===Number($('trial').value)).ordinal;loadClip()};$('fixation').onchange=()=>{ordinal=Number($('fixation').value);loadClip()};$('context').onchange=loadClip;
$('eye-scale').onchange=()=>{if(C)plotClip()};
$('cursor').oninput=()=>{stopPlay();drawFrame(Number($('cursor').value))};$('play').onclick=()=>{if(playTimer)return stopPlay();$('play').textContent='❚❚ Pause';playTimer=setInterval(()=>{let n=Number($('cursor').value)+1;if(n>=C.crop.t.length)n=0;drawFrame(n)},70)};
document.addEventListener('keydown',e=>{if(tab!=='browse'||!M||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='ArrowRight')$('next').click();if(e.key==='ArrowLeft')$('prev').click()});
initTF();
initPhase();
(async()=>{try{let r=await api('/api/sessions');opts($('session'),r.sessions.map(s=>[s,s]),query.get('session')||'Allen_2022-04-13');$('reference').value=['shank_car','recorded','cross_shank'].includes(query.get('reference'))?query.get('reference'):'shank_car';$('context').value='200';await loadSession();}catch(e){status(e.message,true)}})();
