// Sunfall City — vehicles. One Car class covers parked cars, lane-following
// traffic, police cruisers and the car the player drives. Cars take damage,
// catch fire and explode; F near a car steals it.
class Car {
  constructor(x, y, angle, kind) {
    this.x = x; this.y = y;
    this.angle = angle || 0;
    this.vx = 0; this.vy = 0;
    this.speed = 0;              // signed forward speed
    this.kind = kind || 'civil'; // civil | police | taxi | sport
    this.hp = CONFIG.CAR_HP;
    this.burning = false;
    this.dead = false;           // wrecked (exploded)
    this.traffic = kind === 'civil' || kind === 'taxi';
    this.laneDir = this.angle;   // direction of lane travel for AI
    this.wanderTimer = 0;
    this.honk = 0;
    const palette = { civil: '#c94f3d', taxi: '#e8b23a', sport: '#3fa7c9', police: '#e9e9ee' };
    this.color = palette[this.kind] || palette.civil;
    this.w = kind === 'sport' ? 44 : kind === 'police' ? 42 : 40;
    this.h = kind === 'sport' ? 22 : 20;
    // Per-car trim color so the street doesn't look like a mono-colour lot.
    this.trim = ['#8a6f4e', '#4e6f8a', '#6f8a4e', '#8a4e6f'][Math.floor(Math.random() * 4)];
  }

  get occupied() { return Player.car === this; }

  explode(world) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    AudioSys.explosion();
    Camera.addShake(1.0);
    Effects.explosion(this.x, this.y);
    world.wanted.crime('explosion');
    // Damage anyone standing/driving right next to the blast.
    if (!Player.car && dist2(Player.x, Player.y, this.x, this.y) < 90 * 90) {
      Player.damage(45, world);
    }
    for (const c of world.wanted.cops) {
      if (dist2(c.x, c.y, this.x, this.y) < 90 * 90) Police.hitCop(c, 60, world);
    }
    for (const p of world.peds) {
      if (!p.dead && dist2(p.x, p.y, this.x, this.y) < 90 * 90) Peds.killPed(p, world);
    }
  }

  damageCar(amount, world) {
    if (this.dead) return;
    this.hp -= amount;
    if (this.hp < 35 && !this.burning) {
      this.burning = true;
      Effects.fire(this);
    }
    if (this.hp <= 0) this.explode(world);
  }

  // Player driving physics: W/S throttle/brake, A/D steer scaled by speed.
  drive(dt, input) {
    let throttle = 0;
    if (input.down('KeyW')) throttle += 1;
    if (input.down('KeyS')) throttle -= 1;
    if (throttle > 0) this.speed += CONFIG.CAR_ACCEL * dt;
    else if (throttle < 0) this.speed -= (this.speed > 0 ? CONFIG.CAR_BRAKE : CONFIG.CAR_ACCEL * 0.6) * dt;
    else this.speed *= (1 - 1.4 * dt);
    this.speed = clamp(this.speed, -CONFIG.CAR_MAX_SPEED * 0.5, CONFIG.CAR_MAX_SPEED);
    let steer = 0;
    if (input.down('KeyA')) steer -= 1;
    if (input.down('KeyD')) steer += 1;
    const lock = CONFIG.CAR_TURN * clamp(Math.abs(this.speed) / 130, 0, 1) * Math.sign(this.speed || 1);
    this.angle += steer * lock * dt;
    // Skid marks when cornering hard
    if (Math.abs(steer) > 0 && Math.abs(this.speed) > 220) Effects.skid(this);
    this.move(dt, world0());
    if (City.hitBuilding(this.x, this.y, 12)) {
      // Crash into a building: bounce and take damage.
      this.x -= this.vx * dt * 1.5;
      this.y -= this.vy * dt * 1.5;
      this.speed *= -0.3;
      this.damageCar(Math.abs(this.speed) * 0.06 + 4, world0());
      Effects.sparks(this.x, this.y);
    }
    AudioSys.setEngine(true, clamp(Math.abs(this.speed) / CONFIG.CAR_MAX_SPEED, 0, 1));
  }

  // Traffic AI: keep rolling along the lane, slow near the player's car ahead.
  trafficDrive(dt, world) {
    if (this.dead) return;
    const sp = 120;
    const dir = { x: Math.cos(this.laneDir), y: Math.sin(this.laneDir) };
    this.speed = sp;
    // Clamp to lane: steer toward the next grid line in travel direction.
    const aheadX = this.x + dir.x * 60, aheadY = this.y + dir.y * 60;
    if (aheadX < 20 || aheadX > City.w - 20 || aheadY < 20 || aheadY > City.h - 20) {
      // Turn around at the map edge.
      this.laneDir += Math.PI + (Math.random() - 0.5) * 0.4;
    }
    this.angle = angleLerp(this.angle, this.laneDir, clamp(3 * dt, 0, 1));
    this.move(dt, world);
    // Panic honk when the player nearly rams us
    const d2 = dist2(this.x, this.y, Player.x, Player.y);
    if (d2 < 80 * 80 && Player.car) this.honk = 0.5;
    if (this.honk > 0) this.honk -= dt;
  }

  move(dt, world) {
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, 16, City.w - 16);
    this.y = clamp(this.y, 16, City.h - 16);
    // Running over pedestrians
    if (world && Math.abs(this.speed) > 60) {
      for (const p of world.peds) {
        if (!p.dead && dist2(p.x, p.y, this.x, this.y) < 22 * 22) {
          Peds.killPed(p, world);
          if (this.occupied) world.wanted.crime('pedKill');
        }
      }
    }
  }

  draw(ctx) {
    if (this.dead) {
      // Charred wreck
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-this.w / 2 + 4, -this.h / 2 + 5, this.w, this.h);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    // Roof inset (darker centre panel) and sunlit rear edge.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-this.w / 2 + 6, -this.h / 2 + 4, this.w - 14, this.h - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(-this.w / 2, -this.h / 2, 3, this.h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-2, -this.h / 2 + 3, 8, this.h - 6);   // windshield
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(this.w / 2 - 8, -this.h / 2 + 3, 4, this.h - 6); // rear window
    if (this.kind === 'police') {
      // Black doors + "SUNFALL PD" stripe, white/black livery.
      ctx.fillStyle = '#17181c';
      ctx.fillRect(-this.w / 2 + 8, -this.h / 2, this.w - 22, this.h);
      ctx.fillStyle = '#d8b23a';
      ctx.fillRect(-this.w / 2 + 8, -1.5, this.w - 22, 3);
      // Alternating red/blue light bar with glow when chasing.
      const t = performance.now() / 130;
      const red = Math.floor(t) % 2 === 0;
      const on = world0() && world0().wanted && world0().wanted.level > 0;
      const glow = on ? 0.30 + Math.sin(t * 12) * 0.12 : 0;
      if (glow > 0) {
        ctx.fillStyle = red ? 'rgba(255,60,60,' + glow.toFixed(2) + ')' : 'rgba(70,110,255,' + glow.toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#1a1a1e';
      ctx.fillRect(-4, -this.h / 2 - 6, 10, 5);
      ctx.fillStyle = red ? '#ff4040' : '#7a3030';
      ctx.fillRect(-4, -this.h / 2 - 6, 5, 5);
      ctx.fillStyle = red ? '#30357a' : '#4a68ff';
      ctx.fillRect(1, -this.h / 2 - 6, 5, 5);
    }
    ctx.restore();
  }
}

// Fallback world accessor for physics callbacks that run before a world is
// wired (only relevant in headless smoke tests; in game main.js sets it).
let _world = null;
function world0() { return _world; }
