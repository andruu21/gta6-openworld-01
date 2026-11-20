// Sunfall City — menus, toasts and input. Builds the start screen and pause
// menu in the DOM, wires keyboard/mouse into an Input state object, and owns
// game phase transitions (menu -> playing -> paused).
const Input = {
  keys: {},
  mouseX: 640, mouseY: 360,
  wheel: 0,
  init(canvas) {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', e => { this.keys['Mouse0'] = true; });
    window.addEventListener('mouseup', () => { this.keys['Mouse0'] = false; });
    canvas.addEventListener('wheel', e => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },
  down(code) { return !!this.keys[code]; },
  aimWorld() {
    // Screen -> world coordinates through the camera.
    const vw = Game.view.w, vh = Game.view.h;
    return { x: Camera.x + (this.mouseX - vw / 2), y: Camera.y + (this.mouseY - vh / 2) };
  },
  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; },
};

const Ui = {
  buildStart(canvas, onStart, onContinue) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'start';
    overlay.innerHTML =
      '<h1>SUNFALL CITY</h1>' +
      '<h2>An open world crime story</h2>' +
      '<p class="story">' + STORY_INTRO + '</p>' +
      '<div class="controls">' +
      'WASD — move / drive\n' +
      'MOUSE — aim · LEFT CLICK — shoot / punch\n' +
      'F — steal or enter a car (again to exit)\n' +
      'Q — switch weapon · SCROLL / MINUS — minimap zoom\n' +
      'ESC — pause</div>';
    const btnNew = document.createElement('button');
    btnNew.className = 'menu-btn';
    btnNew.textContent = 'NEW GAME';
    btnNew.onclick = () => { overlay.remove(); onStart(); };
    overlay.appendChild(btnNew);
    if (SaveSys.has()) {
      const btnCont = document.createElement('button');
      btnCont.className = 'menu-btn';
      btnCont.textContent = 'CONTINUE';
      btnCont.onclick = () => { overlay.remove(); onContinue(); };
      overlay.appendChild(btnCont);
    }
    document.body.appendChild(overlay);
    return overlay;
  },

  buildPause(onResume, onQuit) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'pause';
    overlay.innerHTML =
      '<h1>PAUSED</h1>' +
      '<h2>Sunfall City</h2>' +
      '<p class="story">Missions done: ' + Game.world.stats.missionsDone +
      ' · Peds down: ' + Game.world.stats.pedsKilled +
      ' · Cops down: ' + Game.world.stats.copsKilled +
      ' · Cars wrecked: ' + Game.world.stats.carsWrecked + '</p>';
    const resume = document.createElement('button');
    resume.className = 'menu-btn';
    resume.textContent = 'RESUME';
    resume.onclick = () => { overlay.remove(); onResume(); };
    overlay.appendChild(resume);
    const quit = document.createElement('button');
    quit.className = 'menu-btn';
    quit.textContent = 'QUIT TO MENU';
    quit.onclick = () => { overlay.remove(); onQuit(); };
    overlay.appendChild(quit);
    document.body.appendChild(overlay);
    return overlay;
  },

  toastEl: null,
  toast(msg) {
    if (!this.toastEl) {
      this.toastEl = document.createElement('div');
      this.toastEl.id = 'toasts';
      document.body.appendChild(this.toastEl);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.toastEl.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; }, 2600);
    setTimeout(() => { t.remove(); }, 3100);
    while (this.toastEl.children.length > 4) this.toastEl.firstChild.remove();
  },
};
