// Sunfall City — pedestrians. They wander sidewalks, scatter from gunfire and
// near-miss cars, and can be killed (which raises the wanted level).
const Peds = {
  // Managed as a flat array on the world; helpers here operate on individual
  // peds and on world.peds collectively.
  spawnRing(n, cx, cy, radius) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const r = radius * (0.4 + Math.random() * 0.6);
      out.push(this.make(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
    return out;
  },

  make(x, y) {
    return {
      x, y,
      angle: Math.random() * Math.PI * 2,
      speed: CONFIG.PED_SPEED * (0.7 + Math.random() * 0.6),
      dead: false,
      flee: 0,          // seconds of fleeing left
      color: ['#d8c9a8', '#a8b8d8', '#c9a8b8', '#b8c9a8', '#8f9fb5'][Math.floor(Math.random() * 5)],
      bob: Math.random() * Math.PI * 2,
      deadTimer: 12,
    };
  },

  // Keep a pool of peds near the player: despawn far ones, respawn at the edge.
  populate(world, count) {
    while (world.peds.length < count) {
      const a = Math.random() * Math.PI * 2;
      const r = 700 + Math.random() * 400;
      const x = clamp(Player.x + Math.cos(a) * r, 40, City.w - 40);
      const y = clamp(Player.y + Math.sin(a) * r, 40, City.h - 40);
      if (City.hitBuilding(x, y, 4) || City.onRoad(x, y)) continue;
      world.peds.push(this.make(x, y));
    }
  },

  update(world, dt) {
    for (const p of world.peds) {
      if (p.dead) {
        p.deadTimer -= dt;
        continue;
      }
      // Fleeing: run directly away from the threat.
      if (p.flee > 0) {
        p.flee -= dt;
        p.angle = Math.atan2(p.y - world.threatY, p.x - world.threatX);
        const sp = p.speed * 2.2;
        const nx = p.x + Math.cos(p.angle) * sp * dt;
        const ny = p.y + Math.sin(p.angle) * sp * dt;
        if (!City.hitBuilding(nx, ny, 4) && nx > 20 && nx < City.w - 20 && ny > 20 && ny < City.h - 20) {
          p.x = nx; p.y = ny;
        }
        continue;
      }
      // Wander: change heading occasionally, hug sidewalks.
      p.bob += dt * 8;
      if (Math.random() < dt * 0.4) p.angle += (Math.random() - 0.5) * 1.6;
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (City.hitBuilding(nx, ny, 4) || City.onRoad(nx, ny) || nx < 20 || nx > City.w - 20 || ny < 20 || ny > City.h - 20) {
        p.angle += Math.PI / 2 + Math.random() * 0.6;
      } else {
        p.x = nx; p.y = ny;
      }
      // Near-miss from a fast car sends them running.
      for (const c of world.cars) {
        if (!c.dead && Math.abs(c.speed) > 150 && dist2(c.x, c.y, p.x, p.y) < 130 * 130) {
          p.flee = 1.6;
          world.threatX = c.x; world.threatY = c.y;
          break;
        }
      }
    }
    // Cull dead bodies and far-away peds, then repopulate.
    world.peds = world.peds.filter(p => !(p.dead && p.deadTimer <= 0));
    world.peds = world.peds.filter(p => dist2(p.x, p.y, Player.x, Player.y) < 1400 * 1400);
    this.populate(world, CONFIG.PED_COUNT);
  },

  scare(world, x, y, radius) {
    world.threatX = x; world.threatY = y;
    for (const p of world.peds) {
      if (!p.dead && dist2(p.x, p.y, x, y) < radius * radius) p.flee = 2.5 + Math.random();
    }
  },

  killPed(p, world) {
    if (p.dead) return;
    p.dead = true;
    p.deadTimer = 10;
    Effects.blood(p.x, p.y);
    world.stats.pedsKilled++;
  },

  draw(ctx, peds) {
    for (const p of peds) {
      if (p.dead) {
        ctx.fillStyle = 'rgba(120,20,20,0.8)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 5, p.angle, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      const bob = Math.sin(p.bob) * 1.2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(1, 2, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(0, bob, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a3a2c';
      ctx.beginPath(); ctx.arc(2, bob, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  },
};
