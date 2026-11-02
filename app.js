const MAX=10;
const $=s=>document.querySelector(s);
const workspace=$("#workspace"), board=$("#board"), cardsEl=$("#cards");
const input=$("#channelInput");
let channels=JSON.parse(localStorage.getItem("tm_channels")||"[]").slice(0,MAX);
let selected=localStorage.getItem("tm_chat")||"";
let positions=JSON.parse(localStorage.getItem("tm_positions")||"{}");
let zoom=Number(localStorage.getItem("tm_zoom")||1);
let pan=JSON.parse(localStorage.getItem("tm_pan")||'{"x":0,"y":0}');
let dragging=null, panning=null;

function parentDomain(){return location.hostname}
function playerUrl(ch){
  const u=new URL("https://player.twitch.tv/");
  u.searchParams.set("channel",ch);u.searchParams.set("parent",parentDomain());
  u.searchParams.set("autoplay","false");u.searchParams.set("muted","true");return u.toString()
}
function chatUrl(ch){
  const u=new URL(`https://www.twitch.tv/embed/${encodeURIComponent(ch)}/chat`);
  u.searchParams.set("parent",parentDomain());return u.toString()+"&darkpopout"
}
function save(){localStorage.setItem("tm_channels",JSON.stringify(channels));localStorage.setItem("tm_positions",JSON.stringify(positions));localStorage.setItem("tm_zoom",String(zoom));localStorage.setItem("tm_pan",JSON.stringify(pan));localStorage.setItem("tm_chat",selected)}
function defaultPos(i){
  const cols=3, gapX=590, gapY=380;
  return {x:40+(i%cols)*gapX,y:40+Math.floor(i/cols)*gapY,w:560,h:350}
}
function posFor(ch,i){
  if(!positions[ch]) positions[ch]=defaultPos(i);
  const p=positions[ch];
  if(p.fill){p.w=Math.max(1,Number(p.w)||160);p.h=Math.max(1,Number(p.h)||90)}
  else{p.w=Math.max(160,Number(p.w)||560);p.h=Math.round(p.w*9/16)}
  return p
}
function applyBoard(){board.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}
function selectCard(ch){
  document.querySelectorAll(".stream-card").forEach(c=>c.classList.toggle("selected",c.dataset.channel===ch))
}
function openChat(ch){
  selected=ch;$("#chatTitle").textContent=`#${ch} chat`;$("iframe#chatFrame").src=chatUrl(ch);
  $("#chatPanel").classList.add("open");selectCard(ch);save()
}
function closeChat(){selected="";$("#chatPanel").classList.remove("open");$("#chatFrame").src="about:blank";save()}

// Width of the chat panel when it is open (0 when closed), so fitting can leave room for it.
function chatWidth(){
  const panel=$("#chatPanel");
  return panel.classList.contains("open")?panel.offsetWidth:0
}

// Scale a 16:9 player so it fully covers a w x h box (crops the overflow, no black bars).
function coverIframe(ifr,w,h){
  const R=16/9;
  let iw=w, ih=w/R;
  if(ih<h){ih=h;iw=h*R}
  ifr.style.width=iw+"px";ifr.style.height=ih+"px";
  ifr.style.left=((w-iw)/2)+"px";ifr.style.top=((h-ih)/2)+"px"
}

// Pick the number of rows that keeps the tiles closest to 16:9 (least cropping).
// Tile counts per row differ by at most one. Row heights are proportional to 1/tilesInRow,
// which gives every tile the same shape, so every stream is cropped by the same small amount.
function bestRows(n,vw,vh){
  const R=16/9;
  let best=null;
  for(let r=1;r<=n;r++){
    const base=Math.floor(n/r), extra=n%r;
    const parts=[];
    for(let i=0;i<r;i++) parts.push(base+(i<extra?1:0));
    const S=parts.reduce((t,k)=>t+1/k,0);
    const a=vw*S/vh;
    const score=Math.min(a,R)/Math.max(a,R);
    if(!best||score>best.score+1e-9) best={parts,S,score}
  }
  return best
}

function fillScreenBoard(){
  const n=channels.length;
  if(!n) return;

  const vw=Math.max(1,workspace.clientWidth-chatWidth());
  const vh=Math.max(1,workspace.clientHeight);

  const {parts,S}=bestRows(n,vw,vh);

  // Tiles cover the whole area edge to edge. Each player is scaled up to cover its tile,
  // so every pixel is video (the edges of the picture get cropped a little).
  let idx=0, acc=0;
  parts.forEach(k=>{
    const y0=Math.round(vh*acc/S);
    acc+=1/k;
    const y1=Math.round(vh*acc/S);
    for(let c=0;c<k;c++){
      const x0=Math.round(vw*c/k), x1=Math.round(vw*(c+1)/k);
      positions[channels[idx++]]={x:x0,y:y0,w:x1-x0,h:y1-y0,fill:true};
    }
  });

  // Reset view so tiles map 1:1 to the viewport.
  zoom=1;
  pan={x:0,y:0};
  save();
  render();
}


// Stream controls use delegated capture handlers so the Twitch iframe can never swallow the X click.
document.addEventListener("pointerdown", (e) => {
  const btn = e.target.closest?.(".remove");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
}, true);

document.addEventListener("click", (e) => {
  const btn = e.target.closest?.(".remove");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const card = btn.closest(".stream-card");
  const ch = card?.dataset.channel;
  if (!ch) return;
  channels = channels.filter(x => x !== ch);
  delete positions[ch];
  if (selected === ch) closeChat();
  save();
  render();
}, true);


// Custom 16:9 resize handle.
// Width is the primary control; height is always width * 9 / 16.
let resizing = null;

document.addEventListener("pointerdown", (e) => {
  const handle = e.target.closest?.(".resize-handle");
  if (!handle) return;
  const card = handle.closest(".stream-card");
  if (!card) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  const ch = card.dataset.channel;
  const p = positions[ch];
  if (!p) return;

  resizing = {
    ch,
    startX: e.clientX,
    startW: card.getBoundingClientRect().width,
    pointerId: e.pointerId
  };
  handle.setPointerCapture?.(e.pointerId); document.body.style.userSelect="none";
  selectCard(ch);
}, true);

document.addEventListener("pointermove", (e) => {
  if (!resizing) return;
  e.preventDefault();

  const p = positions[resizing.ch];
  if (!p) return;

  if (p.fill) {
    // Manually resizing a filled tile goes back to a normal 16:9 tile.
    p.fill = false;
    const fc = document.querySelector(`.stream-card[data-channel="${CSS.escape(resizing.ch)}"]`);
    if (fc) {
      fc.classList.remove("fill");
      const fi = fc.querySelector("iframe.player");
      if (fi) fi.style.cssText = "";
    }
  }

  // Account for board zoom so the handle tracks the cursor correctly.
  const delta = (e.clientX - resizing.startX) / Math.max(zoom, 0.01);
  const w = Math.max(160, Math.round(resizing.startW + delta));
  const h = Math.round(w * 9 / 16);

  p.w = w;
  p.h = h;

  const card = document.querySelector(`.stream-card[data-channel="${CSS.escape(resizing.ch)}"]`);
  if (card) {
    card.style.width = `${w}px`;
    card.style.height = `${h}px`;
  }
}, true);

document.addEventListener("pointerup", (e) => {
  if (!resizing) return;
  save();
  resizing = null; document.body.style.userSelect="";
}, true);

document.addEventListener("pointercancel", () => {
  if (!resizing) return;
  save();
  resizing = null; document.body.style.userSelect="";
}, true);

function render(){
  cardsEl.innerHTML="";
  channels.forEach((ch,i)=>{
    const p=posFor(ch,i);
    const card=document.createElement("article");
    card.className="stream-card"+(p.fill?" fill":"");
    card.dataset.channel=ch;card.style.zIndex=String(10+i);
    card.style.left=p.x+"px";card.style.top=p.y+"px";card.style.width=p.w+"px";card.style.height=p.h+"px";
    card.innerHTML=`<div class="card-head"><span class="channel">#${escapeHtml(ch)}</span><div class="card-actions">
      <button class="icon-btn chat" type="button">Chat</button>
      <button class="icon-btn full" type="button">Fullscreen</button>
      <button class="icon-btn remove" type="button">×</button></div></div>
      <div class="player-wrap"><iframe class="player" src="${playerUrl(ch)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${escapeHtml(ch)}"></iframe></div>`;
    if(p.fill) coverIframe(card.querySelector("iframe.player"),p.w,p.h);
    const handle=document.createElement("div");
    handle.className="resize-handle always-visible";
    handle.setAttribute("aria-label","Resize stream");
    handle.title="Resize";
    card.appendChild(handle);
    const head=card.querySelector(".card-head");
    head.addEventListener("pointerdown",e=>startCardDrag(e,card,ch));
    card.querySelector(".chat").onclick=e=>{e.stopPropagation();openChat(ch)};
    card.querySelector(".remove").onclick=e=>{e.stopPropagation();channels=channels.filter(x=>x!==ch);delete positions[ch];if(selected===ch)closeChat();save();render()};
    card.querySelector(".full").onclick=e=>{e.stopPropagation();card.requestFullscreen?.()};
    card.addEventListener("pointerdown",()=>selectCard(ch));
    cardsEl.appendChild(card);
  });
  selectCard(selected);applyBoard()
}
function startCardDrag(e,card,ch){
  if(e.button!==0)return;
  // Let the header buttons (Chat / Fullscreen / x) receive their own clicks instead of starting a drag.
  if(e.target.closest?.(".card-actions"))return;
  e.preventDefault();e.stopPropagation();
  const p=positions[ch];const rect=workspace.getBoundingClientRect();
  const startX=e.clientX,startY=e.clientY,startLeft=p.x,startTop=p.y;
  dragging={card,ch,startX,startY,startLeft,startTop};
  card.setPointerCapture?.(e.pointerId)
}
workspace.addEventListener("pointermove",e=>{
  if(dragging){
    const dx=(e.clientX-dragging.startX)/zoom,dy=(e.clientY-dragging.startY)/zoom;
    const p=positions[dragging.ch];p.x=Math.max(0,dragging.startLeft+dx);p.y=Math.max(0,dragging.startTop+dy);
    dragging.card.style.left=p.x+"px";dragging.card.style.top=p.y+"px";return
  }
  if(panning){
    pan.x=panning.startPanX+(e.clientX-panning.startX);pan.y=panning.startPanY+(e.clientY-panning.startY);
    applyBoard()
  }
});
workspace.addEventListener("pointerup",e=>{if(dragging){dragging=null;save()}if(panning){panning=null;workspace.classList.remove("panning");save()}});
workspace.addEventListener("pointercancel",()=>{dragging=null;panning=null;workspace.classList.remove("panning");save()});
workspace.addEventListener("pointerdown",e=>{
  if(e.target.closest(".stream-card"))return;
  if(e.button!==0)return;
  selectCard(""); // clicking empty space unfocuses the selected tile
  panning={startX:e.clientX,startY:e.clientY,startPanX:pan.x,startPanY:pan.y};workspace.classList.add("panning")
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")selectCard("")});
workspace.addEventListener("wheel",e=>{
  e.preventDefault();
  const factor=e.deltaY<0?1.08:.925;
  const old=zoom,newZoom=Math.min(1.8,Math.max(.35,zoom*factor));
  const r=workspace.getBoundingClientRect();
  const mx=e.clientX-r.left,my=e.clientY-r.top;
  pan.x=mx-(mx-pan.x)*(newZoom/old);pan.y=my-(my-pan.y)*(newZoom/old);zoom=newZoom;
  applyBoard();save()
},{passive:false});
$("#addForm").addEventListener("submit",e=>{
  e.preventDefault();let ch=input.value.trim().toLowerCase().replace(/^#/,"");
  if(!ch||channels.includes(ch)||channels.length>=MAX)return;
  channels.push(ch);input.value="";save();render()
});
$("#chatBtn").onclick=()=>{if($("#chatPanel").classList.contains("open"))closeChat();else if(selected)openChat(selected);else if(channels[0])openChat(channels[0])};
$("#closeChat").onclick=closeChat;
$("#fitBtn").onclick=()=>{
  if(!channels.length)return;
  const ps=channels.map((ch,i)=>posFor(ch,i));const minX=Math.min(...ps.map(p=>p.x)),minY=Math.min(...ps.map(p=>p.y));
  const maxX=Math.max(...ps.map(p=>p.x+p.w)),maxY=Math.max(...ps.map(p=>p.y+p.h));
  const r=workspace.getBoundingClientRect(), pad=50;
  const availW=Math.max(1,r.width-chatWidth());
  const sx=(availW-pad*2)/(maxX-minX),sy=(r.height-pad*2)/(maxY-minY);
  zoom=Math.min(1,Math.max(.35,Math.min(sx,sy)));
  pan.x=pad-minX*zoom;pan.y=pad-minY*zoom;save();applyBoard()
};
$("#resetBtn").onclick=()=>{
  positions={};zoom=1;pan={x:0,y:0};save();render()
};
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
render();

const fillScreenBtn=document.getElementById("fillScreen");
if(fillScreenBtn) fillScreenBtn.addEventListener("click",fillScreenBoard);
