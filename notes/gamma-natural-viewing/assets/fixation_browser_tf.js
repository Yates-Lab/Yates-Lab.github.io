/* All fixation traces and spectra use one Plotly x-axis and one plotting box. */
function tfSettings(){return {'tf-window':$('tf-window').value,'tf-method':$('tf-method').value,'tf-scale':$('tf-scale').value,'envelope-scale':$('envelope-scale').value,'eye-spectrum':'position'}}
function tfDb(x){return finite(x)&&x>0?10*Math.log10(x):null}
function stackDomains(){
 const enabled=phaseEnabled(),heights=enabled?[85,85,105,75,110,130,130,80,80,80]:[85,85,105,90,130,130,80,80,80],gap=24,total=heights.reduce((a,b)=>a+b,0)+gap*(heights.length-1);let top=1;
 const domains=heights.map(h=>{const d=[top-h/total,top];top=d[0]-gap/total;return d});
 if(enabled)domains.phase=domains.splice(3,1)[0];
 return domains;
}
function unifiedShapes(ms){
 const shapes=cursorShapes(ms).map(s=>s.type==='rect'?{...s,layer:'above',opacity:.08}:s);
 if(!C?.time_frequency)return shapes;
 const tf=C.time_frequency,domains=stackDomains();
 for(const [name,row,axisId] of [['eye',4,'y5'],['lfp',5,'y6']]){
  const v=tf[name],y=domains[row][0]-.006;
  for(let i=0;i<tf.time_ms.length;i++)if(v.valid[i]&&v.inside_fixation[i])shapes.push({type:'line',xref:'x',yref:'paper',x0:tf.time_ms[i]-tf.hop_ms/2,x1:tf.time_ms[i]+tf.hop_ms/2,y0:y,y1:y,line:{color:'#41845d',width:2}});
  if(v.maximum_frequency_hz<180)shapes.push({type:'rect',xref:'paper',yref:axisId,x0:0,x1:1,y0:v.maximum_frequency_hz+1,y1:180,fillcolor:'#e9edf0',line:{width:0},layer:'above'});
 }
 return shapes;
}
function addSpectralPanels(tr,ly){
 const tf=C.time_frequency;if(!tf)return;
 const domains=stackDomains(),relative=$('tf-scale').value==='relative',isPower=$('envelope-scale').value==='power',metric=isPower?'band_power':'rms',position=tf.eye_signal==='position',eyeName=position?'Eye position':'Eye velocity';
 ly.height=phaseEnabled()?1370:1220;$('traces').style.height=ly.height+'px';ly.margin={l:85,r:105,t:35,b:50};ly.xaxis.anchor='y11';ly.hovermode='closest';
 for(let i=0;i<4;i++)ly['yaxis'+(i===0?'':i+1)].domain=domains[i];
 const message=C.quality.selected_unavailable_reason;
 if(message)ly.annotations.push({xref:'paper',yref:'paper',x:.5,y:(domains[2][0]+domains[2][1])/2,text:'LFP unavailable: '+message,showarrow:false,font:{size:12,color:'#985323'}});
 for(const [name,row,number] of [['eye',4,5],['lfp',5,6]]){
  const v=tf[name],d=domains[row],units=name==='eye'?(position?'arcmin²/Hz':'(arcmin/s)²/Hz'):'µV²/Hz';
  const z=v.power.map((r,f)=>r.map(p=>relative?tfDb(p>0&&v.background[f]>0?p/v.background[f]:null):tfDb(p))),flat=z.flat().filter(finite);
  const low=relative?-8:Math.floor(percentile(flat,.02)),high=relative?8:Math.max(low+1,Math.ceil(percentile(flat,.98)));
  ly['yaxis'+number]={...axis(name==='eye'?'Eye spectrum<br>(Hz)':'LFP spectrum<br>(Hz)'),domain:d,range:[20,180],tickvals:[40,80,120,160]};
  tr.push({type:'heatmap',x:tf.time_ms,y:tf.frequencies,z,xaxis:'x',yaxis:'y'+number,zmin:low,zmax:high,zsmooth:false,connectgaps:false,hoverongaps:false,
   colorscale:relative?[[0,'#245d99'],[.5,'#fafafa'],[1,'#af343e']]:'Viridis',showscale:flat.length>0,
   colorbar:{title:{text:relative?'dB vs local<br>median':`dB<br>${units}`,font:{size:10}},len:d[1]-d[0]+.012,y:(d[1]+d[0])/2,thickness:12,x:1.015,tickfont:{size:10},nticks:3,yanchor:'middle'},
   customdata:z.map((r,f)=>r.map((_,j)=>[v.power[f][j],...v.support_ms[j],v.inside_fixation[j]?'inside this fixation':'includes outside time'])),
   hovertemplate:`%{x:.0f} ms · %{y} Hz<br>%{z:.2f} dB<br>%{customdata[0]:.3g} ${units}<br>Window: %{customdata[1]:.0f}…%{customdata[2]:.0f} ms<br>%{customdata[3]}<extra>${name==='eye'?eyeName:'LFP · ch '+contact}</extra>`});
  ly.annotations.push({xref:'paper',yref:'paper',x:0,y:d[1]+.005,xanchor:'left',yanchor:'bottom',showarrow:false,text:name==='eye'?`${eyeName} power · horizontal + vertical`:`LFP power · contact ${contact} · ${$('reference').selectedOptions[0].text}`,font:{size:11,color:color.ink}});
  if(!flat.length)ly.annotations.push({xref:'paper',yref:'paper',x:.5,y:(d[1]+d[0])/2,text:name==='lfp'?(message||'No complete, accepted LFP windows here; try a shorter window.'):'No complete, valid eye windows here.',showarrow:false,font:{size:12,color:'#985323'}});
 }
 tf.bands.forEach((band,i)=>{
  const number=7+2*i,overlay=number+1,d=domains[i+6],eu=position?(isPower?'arcmin²':'arcmin'):(isPower?'(arcmin/s)²':'arcmin/s'),lu=isPower?'µV²':'µV';
  ly['yaxis'+number]={...axis(`Eye ${isPower?'power':'RMS'}<br>${eu}`),domain:d,rangemode:'tozero',nticks:3,tickfont:{color:color.x,size:10},title:{text:`Eye ${isPower?'power':'RMS'}<br>${eu}`,font:{color:color.x,size:11}}};
  ly['yaxis'+overlay]={...axis(`LFP ${isPower?'power':'RMS'}<br>${lu}`),overlaying:'y'+number,side:'right',rangemode:'tozero',showgrid:false,nticks:3,tickfont:{color:color.lfp,size:10},title:{text:`LFP ${isPower?'power':'RMS'}<br>${lu}`,font:{color:color.lfp,size:11}}};
  for(const [name,num,clr,units] of [['eye',number,color.x,eu],['lfp',overlay,color.lfp,lu]])tr.push({type:'scatter',mode:'lines',x:tf.time_ms,y:tf[name][metric][i],xaxis:'x',yaxis:'y'+num,name:`${name==='eye'?eyeName:'LFP'} · ${band[0]}–${band[1]} Hz`,connectgaps:false,line:{color:clr,width:1.7},hovertemplate:`%{x:.0f} ms · %{y:.3g} ${units}<extra>%{fullData.name}</extra>`});
  ly.annotations.push({xref:'paper',yref:'paper',x:0,y:d[1]+.002,xanchor:'left',yanchor:'bottom',text:`${band[0]}–${band[1]} Hz · eye ${position?'position':'velocity'} teal / LFP blue${tf.eye.bands_available[i]?'':' · eye band unavailable'}`,showarrow:false,font:{size:10.5,color:color.ink}});
 });
 $('tf-resolution').textContent=`${tf.hop_ms} ms steps · smoothing ≈ ±${tf.lfp.half_bandwidth_hz.toFixed(1)} Hz`;
 $('tf-note').textContent=`${eyeName} on the native eye clock; each window is mean-subtracted before tapering, without linear detrending or an additional high-pass. ${$('tf-method').selectedOptions[0].text}; windows ${tf.eye.window_ms.toFixed(1)} ms eye / ${tf.lfp.window_ms.toFixed(1)} ms LFP. Eye ${tf.eye.fs.toFixed(1)} Hz; LFP ${tf.lfp.fs.toFixed(0)} Hz. Valid windows: eye ${tf.eye.valid_windows}/${tf.eye.total_windows}, LFP ${tf.lfp.valid_windows}/${tf.lfp.total_windows}. The 2 Hz grid adds no resolution. `+(relative?'Colors divide each frequency by its own median over this fixation plus 1 s each side; that is not a pre-image baseline.':'Colors show absolute power density with separate eye and LFP dB scales.');
 $('envelope-note').textContent=`Band power integrates spectral density over each entire labeled band. Eye curves show ${position?'position':'velocity'}. ${isPower?'Curves retain squared physical units.':'RMS is √power; eye RMS is √(horizontal band power + vertical band power).'} These are sliding-window band-power/RMS estimates, not instantaneous Hilbert envelopes. Eye and LFP have independent physical scales; no peak normalization or time shift is applied. The 60/120 Hz components are retained. Green bars mark windows wholly within the fixation.`;
}
async function plotTF(){if(C)await plotClip()}
async function plotEnvelopes(){if(C)await plotClip()}
function initTF(){
 for(const id of ['tf-window','tf-method','tf-scale','envelope-scale']){
  const v=query.get(id);if(v&&[...$(id).options].some(o=>o.value===v))$(id).value=v;
  $(id).onchange=()=>{save();if(['tf-window','tf-method'].includes(id))loadClip();else plotClip()};
 }
}
