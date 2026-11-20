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
      snapshot: () => SaveSys.data(),
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
      if (car.burning && Math.random() < 0.15) Effects.smoke(car.x, car.y);
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
    // Day-night grade: golden hour washes the city in warm amber, night cools.
    const night = clamp(Math.abs(phase - 0.5) * 2.6 - 0.35, 0, 0.62);
    if (phase > 0.30 && phase < 0.50) {
      // Golden hour: warm overlay peaking around phase 0.40.
      const dusk = 1 - Math.abs(phase - 0.40) / 0.10;
      const g = clamp(dusk, 0, 1);
      ctx.fillStyle = 'rgba(255,146,52,' + (0.22 * g).toFixed(3) + ')';
      ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = 'rgba(255,190,90,' + (0.10 * g).toFixed(3) + ')';
      ctx.fillRect(0, 0, vw, vh);
    } else if (night > 0) {
      ctx.fillStyle = 'rgba(14,18,44,' + night.toFixed(3) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }
    // Subtle vignette: darkens the frame corners for depth.
    const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(20,10,5,0.30)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, vw, vh);
    if (this.phase !== 'menu') Hud.draw(ctx, world, vw, vh);
  },

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0.016);
    this.lastTime = now;
    if (this.phase === 'playing' && !this.debugFrozen) this.update(dt);
    this.drawFrame();
    requestAnimationFrame(t => this.loop(t));
  },

  // Staged scene for screenshots: ?debug=chase puts the player in a car with
  // police after them, a mission running, and a full HUD.
  debugScene(kind) {
    const existing = document.getElementById('start');
    if (existing) existing.remove();
    // Size the canvas to the real headless viewport (it can lag --window-size).
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.view.w = this.canvas.width;
    this.view.h = this.canvas.height;
    this.startGame(null);
    const T = CONFIG.TILE;
    this.world.time = CONFIG.DAY_LENGTH * 0.40; // force golden hour for screenshots
    this.debugFrozen = true; // staged scene: don't simulate (lights still flash)
    if (kind === 'foot') {
      // On foot downtown: peds on the sidewalk, parked cars, awning shops.
      // Stand on the east sidewalk of the avenue at x=T*6, mid-block.
      Player.x = T * 6 + 40; Player.y = T * 5 + 170;
      Player.weaponIndex = 1;
      Player.walkPhase = 0;
      Player.angle = -0.5;
      // Sidewalk peds strolling nearby (same sidewalk band, jittered).
      for (let i = 0; i < 24; i++) {
        const px = T * 6 + 32 + Math.floor(i / 8) * 16;
        const py = Player.y - 140 + i * 14;
        if (!City.hitBuilding(px, py, 6) && !City.onRoad(px, py)) {
          this.world.peds.push(Peds.make(px, py));
        }
      }
      // Parked cars along the curb (road edge just west of the sidewalk).
      for (let i = 0; i < 6; i++) {
        const c = new Car(T * 6 + 10, Player.y - 150 + i * 60, Math.PI / 2, ['civil', 'taxi', 'sport'][i % 3]);
        c.traffic = false;
        this.world.cars.push(c);
      }
      Camera.snapTo(Player.x, Player.y);
      this.phase = 'playing';
      return;
    }
    if (kind === 'bay') {
      // Cruising the waterfront avenue: bay, palms, dock and waves in view.
      const shore = (CONFIG.BLOCKS_X - CONFIG.WATER_COLS) * CONFIG.TILE;
      Player.x = shore; Player.y = T * 6.5;
      const car = new Car(Player.x, Player.y, Math.PI / 2, 'sport');
      this.world.cars.push(car);
      Player.car = car;
      car.speed = 180;
      for (let i = 0; i < 10; i++) {
        const c = new Car(shore, Player.y - 600 + i * 140, i % 2 ? 0 : Math.PI, i % 3 ? 'civil' : 'taxi');
        c.traffic = true;
        this.world.cars.push(c);
      }
      Camera.snapTo(Player.x, Player.y);
      this.phase = 'playing';
      return;
    }
    if (kind === 'drive') {
      // Cruising the waterfront avenue in a stolen taxi, traffic around.
      Player.x = (CONFIG.BLOCKS_X - CONFIG.WATER_COLS) * CONFIG.TILE; // waterfront avenue centerline
      Player.y = T * 3.0;
      const car = new Car(Player.x, Player.y, Math.PI / 2, 'taxi');
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
      let car = null;
      if (!onFoot) {
        car = new Car(T * 3, T * 3, 0.4, 'sport');
        this.world.cars.push(car);
        Player.car = car;
        car.speed = 240;
        // Pre-laid skid marks trailing the player's line of travel.
        for (let i = 1; i < 10; i++) {
          const sx = T * 3 - Math.cos(0.4) * i * 26;
          const sy = T * 3 - Math.sin(0.4) * i * 26;
          const off = 9;
          Effects.marks.push({ x: sx + off, y: sy - off, angle: 0.4, life: 30, color: 'rgba(20,20,20,0.65)', size: 5, kind: 'skid' });
          Effects.marks.push({ x: sx - off, y: sy + off, angle: 0.4, life: 30, color: 'rgba(20,20,20,0.65)', size: 5, kind: 'skid' });
        }
      } else {
        Player.weaponIndex = 1;
      }
      this.crime('carSteal');
      this.crime('shot');
      this.crime('shot');
      this.world.wanted.heat = 3;
      this.world.wanted.level = 3;
      // Cops spilling out of the cruisers, right behind.
      for (let i = 0; i < 4; i++) {
        const a = 0.4 + Math.PI + (i - 1.5) * 0.35;
        this.world.wanted.cops.push({
          x: Player.x + Math.cos(a) * 170, y: Player.y + Math.sin(a) * 170,
          hp: 55, angle: a + Math.PI, dead: false, retire: false, fireTimer: 2, bob: 0,
        });
      }
      // 3 cruisers fanned right on the player's tail, lights flashing.
      for (let i = 0; i < 3; i++) {
        const a = 0.4 + Math.PI + (i - 1) * 0.5;
        const cruiser = new Car(Player.x + Math.cos(a) * (190 + i * 60), Player.y + Math.sin(a) * (190 + i * 60), 0.4, 'police');
        cruiser.hp = 130;
        cruiser.speed = 200;
        this.world.wanted.cruisers.push(cruiser);
      }
      if (onFoot) {
        // Rampage: a just-exploded car burning ahead + a wreck, cops closing in.
        const wreckX = Player.x + 150, wreckY = Player.y + 60;
        const wreck = new Car(wreckX, wreckY, 1.2, 'civil');
        wreck.dead = true;
        this.world.cars.push(wreck);
        const burning = new Car(Player.x - 120, Player.y + 140, 2.4, 'civil');
        burning.hp = 30; burning.burning = true;
        this.world.cars.push(burning);
        Effects.explosion(wreckX, wreckY);
        // Extra fireballs so the explosion is unmistakable in the frame.
        for (let i = 0; i < 3; i++) {
          Effects.rings.push({ x: wreckX + (i - 1) * 30, y: wreckY + (i % 2) * 24, life: 0.55, maxLife: 0.55, r0: 8, r1: 54 });
        }
        for (let i = 0; i < 14; i++) {
          Effects.spawn(wreckX + (Math.random() - 0.5) * 60, wreckY + (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 40, -50 - Math.random() * 40, 1.0,
            Math.random() < 0.5 ? '#ff8830' : '#ffce54', 5 + Math.random() * 5, -20);
        }
        // Advance the effect system manually so the fireball is mid-bloom.
        for (let i = 0; i < 14; i++) Effects.update(0.035);
      }
      for (let i = 0; i < 26; i++) {
        const p = Missions.randomRoadPoint(makeRng(100 + i));
        const c = new Car(p.x, p.y, makeRng(200 + i)() * 6.28, 'civil');
        c.traffic = true;
        this.world.cars.push(c);
      }
      // Scattered fleeing peds for street life.
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const px = clamp(Player.x + Math.cos(a) * (120 + Math.random() * 200), 40, City.w - 40);
        const py = clamp(Player.y + Math.sin(a) * (120 + Math.random() * 200), 40, City.h - 40);
        if (!City.hitBuilding(px, py, 4)) {
          const ped = Peds.make(px, py);
          ped.flee = 3;
          this.world.peds.push(ped);
        }
      }
      this.world.threatX = Player.x; this.world.threatY = Player.y;
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
