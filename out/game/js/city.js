// Sunfall City — city generation and rendering. The world is a grid of blocks
// separated by roads; each block is assigned a district (downtown towers,
// shops, residential houses, parks) by a seeded RNG, and the easternmost
// columns fall into the bay. Also provides lane geometry for traffic and
// collision queries for buildings.
const City = {
  blocks: [],    // {x,y,w,h,kind,rects:[{x,y,w,h,color,h}]} lot rectangles
  buildings: [], // flat list of collision rects (solid building footprints)
  w: 0, h: 0,    // world size in px
  signs: [],     // "SUNFALL CITY" name signs at avenue corners
  seed: 7,

  T() { return CONFIG.TILE; },
  roadHalf() { return CONFIG.ROAD / 2; },

  generate(seed) {
    this.seed = seed;
    const rng = makeRng(seed);
    const T = CONFIG.TILE, R = CONFIG.ROAD;
    this.blocks = [];
    this.buildings = [];
    this.signs = [];
    this.w = CONFIG.BLOCKS_X * T;
    this.h = CONFIG.BLOCKS_Y * T;
    const towerColors = ['#5b6678', '#4a5468', '#6e6254', '#59616e'];
    const shopColors = ['#8a5a44', '#7a6a52', '#91695a', '#6f5a4e'];
    const houseColors = ['#c4a878', '#b08e6a', '#a58a72', '#c9b28a'];
    for (let by = 0; by < CONFIG.BLOCKS_Y; by++) {
      for (let bx = 0; bx < CONFIG.BLOCKS_X; bx++) {
        const x = bx * T, y = by * T;
        let kind;
        if (bx >= CONFIG.BLOCKS_X - CONFIG.WATER_COLS) kind = 'water';
        else if (bx === 0 && by === 0) kind = 'plaza';
        else {
          const r = rng();
          const dcx = Math.abs(bx - CONFIG.BLOCKS_X * 0.45), dcy = Math.abs(by - CONFIG.BLOCKS_Y * 0.45);
          kind = (dcx + dcy < 3.2) ? 'downtown' : r < 0.18 ? 'park' : r < 0.55 ? 'shops' : 'houses';
        }
        const block = { x, y, kind, rects: [] };
        if (kind !== 'water' && kind !== 'park') {
          // Subdivide the lot into 2-4 building rectangles with a sidewalk gap.
          const pad = R / 2 + 8;
          const inner = { x: x + pad, y: y + pad, w: T - pad * 2, h: T - pad * 2 };
          const cols = 1 + Math.floor(rng() * 2), rows = 1 + Math.floor(rng() * 2);
          const cw = inner.w / cols, ch = inner.h / rows;
          for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) {
              const gx = inner.x + cx * cw, gy = inner.y + cy * ch;
              const bw = cw - 6 - rng() * cw * 0.25;
              const bh = ch - 6 - rng() * ch * 0.25;
              let color, height;
              if (kind === 'downtown') { color = pick(rng, towerColors); height = 40 + rng() * 90; }
              else if (kind === 'shops') { color = pick(rng, shopColors); height = 18 + rng() * 26; }
              else { color = pick(rng, houseColors); height = 14 + rng() * 18; }
              const rect = { x: gx, y: gy, w: bw, h: bh, color, height, win: rng() };
              block.rects.push(rect);
              this.buildings.push(rect);
            }
          }
        }
        this.blocks.push(block);
      }
    }
    // City name signs at four avenue corners.
    const T2 = T * 2;
    this.signs = [
      { x: T2, y: T2, t: 'SUNFALL CITY' },
      { x: this.w - T2, y: T2, t: 'SUNFALL CITY' },
      { x: T2, y: this.h - T2, t: 'PORT NOVA' },
      { x: this.w - T2, y: this.h - T2, t: 'PORT NOVA' },
    ];
  },

  // Is a point on the road surface (not inside a lot)? Lanes run down block
  // boundaries; anything within roadHalf of a multiple of T is road.
  onRoad(x, y) {
    const T = CONFIG.TILE, r = CONFIG.ROAD / 2;
    const mx = ((x % T) + T) % T, my = ((y % T) + T) % T;
    return mx < r || mx > T - r || my < r || my > T - r;
  },

  blockAt(x, y) {
    const bx = clamp(Math.floor(x / CONFIG.TILE), 0, CONFIG.BLOCKS_X - 1);
    const by = clamp(Math.floor(y / CONFIG.TILE), 0, CONFIG.BLOCKS_Y - 1);
    return this.blocks[by * CONFIG.BLOCKS_X + bx];
  },

  // Do these coordinates hit a building footprint (used for car/bullet/ped collision)?
  hitBuilding(x, y, pad) {
    pad = pad || 0;
    for (const b of this.buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  },

  // Nearest road centerline point (for respawns and spawn placement).
  nearestRoadPoint(x, y) {
    const T = CONFIG.TILE, r = CONFIG.ROAD / 4;
    const gx = Math.round(x / T) * T, gy = Math.round(y / T) * T;
    return { x: clamp(gx, T * 0.5, this.w - T * 0.5), y: clamp(gy, r * 2, this.h - r * 2) };
  },

  // Traffic lane waypoints: cars drive on the right side of each vertical
  // avenue, looping through the grid.
  lanePoints(rng, count) {
    const T = CONFIG.TILE, r = CONFIG.ROAD / 4;
    const pts = [];
    for (let i = 0; i < count; i++) {
      const col = Math.floor(rng() * (CONFIG.BLOCKS_X + 1));
      const x = clamp(col * T + (rng() < 0.5 ? -r : r), r, this.w - r);
      const y = rng() * this.h;
      pts.push({ x, y });
    }
    return pts;
  },

  // Render the visible slice of the city. Cam is {x,y}; view width/height in px.
  draw(ctx, cam, vw, vh, phase) {
    const T = CONFIG.TILE;
    const x0 = Math.max(0, Math.floor((cam.x - vw / 2) / T) * T - T);
    const y0 = Math.max(0, Math.floor((cam.y - vh / 2) / T) * T - T);
    const x1 = Math.min(this.w, cam.x + vw / 2 + T);
    const y1 = Math.min(this.h, cam.y + vh / 2 + T);
    // Asphalt base
    ctx.fillStyle = '#23262e';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Lane dashes on road centers
    ctx.strokeStyle = '#3a3f4c';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 18]);
    for (let gx = Math.ceil(x0 / T) * T; gx <= x1; gx += T) {
      ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y1); ctx.stroke();
    }
    for (let gy = Math.ceil(y0 / T) * T; gy <= y1; gy += T) {
      ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x1, gy); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Blocks
    const night = phase < 0.22 || phase > 0.82;
    for (const b of this.blocks) {
      if (b.x + T < x0 || b.x > x1 || b.y + T < y0 || b.y > y1) continue;
      if (b.kind === 'water') {
        const g = ctx.createLinearGradient(0, b.y, 0, b.y + T);
        g.addColorStop(0, '#173a52'); g.addColorStop(1, '#0e2a40');
        ctx.fillStyle = g;
        ctx.fillRect(b.x, b.y, T, T);
      } else if (b.kind === 'park') {
        ctx.fillStyle = '#3d6b3a';
        ctx.fillRect(b.x, b.y, T, T);
        ctx.fillStyle = '#4c7f45';
        for (let i = 0; i < 5; i++) {
          const px = b.x + 40 + (i * 53) % (T - 80), py = b.y + 40 + ((i * 91) % (T - 80));
          ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2); ctx.fill();
        }
      } else if (b.kind === 'plaza') {
        ctx.fillStyle = '#4a4f5e';
        ctx.fillRect(b.x, b.y, T, T);
        ctx.fillStyle = '#5b6070';
        ctx.fillRect(b.x + 40, b.y + 40, T - 80, T - 80);
      } else {
        // Sidewalk slab
        ctx.fillStyle = '#3c404c';
        ctx.fillRect(b.x, b.y, T, T);
        ctx.fillStyle = '#464b58';
        ctx.fillRect(b.x + 10, b.y + 10, T - 20, T - 20);
        // Buildings with a fake-height shadow edge toward the sun
        for (const r of b.rects) {
          ctx.fillStyle = '#1b1f28';
          ctx.fillRect(r.x + 5, r.y + 6, r.w, r.h);
          ctx.fillStyle = r.color;
          ctx.fillRect(r.x, r.y, r.w, r.h);
          // Windows: lit at night
          ctx.fillStyle = night ? 'rgba(255,220,130,0.75)' : 'rgba(140,170,200,0.28)';
          const step = 14;
          for (let wy = r.y + 6; wy < r.y + r.h - 6; wy += step) {
            for (let wx = r.x + 6; wx < r.x + r.w - 6; wx += step) {
              if ((Math.floor(wx / step) * 7 + Math.floor(wy / step) * 13) % 3 === 0) {
                ctx.fillRect(wx, wy, 6, 7);
              }
            }
          }
        }
      }
    }
    // City name signs
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    for (const s of this.signs) {
      if (s.x < x0 - 200 || s.x > x1 + 200 || s.y < y0 - 200 || s.y > y1 + 200) continue;
      ctx.fillStyle = '#0d1119';
      ctx.fillRect(s.x - 86, s.y - 18, 172, 34);
      ctx.strokeStyle = '#ffc85c';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - 86, s.y - 18, 172, 34);
      ctx.fillStyle = '#ffc85c';
      ctx.fillText(s.t, s.x, s.y + 7);
    }
  },
};
