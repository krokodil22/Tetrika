// ===== Полная логика игры (v19) с reorder и надёжным placeholder =====
const LEVELS = [
  { id:"lvl1", name:"Уровень 1", bg:"assets/level1.png",
    cols:4, rows:1, gridBox:{x:0.146,y:0.433,w:0.73,h:0.185},
    start:{x:0,y:0,dir:"E"}, goal:{x:3,y:0},
    passmap:["...."]
  },
  { id:"lvl2", name:"Уровень 2", bg:"assets/level2.png",
    cols:4, rows:3, gridBox:{x:0.128,y:0.133,w:0.712,h:0.571},
    start:{x:0,y:2,dir:"E"}, goal:{x:3,y:0},
    passmap:["###.","###.","...."]
  },
  { id:"lvl3", name:"Уровень 3", bg:"assets/level3.svg",
    cols:3, rows:4, gridBox:{x:0.29,y:0.15,w:0.452,h:0.598},
    start:{x:0,y:3,dir:"E"}, goal:{x:0,y:0},
    passmap:["...","##.","##.","..."]
  },
  { id:"lvl4", name:"Уровень 4", bg:"assets/level4.svg",
    cols:3, rows:7, gridBox:{x:0.315,y:0.049,w:0.394,h:0.91},
    start:{x:0,y:6,dir:"E"}, goal:{x:2,y:0},
    passmap:["##.","##.","##.","...",".##",".##",".##"]
  },
  { id:"lvl5", name:"Уровень 5", bg:"assets/level5.svg",
    cols:5, rows:7, gridBox:{x:0.178,y:0.075,w:0.588,h:0.822},
    start:{x:0,y:6,dir:"E"}, goal:{x:1,y:1},
    passmap:["#....","#.##.","####.","##...","#..##","..###",".####"]
  },
  { id:"lvl6", name:"Уровень 6", bg:"assets/level6.svg",
    cols:8, rows:7, gridBox:{x:0.172,y:0.175,w:0.745,h:0.649},
    start:{x:0,y:6,dir:"E"}, goal:{x:6,y:2},
    passmap:["##....##","##.##.##","...##..#",".#######","......#.","##.##...","...#####"]
  },
  { id:"lvl7", name:"Уровень 7", bg:"assets/level7.svg",
    cols:9, rows:6, gridBox:{x:0.09,y:0.27,w:0.821,h:0.549},
    start:{x:0,y:5,dir:"E"}, goal:{x:0,y:2},
    passmap:["...#...##",".#...#...",".#######.","####...#.","...#.#.#.",".#...#..."]
  },
];

const DIR_ORDER=["N","E","S","W"];
const DIR_VEC={N:{dx:0,dy:-1,deg:0},E:{dx:1,dy:0,deg:90},S:{dx:0,dy:1,deg:180},W:{dx:-1,dy:0,deg:270}};

let levelIndex=0, unlocked=1;
let currentLevel=null, program=[], state=null, running=false;
let tileX=100, tileY=100, gridOffsetX=0, gridOffsetY=0;
let animMs=400;

const elLevelBg=document.getElementById('levelBg');
const elBoard=document.getElementById('board');
const elActor=document.getElementById('actor');
const elProgram=document.getElementById('program');
const elStatus=document.getElementById('status');
const elSuccess=document.getElementById('success');
const elSuccessText=document.getElementById('successText');
const elNext=document.getElementById('nextBtn');
const elOops=document.getElementById('oops');
const elMenu=document.getElementById('levelMenu');

document.getElementById('runBtn').addEventListener('click', runProgram);
document.getElementById('resetBtn').addEventListener('click', ()=>loadLevel(levelIndex, {preserveProgram:true}));
document.getElementById('clearBtn').addEventListener('click', ()=>{ program=[]; renderProgram(); });

elNext.addEventListener('click', ()=>{
  if(levelIndex < LEVELS.length-1){ unlock(levelIndex+2); levelIndex++; }
  hideSuccess(); loadLevel(levelIndex, {preserveProgram:false}); renderMenu();
});

function loadProgress(){ unlocked = Math.min(LEVELS.length, Math.max(1, +localStorage.getItem('tetrikaUnlocked')||1)); }
function saveProgress(){ localStorage.setItem('tetrikaUnlocked', String(unlocked)); }
function unlock(n){ if(n>unlocked){ unlocked=n; saveProgress(); } }

function renderMenu(){
  elMenu.innerHTML='';
  LEVELS.forEach((lvl, i)=>{
    const btn=document.createElement('button');
    btn.textContent = i+1;
    if(i===levelIndex) btn.classList.add('active');
    if(i+1>unlocked) btn.classList.add('locked');
    btn.addEventListener('click', ()=>{
      if(i+1<=unlocked){ levelIndex=i; hideSuccess(); hideOops(); loadLevel(levelIndex, {preserveProgram:false}); renderMenu(); }
    });
    elMenu.appendChild(btn);
  });
}

// toolbox
document.querySelectorAll('.toolbox .block').forEach(block=>{
  block.addEventListener('dragstart', e=>{
    e.dataTransfer.setData('text/cmd', block.dataset.cmd);
    e.dataTransfer.effectAllowed='copy';
  });
});

// program render + DnD reorder
let placeholderIndex = null;
function createPlaceholder(){
  const ph=document.createElement('li');
  ph.className='placeholder';
  ph.setAttribute('aria-hidden','true');
  ph.draggable=false;
  return ph;
}
function renderProgram(){
  elProgram.innerHTML='';
  const total = program.length;
  let pIdx=0;
  for(let i=0;i<total;i++){
    if(placeholderIndex!==null && i===placeholderIndex){
      elProgram.appendChild(createPlaceholder());
    }
    const cmd=program[pIdx];
    const idx=pIdx;
    const li=document.createElement('li'); li.className='item'; li.draggable=true;
    li.innerHTML=`<span>${labelFor(cmd)}</span><span class="ops"><button aria-label="delete">✕</button></span>`;
    const delBtn=li.querySelector('button');
    delBtn.setAttribute('draggable','false');
    delBtn.addEventListener('mousedown', e=>e.stopPropagation());
    delBtn.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); program.splice(idx,1); placeholderIndex=null; renderProgram(); });
    li.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/progIndex', String(idx)); e.dataTransfer.effectAllowed='move'; });
    elProgram.appendChild(li);
    pIdx++;
  }
  if(placeholderIndex!==null && placeholderIndex===total){
    elProgram.appendChild(createPlaceholder());
  }
}

function getInsertIndex(container, mouseY){
  const items=[...container.querySelectorAll('.item')];
  let idx=items.length;
  for(let i=0;i<items.length;i++){
    const r=items[i].getBoundingClientRect(); const mid=r.top+r.height/2;
    if(mouseY < mid){ idx=i; break; }
  }
  return idx;
}
elProgram.addEventListener('dragover', e=>{
  e.preventDefault();
  const idx=getInsertIndex(elProgram, e.clientY);
  if(placeholderIndex!==idx){ placeholderIndex=idx; renderProgram(); }
});
elProgram.addEventListener('drop', e=>{
  e.preventDefault();
  const cmd=e.dataTransfer.getData('text/cmd');
  const fromStr=e.dataTransfer.getData('text/progIndex');
  const insertAt=(placeholderIndex===null)?program.length:placeholderIndex;
  if(cmd){
    program.splice(insertAt,0,cmd);
  }else if(fromStr){
    const from=parseInt(fromStr,10); let to=insertAt;
    if(from<to) to--;
    if(from!==to){ const [moved]=program.splice(from,1); program.splice(to,0,moved); }
  }
  placeholderIndex=null; renderProgram();
});

function labelFor(cmd){ return cmd==='MOVE'?'шаг':(cmd==='RIGHT'?'повернуть направо':'повернуть налево'); }
function setStatus(t){ elStatus.textContent=t; }

async function loadLevel(index=0, opts={preserveProgram:false}){
  const lvl=LEVELS[index];
  currentLevel=structuredClone(lvl);
  currentLevel.pass = currentLevel.passmap.map(r=>[...r].map(ch=>ch==='.'));
  if(!opts.preserveProgram){ program=[]; renderProgram(); }
  hideSuccess(); hideOops();

  await new Promise((res,rej)=>{ elLevelBg.onload=res; elLevelBg.onerror=rej; elLevelBg.src=lvl.bg; });

  const headerH=document.querySelector('.topbar').getBoundingClientRect().height;
  const controlsH=document.querySelector('.top-actions').getBoundingClientRect().height;
  const availableH=Math.max(280, window.innerHeight - headerH - controlsH - 42);

  const natW=elLevelBg.naturalWidth, natH=elLevelBg.naturalHeight;
  const scale=Math.min(1, availableH/natH);
  const renderH=Math.round(natH*scale), renderW=Math.round(natW*scale);

  elBoard.style.width=renderW+'px'; elBoard.style.height=renderH+'px';
  elLevelBg.style.width=renderW+'px'; elLevelBg.style.height=renderH+'px';

  const box=lvl.gridBox||{x:0,y:0,w:1,h:1};
  gridOffsetX=Math.round(renderW*box.x);
  gridOffsetY=Math.round(renderH*box.y);
  const gridW=Math.round(renderW*box.w), gridH=Math.round(renderH*box.h);
  tileX=gridW/lvl.cols; tileY=gridH/lvl.rows;
  document.documentElement.style.setProperty('--tileX', tileX+'px');
  document.documentElement.style.setProperty('--tileY', tileY+'px');

  resetLevel();
  setStatus('Соберите программу и запустите.');
}

function resetLevel(){ state={...currentLevel.start, rotDeg: DIR_VEC[currentLevel.start.dir].deg}; placeActor(); }
function placeActor(){
  const scale=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--actorScale'));
  const actorW=tileX*scale, actorH=tileY*scale;
  const deg=state.rotDeg||0;
  elActor.style.left=(gridOffsetX + state.x*tileX + (tileX-actorW)/2)+'px';
  elActor.style.top =(gridOffsetY + state.y*tileY + (tileY-actorH)/2)+'px';
  elActor.style.transform=`rotate(${deg}deg)`;
}

document.addEventListener('keydown', e=>{ if(e.key==='Enter') runProgram(); });
async function runProgram(){
  if(running) return; running=true; setStatus('Выполняю...');
  try{
    for(let i=0;i<program.length;i++){
      const ok=await execCommand(program[i]);
      if(!ok){ onOops(); return; }
      if(reachedGoal()){ onSuccess(); return; }
    }
    onOops();
  } finally { running=false; }
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function execCommand(cmd){
  const cols=currentLevel.cols, rows=currentLevel.rows, pass=currentLevel.pass;
  if(cmd==='LEFT'||cmd==='RIGHT'){
    const i=DIR_ORDER.indexOf(state.dir);
    if(cmd==='RIGHT'){
      state.dir = DIR_ORDER[(i+1)%4];
      state.rotDeg = (state.rotDeg||0) + 90;
    } else {
      state.dir = DIR_ORDER[(i+3)%4];
      state.rotDeg = (state.rotDeg||0) - 90; // CCW
    }
    placeActor(); await sleep(280); return true;
  }
  if(cmd==='MOVE'){
    const v=DIR_VEC[state.dir]; const nx=state.x+v.dx, ny=state.y+v.dy;
    if(nx<0||ny<0||nx>=cols||ny>=rows) return false;
    if(!pass[ny]?.[nx]) return false;
    state.x=nx; state.y=ny; placeActor(); await sleep(animMs); return true;
  }
  return true;
}
function reachedGoal(){ const g=currentLevel.goal; return state.x===g.x && state.y===g.y; }
function onSuccess(){
  setStatus('');
  const humanLevel=levelIndex+1;
  elSuccessText.textContent=`Молодец! Ты прошел ${humanLevel} уровень!`;
  elSuccess.classList.remove('hidden');
  unlock(levelIndex+2); renderMenu();
}
function hideSuccess(){ elSuccess.classList.add('hidden'); }
function onOops(){ setStatus(''); elOops.classList.remove('hidden'); setTimeout(()=>{ hideOops(); loadLevel(levelIndex, {preserveProgram:true}); }, 2000); }
function hideOops(){ elOops.classList.add('hidden'); }

loadProgress(); renderMenu(); loadLevel(levelIndex, {preserveProgram:false});
