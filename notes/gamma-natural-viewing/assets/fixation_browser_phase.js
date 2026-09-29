/* Circular HSV spike colors. The phase source is always stated explicitly. */
function phaseSettings(){return {'spike-colors':$('spike-colors').value,'phase-band':$('phase-band').value,'phase-source':$('phase-source').value,'phase-floor':$('phase-floor').value}}
function phaseEnabled(){return $('spike-colors').value==='phase'&&!!C?.spike_phase}
function phaseColor(angle){
 if(!finite(angle))return '#b2bdc4';
 const h=((angle/(2*Math.PI))%1+1)%1*6,x=1-Math.abs(h%2-1),rgb=[[1,x,0],[x,1,0],[0,1,x],[0,x,1],[x,0,1],[1,0,x]][Math.min(5,Math.floor(h))];
 return `rgb(${rgb.map(v=>Math.round(217*v)).join(',')})`;
}
function spikePhasePoint(i){
 const p=C.spike_phase,source=$('phase-source').value,id=C.spike_units[i],v=p.spikes[source],angle=v.angle[i],amplitude=v.amplitude[i],ch=source==='selected'?contact:p.unit_contacts[id];
 const valid=finite(angle)&&finite(amplitude)&&amplitude>=Number($('phase-floor').value);
 return {valid,angle,amplitude,ch,color:phaseColor(valid?angle:null),description:`Phase source: ch ${ch??'unknown'} · ${p.band} Hz<br>`+(valid?`${(angle*180/Math.PI).toFixed(1)}° · envelope ${amplitude.toFixed(2)} µV`:(finite(angle)?`Below display floor · envelope ${amplitude.toFixed(2)} µV`:'Phase unavailable: missing reference, gap or guarded edge'))};
}
function addPhasePanel(tr,ly){
 const enabled=phaseEnabled();$('phase-legend').classList.toggle('hidden',!enabled);$('phase-readout').classList.toggle('hidden',!enabled);
 if(!enabled)return;
 const p=C.spike_phase,source=$('phase-source').value,g=p.guides[source],domain=stackDomains().phase,floor=Number($('phase-floor').value);
 ly.yaxis13={...axis('Phase guide<br>(µV)'),domain,nticks:3,zeroline:true};
 tr.push({type:'scatter',mode:'lines',x:p.time_ms,y:g.waveform,xaxis:'x',yaxis:'y13',name:`${p.band} Hz · ch ${g.channel}`,line:{color:'#9eabb2',width:1},connectgaps:false,hoverinfo:'skip'});
 tr.push({type:'scatter',mode:'markers',x:p.time_ms,y:g.waveform,xaxis:'x',yaxis:'y13',name:'Band phase guide',marker:{size:3.5,color:g.angle.map((a,i)=>phaseColor(g.amplitude[i]>=floor?a:null))},customdata:g.angle.map((a,i)=>[finite(a)?a*180/Math.PI:null,g.amplitude[i]]),hovertemplate:`%{x:.1f} ms · %{y:.2f} µV<br>%{customdata[0]:.1f}° · envelope %{customdata[1]:.2f} µV<extra>Ch ${g.channel} · ${p.band} Hz</extra>`});
 ly.annotations.push({xref:'paper',yref:'paper',x:0,y:domain[1]+.004,xanchor:'left',yanchor:'bottom',text:`${p.band} Hz phase guide · ch ${g.channel}${source==='nearby'?` · reference for unit ${unit}`:' · common reference for all spikes'}`,showarrow:false,font:{size:10.5,color:color.ink}});
 if(!g.angle.some(finite))ly.annotations.push({xref:'paper',yref:'paper',x:.5,y:(domain[0]+domain[1])/2,text:'No supported phase here; spikes using this reference remain gray.',showarrow:false,font:{size:11,color:'#985323'}});
 let all=0,valid=0,own=0,ownValid=0;
 C.spike_t.forEach((t,i)=>{if(t<0||t>=C.fixation.duration*1000)return;const point=spikePhasePoint(i);all++;if(point.valid)valid++;if(C.spike_units[i]===unit){own++;if(point.valid)ownValid++}});
 $('phase-readout').textContent=`Inside this fixation: ${valid.toLocaleString()}/${all.toLocaleString()} spikes have displayed phase; unit ${unit}: ${ownValid}/${own}. `+(source==='selected'?`All spikes use ch ${contact}; simultaneous spikes therefore have the same color. `:'Each neuron uses its fixed contact 140 µm away on the same shank; depth-dependent phase reversals can change colors. No substitute contact is used when that reference is missing. ')+`The guide shows ${source==='selected'?'the common reference':`unit ${unit}’s reference`}. Taller, thicker ticks identify the selected unit. Gray ticks have unavailable phase or an envelope below ${floor} µV. This is a phase display, not an oscillation or phase-locking test.`;
}
function initPhase(){
 for(const id of ['spike-colors','phase-band','phase-source','phase-floor']){
  const v=query.get(id);if(v&&[...$(id).options].some(o=>o.value===v))$(id).value=v;
  $(id).onchange=()=>{save();if(id==='phase-band')loadClip();else if(C)plotClip()};
 }
}
