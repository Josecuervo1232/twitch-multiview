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
  u.searchParams.set("parent",parentDomain());return u.toString()
}
function save(){localStorage.setItem("tm_channels",JSON.stringify(channels));localStorage.setItem("tm_positions",JSON.stringify(positions));localStorage.setItem("tm_zoom",String(zoom));localStorage.setItem("tm_pan",JSON.stringify(pan));localStorage.setItem("tm_chat",selected)}
function defaultPos(i){
  const cols=3, gapX=590, gapY=380;
  return {x:40+(i%cols)*gapX,y:40+Math.floor(i/cols)*gapY,w:560,h:350}
}
function posFor(ch,i){
  if(!positions[ch]) positions[ch]=defaultPos(i);
  const p=positions[ch];
  p.w=Math.max(400,Number(p.w)||560);p.h=Math.max(300,Number(p.h)||350);
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

function fillScreenBoard(){
  const n=channels.length;
  if(!n) return;
  const gap=0;
  const viewportW=Math.max(1, window.innerWidth);
  const viewportH=Math.max(1, window.innerHeight);
  const cols=Math.ceil(Math.sqrt(n));
  const rows=Math.ceil(n/cols);
  const cellW=Math.floor(viewportW/cols);
  const cellH=Math.floor(viewportH/rows);

  channels.forEach((ch,i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const isLastRow = row===rows-1;
    const rowCount = Math.min(cols, n-row*cols);
    const w = isLastRow && rowCount<cols ? Math.floor(viewportW/rowCount) : cellW;
    const x = isLastRow && rowCount<cols ? col*w : col*cellW;
    const y = row*cellH;
    const h = (row===rows-1) ? viewportH-y : cellH;
    positions[ch]={x,y,w,h};
  });
  save();
  render();
  document.querySelectorAll(".stream-card").forEach((c,i)=>c.style.zIndex=String(10+i));
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

function render(){
  cardsEl.innerHTML="";
  channels.forEach((ch,i)=>{
    const p=posFor(ch,i);
    const card=document.createElement("article");
    card.className="stream-card";card.dataset.channel=ch;card.style.zIndex=String(10+i);
    card.style.left=p.x+"px";card.style.top=p.y+"px";card.style.width=p.w+"px";card.style.height=p.h+"px";
    card.innerHTML=`<div class="card-head"><span class="channel">#${escapeHtml(ch)}</span><div class="card-actions">
      <button class="icon-btn chat" type="button">Chat</button>
      <button class="icon-btn full" type="button">Fullscreen</button>
      <button class="icon-btn remove" type="button">×</button></div></div>
      <iframe class="player" src="${playerUrl(ch)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${escapeHtml(ch)}"></iframe>`;
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
  panning={startX:e.clientX,startY:e.clientY,startPanX:pan.x,startPanY:pan.y};workspace.classList.add("panning")
});
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
  const sx=(r.width-pad*2)/(maxX-minX),sy=(r.height-pad*2)/(maxY-minY);
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
