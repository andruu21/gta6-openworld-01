// Sunfall City — the player on foot. Handles WASD movement, mouse aim,
// health/money, entering and exiting vehicles, and respawn after death.
const Player = {
  x: 0, y: 0, vx: 0, vy: 0,
  angle: 0,           // facing (mouse aim on foot)
  hp: CONFIG.PLAYER_HP,
  money: CONFIG.PLAYER_MONEY_START,
  car: null,          // vehicle being driven, or null
  weaponIndex: 1,     // 0 fists, 1 pistol
  fireTimer: 0,
  dead: false,
  deadTimer: 0,
  walkPhase: 0,

  spawn(x, y) {
    this.x = x; this.y = y; this.vx = this.vy = 0;
    this.hp = CONFIG.PLAYER_HP;
    this.car = null;
    this.dead = false;
    this.deadTimer = 0;
    Camera.snapTo(x, y);
  },

  weapon() { return WEAPONS[this.weaponIndex]; },
  cycleWeapon() {
    this.weaponIndex = (this.weaponIndex + 1) % WEAPONS.length;
  },

  update(dt, input, world) {
    this.fireTimer -= dt;
    if (this.dead) {
      this.deadTimer -= dt;
      if (this.deadTimer <= 0) world.respawnPlayer();
      return;
    }
    if (this.car) {
      // Driving: vehicles.js moves the car, here we keep the player inside it.
      this.x = this.car.x;
      this.y = this.car.y;
      this.vx = this.car.vx; this.vy = this.car.vy;
      return;
    }
    // On foot
    let mx = 0, my = 0;
    if (input.down('KeyW')) my -= 1;
    if (input.down('KeyS')) my += 1;
    if (input.down('KeyA')) mx -= 1;
    if (input.down('KeyD')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      const sp = CONFIG.PLAYER_SPEED;
      this.vx = (mx / len) * sp;
      this.vy = (my / len) * sp;
      this.walkPhase += dt * 10;
    } else { this.vx = this.vy = 0; }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (!City.hitBuilding(nx, this.y, 6) && nx > 8 && nx < City.w - 8) this.x = nx;
    if (!City.hitBuilding(this.x, ny, 6) && ny > 8 && ny < City.h - 8) this.y = ny;
    // Aim toward mouse
    const aim = input.aimWorld();
    this.angle = Math.atan2(aim.y - this.y, aim.x - this.x);
  },

  damage(amount, world) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.dead = true;
      this.deadTimer = 2.4;
      AudioSys.explosion();
      world.toast('WASTED — you lost some cash');
      world.stats.deaths++;
      // Lose a fraction of money on death; wanted resets on respawn.
      this.money = Math.floor(this.money * (1 - CONFIG.RESPAWN_LOSS));
      Effects.blood(this.x, this.y);
    }
  },

  respawn(world) {
    // Respawn near the hospital plaza block, on foot, clean record.
    const p = City.nearestRoadPoint(City.T() * 1.5, City.T() * 1.5);
    this.hp = CONFIG.PLAYER_HP;
    this.dead = false;
    this.car = null;
    this.x = p.x; this.y = p.y;
    this.vx = this.vy = 0;
    world.wanted.level = 0;
    world.wanted.cops.forEach(c => { c.retire = true; });
    Camera.snapTo(this.x, this.y);
    world.toast('Back on your feet at Mercy General');
  },

  draw(ctx) {
    if (this.car || this.dead) return;
    const bob = Math.sin(this.walkPhase) * 1.2;
    ctx.save();
    ctx.translate(this.x, this.y);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(2, 3, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(this.angle);
    // Body
    ctx.fillStyle = '#e8b04b';
    ctx.beginPath(); ctx.ellipse(0, bob, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.fillStyle = '#3a2c22';
    ctx.beginPath(); ctx.arc(3, bob, 5, 0, Math.PI * 2); ctx.fill();
    // Weapon
    if (this.weaponIndex === 1) {
      ctx.fillStyle = '#222';
      ctx.fillRect(6, bob - 2, 12, 4);
    }
    ctx.restore();
  },
};
