// Sunfall City — game shell. Owns the world state, the main loop, phase
// transitions (menu / playing / paused), car stealing, the wanted system's
// world hooks, saving, and a ?debug scene stager used for screenshots.
const Game = {
  canvas: null, ctx: null,
  view: { w: 1280, h: 720 },
  world: null,
  phase: 'menu',        // menu | playing | paused
  lastTime: 0,
  saveTimer: 0,

  boot() {
    this.canvas = document.getElementById('game');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.view.w = this.canvas.width;
    this.view.h = this.canvas.height;
    this.ctx = this.canvas.getContext('2d');
    Input.init(this.canvas);
    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.view.w = this.canvas.width;
      this.view.h = this.canvas.height;
    });
    City.generate(7);
    this.buildWorld();
    this.drawFrame();
    Ui.buildStart(this.canvas,
      () => this.startGame(null),
      () => this.startGame(SaveSys.read()));
    window.addEventListener('keydown', e => this.onKey(e));
    const params = new URLSearchParams(location.search);
    if (params.has('debug')) this.debugScene(params.get('debug'));
  },

  buildWorld() {
    _world = {
      time: 8 * (CONFIG.DAY_LENGTH / 24), // start mid-morning
      money: 0, // actual money lives on Player; kept here for snapshot parity
      bullets: [],
      cars: [],
      peds: [],
      wanted: { level: 0, heat: 0, cops: [], cruisers: [], calmTimer: 0 },
      threatX: 0, threatY: 0,
      copSpawnTimer: 0,
      missionCooldown: 0,
      missionOffered: false,
      stats: { missionsDone: 0, pedsKilled: 0, copsKilled: 0, carsWrecked: 0, damageDealt: 0, deaths: 0 },
      toast: msg => Ui.toast(msg),
      moneyDrop: amount => { Player.money += amount; },
      crime: name => this.crime(name),
      snapshot: () => SaveSys.data(this.world),
      respawnPlayer: () => Player.respawn(this.world),
    };
    this.world = _world;
  },

  crime(name) {
    const inc = CONFIG.WANTED_CRIME[name] || 0.5;
    const w = this.world.wanted;
    w.heat = Math.min(5, w.heat + inc);
    w.level = Math.min(5, Math.floor(w.heat));
    w.calmTimer = 0;
  },

  startGame(save) {
    AudioSys.init();
    AudioSys.resume();
    this.buildWorld();
    Missions.reset();
    const start = City.nearestRoadPoint(City.T() * 1.5, City.T() * 1.5);
    Player.money = CONFIG.PLAYER_MONEY_START;
    Player.spawn(start.x, start.y);
    this.spawnCars();
    Peds.populate(this.world, CONFIG.PED_COUNT);
    if (save) {
      Player.money = save.money ?? Player.money;
      Player.x = save.x ?? Player.x;
      Player.y = save.y ?? Player.y;
      Missions.index = save.missionIndex ?? 0;
      Missions.done = save.missionsDone ?? [];
      Object.assign(this.world.stats, save.stats || {});
      this.world.time = save.time ?? this.world.time;
      Camera.snapTo(Player.x, Player.y);
    }
    this.phase = 'playing';
    this.world.missionCooldown = save ? 2 : 5;
    this.world.missionOffered = !!save;
    Ui.toast('Welcome to Sunfall City');
  },

  spawnCars() {
    const rng = makeRng(1234 + City.seed);
    this.world.cars = [];
    // Parked cars along block edges.
    for (let i = 0; i < CONFIG.CAR_COUNT * 0.4; i++) {
      const p = Missions.randomRoadPoint(rng);
      const car = new Car(p.x + (rng() - 0.5) * 40, p.y + (rng() - 0.5) * 40, rng() * Math.PI * 2, rng() < 0.15 ? 'taxi' : rng() < 0.1 ? 'sport' : 'civil');
      this.world.cars.push(car);
    }
    // Traffic cars on lanes.
    for (let i = 0; i < CONFIG.CAR_COUNT * 0.6; i++) {
      const pts = City.lanePoints(rng, 1);
      const car = new Car(pts[0].x, pts[0].y, rng() < 0.5 ? 0 : Math.PI, rng() < 0.2 ? 'taxi' : 'civil');
      car.traffic = true;
      this.world.cars.push(car);
    }
  },

  onKey(e) {
    if (e.code === 'Escape') {
      if (this.phase === 'playing') {
        this.phase = 'paused';
        this.pauseOverlay = Ui.buildPause(
          () => { this.phase = 'playing'; },
          () => { this.pauseOverlay = null; this.phase = 'menu'; Ui.buildStart(this.canvas, () => this.startGame(null), () => this.startGame(SaveSys.read())); });
      } else if (this.phase === 'paused' && this.pauseOverlay) {
        this.pauseOverlay.remove();
        this.pauseOverlay = null;
        this.phase = 'playing';
      }
      return;
    }
    if (this.phase !== 'playing') return;
    if (e.code === 'KeyQ') Player.cycleWeapon();
    if (e.code === 'KeyF') this.toggleCar();
    if (e.code === 'Minus' || e.code === 'Equal') Hud.adjustZoom(e.code === 'Minus' ? -2 : 2);
  },

  // Steal the nearest car (or exit the current one).
  toggleCar() {
    if (Player.car) {
      const car = Player.car;
      car.speed *= 0.2;
      Player.car = null;
      Player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
      Player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
      AudioSys.setEngine(false, 0);
      this.world.toast('Left the car');
      return;
    }
    let best = null, bestD = 60 * 60;
    for (const car of this.world.cars) {
      if (car.dead) continue;
      const d = dist2(car.x, car.y, Player.x, Player.y);
      if (d < bestD) { best = car; bestD = d; }
    }
    if (best) {
      if (best.kind !== 'police' && best.traffic !== false) {
        this.crime('carSteal');
        this.world.toast('Car stolen');
      } else {
        this.world.toast('Entered car');
      }
      best.traffic = false;
      Player.car = best;
      AudioSys.resume();
    }
  },

  update(dt) {
    const world = this.world;
    world.time += dt;
    // Player actions
    if (!Player.dead) {
      if (Player.car) {
        Player.car.drive(dt, Input);
      } else {
        Player.update(dt, Input, this);
        const weapon = Player.weapon();
        const firing = Input.down('Mouse0');
        if (firing && Player.fireTimer <= 0) {
          if (weapon.ranged) {
            Player.fireTimer = CONFIG.FIRE_COOLDOWN;
            Combat.fire(world, Player, Player.angle, weapon);
          } else {
            Player.fireTimer = CONFIG.PUNCH_COOLDOWN;
            Combat.punch(world, Player);
          }
        }
      }
    }
    if (Input.down('Mouse0') && Player.car) {
      // Drive-by: shoot sideways from the car.
      if (Player.fireTimer <= 0) {
        Player.fireTimer = CONFIG.FIRE_COOLDOWN * 1.6;
        Combat.fire(world, Player, Player.angle, WEAPONS[1]);
      }
    }
    Player.fireTimer -= dt;
    // Wheel zoom for the minimap
    const wheel = Input.consumeWheel();
    if (wheel) Hud.adjustZoom(wheel);
    // World systems
    for (const car of world.cars) {
      if (car.dead || car === Player.car) continue;
      if (car.traffic) car.trafficDrive(dt, world);
      if (car.burning && Math.random() < 0.4) Effects.fire(car);
    }
    Peds.update(world, dt);
    Combat.update(world, dt);
    Police.sync(world, dt);
    Police.updateWanted(world, dt);
    Missions.update(world, dt);
    Effects.update(dt);
    Camera.update(dt, Player.car || Player, !!Player.car, Player.vx, Player.vy);
    // Stats: cars wrecked by the player
    for (const car of world.cars) {
      if (car.dead && !car.counted) {
        car.counted = true;
        world.stats.carsWrecked++;
      }
    }
    // Autosave
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      this.saveTimer = CONFIG.SAVE_INTERVAL;
      SaveSys.write(world.snapshot());
    }
  },

  drawFrame() {
    const ctx = this.ctx, vw = this.view.w, vh = this.view.h;
    const world = this.world;
    const phase = dayPhase(world.time, CONFIG.DAY_LENGTH);
    // Sky tint behind the city (visible at map edge)
    ctx.fillStyle = '#10131c';
    ctx.fillRect(0, 0, vw, vh);
    if (!world) { requestAnimationFrame(() => this.drawFrame()); return; }
    Camera.apply(ctx, vw, vh);
    City.draw(ctx, Camera, vw, vh, phase);
    Effects.drawGround(ctx);
    Missions.drawMarkers(ctx);
    for (const car of world.cars) car.draw(ctx);
    for (const cruiser of world.wanted.cruisers) cruiser.draw(ctx);
    Peds.draw(ctx, world.peds);
    for (const cop of world.wanted.cops) {
      if (cop.dead) continue;
      ctx.save();
      ctx.translate(cop.x, cop.y);
      ctx.rotate(cop.angle);
      ctx.fillStyle = '#2b57a8';
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1c2f55';
      ctx.beginPath(); ctx.arc(3, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    Player.draw(ctx);
    // Bullets
    ctx.fillStyle = '#ffe9a0';
    for (const b of world.bullets) {
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    }
    Effects.draw(ctx);
    Camera.restore(ctx);
    // Day-night tint over everything
    const night = clamp(Math.abs(phase - 0.5) * 2.6 - 0.35, 0, 0.62);
    if (night > 0) {
      ctx.fillStyle = 'rgba(14,18,44,' + night.toFixed(3) + ')';
      ctx.fillRect(0, 0, vw, vh);
    } else if (phase > 0.3 && phase < 0.45) {
      // Sunset warmth
      ctx.fillStyle = 'rgba(255,140,40,' + (0.18 * (1 - Math.abs(phase - 0.375) / 0.075)).toFixed(3) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }
    if (this.phase !== 'menu') Hud.draw(ctx, world, vw, vh);
  },

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0.016);
    this.lastTime = now;
    if (this.phase === 'playing') this.update(dt);
    this.drawFrame();
    requestAnimationFrame(t => this.loop(t));
  },

  // Staged scene for screenshots: ?debug=chase puts the player in a car with
  // police after them, a mission running, and a full HUD.
  debugScene(kind) {
    const existing = document.getElementById('start');
    if (existing) existing.remove();
    // Pin the canvas to the screenshot viewport (headless innerHeight lies).
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.view.w = 1280;
    this.view.h = 720;
    this.startGame(null);
    const T = CONFIG.TILE;
    this.world.time = CONFIG.DAY_LENGTH * 0.5; // midday for clear screenshots
    if (kind === 'foot') {
      // On foot downtown, pistol drawn, peds and traffic around.
      Player.x = T * 6.2; Player.y = T * 5.5;
      Player.weaponIndex = 1;
      this.crime('shot');
      Camera.snapTo(Player.x, Player.y);
      this.phase = 'playing';
      return;
    }
    if (kind === 'drive') {
      // Cruising the bay district in a stolen taxi, light traffic.
      Player.x = T * 11; Player.y = T * 4.2;
      const car = new Car(Player.x, Player.y, 1.2, 'taxi');
      this.world.cars.push(car);
      Player.car = car;
      for (let i = 0; i < 14; i++) {
        const p = Missions.randomRoadPoint(makeRng(300 + i));
        const c = new Car(p.x, p.y, makeRng(400 + i)() * 6.28, 'civil');
        c.traffic = true;
        this.world.cars.push(c);
      }
      Camera.snapTo(Player.x, Player.y);
      this.phase = 'playing';
      return;
    }
    if (kind === 'rampage' || kind === 'chase') {
      const onFoot = kind === 'rampage';
      Player.x = T * 3; Player.y = T * 3;
      if (!onFoot) {
        const car = new Car(T * 3, T * 3, 0.4, 'sport');
        this.world.cars.push(car);
        Player.car = car;
      } else {
        Player.weaponIndex = 1;
      }
      this.crime('carSteal');
      this.crime('shot');
      this.crime('shot');
      this.world.wanted.heat = 3;
      this.world.wanted.level = 3;
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6;
        this.world.wanted.cops.push({
          x: Player.x + Math.cos(a) * 200, y: Player.y + Math.sin(a) * 200,
          hp: 55, angle: 0, dead: false, retire: false, fireTimer: 2, bob: 0,
        });
      }
      const cruiser = new Car(Player.x + 260, Player.y + 60, 0, 'police');
      cruiser.hp = 130;
      this.world.wanted.cruisers.push(cruiser);
      for (let i = 0; i < 26; i++) {
        const p = Missions.randomRoadPoint(makeRng(100 + i));
        const c = new Car(p.x, p.y, makeRng(200 + i)() * 6.28, 'civil');
        c.traffic = true;
        this.world.cars.push(c);
      }
      Missions.reset();
      Missions.index = 1;
      Missions.active = Missions.start_rampage(this.world, 'Contract: Street Sweep', 400);
      Missions.active.started = true;
      Missions.active.start(this.world);
      Player.money = 1870;
      Camera.snapTo(Player.x, Player.y);
    }
    this.phase = 'playing';
  },
};

window.addEventListener('load', () => {
  Game.boot();
  Game.lastTime = performance.now();
  requestAnimationFrame(t => Game.loop(t));
});
