/* The host may serve .gz literally or decode Content-Encoding itself. */
async function savedJSON(url) {
 const response=await fetch(url);
 if(!response.ok)throw Error('Saved data could not be loaded. Please reload the page.');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes[0]===31&&bytes[1]===139){
  if(!('DecompressionStream' in window))throw Error('This viewer needs a current Chrome, Firefox, Safari or Edge browser.');
  return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
 }
 return JSON.parse(new TextDecoder().decode(bytes));
}
