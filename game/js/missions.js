// Sunfall City — missions and the story chain. Nova Reyes works for fixer
// Marisol Vega: deliveries first, then a rampage contract, then a street race,
// then the cycle repeats at higher pay. Each mission places markers in the
// world and on the minimap.
const STORY_INTRO =
  'Nova Reyes arrives in Sunfall City with two hundred dollars, ' +
  'a stolen pistol and the address of a fixer named Marisol Vega. ' +
  'The city sun sets over the bay and the work never stops...';

const Missions = {
  // Mission definitions. `chain` is the ordered story list; each entry names a
  // generator that builds the live mission object.
  chain: [
    { type: 'delivery', pay: 350, title: 'Run the Package' },
    { type: 'rampage', pay: 400, title: 'Contract: Street Sweep' },
    { type: 'race', pay: 500, title: 'Bay Circuit' },
    { type: 'delivery', pay: 550, title: 'Hot Cargo' },
    { type: 'rampage', pay: 650, title: 'Contract: Dock Lights' },
    { type: 'race', pay: 800, title: 'Avenue Rush' },
  ],

  reset() {
    this.index = 0;
    this.done = [];
    this.active = null;
  },

  // Start the next mission in the chain (loops with rising pay).
  offer(world) {
    const entry = this.chain[this.index % this.chain.length];
    const loop = Math.floor(this.index / this.chain.length);
    const pay = entry.pay * (1 + loop * 0.5);
    const gen = this['start_' + entry.type];
    this.active = gen.call(this, world, entry.title, Math.round(pay));
    this.active.type = entry.type;
    this.active.title = entry.title + (loop > 0 ? ' II+'.repeat(1 + loop) : '');
    world.toast('MISSION: ' + this.active.title);
    return this.active;
  },

  start_delivery(world, title, pay) {
    const rng = makeRng(Math.floor(Math.random() * 1e9));
    const pickup = this.randomRoadPoint(rng);
    const dropoff = this.randomRoadPoint(rng);
    return {
      title, pay, stage: 'pickup', pickup, dropoff, timer: 0,
      objective: 'Pick up the package (yellow marker)',
      update(world, dt) {
        const m = Missions.active;
        if (m.stage === 'pickup' && dist2(Player.x, Player.y, m.pickup.x, m.pickup.y) < 40 * 40) {
          m.stage = 'dropoff';
          world.toast('Package secured — drive to the dropoff');
        } else if (m.stage === 'dropoff' && dist2(Player.x, Player.y, m.dropoff.x, m.dropoff.y) < 40 * 40) {
          Missions.complete(world);
        }
      },
      markers() { return this.stage === 'pickup' ? [this.pickup] : [this.dropoff]; },
    };
  },

  start_rampage(world, title, pay) {
    const rng = makeRng(Math.floor(Math.random() * 1e9));
    const targets = [];
    for (let i = 0; i < 5; i++) {
      const p = this.randomRoadPoint(rng);
      targets.push({ x: p.x, y: p.y, hp: 100, car: null });
    }
    return {
      title, pay, targets, timer: 75, objective: 'Destroy 5 target cars before time runs out',
      start(world) {
        for (const t of this.targets) {
          const car = new Car(t.x, t.y, Math.random() * Math.PI * 2, 'civil');
          car.hp = 70;
          t.car = car;
          world.cars.push(car);
        }
      },
      update(world, dt) {
        this.timer -= dt;
        if (this.timer <= 0) { Missions.fail(world, 'Time ran out'); return; }
        const left = this.targets.filter(t => t.car && !t.car.dead).length;
        const destroyed = 5 - left;
        this.objective = 'Destroy target cars: ' + destroyed + '/5 (' + Math.ceil(this.timer) + 's)';
        if (left === 0) Missions.complete(world);
      },
      markers() { return this.targets.filter(t => t.car && !t.car.dead).map(t => ({ x: t.car.x, y: t.car.y })); },
    };
  },

  start_race(world, title, pay) {
    const rng = makeRng(Math.floor(Math.random() * 1e9));
    const checkpoints = [];
    const T = CONFIG.TILE;
    for (let i = 0; i < 6; i++) {
      const gx = Math.floor(rng() * (CONFIG.BLOCKS_X - 1));
      const gy = Math.floor(rng() * (CONFIG.BLOCKS_Y - 1));
      checkpoints.push({ x: gx * T + T / 2, y: gy * T + T / 2, r: 46 });
    }
    return {
      title, pay, checkpoints, idx: 0, timer: 0, objective: 'Reach the checkpoints in order',
      start(world) {
        world.toast('Get in a car — race begins when you pass the first gate');
      },
      update(world, dt) {
        this.timer += dt;
        const cp = this.checkpoints[this.idx];
        this.objective = 'Checkpoint ' + (this.idx + 1) + '/' + this.checkpoints.length;
        if (Player.car && dist2(Player.x, Player.y, cp.x, cp.y) < cp.r * cp.r) {
          this.idx++;
          AudioSys.jingle(false);
          if (this.idx >= this.checkpoints.length) Missions.complete(world);
        }
      },
      markers() { return this.idx < this.checkpoints.length ? [this.checkpoints[this.idx]] : []; },
    };
  },

  randomRoadPoint(rng) {
    for (let tries = 0; tries < 40; tries++) {
      const gx = Math.floor(rng() * (CONFIG.BLOCKS_X + 1)) * CONFIG.TILE;
      const gy = Math.floor(rng() * (CONFIG.BLOCKS_Y + 1)) * CONFIG.TILE;
      const x = clamp(gx + (rng() - 0.5) * 60, 60, City.w - 60);
      const y = clamp(gy + (rng() - 0.5) * 60, 60, City.h - 60);
      if (!City.hitBuilding(x, y, 10)) return { x, y };
    }
    return { x: City.w / 2, y: City.h / 2 };
  },

  complete(world) {
    const m = this.active;
    if (!m) return;
    world.money += m.pay;
    world.stats.missionsDone++;
    this.done.push(m.title);
    AudioSys.jingle(true);
    world.toast('MISSION COMPLETE: ' + m.title + ' — $' + m.pay);
    Effects.celebrate(Player.x, Player.y);
    this.active = null;
    this.index++;
    SaveSys.write(world.snapshot());
    world.missionCooldown = 4;
  },

  fail(world, reason) {
    if (!this.active) return;
    world.toast('MISSION FAILED: ' + reason);
    AudioSys.jingle(false);
    this.active = null;
    world.missionCooldown = 4;
  },

  update(world, dt) {
    if (world.missionCooldown > 0) {
      world.missionCooldown -= dt;
      if (world.missionCooldown <= 0) this.offer(world);
      return;
    }
    if (!this.active && this.index === 0 && !world.missionOffered) {
      world.missionOffered = true;
      world.missionCooldown = 5;
    }
    if (this.active) {
      if (this.active.start && !this.active.started) { this.active.started = true; this.active.start(world); }
      this.active.update(world, dt);
    }
  },

  // Objective text for the HUD.
  objective() {
    return this.active ? this.active.objective : (this.index === 0 ? 'Find work — follow the blue marker' : 'Next job incoming...');
  },

  drawMarkers(ctx) {
    if (!this.active) return;
    for (const m of this.active.markers()) {
      ctx.save();
      ctx.translate(m.x, m.y);
      const pulse = 1 + Math.sin(performance.now() / 200) * 0.15;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = this.active.type === 'rampage' ? '#ff5544' : this.active.type === 'race' ? '#44aaff' : '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(14, 8); ctx.lineTo(-14, 8);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#0d1119';
      ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
  },
};
