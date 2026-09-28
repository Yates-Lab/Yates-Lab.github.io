'use strict';
const $=id=>document.getElementById(id), query=new URLSearchParams(location.search), cache=new Map();
let sessions=[],ticket=0;
const diverging=[[0,'#245d99'],[.5,'#fafafa'],[1,'#af343e']];
const config={responsive:true,displaylogo:false,displayModeBar:false};
async function data(path){
 if(!cache.has(path))cache.set(path,savedJSON('../data/cohort/'+path+'.json.gz'));
 try{return await cache.get(path)}catch(e){cache.delete(path);throw e}
}
function sessionChoices(value='all'){
 const ns=sessions.filter(n=>$('animal').value==='all'||n.startsWith($('animal').value+'_'));
 $('session').replaceChildren(new Option('All sessions for this animal','all'),...ns.map(n=>new Option(n,n)));
 $('session').value=ns.includes(value)?value:'all';
}
function keepPanel(p){return ($('animal').value==='all'||p.animal===$('animal').value)&&($('shank').value==='both'||p.shank===Number($('shank').value)||p.paired)}
function mean(rows){return rows[0]?.map((_,i)=>{const a=rows.map(r=>r[i]).filter(v=>v!==null&&Number.isFinite(v));return a.length?a.reduce((x,y)=>x+y,0)/a.length:null})||[]}
function base(title){return {height:325,margin:{l:53,r:15,t:62,b:49},font:{family:'system-ui, sans-serif',size:11,color:'#213b49'},title:{text:title,font:{size:12},x:.5},paper_bgcolor:'white',plot_bgcolor:'white',showlegend:false,hovermode:'closest'}}
function drawMap(el,p,d,key){
 const phase=key==='ispc', ly=base(`${p.paired?'Across shanks':'Shank '+(p.shank+1)} · ${p.layer}<br>${p.sessions} session${p.sessions===1?'':'s'}`);
 ly.xaxis={title:{text:'From saccade onset (ms)'},range:[-100,300],tickvals:[-100,0,100,200,300],zeroline:false};
 ly.yaxis={title:{text:'Frequency (Hz)'},type:'log',range:[0,Math.log10(256)],tickvals:[1,2,4,8,16,32,64,128,256],zeroline:false};
 ly.shapes=[{type:'line',x0:0,x1:0,y0:1,y1:256,line:{color:'white',width:1}},
 {type:'rect',x0:-100,x1:300,y0:180,y1:256,fillcolor:'#c4cbd0',opacity:.4,line:{width:0}}];
 if(p.saccade_hz)ly.shapes.push({type:'line',x0:-100,x1:300,y0:p.saccade_hz,y1:p.saccade_hz,line:{color:'#388262',width:1.5}});
 return Plotly.newPlot(el,[{type:'heatmap',x:d.time,y:d.frequency,z:p[key],zmin:phase?0:-.5,zmax:.5,colorscale:phase?'Viridis':diverging,zsmooth:false,showscale:false,hoverongaps:false,hovertemplate:`%{x} ms · %{y:.1f} Hz<br>%{z:.3f} ${phase?'phase consistency':'SD'}<extra>${p.layer}</extra>`}],ly,config);
}
function drawSpectrum(el,p,d){
 const rows=p.rows.filter(r=>$('session').value==='all'||r.session===$('session').value),ly=base(`${p.paired?'Across shanks':'Shank '+(p.shank+1)} · ${p.layer}<br>${rows.length} session${rows.length===1?'':'s'}`);
 ly.xaxis={title:{text:'Frequency (Hz)'},range:[20,140],tickvals:[20,40,60,80,100,120,140]};
 ly.yaxis={title:{text:'Power change (%)'},zeroline:true,zerolinecolor:'#abbcc5',range:window.spectrumRange};
 ly.shapes=[60,120].map(f=>({type:'line',x0:f,x1:f,yref:'paper',y0:0,y1:1,line:{color:'#bbbec4',width:1,dash:'dot'}}));
 const tr=rows.map(r=>({x:d.frequency,y:r.percent,type:'scatter',mode:'lines',name:r.session,line:{color:'#bcc9d0',width:1},hovertemplate:`%{x} Hz · %{y:.1f}%<extra>${r.session}</extra>`}));
 if(rows.length)tr.push({x:d.frequency,y:mean(rows.map(r=>r.percent)),type:'scatter',mode:'lines',name:rows.length>1?'Equal-session mean':rows[0].session,line:{color:p.animal==='Allen'?'#087f8c':'#b16532',width:2.5},hovertemplate:'%{x} Hz · %{y:.1f}%<extra>%{fullData.name}</extra>'});
 else ly.annotations=[{text:'No supported depth-matched pairs',xref:'paper',yref:'paper',x:.5,y:.5,showarrow:false}];
 return Plotly.newPlot(el,tr,ly,config);
}
function depthTable(d){
 const rows=d.depth.filter(r=>($('animal').value==='all'||r.session.startsWith($('animal').value+'_'))&&($('shank').value==='both'||r.shank===Number($('shank').value)||$('reference').value==='cross_shank'));
 const table=document.createElement('table'),header=table.createTHead().insertRow();
 for(const t of ['Session','Shank','Stored center (µm)','Early sink (µm)','Independent check']){const th=document.createElement('th');th.textContent=t;header.append(th)}
 const body=table.createTBody();for(const r of rows){const tr=body.insertRow();for(const v of [r.session,r.shank+1,r.current_center_um,r.early_sink_um??'—',r.comparable?'Qualified; difference '+Math.abs(r.current_center_um-r.early_sink_um)+' µm':'Uncertain: '+r.reason])tr.insertCell().textContent=v}
 $('depth-table').replaceChildren(table);
}
async function render(){
 const id=++ticket,ref=$('reference').value,session=$('session').value,key=$('measure').value;
 $('coverage').classList.remove('error');$('coverage').textContent='Loading saved results…';
 $('shank').disabled=ref==='cross_shank';if(ref==='cross_shank')$('shank').value='both';
 history.replaceState(null,'',location.pathname+'?'+new URLSearchParams(Object.fromEntries(['animal','session','reference','measure','shank'].map(k=>[k,$(k).value]))));
 try{
  const maps=await data(ref+'/'+session);const d=key==='image'?await data(ref+'/image'):maps;if(id!==ticket)return;
  const panels=d.panels.filter(keepPanel),ns=maps.selected_sessions.filter(n=>$('animal').value==='all'||n.startsWith($('animal').value+'_'));
  // Event totals count each session once, never once per depth or contact.
  const bySession=new Map(maps.coverage.filter(r=>ns.includes(r.session)).map(r=>[r.session,r.events]));
  const events=[...bySession.values()].reduce((a,b)=>a+b,0);
  $('coverage').textContent=`${ns.length} session${ns.length===1?'':'s'} · ${ns.filter(n=>n.startsWith('Allen')).length} Allen / ${ns.filter(n=>n.startsWith('Logan')).length} Logan · ${key==='image'?'paired image/pre-image spectral comparison':events.toLocaleString()+' eligible saccades'} · unnotched LFP`;
  $('explanation').textContent=key==='power_z'?'Time zero is saccade onset. Red means more power than usual at that contact and frequency; blue means less. Power is standardized over valid image-viewing time across trials before saccade averaging. It is not percent change from a pre-image baseline. Five-cycle Morlet windows preserve slow structure but spread slow-frequency timing over seconds.':key==='ispc'?'Time zero is saccade onset. Brighter colors mean more repeatable LFP phase across saccades (0: little repeatability; 1: perfect agreement). The displayed scale ends at 0.5, so higher values saturate. Phase consistency is computed within each contact before averaging; it does not measure phase locking to eye tremor.':'The curves compare power during image viewing with paired pre-image periods. Zero means no change; 100% means twice the pre-image power. Faint curves are individual sessions; the thick curve gives sessions equal weight. Frequencies at 60 and 120 Hz are marked, not removed. These are completed benchmark spectra, not the single-example estimator.';
  const strip=document.createElement('span');strip.className='color-strip';
  if(key==='ispc')strip.style.background='linear-gradient(to right,#440154,#31688e,#35b779,#fde725)';
  $('legend').replaceChildren();if(key!=='image'){$('legend').append(key==='power_z'?'−0.5 SD': '0',strip,key==='power_z'?'+0.5 SD':'0.5 phase consistency');$('legend').append(' · Green line: inverse median inter-saccade interval.')}else $('legend').textContent='Shared vertical scale across the displayed panels. Gray: individual sessions; color: mean.';
  if(key==='image'){
   const values=panels.flatMap(p=>p.rows.filter(r=>session==='all'||r.session===session).flatMap(r=>r.percent)).filter(v=>v!==null&&Number.isFinite(v));
   const low=Math.min(0,...values),high=Math.max(1,...values),pad=(high-low)*.08;
   window.spectrumRange=[low-pad,high+pad];
  }
  document.querySelectorAll('.cohort-plot').forEach(el=>Plotly.purge(el));$('plots').replaceChildren();
  for(const animal of [...new Set(panels.map(p=>p.animal))]){
   const h=document.createElement('h2');h.className='animal-label';h.textContent=animal;const grid=document.createElement('div');grid.className='cohort-grid';$('plots').append(h,grid);
   for(const p of panels.filter(p=>p.animal===animal)){if(id!==ticket)return;const el=document.createElement('div');el.className='cohort-plot';grid.append(el);if(key==='image')await drawSpectrum(el,p,d);else await drawMap(el,p,d,key)}
  }
  if(id!==ticket)return;
  $('averaging').textContent=key==='image'?d.normalization+' This summary uses the completed 4,262-trial benchmark and its earlier quality mask. The single-trial examples in the report use the fixed-quality follow-up and a different spectral estimator.':maps.averaging+' Colors are descriptive, not significance tests. All eligible saccades are retained, including short fixations.';
  depthTable(maps);
 }catch(e){if(id===ticket){$('coverage').textContent=e.message;$('coverage').classList.add('error')}}
}
(async()=>{try{
 const m=await data('manifest');sessions=m.sessions;
 for(const id of ['animal','reference','measure','shank'])if([...$(id).options].some(o=>o.value===query.get(id)))$(id).value=query.get(id);
 const requested=query.get('session');if(sessions.includes(requested))$('animal').value=requested.split('_')[0];sessionChoices(requested);
 $('animal').onchange=()=>{sessionChoices();render()};for(const id of ['session','reference','measure','shank'])$(id).onchange=render;
 await render();
}catch(e){$('coverage').textContent=e.message;$('coverage').classList.add('error')}})();
