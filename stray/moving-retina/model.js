/* Mathematical core. Frequencies q in cycles/degree, f in Hz; D in arcmin²/s. */
(function(root){
'use strict';
const PI=Math.PI;
function bandwidth(q,D){return 2*PI*(D/3600)*q*q;}
function mass(q,D,lo,hi,center=0){const b=bandwidth(q,D);if(b===0)return center>=lo&&center<hi?1:0;return (Math.atan((hi-center)/b)-Math.atan((lo-center)/b))/PI;}
function components(mode,m=1,f0=30){if(mode==='steady'||mode==='additive')return [{c:0,w:1}];if(mode==='reversal')return [{c:-f0,w:m*m/4},{c:f0,w:m*m/4}];const out=[{c:0,w:1}];if(mode==='sine'){out.push({c:-f0,w:m*m/4},{c:f0,w:m*m/4});}else if(mode==='pulse'){for(let n=1;n<=19;n+=2){const w=(2*m/(PI*n))**2;out.push({c:-n*f0,w},{c:n*f0,w});}}return out;}
function density(q,D,beta,lo,hi,mode='steady',m=1,f0=30){return q**(-beta)*components(mode,m,f0).reduce((a,z)=>a+z.w*mass(q,D,lo,hi,z.c),0)/(hi-lo);}
function gain2(f,peak){const z=Math.abs(f)/peak;return z*z*Math.exp(2*(1-z));}
function weighted(q,D,mode,m,f0,peak){let central=0,shifted=0;for(const z of components(mode,m,f0)){let p=0;if(D===0){p=gain2(z.c,peak);}else{const step=.1,b=bandwidth(q,D);for(let f=-600+step/2;f<600;f+=step){const weight=z.c===0?step*b/(PI*(b*b+f*f)):mass(q,D,f-step/2,f+step/2,z.c);p+=weight*gain2(f,peak);}}if(z.c===0)central+=z.w*p;else shifted+=z.w*p;}return {central,shifted,total:central+shifted};}
function saccade(A,q,keepTrace=true){const dt=.0001,T=.03+.005*A,N=7001;const ah=Math.exp(-dt/.08),al=Math.exp(-dt/.008);let oldC=1,oldS=0,hc=0,hs=0,lc=0,ls=0,energy=0;const trace=[];for(let i=0;i<N;i++){const t=i*dt-.3;const z=Math.max(0,Math.min(1,t/T));const u=A*(10*z**3-15*z**4+6*z**5);const c=Math.cos(2*PI*q*u),s=Math.sin(2*PI*q*u);hc=ah*(hc+c-oldC);hs=ah*(hs+s-oldS);lc=al*lc+(1-al)*hc;ls=al*ls+(1-al)*hs;energy+=(lc*lc+ls*ls)*dt/2;oldC=c;oldS=s;if(keepTrace&&i%2===0)trace.push({t,u,r:Math.cos(2*PI*q*u+PI/4),filtered:lc});}return {trace,energy,T};}
const api={bandwidth,mass,components,density,gain2,weighted,saccade};root.RetinaModel=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
