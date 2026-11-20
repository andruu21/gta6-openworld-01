// Sunfall City — the police. Wanted stars rise on crimes, decay while the
// player stays out of sight; foot cops and cruisers spawn proportional to the
// level, chase the player and shoot. Killing cops raises the heat faster.
const Police = {
  hitCop(cop, dmg, world) {
    cop.hp -= dmg;
    Effects.blood(cop.x, cop.y);
    if (cop.hp <= 0) {
      cop.dead = true;
      world.stats.copsKilled++;
      world.wanted.crime('copKill');
      world.moneyDrop(120);
      world.toast('Officer down — heat rising');
    }
  },

  // Spawn police appropriate to the wanted level around the player.
  sync(world, dt) {
    const wanted = world.wanted;
    if (wanted.level <= 0) {
      wanted.cops = wanted.cops.filter(c => !c.dead && (c.retire || dist2(c.x, c.y, Player.x, Player.y) > 900 * 900));
      wanted.cruisers = wanted.cruisers.filter(c => !c.dead);
      AudioSys.setSiren(false);
      return;
    }
    AudioSys.setSiren(true);
    const wantFoot = Math.min(CONFIG.POLICE_FOOT * wanted.level, 10);
    const wantCars = Math.max(0, (wanted.level - 1)) * CONFIG.POLICE_CARS;
    let foot = wanted.cops.filter(c => !c.dead && !c.retire).length;
    let cars = wanted.cruisers.filter(c => !c.dead).length;
    // Spawn a foot cop every so often until the quota is met.
    world.copSpawnTimer -= dt;
    if (world.copSpawnTimer <= 0 && foot < wantFoot) {
      world.copSpawnTimer = 1.4;
      const a = Math.random() * Math.PI * 2;
      const r = 480 + Math.random() * 260;
      const x = clamp(Player.x + Math.cos(a) * r, 40, City.w - 40);
      const y = clamp(Player.y + Math.sin(a) * r, 40, City.h - 40);
      if (!City.hitBuilding(x, y, 6)) {
        wanted.cops.push({ x, y, hp: 55, angle: 0, dead: false, retire: false, fireTimer: 1 + Math.random(), bob: 0 });
        foot++;
      }
    }
    if (cars < wantCars && world.copSpawnTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      const r = 620;
      const x = clamp(Player.x + Math.cos(a) * r, 60, City.w - 60);
      const y = clamp(Player.y + Math.sin(a) * r, 60, City.h - 60);
      const car = new Car(x, y, Math.atan2(Player.y - y, Player.x - x), 'police');
      car.hp = 130;
      wanted.cruisers.push(car);
      cars++;
    }
    this.updateCops(world, dt);
    this.updateCruisers(world, dt);
  },

  updateCops(world, dt) {
    for (const cop of world.wanted.cops) {
      if (cop.dead) continue;
      cop.bob += dt * 9;
      const d = Math.hypot(Player.x - cop.x, Player.y - cop.y);
      cop.angle = Math.atan2(Player.y - cop.y, Player.x - cop.x);
      // Approach on foot; keep a shooting distance of ~120px.
      if (d > 130 && !Player.car) {
        const nx = cop.x + Math.cos(cop.angle) * 120 * dt;
        const ny = cop.y + Math.sin(cop.angle) * 120 * dt;
        if (!City.hitBuilding(nx, ny, 4)) { cop.x = nx; cop.y = ny; }
      } else if (Player.car) {
        // Step aside from speeding cars but keep chasing.
        const nx = cop.x + Math.cos(cop.angle) * 150 * dt;
        const ny = cop.y + Math.sin(cop.angle) * 150 * dt;
        if (!City.hitBuilding(nx, ny, 4)) { cop.x = nx; cop.y = ny; }
      }
      cop.fireTimer -= dt;
      if (cop.fireTimer <= 0 && d < 340 && !Player.dead) {
        cop.fireTimer = 0.9 + Math.random() * 0.6;
        Combat.fire(world, cop, cop.angle + (Math.random() - 0.5) * 0.18, WEAPONS[1]);
      }
    }
    world.wanted.cops = world.wanted.cops.filter(c => !c.dead || c.deadTimer > 0);
    world.wanted.cops.forEach(c => { if (c.dead) c.deadTimer -= dt; });
  },

  updateCruisers(world, dt) {
    for (const car of world.wanted.cruisers) {
      if (car.dead) continue;
      // Drive straight at the player; ram when close.
      car.laneDir = Math.atan2(Player.y - car.y, Player.x - car.x);
      car.speed = CONFIG.CAR_MAX_SPEED * 0.75;
      car.move(dt, world);
      if (Player.car && dist2(car.x, car.y, Player.car.x, Player.car.y) < 30 * 30) {
        Player.car.damageCar(14, world);
        car.damageCar(10, world);
      }
      if (!Player.car && dist2(car.x, car.y, Player.x, Player.y) < 24 * 24 && Math.abs(car.speed) > 40) {
        Player.damage(30, world);
      }
    }
  },

  // Wanted decay: level drops when no cop has line of sight for a while.
  updateWanted(world, dt) {
    const wanted = world.wanted;
    if (wanted.level <= 0) return;
    let seen = false;
    for (const cop of wanted.cops) {
      if (!cop.dead && dist2(cop.x, cop.y, Player.x, Player.y) < 400 * 400) seen = true;
    }
    for (const car of wanted.cruisers) {
      if (!car.dead && dist2(car.x, car.y, Player.x, Player.y) < 520 * 520) seen = true;
    }
    if (!seen) {
      wanted.heat = Math.max(0, wanted.heat - dt * CONFIG.WANTED_DECAY);
      wanted.level = Math.floor(wanted.heat);
    } else {
      wanted.calmTimer = 0;
    }
    wanted.level = Math.min(5, Math.floor(wanted.heat));
  },
};
