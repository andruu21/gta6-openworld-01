// Sunfall City — visual effects. A pooled particle system: blood, sparks,
// explosion fireballs, muzzle flashes, tire skid marks and mission fireworks.
const Effects = {
  parts: [],   // moving particles {x,y,vx,vy,life,maxLife,color,size,gravity}
  marks: [],   // static ground marks (skids, blood pools) {x,y,angle,life,color}
  MAX: 500,

  spawn(x, y, vx, vy, life, color, size, gravity) {
    if (this.parts.length >= this.MAX) this.parts.shift();
    this.parts.push({ x, y, vx, vy, life, maxLife: life, color, size: size || 3, gravity: gravity || 0 });
  },

  blood(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 90;
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5, '#8a1420', 3);
    }
    this.marks.push({ x, y, angle: Math.random() * 3, life: 15, color: 'rgba(110,16,26,0.5)', size: 12, kind: 'pool' });
  },

  sparks(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 140;
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3, '#ffcf7a', 2);
    }
  },

  muzzle(x, y, angle) {
    for (let i = 0; i < 5; i++) {
      const s = 120 + Math.random() * 180;
      this.spawn(x, y, Math.cos(angle) * s + (Math.random() - 0.5) * 60, Math.sin(angle) * s + (Math.random() - 0.5) * 60, 0.12, '#ffe9a0', 3);
    }
  },

  punch(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(x, y, Math.cos(a) * 70, Math.sin(a) * 70, 0.2, '#ffffff', 2);
    }
  },

  explosion(x, y) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 260;
      const c = Math.random() < 0.5 ? '#ff8830' : Math.random() < 0.5 ? '#ffce54' : '#555';
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.6, c, 4 + Math.random() * 5, 30);
    }
    this.spawn(x, y, 0, 0, 0.4, '#ffffff', 30, 0);
  },

  fire(car) {
    // Attached fire: emit from a burning car every frame while it lives.
    this.spawn(car.x + (Math.random() - 0.5) * 14, car.y + (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 30, -40 - Math.random() * 40, 0.4, Math.random() < 0.5 ? '#ff9040' : '#ffc060', 4, -30);
  },

  skid(car) {
    const back = -car.w / 2;
    const bx = car.x + Math.cos(car.angle) * back;
    const by = car.y + Math.sin(car.angle) * back;
    const px = Math.cos(car.angle + Math.PI / 2) * car.h / 2;
    const py = Math.sin(car.angle + Math.PI / 2) * car.h / 2;
    this.marks.push({ x: bx + px, y: by + py, angle: car.angle, life: 8, color: 'rgba(20,20,20,0.6)', size: 4, kind: 'skid' });
    this.marks.push({ x: bx - px, y: by - py, angle: car.angle, life: 8, color: 'rgba(20,20,20,0.6)', size: 4, kind: 'skid' });
  },

  celebrate(x, y) {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 200;
      const colors = ['#ffd24a', '#44aaff', '#ff5577', '#66ff88'];
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.9, colors[i % 4], 3, 60);
    }
  },

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const m of this.marks) m.life -= dt;
    this.marks = this.marks.filter(m => m.life > 0);
    if (this.marks.length > 300) this.marks.splice(0, this.marks.length - 300);
  },

  drawGround(ctx) {
    for (const m of this.marks) {
      ctx.fillStyle = m.color;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      ctx.fillRect(-m.size, -m.size / 2, m.size * 2, m.size);
      ctx.restore();
    }
  },

  draw(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};
