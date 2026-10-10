/* Observed physiology for the neuron currently inspected in the coupling map. */
(() => {
  const cache = new Map();
  let current = null, physiology = null, partner = null, page = 0, serial = 0;
  let wavesOn = false, ccgsOn = false, pairOnly = false, normalized = false, range = 150;
  let wavePositions = [];
  const gold = '#bd7b00', teal = '#087e8b';
  const panel = document.createElement('section');
  panel.id = 'physiology'; panel.hidden = true;
  panel.innerHTML = `<h2 id="physiology-title">Waveforms and spike correlations</h2>
    <p id="physiology-status"></p>
    <div class="controls physiology-controls"><label>Connected unit <select id="physiology-partner"></select></label>
    <label><input id="physiology-pair" type="checkbox"> Only show this pair</label></div>
    <div id="waveform-view" hidden><h3>Waveforms along the probes</h3>
      <p class="small">Gold: selected unit. Teal: inspected partner. Gray: other connected units. Each peak-channel waveform is centered at its unit’s recorded depth; the two shanks are separated for visibility.</p>
      <label class="small"><input id="waveform-normalize" type="checkbox"> Normalize each waveform to compare shape</label>
      <canvas id="waveform-probes" width="980" height="820" aria-label="Selected and connected units’ waveforms along recording probes"></canvas>
      <p id="waveform-hover" class="small">Point at a unit’s marker to see its waveform details; click to inspect that partner.</p>
    </div>
    <div id="ccg-view" hidden><h3>Observed cross-correlograms</h3>
      <p class="small">Positive lag: the connected unit spikes <strong>after</strong> the selected unit. Bars show partner firing rate around recorded spikes of the selected unit; the dashed line is the partner’s mean rate. BackImage, 2-ms bins, valid intervals within single trials. These are observed correlations, not evidence of direct synapses.</p>
      <div class="controls"><label>Lag window <select id="ccg-range"><option value="150">±150 ms</option><option value="50">±50 ms</option><option value="25">±25 ms</option></select></label>
      <button id="ccg-prev">Previous</button><span id="ccg-page" class="small"></span><button id="ccg-next">Next</button></div>
      <div id="ccg-grid"></div>
    </div>`;
  document.getElementById('detail').after(panel);
  const byId = id => document.getElementById(id);
  function connections() {
    if (!current) return [];
    const m = new Map();
    for (const edge of current.s.edges) {
      if (edge[0] !== current.n.index && edge[1] !== current.n.index) continue;
      const other = edge[0] === current.n.index ? edge[1] : edge[0];
      const row = m.get(other) || {index: other, strength: 0, edges: []};
      row.strength = Math.max(row.strength, edge[3]); row.edges.push(edge); m.set(other, row);
    }
    return [...m.values()].sort((a,b) => b.strength-a.strength);
  }
  window.physiologyControls = () => `<div class="physiology-toggles">
    <label><input type="checkbox" data-physiology="waves" ${wavesOn?'checked':''}> Show waveforms</label>
    <label><input type="checkbox" data-physiology="ccgs" ${ccgsOn?'checked':''}> Show CCGs</label>
    ${wavesOn||ccgsOn?'<a href="#physiology">View below the session graph ↓</a>':''}</div>`;
  function syncToggles() {
    const target = document.querySelector('.physiology-toggles');
    if (target) target.outerHTML = window.physiologyControls();
  }
  document.addEventListener('change', e => {
    const kind = e.target.dataset.physiology;
    if (!kind) return;
    if (kind === 'waves') wavesOn = e.target.checked; else ccgsOn = e.target.checked;
    syncToggles(); update();
  });
  window.clearPhysiology = () => { serial++; current = null; physiology = null; panel.hidden = true; };
  window.updatePhysiology = (s,n) => {
    if (current?.s.session === s.session && current.n.index === n.index) return;
    current = {s,n}; physiology = null; page = 0;
    partner = connections()[0]?.index ?? null;
    update();
  };
  async function update() {
    const id = ++serial;
    panel.hidden = !current || !(wavesOn || ccgsOn);
    if (panel.hidden) return;
    byId('waveform-view').hidden = true; byId('ccg-view').hidden = true;
    byId('physiology-title').textContent = `${current.s.session.replaceAll('_',' ')} · unit ${current.n.cid}`;
    byId('physiology-status').textContent = 'Loading measured waveforms and spike correlations…';
    try {
      const name = current.s.session;
      if (!cache.has(name)) cache.set(name, fetch(`physiology/${encodeURIComponent(name)}.json`).then(r => {
        if (!r.ok) throw Error('Physiology data are unavailable for this snapshot'); return r.json();
      }).catch(e => {cache.delete(name); throw e;}));
      const d = await cache.get(name);
      if (id !== serial) return;
      if (d.snapshot_sha256 !== data.snapshot.sha256 || d.session !== name ||
          d.units.some(u => current.s.nodes[u.index]?.cid !== u.cid)) throw Error('Physiology and graph unit identities do not match');
      physiology = d;
      const linked = connections();
      byId('physiology-status').textContent = `${linked.length} connected units · ${d.units[current.n.index].reference_spikes.toLocaleString()} recorded reference spikes with complete ±151-ms windows · ${(d.exposure_seconds/60).toFixed(1)} minutes of valid BackImage.`;
      byId('physiology-partner').innerHTML = linked.map(p => `<option value="${p.index}">Unit ${d.units[p.index].cid} · shank ${d.units[p.index].shank+1}</option>`).join('');
      byId('physiology-partner').disabled = !linked.length;
      if (partner !== null) byId('physiology-partner').value = partner;
      byId('waveform-view').hidden = !wavesOn; byId('ccg-view').hidden = !ccgsOn;
      if (wavesOn) drawWaveforms(); if (ccgsOn) drawCCGs();
    } catch(e) { if (id === serial) byId('physiology-status').textContent = e.message; }
  }
  function inspect(index) {
    partner = index; byId('physiology-partner').value = index;
    if (wavesOn) drawWaveforms(); if (ccgsOn) drawCCGs();
  }
  byId('physiology-partner').addEventListener('change',e => inspect(Number(e.target.value)));
  byId('physiology-pair').addEventListener('change',e => {pairOnly=e.target.checked;page=0;if(wavesOn)drawWaveforms();if(ccgsOn)drawCCGs();});
  byId('waveform-normalize').addEventListener('change',e => {normalized=e.target.checked;drawWaveforms();});
  byId('ccg-range').addEventListener('change',e => {range=Number(e.target.value);drawCCGs();});
  byId('ccg-prev').addEventListener('click',() => {page--;drawCCGs();});
  byId('ccg-next').addEventListener('click',() => {page++;drawCCGs();});
  function drawWaveforms() {
    if (!physiology || !current) return;
    const c=byId('waveform-probes'),ctx=c.getContext('2d'),W=c.width,H=c.height;
    ctx.clearRect(0,0,W,H);ctx.fillStyle='white';ctx.fillRect(0,0,W,H);
    const d=physiology, source=current.n.index;
    const indices=[...new Set([source,...(pairOnly?(partner===null?[]:[partner]):connections().map(x=>x.index))])];
    const units=indices.map(i=>d.units[i]), ymin=-65,ymax=Math.max(1120,...d.geometry_um.map(g=>g[1]))+40;
    const left=80,right=W-30,top=65,bottom=H-82,py=y=>bottom-(y-ymin)/(ymax-ymin)*(bottom-top);
    const center=shank=>left+(shank+.5)/d.shanks.length*(right-left),time=d.waveform_time_ms;
    const width=Math.min(210,(right-left)/d.shanks.length*.56),px=(t,shank)=>center(shank)+(t-(time[0]+time.at(-1))/2)/(time.at(-1)-time[0])*width;
    const maximum=Math.max(1,...units.flatMap(u=>u.waveform_uv.map(Math.abs))),commonScale=42/maximum;
    ctx.font='16px system-ui';ctx.textAlign='right';
    for(let y=0;y<=ymax;y+=200){ctx.strokeStyle='#e5e9ed';ctx.beginPath();ctx.moveTo(left,py(y));ctx.lineTo(right,py(y));ctx.stroke();ctx.fillStyle='#53616d';ctx.fillText(y,left-10,py(y)+5);}
    for(let si=0;si<d.shanks.length;si++){
      const x=center(si);ctx.strokeStyle='#c3cdd5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,py(0));ctx.lineTo(x,py(Math.max(...d.shanks[si].map(j=>d.geometry_um[j][1]))));ctx.stroke();
      ctx.fillStyle='#d8dfe5';for(const ch of d.shanks[si])ctx.fillRect(x-3,py(d.geometry_um[ch][1])-3,6,6);
      ctx.fillStyle='#25323b';ctx.textAlign='center';ctx.font='20px system-ui';ctx.fillText(`Shank ${si+1}`,x,32);
      ctx.font='14px system-ui';for(const t of [-1,0,1])ctx.fillText(t,px(t,si),H-45);ctx.fillText('Waveform time (ms)',x,H-20);
    }
    wavePositions=[];
    units.sort((a,b)=>(a.index===source?2:a.index===partner?1:0)-(b.index===source?2:b.index===partner?1:0));
    for(const u of units){const active=u.index===source, inspected=u.index===partner,col=active?gold:inspected?teal:'#8593a1',scale=normalized?30/Math.max(1,...u.waveform_uv.map(Math.abs)):commonScale;
      const y=py(u.depth_um);ctx.strokeStyle=col;ctx.globalAlpha=active||inspected?1:.4;ctx.lineWidth=active||inspected?2.4:1;
      ctx.beginPath();time.forEach((t,j)=>j?ctx.lineTo(px(t,u.shank),y-u.waveform_uv[j]*scale):ctx.moveTo(px(t,u.shank),y-u.waveform_uv[j]*scale));ctx.stroke();ctx.globalAlpha=1;
      const x=px(time[0],u.shank)-10;ctx.beginPath();ctx.arc(x,y,active||inspected?5:3,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();wavePositions.push({x,y,u});
      if(active||inspected){ctx.font='15px system-ui';ctx.textAlign='right';ctx.fillText(`Unit ${u.cid}`,x-9,y+5);}
    }
    ctx.fillStyle='#53616d';ctx.font='16px system-ui';ctx.save();ctx.translate(21,H/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText('Native probe depth (µm; superficial ↑)',0,0);ctx.restore();
    ctx.textAlign='left';if(normalized)ctx.fillText('Each unit scaled separately; shape comparison only',left,H-65);else{const value=50, x=W-115,y=105;ctx.strokeStyle='#25323b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+value*commonScale);ctx.stroke();ctx.font='14px system-ui';ctx.fillText('50 µV',x+8,y+value*commonScale/2+5);}
    byId('waveform-hover').textContent=`${units.length} units shown. Point at a marker for unit details; click to inspect a connected partner.`;
  }
  const waveCanvas=byId('waveform-probes');
  function nearestWave(e){const r=waveCanvas.getBoundingClientRect();let best=null,distance=12;for(const p of wavePositions){const d=Math.hypot(e.clientX-r.left-p.x*r.width/waveCanvas.width,e.clientY-r.top-p.y*r.height/waveCanvas.height);if(d<distance){distance=d;best=p.u;}}return best;}
  waveCanvas.addEventListener('mousemove',e=>{const u=nearestWave(e);if(u)byId('waveform-hover').textContent=`Unit ${u.cid} · shank ${u.shank+1} · ${u.depth_um.toFixed(0)} µm · peak channel ${u.peak_channel} · peak-to-peak ${(Math.max(...u.waveform_uv)-Math.min(...u.waveform_uv)).toFixed(1)} µV · ${u.waveform_spikes} waveform samples`;});
  waveCanvas.addEventListener('click',e=>{const u=nearestWave(e);if(u&&u.index!==current.n.index)inspect(u.index);});
  function drawCCGs(){
    if(!physiology||!current)return;
    const linked=connections().filter(x=>!pairOnly||x.index===partner),size=6,pages=Math.max(1,Math.ceil(linked.length/size));page=Math.max(0,Math.min(page,pages-1));
    byId('ccg-prev').disabled=page===0;byId('ccg-next').disabled=page>=pages-1;
    byId('ccg-page').textContent=linked.length?`${page*size+1}–${Math.min((page+1)*size,linked.length)} of ${linked.length} partners`:'No connected partners in this snapshot';
    const grid=byId('ccg-grid');grid.replaceChildren();const source=current.n.index,reference=physiology.units[source];
    for(const row of linked.slice(page*size,(page+1)*size)){
      const u=physiology.units[row.index],a=Math.min(source,u.index),b=Math.max(source,u.index),pair=physiology.ccgs[`${a}:${b}`];
      const box=document.createElement('article');box.className='ccg-card'+(partner===u.index?' inspected':'');
      const directions=row.edges.map(e=>`${current.s.nodes[e[0]].cid} → ${current.s.nodes[e[1]].cid}: ${e[2]>0?'positive':'negative'}`).join(' · ');
      const title=document.createElement('h4');title.textContent=`Selected ${reference.cid} · partner ${u.cid}`;box.appendChild(title);
      const meta=document.createElement('p');meta.className='small';meta.textContent=`${reference.shank===u.shank?'Same':'Different'} shank · fitted filters: ${directions}`;box.appendChild(meta);
      if(!pair||!reference.reference_spikes){const note=document.createElement('p');note.textContent='No complete-window reference spikes available.';box.appendChild(note);grid.appendChild(box);continue;}
      const counts=source===a?pair.a_to_b:pair.b_to_a,rates=counts.map(v=>v/reference.reference_spikes/(physiology.bin_ms/1000));
      const canvas=document.createElement('canvas');canvas.width=440;canvas.height=260;canvas.setAttribute('aria-label',`Observed CCG: positive lag means unit ${u.cid} after unit ${reference.cid}`);box.appendChild(canvas);ccgPlot(canvas,physiology.lags_ms,rates,u.baseline_hz);
      const button=document.createElement('button');button.textContent=partner===u.index?'Inspected partner':'Inspect this partner';button.addEventListener('click',()=>inspect(u.index));box.appendChild(button);grid.appendChild(box);
    }
  }
  function ccgPlot(canvas,lags,rates,baseline){const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,l=57,r=W-15,t=15,b=H-45;
    const max=1.15*Math.max(1,baseline,...rates.filter((_,i)=>Math.abs(lags[i])<=range)),px=x=>l+(x+range)/(2*range)*(r-l),py=y=>b-y/max*(b-t);
    ctx.fillStyle='white';ctx.fillRect(0,0,W,H);ctx.font='14px system-ui';ctx.fillStyle='#53616d';ctx.textAlign='right';
    for(let i=0;i<=2;i++){const v=max*i/2;ctx.fillText(v.toFixed(v<10?1:0),l-7,py(v)+5);ctx.strokeStyle='#e4eaef';ctx.beginPath();ctx.moveTo(l,py(v));ctx.lineTo(r,py(v));ctx.stroke();}
    ctx.fillStyle=teal;const bw=(r-l)*2/(2*range);for(let i=0;i<lags.length;i++){if(Math.abs(lags[i])>range)continue;ctx.fillRect(px(lags[i])-bw/2,py(rates[i]),Math.max(.5,bw-.2),b-py(rates[i]));}
    ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.strokeStyle='#42525f';ctx.beginPath();ctx.moveTo(l,py(baseline));ctx.lineTo(r,py(baseline));ctx.stroke();ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(px(0),t);ctx.lineTo(px(0),b);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='#53616d';ctx.beginPath();ctx.moveTo(l,t);ctx.lineTo(l,b);ctx.lineTo(r,b);ctx.stroke();ctx.textAlign='center';for(const x of [-range,0,range])ctx.fillText(x,px(x),b+19);ctx.fillText('Partner lag from selected unit (ms)',(l+r)/2,H-3);ctx.save();ctx.translate(14,(t+b)/2);ctx.rotate(-Math.PI/2);ctx.fillText('Partner spikes/s',0,0);ctx.restore();
  }
})();
