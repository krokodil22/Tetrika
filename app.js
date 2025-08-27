// ===== Уровни =====
const LEVELS = [
  {
    id: "mars1",
    name: "Уровень 1",
    cols: 4, rows: 1,
    tile: 120,
    bg: "assets/level1.png",
    actor: "assets/hero.png",
    goalImg: "assets/goal.png",
    start: { x: 0, y: 0, dir: "E" },
    goal:  { x: 3, y: 0 },
    blocked: ["...."]
  },
  {
    id: "mars2",
    name: "Уровень 2",
    cols: 4, rows: 3,
    tile: 120,
    bg: "assets/level2.png",
    actor: "assets/hero.png",
    goalImg: "assets/goal.png",
    start: { x: 0, y: 2, dir: "E" }, // зелёная клетка (слева внизу)
    goal:  { x: 3, y: 0 },           // красная клетка (справа вверху)
    // схему препятствий можно менять; сейчас проходимо по "коридору-Г"
    blocked: [
      "....",
      "...#",
      "...."
    ]
  }
];

// ===== Движок и DnD (как в Scratch) =====
const DIRS = ["N","E","S","W"];
const DIR_VEC = { N:{dx:0,dy:-1,deg:0}, E:{dx:1,dy:0,deg:90}, S:{dx:0,dy:1,deg:180}, W:{dx:-1,dy:0,deg:270} };

let currentLevel=null, program=[], state=null, running=false, animMs=500;

const elLevelBg=document.getElementById('levelBg');
const elBoard=document.getElementById('board');
const elGrid=document.getElementById('grid');
const elActor=document.getElementById('actor');
const elGoal=document.getElementById('goal');
const elProgram=document.getElementById('program');
const elStatus=document.getElementById('status');
const levelSelect=document.getElementById('levelSelect');
const speedRange=document.getElementById('speed');
const gridToggle=document.getElementById('toggleGrid');

document.getElementById('runBtn').addEventListener('click', runProgram);
document.getElementById('stepBtn').addEventListener('click', stepOnce);
document.getElementById('resetBtn').addEventListener('click', resetLevel);
document.getElementById('clearBtn').addEventListener('click', ()=>{ program=[]; renderProgram(); });
document.getElementById('exportBtn').addEventListener('click', copyAsPseudoCode);
speedRange.addEventListener('input', ()=> setSpeed(+speedRange.value));
gridToggle.addEventListener('change', ()=> elGrid.style.display = gridToggle.checked? "grid":"none");

// Тулбокс — источники перетаскивания
document.querySelectorAll('.toolbox .block').forEach(block=>{
  block.addEventListener('dragstart', e=>{
    e.dataTransfer.setData('text/cmd', block.dataset.cmd);
    e.dataTransfer.effectAllowed='copy';
  });
});

// Область программы — приёмник и сортировка
elProgram.addEventListener('dragover', e=>{
  e.preventDefault();
  e.dataTransfer.dropEffect='copyMove';
  const {afterEl}=getDragAfterElement(e.clientY);
  if(afterEl) afterEl.classList.add('drag-over');
});
elProgram.addEventListener('dragleave', e=>{
  document.querySelectorAll('.program .drag-over').forEach(n=>n.classList.remove('drag-over'));
});
elProgram.addEventListener('drop', e=>{
  e.preventDefault();
  const cmd=e.dataTransfer.getData('text/cmd');
  const reorder=e.dataTransfer.getData('text/reorder');
  document.querySelectorAll('.program .drag-over').forEach(n=>n.classList.remove('drag-over'));
  const index=indexForY(e.clientY);
  if(cmd){ program.splice(index,0,cmd); renderProgram(); }
  else if(reorder){
    const from=+reorder; const item=program.splice(from,1)[0];
    program.splice(index,0,item); renderProgram();
  }
});
function getDragAfterElement(y){
  const els=[...elProgram.querySelectorAll('.item')];
  let closest=null, closestOffset=Number.NEGATIVE_INFINITY;
  els.forEach(el=>{
    const box=el.getBoundingClientRect();
    const offset=y - box.top - box.height/2;
    if(offset<0 && offset>closestOffset){ closestOffset=offset; closest=el; }
    el.classList.remove('drag-over');
  });
  return {afterEl:closest};
}
function indexForY(y){
  const items=[...elProgram.querySelectorAll('.item')];
  for(let i=0;i<items.length;i++){
    const box=items[i].getBoundingClientRect();
    if(y < box.top + box.height/2) return i;
  }
  return items.length;
}
function renderProgram(){
  elProgram.innerHTML='';
  program.forEach((cmd,idx)=>{
    const li=document.createElement('li');
    li.className='item'; li.draggable=true;
    li.innerHTML=`<span>${labelFor(cmd)}</span><span class="ops"><button aria-label="delete">✕</button></span>`;
    li.querySelector('button').addEventListener('click', ()=>{ program.splice(idx,1); renderProgram(); });
    li.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('text/reorder', idx);
      e.dataTransfer.effectAllowed='move';
      const ghost=document.createElement('div'); ghost.className='block'; ghost.textContent=labelFor(cmd);
      document.body.appendChild(ghost); e.dataTransfer.setDragImage(ghost, 0, 0); setTimeout(()=>ghost.remove(),0);
    });
    elProgram.appendChild(li);
  });
}

function setSpeed(v){ animMs=Math.round(1000*(1.2-v)); elActor.style.setProperty('--moveMs', animMs+'ms'); }
function labelFor(cmd){ return cmd==='MOVE'?'шаг':(cmd==='RIGHT'?'повернуть направо':'повернуть налево'); }
function setStatus(t){ elStatus.textContent=t; }

// Загрузка уровней
LEVELS.forEach(l=>{ const opt=document.createElement('option'); opt.value=l.id; opt.textContent=l.name; levelSelect.appendChild(opt); });
levelSelect.addEventListener('change', ()=> loadLevel(levelSelect.value));

function loadLevel(id){
  const lvl=LEVELS.find(l=>l.id===id)||LEVELS[0];
  currentLevel=structuredClone(lvl);
  currentLevel.blockedBool=currentLevel.blocked.map(row=>[...row].map(ch=>ch==='#'));
  const {cols,rows,tile}=currentLevel;
  document.documentElement.style.setProperty('--tile', tile+'px');
  elGrid.style.setProperty('--cols', cols);
  elGrid.style.setProperty('--rows', rows);
  elBoard.style.width=(cols*tile)+'px';
  elBoard.style.height=(rows*tile)+'px';
  document.getElementById('levelBg').src=currentLevel.bg;
  elActor.style.backgroundImage=`url("${currentLevel.actor}")`;
  elGoal.style.backgroundImage=`url("${currentLevel.goalImg}")`;
  renderGrid();
  program=[]; renderProgram();
  resetLevel();
  setStatus('Готово. Соберите программу и запустите.');
}
function renderGrid(){
  const {cols,rows,blockedBool}=currentLevel;
  elGrid.innerHTML='';
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const cell=document.createElement('div'); cell.className='cell';
      if(blockedBool[y]?.[x]) cell.classList.add('blocked'); elGrid.appendChild(cell);
    }
  }
  elGrid.style.display = gridToggle.checked? "grid":"none";
}

function resetLevel(){ state={...currentLevel.start}; placeActor(); }
function placeActor(){
  const {tile}=currentLevel;
  elActor.style.left=(state.x*tile)+'px'; elActor.style.top=(state.y*tile)+'px';
  elActor.style.transform=`rotate(${DIR_VEC[state.dir].deg}deg)`;
  const g=currentLevel.goal; elGoal.style.left=(g.x*tile)+'px'; elGoal.style.top=(g.y*tile)+'px';
}

async function runProgram(){
  if(running) return; running=true; setStatus('Выполняю...');
  try{
    for(let i=0;i<program.length;i++){
      const ok=await execCommand(program[i]);
      if(!ok){ setStatus('Столкновение!'); break; }
      if(reachedGoal()){ setStatus('Ура! Цель достигнута 🎉'); break; }
    }
    if(!program.length) setStatus('Добавьте команды и запустите.');
    else if(!reachedGoal()) setStatus('Программа завершена, цель не достигнута.');
  } finally { running=false; }
}
async function stepOnce(){
  if(running) return; running=true;
  try{
    const cmd=program.shift(); renderProgram();
    if(!cmd){ setStatus('Нет команд.'); return; }
    const ok=await execCommand(cmd);
    if(!ok){ setStatus('Столкновение!'); return; }
    if(reachedGoal()) setStatus('Готово! Цель достигнута 🎯');
  } finally { running=false; }
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function execCommand(cmd){
  const {cols,rows,blockedBool}=currentLevel;
  if(cmd==='LEFT'||cmd==='RIGHT'){
    const dirIdx=["N","E","S","W"].indexOf(state.dir);
    state.dir = cmd==='RIGHT' ? ["N","E","S","W"][(dirIdx+1)%4] : ["N","E","S","W"][(dirIdx+3)%4];
    placeActor(); await sleep(animMs*0.6); return true;
  }
  if(cmd==='MOVE'){
    const v=DIR_VEC[state.dir]; const nx=state.x+v.dx, ny=state.y+v.dy;
    if(nx<0||ny<0||nx>=cols||ny>=rows) return false;
    if(blockedBool[ny]?.[nx]) return false;
    state.x=nx; state.y=ny; placeActor(); await sleep(animMs); return true;
  }
  return true;
}
function reachedGoal(){ const g=currentLevel.goal; return state.x===g.x && state.y===g.y; }
function copyAsPseudoCode(){ const map={MOVE:'step();',RIGHT:'turnRight();',LEFT:'turnLeft();'}; const txt=program.map(c=>map[c]||c).join('\\n'); navigator.clipboard?.writeText(txt).then(()=>setStatus('Код скопирован.'), ()=>{ prompt('Скопируйте код:', txt); }); }

// Старт
setSpeed(+speedRange.value);
LEVELS.forEach((l,i)=>{ if(i===0) levelSelect.value=l.id; });
loadLevel(LEVELS[0].id);
