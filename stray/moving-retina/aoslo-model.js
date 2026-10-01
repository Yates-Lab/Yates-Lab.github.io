/* Casile, Victor & Rucci (2019), Eqs. 2–4, Tables 1–2.
   Units: space in arcmin at API boundary, temporal impulse density in ms^-1. */
(function(root){
'use strict';
const PARAMS={M:{rc:.10,Kc:148,rs:.72,Ks:1.1,N:30,A:499.77,delay:2,Hs:1,tL:1.1,tS:2.23},P:{rc:.03,Kc:353.2,rs:.18,Ks:4.4,N:38,A:67.59,delay:3.5,Hs:.69,tL:1.27,tS:29.36}};
const SPATIAL_SCALE=.5,TEMPORAL_SCALE=1/1.6;
const logFac=[0];for(let n=1;n<100;n++)logFac[n]=logFac[n-1]+Math.log(n);
function gammaP(n,z){if(z<=0)return 0;if(z<n+1){let term=1,sum=1;for(let j=1;j<1000;j++){term*=z/(n+j);sum+=term;if(term<sum*1e-15)break;}return Math.exp(-z+n*Math.log(z)-logFac[n])*sum;}let term=1,sum=1;for(let j=1;j<n;j++){term*=z/j;sum+=term;}return 1-Math.exp(-z)*sum;}
function impulseAt(type,time){const p=PARAMS[type],t=time-TEMPORAL_SCALE*p.delay;if(t<=0)return 0;const l=TEMPORAL_SCALE*p.tL,s=TEMPORAL_SCALE*p.tS;const low=Math.exp((p.N-1)*Math.log(t)-t/l-p.N*Math.log(l)-logFac[p.N-1]);const gp=gammaP(p.N,(1/l-1/s)*t);const slow=gp>0?Math.exp(-t/s-Math.log(s)-p.N*Math.log(1-l/s)+Math.log(gp)):0;return p.A*(low-p.Hs*slow);}
function kernel(type,length=500){return Float64Array.from({length},(_,i)=>impulseAt(type,i));}
function temporalTransfer(type,f){const p=PARAMS[type],w=2*Math.PI*f/1000*TEMPORAL_SCALE;const z=w*p.tS;const hr=1-p.Hs/(1+z*z),hi=p.Hs*z/(1+z*z);const amp=p.A*(1+(w*p.tL)**2)**(-p.N/2),phase=-w*p.delay-p.N*Math.atan(w*p.tL);return {re:amp*(hr*Math.cos(phase)-hi*Math.sin(phase)),im:amp*(hr*Math.sin(phase)+hi*Math.cos(phase))};}
function spatialGain(type,f){const p=PARAMS[type];return Math.PI*(p.Kc*p.rc*p.rc*Math.exp(-((Math.PI*p.rc*SPATIAL_SCALE*f)**2))-p.Ks*p.rs*p.rs*Math.exp(-((Math.PI*p.rs*SPATIAL_SCALE*f)**2)));}
function erf(x){const sign=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a);return sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a));}
function rectangles(size,orientation){const s=size/5,h=size/2;const rects=[[-h,-h+s,-h,h],[-h+s,h,-h,-h+s],[-h+s,h,-s/2,s/2],[-h+s,h,h-s,h]];const rotate=([x,y])=>orientation==='left'?[-x,-y]:orientation==='up'?[y,-x]:orientation==='down'?[-y,x]:[x,y];return rects.map(([x0,x1,y0,y1])=>{const a=rotate([x0,y0]),b=rotate([x1,y1]);return [Math.min(a[0],b[0]),Math.max(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[1],b[1])];});}
function rectBlur(x,y,radius,rects){let value=0;for(const [x0,x1,y0,y1] of rects)value+=.25*(erf((x-x0)/radius)-erf((x-x1)/radius))*(erf((y-y0)/radius)-erf((y-y1)/radius));return value;}
function coverage(x,y,dx,rects){let area=0;for(const [x0,x1,y0,y1]of rects)area+=Math.max(0,Math.min(x+dx/2,x1)-Math.max(x-dx/2,x0))*Math.max(0,Math.min(y+dx/2,y1)-Math.max(y-dx/2,y0));return Math.min(1,area/(dx*dx));}
function blurredE(type,x,y,rects){const p=PARAMS[type],c=rectBlur(x,y,60*SPATIAL_SCALE*p.rc,rects),s=rectBlur(x,y,60*SPATIAL_SCALE*p.rs,rects);return Math.PI*(p.Kc*p.rc*p.rc*c-p.Ks*p.rs*p.rs*s);}
function schedule(rate,hold,exposure=1000,total=1300,matchMean=false){const gate=new Float64Array(total),onsets=[];for(let n=0;;n++){const t=Math.round(n*1000/rate);if(t>=exposure)break;onsets.push(t);for(let j=t;j<Math.min(t+hold,exposure);j++)gate[j]=1;}let count=0;for(let i=0;i<exposure;i++)count+=gate[i];const duty=count/exposure,peak=matchMean?1/duty:1;for(let i=0;i<total;i++)gate[i]*=peak;return {gate,onsets,duty,peak};}
function random(seed){let n=seed>>>0;return ()=>{n+=0x6D2B79F5;let z=n;z=Math.imul(z^(z>>>15),z|1);z^=z+Math.imul(z^(z>>>7),z|61);return ((z^(z>>>14))>>>0)/4294967296;};}
function trajectory(D,gain,total=1300,seed=7,onsets=[],controller='ideal',centering=0){
 if(!Number.isFinite(centering)||centering<0||centering>40)throw Error('Invalid centering');
 const rnd=random(seed),eyeX=new Float64Array(total),eyeY=new Float64Array(total),x=new Float64Array(total),y=new Float64Array(total);
 // Exact 1 ms transition of de = -centering * e dt + sqrt(2D) dW.
 // expm1 preserves the Brownian limit for small positive restoring rates.
 const decay=Math.exp(-centering/1000),sigma=centering===0?Math.sqrt(2*D/1000):Math.sqrt(D/centering*-Math.expm1(-2*centering/1000));
 let update=0,next=1;
 for(let t=0;t<total;t++){
  if(t>0&&t<1000){const r=Math.sqrt(-2*Math.log(Math.max(1e-12,rnd()))),a=2*Math.PI*rnd();eyeX[t]=decay*eyeX[t-1]+sigma*r*Math.cos(a);eyeY[t]=decay*eyeY[t-1]+sigma*r*Math.sin(a);}
  else if(t>=1000){eyeX[t]=eyeX[t-1];eyeY[t]=eyeY[t-1];}
  if(controller==='ideal')update=t;else if(next<onsets.length&&t>=onsets[next])update=onsets[next++];
  x[t]=gain*eyeX[update]-eyeX[t];y[t]=gain*eyeY[update]-eyeY[t];
 }
 return {eyeX,eyeY,x,y};
}
function convolve(signal,h,total=signal.length){const out=new Float32Array(total);for(let t=0;t<signal.length;t++)if(signal[t])for(let j=0;j<h.length&&t+j<total;j++)out[t+j]+=signal[t]*h[j];return out;}
function fft(re,im,inverse=false){const N=re.length;for(let i=1,j=0;i<N;i++){let bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=N;len<<=1){const angle=(inverse?2:-2)*Math.PI/len,wr0=Math.cos(angle),wi0=Math.sin(angle);for(let start=0;start<N;start+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const a=start+j,b=a+len/2,tr=wr*re[b]-wi*im[b],ti=wr*im[b]+wi*re[b];re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const nw=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=nw;}}}if(inverse)for(let i=0;i<N;i++){re[i]/=N;im[i]/=N;}}
function validate(s){for(const [key,min,max]of [['rate',5,120],['hold',1,200],['gain',-1,2],['D',0,100],['centering',0,40],['size',3,15],['contrast',0,1]])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error('Invalid '+key);if(!Number.isInteger(s.hold))throw Error('Hold must be whole milliseconds');if(!['right','up','left','down'].includes(s.orientation))throw Error('Unknown orientation');if(!['ideal','frame'].includes(s.controller))throw Error('Unknown compensation timing');return s;}
async function simulate(settings,progress=()=>{}){
 const s=validate({centering:10,...settings}),N=80,T=1300,FOV=24,dx=FOV/N,P=N*N;const light=schedule(s.rate,s.hold,1000,T,s.matchMean),motion=trajectory(s.D,s.gain,T,s.seed??7,light.onsets,s.controller,s.centering),rects=rectangles(s.size,s.orientation),hM=kernel('M'),hP=kernel('P');const bgM=convolve(light.gate,hM),bgP=convolve(light.gate,hP);for(let t=0;t<T;t++){bgM[t]*=spatialGain('M',0);bgP[t]*=spatialGain('P',0);}
 const input=new Float32Array(T*P),M=new Float32Array(T*P),PP=new Float32Array(T*P);
 const stationary=motion.x.every(v=>v===0)&&motion.y.every(v=>v===0);const active=[];for(let t=0;t<1000;t++)if(light.gate[t])active.push(t);
 progress(5,'Constructing retinal movie');
 if(stationary){const gM=convolve(light.gate,hM),gP=convolve(light.gate,hP);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const px=(x+.5)*dx-FOV/2,py=(y+.5)*dx-FOV/2,p=y*N+x,c=coverage(px,py,dx,rects),m=blurredE('M',px,py,rects),pp=blurredE('P',px,py,rects);for(let t=0;t<T;t++){const k=t*P+p;input[k]=light.gate[t]*(1-s.contrast*c);M[k]=bgM[t]-s.contrast*m*gM[t];PP[k]=bgP[t]-s.contrast*pp*gP[t];}}}
 else {
  // Translation lookup includes the complete motion excursion; no periodic spatial wrapping.
  let excursion=0;for(let t=0;t<T;t++)excursion=Math.max(excursion,Math.abs(motion.x[t]),Math.abs(motion.y[t]));const pad=Math.ceil(excursion/dx)+3,B=N+2*pad,baseM=new Float32Array(B*B),baseP=new Float32Array(B*B);
  for(let y=0;y<B;y++)for(let x=0;x<B;x++){const px=(x-pad+.5)*dx-FOV/2,py=(y-pad+.5)*dx-FOV/2; baseM[y*B+x]=blurredE('M',px,py,rects);baseP[y*B+x]=blurredE('P',px,py,rects);}
  const sm=new Float32Array(1000*P),sp=new Float32Array(1000*P);
  for(const t of active){const shiftX=motion.x[t]/dx,shiftY=motion.y[t]/dx,g=light.gate[t];for(let y=0;y<N;y++){const fy=y+pad-shiftY,iy=Math.floor(fy),ay=fy-iy;for(let x=0;x<N;x++){const fx=x+pad-shiftX,ix=Math.floor(fx),ax=fx-ix,j=iy*B+ix,p=y*N+x,k=t*P+p;const mix=a=>(1-ay)*((1-ax)*a[j]+ax*a[j+1])+ay*((1-ax)*a[j+B]+ax*a[j+B+1]);sm[k]=-s.contrast*g*mix(baseM);sp[k]=-s.contrast*g*mix(baseP);input[k]=g*(1-s.contrast*coverage((x+.5)*dx-FOV/2-motion.x[t],(y+.5)*dx-FOV/2-motion.y[t],dx,rects));}}}
  progress(25,'Applying causal M and P filters');
  const L=2048,hrM=new Float64Array(L),hiM=new Float64Array(L),hrP=new Float64Array(L),hiP=new Float64Array(L);hrM.set(hM);hrP.set(hP);fft(hrM,hiM);fft(hrP,hiP);const re=new Float64Array(L),im=new Float64Array(L);
  for(let p=0;p<P;p++){for(const [src,dest,hr,hi,bg]of [[sm,M,hrM,hiM,bgM],[sp,PP,hrP,hiP,bgP]]){re.fill(0);im.fill(0);for(const t of active)re[t]=src[t*P+p];fft(re,im);for(let k=0;k<L;k++){const a=re[k],b=im[k];re[k]=a*hr[k]-b*hi[k];im[k]=a*hi[k]+b*hr[k];}fft(re,im,true);for(let t=0;t<T;t++)dest[t*P+p]=re[t]+bg[t];}if(p%640===0)progress(25+70*p/P,'Filtering retinal movie');}
 }
 let maxM=0,maxP=0,optM=0,optP=0;for(let t=0;t<T;t++)for(let p=0;p<P;p++){const k=t*P+p;maxM=Math.max(maxM,Math.abs(M[k]));maxP=Math.max(maxP,Math.abs(PP[k]));optM=Math.max(optM,Math.abs(M[k]-bgM[t]));optP=Math.max(optP,Math.abs(PP[k]-bgP[t]));}
 progress(100,'Ready');return {N,T,FOV,dx,input,M,P:PP,bgM,bgP,hM,hP,gate:light.gate,onsets:light.onsets,duty:light.duty,peak:light.peak,motion,maxM,maxP,optM,optP,settings:s};
}
const api={PARAMS,SPATIAL_SCALE,TEMPORAL_SCALE,gammaP,impulseAt,kernel,temporalTransfer,spatialGain,rectangles,coverage,blurredE,schedule,trajectory,convolve,fft,validate,simulate};root.AOSLOModel=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
