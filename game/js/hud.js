// Sunfall City — HUD. Health, money, wanted stars, mission objective, weapon
// indicator, toasts, and the minimap: a mini top-down render of the city with
// player, traffic, police and mission markers. Mouse wheel / - keys zoom it.
const Hud = {
  zoom: 0.055, // minimap px per world px
  zoomMin: 0.03, zoomMax: 0.12,

  adjustZoom(delta) {
    this.zoom = clamp(this.zoom + delta * 0.01, this.zoomMin, this.zoomMax);
  },

  draw(ctx, world, vw, vh) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Health bar (top-left)
    const hw = 180, hh = 16, hx = 24, hy = 24;
    ctx.fillStyle = 'rgba(8,12,20,0.7)';
    ctx.fillRect(hx - 3, hy - 3, hw + 6, hh + 6);
    const hpFrac = Player.hp / CONFIG.PLAYER_HP;
    ctx.fillStyle = hpFrac > 0.35 ? '#5fbf6f' : '#d84840';
    ctx.fillRect(hx, hy, hw * hpFrac, hh);
    ctx.strokeStyle = '#f2e9d8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hx, hy, hw, hh);
    ctx.fillStyle = '#f2e9d8';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('HEALTH', hx + 4, hy + 12);

    // Money (under health)
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillStyle = '#7fe08a';
    ctx.fillText('$' + Player.money, hx, hy + 44);

    // Wanted stars (top-right)
    ctx.textAlign = 'right';
    ctx.font = '22px Arial';
    for (let i = 0; i < 5; i++) {
      const lit = i < world.wanted.level;
      ctx.fillStyle = lit ? '#ffc85c' : 'rgba(120,124,138,0.5)';
      ctx.fillText('★', vw - 24 - i * 26, 44);
    }

    // Weapon indicator (under stars)
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#f2e9d8';
    ctx.fillText('[' + Player.weapon().name + ']', vw - 24, 70);

    // Mission objective (top-center)
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,12,20,0.7)';
    const objText = Missions.objective();
    const ow = Math.max(260, ctx.measureText(objText).width + 28);
    ctx.fillRect(vw / 2 - ow / 2, 16, ow, 30);
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(objText, vw / 2, 37);

    // Death banner
    if (Player.dead) {
      ctx.fillStyle = 'rgba(60,0,0,0.45)';
      ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = '#e8352e';
      ctx.font = 'bold 72px Arial';
      ctx.fillText('WASTED', vw / 2, vh / 2);
    }

    // Day-night clock (small, under money)
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(242,233,216,0.8)';
    ctx.font = '12px Arial';
    const phase = dayPhase(world.time, CONFIG.DAY_LENGTH);
    const hours = Math.floor(phase * 24), mins = Math.floor((phase * 24 % 1) * 60);
    ctx.fillText(('CITY TIME ' + String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0')), hx, hy + 62);

    this.drawMinimap(ctx, world, vw, vh);
    ctx.restore();
  },

  drawMinimap(ctx, world, vw, vh) {
    const size = 190;
    const mx = vw - size - 24, my = vh - size - 24;
    const scale = this.zoom;
    // Clip to a rounded square.
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, size, size);
    ctx.clip();
    ctx.fillStyle = '#141824';
    ctx.fillRect(mx, my, size, size);
    // Center on the player.
    const cx = mx + size / 2 - Player.x * scale;
    const cy = my + size / 2 - Player.y * scale;
    // Blocks
    const T = CONFIG.TILE;
    for (const b of City.blocks) {
      const colors = { downtown: '#3a4254', shops: '#4a4038', houses: '#453f36', park: '#2c5230', water: '#16344a', plaza: '#3c4352' };
      ctx.fillStyle = colors[b.kind] || '#333';
      ctx.fillRect(cx + b.x * scale, cy + b.y * scale, (T + 6) * scale * 0.9, (T + 6) * scale * 0.9);
    }
    // Roads implied by gaps; draw mission markers, cars, police, player.
    for (const m of Missions.active ? Missions.active.markers() : []) {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(cx + m.x * scale, cy + m.y * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of world.cars) {
      if (car.dead) continue;
      ctx.fillStyle = 'rgba(200,190,170,0.7)';
      ctx.fillRect(cx + car.x * scale - 1, cy + car.y * scale - 1, 3, 3);
    }
    for (const cop of world.wanted.cops) {
      if (cop.dead) continue;
      ctx.fillStyle = '#5f8fff';
      ctx.fillRect(cx + cop.x * scale - 2, cy + cop.y * scale - 2, 4, 4);
    }
    for (const cruiser of world.wanted.cruisers) {
      if (cruiser.dead) continue;
      ctx.fillStyle = '#5f8fff';
      ctx.fillRect(cx + cruiser.x * scale - 2, cy + cruiser.y * scale - 2, 5, 5);
    }
    // Player: white arrow
    ctx.save();
    ctx.translate(cx + Player.x * scale, cy + Player.y * scale);
    ctx.rotate(Player.car ? Player.car.angle : Player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, 4); ctx.lineTo(-4, -4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    // Frame
    ctx.strokeStyle = 'rgba(242,233,216,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, size, size);
  },
};
