// Sunfall City — combat. Bullets (pistol), punches (fists) and the hit
// resolution against pedestrians, police and vehicles. Fires from the player
// or from police officers; every shot raises heat and scares nearby peds.
const Combat = {
  fire(world, shooter, angle, weapon) {
    if (weapon.ranged) {
      world.bullets.push({
        x: shooter.x + Math.cos(angle) * 14,
        y: shooter.y + Math.sin(angle) * 14,
        vx: Math.cos(angle) * CONFIG.BULLET_SPEED,
        vy: Math.sin(angle) * CONFIG.BULLET_SPEED,
        life: CONFIG.BULLET_LIFE,
        fromPlayer: shooter === Player,
        dmg: weapon.damage,
      });
      AudioSys.shot();
      Effects.muzzle(shooter.x, shooter.y, angle);
      if (shooter === Player) {
        world.wanted.crime('shot');
        Peds.scare(world, shooter.x, shooter.y, 320);
      }
    }
  },

  punch(world, attacker) {
    AudioSys.punch();
    Effects.punch(attacker.x + Math.cos(attacker.angle) * 20, attacker.y + Math.sin(attacker.angle) * 20);
    // Nearest ped or cop within range takes the hit.
    const ax = attacker.x + Math.cos(attacker.angle) * 24;
    const ay = attacker.y + Math.sin(attacker.angle) * 24;
    for (const p of world.peds) {
      if (!p.dead && dist2(p.x, p.y, ax, ay) < 26 * 26) {
        Peds.killPed(p, world);
        if (attacker === Player) world.wanted.crime('pedKill');
        return;
      }
    }
    for (const c of world.wanted.cops) {
      if (dist2(c.x, c.y, ax, ay) < 26 * 26) {
        Police.hitCop(c, 20, world);
        if (attacker === Player) world.wanted.crime('copHit');
        return;
      }
    }
  },

  update(world, dt) {
    for (const b of world.bullets) {
      b.life -= dt;
      const steps = 3;
      for (let i = 0; i < steps && b.life > 0; i++) {
        const nx = b.x + (b.vx * dt) / steps;
        const ny = b.y + (b.vy * dt) / steps;
        b.x = nx; b.y = ny;
        if (City.hitBuilding(nx, ny, 0)) {
          Effects.sparks(nx, ny);
          b.life = 0;
          break;
        }
        if (b.fromPlayer) this.resolvePlayerHit(world, nx, ny);
        else this.resolveCopHit(world, nx, ny);
      }
    }
    world.bullets = world.bullets.filter(b => b.life > 0);
  },

  resolvePlayerHit(world, x, y) {
    for (const p of world.peds) {
      if (!p.dead && dist2(p.x, p.y, x, y) < 12 * 12) {
        Peds.killPed(p, world);
        world.wanted.crime('pedKill');
        world.stats.pedsKilled++;
        return;
      }
    }
    for (const c of world.wanted.cops) {
      if (!c.dead && dist2(c.x, c.y, x, y) < 12 * 12) {
        Police.hitCop(c, WEAPONS[1].damage, world);
        world.wanted.crime('copHit');
        return;
      }
    }
    for (const car of world.cars) {
      if (car.dead || car === Player.car) continue;
      if (dist2(car.x, car.y, x, y) < 16 * 16) {
        car.damageCar(WEAPONS[1].damage, world);
        world.stats.damageDealt += WEAPONS[1].damage;
        return;
      }
    }
  },

  resolveCopHit(world, x, y) {
    // Police bullets only matter if they hit the player (on foot or in a car).
    if (Player.dead) return;
    if (dist2(Player.x, Player.y, x, y) < 12 * 12) {
      Player.damage(9, world);
      Effects.blood(x, y);
    }
  },
};
