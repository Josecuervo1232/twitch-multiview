const MAX=10;
const $=s=>document.querySelector(s);
const streamsEl=$("#streams"), empty=$("#empty"), input=$("#channelInput");
const chatPanel=$("#chatPanel"), chatFrame=$("#chatFrame"), chatTitle=$("#chatTitle");
let channels=JSON.parse(localStorage.getItem("tm_channels")||"[]");
let selected=localStorage.getItem("tm_chat")||"";
let layout=localStorage.getItem("tm_layout")||"grid";

function parentDomain(){ return location.hostname; }
function save(){localStorage.setItem("tm_channels",JSON.stringify(channels));localStorage.setItem("tm_chat",selected);localStorage.setItem("tm_layout",layout)}
function twitchPlayer(ch){
  const u=new URL("https://player.twitch.tv/");
  u.searchParams.set("channel",ch); u.searchParams.set("parent",parentDomain());
  u.searchParams.set("autoplay","false"); u.searchParams.set("muted","true");
  return u.toString();
}
function twitchChat(ch){
  const u=new URL(`https://www.twitch.tv/embed/${encodeURIComponent(ch)}/chat`);
  u.searchParams.set("parent",parentDomain()); return u.toString();
}
function render(){
  streamsEl.innerHTML="";
  empty.style.display=channels.length?"none":"flex";
  document.body.classList.toggle("focus",layout==="focus");
  document.body.classList.toggle("chat-open",chatPanel.classList.contains("open"));
  channels.forEach((ch,i)=>{
    const card=document.createElement("article"); card.className="stream-card"; card.draggable=true;
    card.dataset.index=i;
    card.innerHTML=`<div class="card-head"><span class="channel">#${escapeHtml(ch)}</span><div class="card-actions">
      <button class="icon-btn chat">Chat</button><button class="icon-btn full">Fullscreen</button><button class="icon-btn remove">×</button></div></div>
      <iframe class="player" src="${twitchPlayer(ch)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${escapeHtml(ch)}"></iframe>`;
    card.querySelector(".chat").onclick=e=>{e.stopPropagation();openChat(ch)};
    card.querySelector(".remove").onclick=e=>{e.stopPropagation();channels.splice(i,1);if(selected===ch){selected="";closeChat()}save();render()};
    card.querySelector(".full").onclick=e=>{e.stopPropagation();card.requestFullscreen?.()};
    card.addEventListener("click",()=>openChat(ch));
    card.addEventListener("dragstart",()=>card.classList.add("dragging"));
    card.addEventListener("dragend",()=>card.classList.remove("dragging"));
    card.addEventListener("dragover",e=>e.preventDefault());
    card.addEventListener("drop",e=>{e.preventDefault();const from=+card.dataset.index;const dragged=streamsEl.querySelector(".dragging");if(!dragged)return;const to=+dragged.dataset.index;if(from!==to){[channels[from],channels[to]]=[channels[to],channels[from]];save();render()}});
    streamsEl.appendChild(card);
  });
}
function openChat(ch){selected=ch;chatTitle.textContent=`#${ch} chat`;chatFrame.src=twitchChat(ch);chatPanel.classList.add("open");save();document.body.classList.add("chat-open")}
function closeChat(){chatPanel.classList.remove("open");chatFrame.src="about:blank";selected="";save();document.body.classList.remove("chat-open")}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
$("#addBtn").onclick=()=>{let ch=input.value.trim().toLowerCase().replace(/^#/,"");if(!ch||channels.includes(ch)||channels.length>=MAX)return;channels.push(ch);input.value="";save();render()};
input.addEventListener("keydown",e=>{if(e.key==="Enter")$("#addBtn").click()});
$("#chatBtn").onclick=()=>{if(chatPanel.classList.contains("open"))closeChat();else if(selected)openChat(selected);else if(channels[0])openChat(channels[0])};
$("#closeChat").onclick=closeChat;
$("#clearBtn").onclick=()=>{if(confirm("Remove all streams?")){channels=[];closeChat();save();render()}};
document.querySelectorAll(".preset").forEach(b=>b.onclick=()=>{layout=b.dataset.layout;save();render()});
render();
