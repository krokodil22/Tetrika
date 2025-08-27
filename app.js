// ===== Настройки уровней =====
// Каждому уровню соответствуют: сетка, старт, цель, фон.
// blocked[y][x] = true означает «препятствие».

const LEVELS = [
  {
    id: "l1",
    name: "Уровень 1 (демо)",
    cols: 8, rows: 8,
    tile: 64,
    bg: "assets/level1.png",     // Замените на свой фон
    actor: "assets/hero.png",    // Замените на своего персонажа (квадратная картинка)
    goalImg: "assets/goal.png",  // Замените на цель (например, морковка)
    start: { x: 1, y: 6, dir: "N" },
    goal:  { x: 6, y: 1 },
    blocked: [
      // 0..7 x, 0..7 y
      // '.' — свободно, '#' — препятствие
      "........",
      "..##....",
      "..##....",
      "....#...",
      "....#...",
      ".##.....",
      ".#......",
      "........"
    ]
  }
];

// ===== Внутреннее состояние =====
let currentLevel = null;
let program = []; // массив команд: 'MOVE' | 'LEFT' | 'RIGHT'
let running = false;
let state = null; // {x,y,dir}
let animMs = 500;

// Повороты по часовой/против
const DIRS = ["N","E","S","W"];
const DIR_VEC = {
  N: {dx:0, dy:-1, deg:0},
  E: {dx:1, dy:0,  deg:90},
  S: {dx:0, dy:1,  deg:180},
  W: {dx:-1,dy:0,  deg:270},
};

// ===== Инициализация DOM =====
const elLevelBg = document.getElementById('levelBg');
const elBoard   = document.getElementById('board');
const elGrid    = document.getElementById('grid');
const elActor   = document.getElementById('actor');
const elGoal    = document.getElementById('goal');
const elProgram = document.getElementById('program');
const elStatus  = document.getElementById('status');
const levelSelect = document.getElementById('levelSelect');
const speedRange  = document.getElementById('speed');
const gridToggle  = document.getElementById('toggleGrid');

// Кнопки
document.querySelectorAll('.toolbox .cmd').forEach(btn => {
  btn.addEventListener('click', () => {
    addCommand(btn.dataset.cmd);
  });
});
document.getElementById('runBtn').addEventListener('click', runProgram);
document.getElementById('stepBtn').addEventListener('click', stepOnce);
document.getElementById('resetBtn').addEventListener('click', resetLevel);
document.getElementById('clearBtn').addEventListener('click', () => { program = []; renderProgram(); });
document.getElementById('exportBtn').addEventListener('click', copyAsPseudoCode);
speedRange.addEventListener('input', () => setSpeed(+speedRange.value));
gridToggle.addEventListener('change', () => elGrid.style.display = gridToggle.checked? "grid":"none");

function setSpeed(val){
  animMs = Math.round(1000 * (1.2 - val)); // 0.2..1.5 -> 1000..?  простое нелинейное отображение
  elActor.style.setProperty('--moveMs', animMs+'ms');
}

// Заполнить селект уровней
LEVELS.forEach(l => {
  const opt = document.createElement('option');
  opt.value = l.id; opt.textContent = l.name;
  levelSelect.appendChild(opt);
});
levelSelect.addEventListener('change', () => {
  loadLevel(levelSelect.value);
});

// ===== Работа с уровнями =====
function loadLevel(id){
  const lvl = LEVELS.find(l => l.id === id) || LEVELS[0];
  currentLevel = structuredClone(lvl);
  // Преобразуем удобное текстовое описание blocked в boolean[][]
  currentLevel.blockedBool = currentLevel.blocked.map(row => [...row].map(ch => ch === '#'));
  // Проставим размеры на CSS
  const {cols, rows, tile} = currentLevel;
  document.documentElement.style.setProperty('--tile', tile+'px');
  elGrid.style.setProperty('--cols', cols);
  elGrid.style.setProperty('--rows', rows);
  elBoard.style.width  = (cols * tile) + 'px';
  elBoard.style.height = (rows * tile) + 'px';

  // Фон/спрайты
  elLevelBg.src = currentLevel.bg;
  elActor.style.backgroundImage = `url("${currentLevel.actor}")`;
  elGoal.style.backgroundImage = `url("${currentLevel.goalImg}")`;

  // Сетка и препятствия
  renderGrid();

  // Сброс состояния
  program = [];
  renderProgram();
  resetLevel();
  setStatus("Готово");
}

function renderGrid(){
  const {cols, rows, blockedBool} = currentLevel;
  elGrid.innerHTML = '';
  for(let y=0; y<rows; y++){
    for(let x=0; x<cols; x++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      if(blockedBool[y]?.[x]) cell.classList.add('blocked');
      elGrid.appendChild(cell);
    }
  }
  elGrid.style.display = gridToggle.checked? "grid":"none";
}

// ===== Программа =====
function addCommand(cmd){
  program.push(cmd);
  renderProgram();
}

function renderProgram(){
  elProgram.innerHTML = '';
  program.forEach((cmd, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${labelFor(cmd)}</span>
      <span class="ops">
        <button title="Выше" aria-label="up">↑</button>
        <button title="Ниже" aria-label="down">↓</button>
        <button title="Удалить" aria-label="delete">✕</button>
      </span>`;
    const [btnUp, btnDown, btnDel] = li.querySelectorAll('button');
    btnUp.addEventListener('click', () => moveCmd(idx, -1));
    btnDown.addEventListener('click', () => moveCmd(idx, +1));
    btnDel.addEventListener('click', () => { program.splice(idx,1); renderProgram(); });
    elProgram.appendChild(li);
  });
}

function moveCmd(i, delta){
  const j = i + delta;
  if(j<0 || j>=program.length) return;
  const tmp = program[i]; program[i] = program[j]; program[j] = tmp;
  renderProgram();
}

function labelFor(cmd){
  return cmd === 'MOVE' ? 'Шаг' : cmd === 'RIGHT' ? 'Повернуть направо' : 'Повернуть налево';
}

// ===== Выполнение =====
function resetLevel(){
  state = {...currentLevel.start};
  placeActor();
}

function placeActor(){
  const {tile} = currentLevel;
  elActor.style.left = (state.x * tile) + 'px';
  elActor.style.top  = (state.y * tile) + 'px';
  elActor.style.transform = `rotate(${DIR_VEC[state.dir].deg}deg)`;
  const g = currentLevel.goal;
  elGoal.style.left = (g.x * tile) + 'px';
  elGoal.style.top  = (g.y * tile) + 'px';
}

async function runProgram(){
  if(running) return;
  running = true;
  setStatus('Выполняю...');
  try{
    for(let i=0; i<program.length; i++){
      const ok = await execCommand(program[i]);
      if(!ok) { setStatus('Столкновение! Программа остановлена.'); break; }
      if(reachedGoal()){
        setStatus('Ура! Цель достигнута 🎉');
        break;
      }
    }
    if(!program.length){
      setStatus('Добавьте команды и запустите программу.');
    } else if(!reachedGoal()){
      setStatus('Программа завершена. Цель не достигнута.');
    }
  } finally {
    running = false;
  }
}

async function stepOnce(){
  if(running) return;
  running = true;
  try{
    const cmd = program.shift();
    renderProgram();
    if(!cmd){ setStatus('Нет команд.'); return; }
    const ok = await execCommand(cmd);
    if(!ok){ setStatus('Столкновение!'); return; }
    if(reachedGoal()){ setStatus('Готово! Цель достигнута 🎯'); }
  } finally {
    running = false;
  }
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function execCommand(cmd){
  const {cols, rows, blockedBool} = currentLevel;
  if(cmd === 'LEFT' || cmd === 'RIGHT'){
    // просто поворот
    const dirIdx = DIRS.indexOf(state.dir);
    const idx = (cmd === 'RIGHT') ? (dirIdx + 1) % 4 : (dirIdx + 3) % 4;
    state.dir = DIRS[idx];
    placeActor();
    await sleep(animMs * 0.6);
    return true;
  }
  if(cmd === 'MOVE'){
    const v = DIR_VEC[state.dir];
    const nx = state.x + v.dx;
    const ny = state.y + v.dy;
    // Проверки
    if(nx < 0 || ny < 0 || nx >= cols || ny >= rows) return false;
    if(blockedBool[ny]?.[nx]) return false;
    state.x = nx; state.y = ny;
    placeActor();
    await sleep(animMs);
    return true;
  }
  return true;
}

function reachedGoal(){
  const g = currentLevel.goal;
  return state.x === g.x && state.y === g.y;
}

function setStatus(text){
  elStatus.textContent = text;
}

// Задать скорость из диапазона
setSpeed(+speedRange.value);

// Загрузить первый уровень
loadLevel(LEVELS[0].id);

// ===== Дополнительно: экспорт программы как псевдокод =====
function copyAsPseudoCode(){
  const map = {MOVE:'step();', RIGHT:'turnRight();', LEFT:'turnLeft();'};
  const lines = program.map(c => map[c] || c);
  const txt = lines.join("\n");
  navigator.clipboard?.writeText(txt).then(()=>{
    setStatus('Код скопирован в буфер обмена.');
  }, ()=>{
    prompt('Скопируйте код вручную:', txt);
  });
}
