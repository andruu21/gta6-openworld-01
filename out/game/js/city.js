// Sunfall City — city generation and rendering. The world is a grid of blocks
// separated by roads; each block is assigned a district (downtown towers,
// shops, residential houses, parks) by a seeded RNG, and the easternmost
// columns fall into the bay. Also provides lane geometry for traffic and
// collision queries for buildings.
const City = {
  blocks: [],    // {x,y,w,h,kind,rects:[{x,y,w,h,color,h}]} lot rectangles
  buildings: [], // flat list of collision rects (solid building footprints)
  trees: [],     // {x,y,r,palm,phase} decorations drawn above blocks
  benches: [],   // {x,y,angle}
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
    this.trees = [];
    this.benches = [];
    this.w = CONFIG.BLOCKS_X * T;
    this.h = CONFIG.BLOCKS_Y * T;
    // Sun-soaked palettes: warm sandy towers, terracotta shops, cream houses.
    const towerColors = ['#d9b98a', '#cfae7f', '#e2c69b', '#c8a374', '#d4b48b', '#c2a06e'];
    const shopColors = ['#e08a5a', '#d97a4e', '#e29a6a', '#cf7a56', '#e8a878', '#c96e48'];
    const houseColors = ['#efd9b0', '#e6cb9c', '#f2dfbc', '#dcc294', '#e8d2a6'];
    const awnings = ['#c0392b', '#2e86ab', '#27ae60', '#e67e22', '#8e44ad', '#d4a017'];
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
              // Per-building brightness variation so no two lots match exactly.
              const jitter = 0.86 + rng() * 0.28;
              color = this.shade(color, jitter);
              const rect = {
                x: gx, y: gy, w: bw, h: bh, color, height, win: rng(),
                awning: (kind === 'shops' && rng() < 0.8) ? pick(rng, awnings) : null,
                detail: rng(),
              };
              block.rects.push(rect);
              this.buildings.push(rect);
            }
          }
        }
        if (kind === 'park') {
          // Trees in the park interior plus a dense ring along the block edges.
          for (let i = 0; i < 6; i++) {
            this.trees.push({
              x: x + 70 + (i * 67) % (T - 140), y: y + 80 + ((i * 113) % (T - 160)),
              r: 15 + rng() * 7, palm: false, phase: rng() * 6.28,
            });
          }
          const edge = R / 2 + 16;
          for (let t = 40; t < T - 30; t += 58) {
            this.trees.push({ x: x + t, y: y + edge, r: 13 + rng() * 6, palm: rng() < 0.3, phase: rng() * 6.28 });
            this.trees.push({ x: x + t + 29, y: y + T - edge, r: 13 + rng() * 6, palm: rng() < 0.3, phase: rng() * 6.28 });
            this.trees.push({ x: x + edge, y: y + t + 20, r: 13 + rng() * 6, palm: rng() < 0.3, phase: rng() * 6.28 });
            this.trees.push({ x: x + T - edge, y: y + t, r: 13 + rng() * 6, palm: rng() < 0.3, phase: rng() * 6.28 });
          }
          for (let i = 0; i < 4; i++) {
            this.benches.push({ x: x + 90 + i * 60, y: y + T / 2 + (i % 2 ? 55 : -55), angle: i % 2 ? 0 : Math.PI });
          }
        }
        if (kind === 'water') {
          // Docks: wooden piers reaching out into the bay.
          if (by % 4 === 2) {
            block.dock = { x: x + 20, y: y + T / 2 - 26, w: T * 0.62, h: 52 };
          }
        }
        this.blocks.push(block);
      }
      // Palm trees along the waterfront promenade (west edge of the bay).
      if (by < CONFIG.BLOCKS_Y - CONFIG.WATER_COLS || true) {
        const shoreX = (CONFIG.BLOCKS_X - CONFIG.WATER_COLS) * T - R / 2 - 20;
        this.trees.push({ x: shoreX, y: by * T + 90, r: 18, palm: true, phase: rng() * 6.28 });
        this.trees.push({ x: shoreX, y: by * T + 240, r: 17, palm: true, phase: rng() * 6.28 });
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

  // Shift a hex color's brightness (factor ~1 = unchanged).
  shade(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(Math.round(((n >> 16) & 255) * factor), 0, 255);
    const g = clamp(Math.round(((n >> 8) & 255) * factor), 0, 255);
    const b = clamp(Math.round((n & 255) * factor), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
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
    const T = CONFIG.TILE, R = CONFIG.ROAD, r = R / 2;
    const x0 = Math.max(0, Math.floor((cam.x - vw / 2) / T) * T - T);
    const y0 = Math.max(0, Math.floor((cam.y - vh / 2) / T) * T - T);
    const x1 = Math.min(this.w, cam.x + vw / 2 + T);
    const y1 = Math.min(this.h, cam.y + vh / 2 + T);
    // Warm sunlit asphalt base: this is what shows in the road strips.
    ctx.fillStyle = '#8f8878';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    const night = phase < 0.22 || phase > 0.82;
    // --- Blocks ---
    for (const b of this.blocks) {
      if (b.x + T < x0 || b.x > x1 || b.y + T < y0 || b.y > y1) continue;
      if (b.kind === 'water') {
        const g = ctx.createLinearGradient(0, b.y, 0, b.y + T);
        g.addColorStop(0, '#2e7f9e'); g.addColorStop(1, '#1a5b7e');
        ctx.fillStyle = g;
        ctx.fillRect(b.x, b.y, T, T);
        // Subtle wave lines.
        ctx.strokeStyle = 'rgba(220,240,250,0.30)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const wy = b.y + 34 + i * 56 + Math.sin(b.x * 0.01 + i * 2) * 8;
          ctx.beginPath();
          ctx.moveTo(b.x + 14, wy);
          for (let wx = b.x + 14; wx < b.x + T - 14; wx += 26) {
            ctx.lineTo(wx, wy + Math.sin(wx * 0.05 + i * 1.7 + b.y * 0.008) * 4);
          }
          ctx.stroke();
        }
        // Foam along the shoreline edge.
        ctx.strokeStyle = 'rgba(235,245,250,0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + 4); ctx.lineTo(b.x + T, b.y + 4);
        ctx.moveTo(b.x + 4, b.y); ctx.lineTo(b.x + 4, b.y + T);
        ctx.stroke();
        // Dock pier.
        if (b.dock) {
          const d = b.dock;
          ctx.fillStyle = '#8a6642';
          ctx.fillRect(d.x, d.y, d.w, d.h);
          ctx.strokeStyle = 'rgba(60,40,20,0.5)';
          ctx.lineWidth = 2;
          for (let px = d.x + 12; px < d.x + d.w - 6; px += 18) {
            ctx.beginPath(); ctx.moveTo(px, d.y); ctx.lineTo(px, d.y + d.h); ctx.stroke();
          }
          ctx.fillStyle = '#6e5136';
          ctx.fillRect(d.x + d.w - 10, d.y - 6, 6, d.h + 12);
        }
      } else if (b.kind === 'park') {
        ctx.fillStyle = '#7aa85a';
        ctx.fillRect(b.x, b.y, T, T);
        ctx.fillStyle = '#8cbb6c';
        for (let i = 0; i < 5; i++) {
          const px = b.x + 40 + (i * 53) % (T - 80), py = b.y + 40 + ((i * 91) % (T - 80));
          ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2); ctx.fill();
        }
        // A sandy path across the park (kept inside the sidewalk slab).
        ctx.fillStyle = '#dcc896';
        ctx.fillRect(b.x + r, b.y + T / 2 - 9, T - 2 * r, 18);
        for (const bn of this.benches) {
          if (bn.x < b.x || bn.x > b.x + T || bn.y < b.y || bn.y > b.y + T) continue;
          ctx.save();
          ctx.translate(bn.x, bn.y); ctx.rotate(bn.angle);
          ctx.fillStyle = '#7a5230';
          ctx.fillRect(-14, -5, 28, 10);
          ctx.fillStyle = '#5e3f24';
          ctx.fillRect(-14, -5, 28, 3);
          ctx.restore();
        }
      } else if (b.kind === 'plaza') {
        ctx.fillStyle = '#c9b894';
        ctx.fillRect(b.x, b.y, T, T);
        ctx.fillStyle = '#d8c8a2';
        ctx.fillRect(b.x + 40, b.y + 40, T - 80, T - 80);
        ctx.strokeStyle = 'rgba(150,130,100,0.6)';
        ctx.lineWidth = 1;
        for (let i = 40; i < T - 40; i += 32) {
          ctx.strokeRect(b.x + 40 + i - 40, b.y + 40, 32, 32);
        }
      } else {
        // Sidewalk slab: inset behind the road half, so road strips stay asphalt.
        ctx.fillStyle = '#c8c0b0';
        ctx.fillRect(b.x + r - 2, b.y + r - 2, T - 2 * r + 4, T - 2 * r + 4);
        ctx.fillStyle = '#d6cdbd';
        ctx.fillRect(b.x + r + 6, b.y + r + 6, T - 2 * r - 12, T - 2 * r - 12);
        // Buildings: 2.5D — drop shadow, facade, sunlit side, roof cap.
        for (const rr of b.rects) {
          const rr2 = rr;
          // Ground shadow offset toward the low sun (southeast).
          ctx.fillStyle = 'rgba(60,45,30,0.35)';
          ctx.fillRect(rr2.x + 7, rr2.y + 9, rr2.w, rr2.h);
          // Facade (base body).
          ctx.fillStyle = rr2.color;
          ctx.fillRect(rr2.x, rr2.y, rr2.w, rr2.h);
          // Sunlit west edge: a warm highlight strip.
          ctx.fillStyle = 'rgba(255,230,180,0.55)';
          ctx.fillRect(rr2.x, rr2.y, 4, rr2.h);
          ctx.fillStyle = 'rgba(255,225,170,0.35)';
          ctx.fillRect(rr2.x, rr2.y, rr2.w, 4);
          // Darker roof cap inset — the fake-height 2.5D read.
          ctx.fillStyle = 'rgba(70,50,35,0.30)';
          ctx.fillRect(rr2.x + 5, rr2.y + 5, rr2.w - 10, rr2.h - 10);
          // Window grid across the roof face, lit at night.
          ctx.fillStyle = night ? 'rgba(255,214,120,0.85)' : 'rgba(80,120,160,0.30)';
          const step = 14;
          for (let wy = rr2.y + 8; wy < rr2.y + rr2.h - 8; wy += step) {
            for (let wx = rr2.x + 8; wx < rr2.x + rr2.w - 8; wx += step) {
              if ((Math.floor(wx / step) * 7 + Math.floor(wy / step) * 13 + Math.floor(rr2.win * 3)) % 3 === 0) {
                ctx.fillRect(wx, wy, 6, 7);
              }
            }
          }
          // Rooftop details: AC units and a water tank.
          const d = rr2.detail;
          ctx.fillStyle = '#9aa0a8';
          ctx.fillRect(rr2.x + rr2.w * 0.25, rr2.y + rr2.h * 0.25, 10, 8);
          if (d > 0.4) ctx.fillRect(rr2.x + rr2.w * 0.55, rr2.y + rr2.h * 0.6, 8, 8);
          if (d > 0.6) {
            ctx.fillStyle = '#8a5a3c';
            ctx.beginPath();
            ctx.arc(rr2.x + rr2.w * 0.75, rr2.y + rr2.h * 0.35, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#a8764e';
            ctx.beginPath();
            ctx.arc(rr2.x + rr2.w * 0.75, rr2.y + rr2.h * 0.35, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          // Shop awning: a bright striped canopy over the street-facing side.
          if (rr2.awning) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(rr2.x - 6, rr2.y - 12, rr2.w + 12, 14);
            ctx.clip();
            ctx.fillStyle = rr2.awning;
            ctx.fillRect(rr2.x - 6, rr2.y - 12, rr2.w + 12, 14);
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            for (let sx = rr2.x - 6; sx < rr2.x + rr2.w + 6; sx += 12) {
              ctx.fillRect(sx, rr2.y - 12, 6, 14);
            }
            ctx.restore();
          }
        }
      }
    }
    // --- Road markings on top of the world: yellow center dashes, white
    //     crosswalks at intersections, and curb edge lines. ---
    ctx.strokeStyle = '#e5c243';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 20]);
    ctx.beginPath();
    for (let gx = Math.ceil(x0 / T) * T; gx <= x1; gx += T) {
      ctx.moveTo(gx, y0); ctx.lineTo(gx, y1);
    }
    for (let gy = Math.ceil(y0 / T) * T; gy <= y1; gy += T) {
      ctx.moveTo(x0, gy); ctx.lineTo(x1, gy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(245,240,228,0.85)';
    for (let gx = Math.ceil(x0 / T) * T; gx <= x1; gx += T) {
      for (let gy = Math.ceil(y0 / T) * T; gy <= y1; gy += T) {
        for (let s = -r + 7; s <= r - 9; s += 8) {
          ctx.fillRect(gx + s, gy - r - 13, 5, 11);
          ctx.fillRect(gx + s, gy + r + 2, 5, 11);
          ctx.fillRect(gx - r - 13, gy + s, 11, 5);
          ctx.fillRect(gx + r + 2, gy + s, 11, 5);
        }
      }
    }
    ctx.strokeStyle = 'rgba(240,234,220,0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let gx = Math.ceil(x0 / T) * T; gx <= x1; gx += T) {
      ctx.moveTo(gx - r + 3, y0); ctx.lineTo(gx - r + 3, y1);
      ctx.moveTo(gx + r - 3, y0); ctx.lineTo(gx + r - 3, y1);
    }
    for (let gy = Math.ceil(y0 / T) * T; gy <= y1; gy += T) {
      ctx.moveTo(x0, gy - r + 3); ctx.lineTo(x1, gy - r + 3);
      ctx.moveTo(x0, gy + r - 3); ctx.lineTo(x1, gy + r - 3);
    }
    ctx.stroke();
    // --- Trees (drawn above blocks so canopies overlap sidewalks). ---
    for (const t of this.trees) {
      if (t.x < x0 - 40 || t.x > x1 + 40 || t.y < y0 - 40 || t.y > y1 + 40) continue;
      ctx.fillStyle = 'rgba(50,40,25,0.30)';
      ctx.beginPath(); ctx.ellipse(t.x + 5, t.y + 6, t.r * 0.95, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      if (t.palm) {
        // Palm: trunk + radiating fronds.
        ctx.strokeStyle = '#7a5a38';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(t.x, t.y + 8); ctx.lineTo(t.x, t.y - t.r * 0.4); ctx.stroke();
        ctx.strokeStyle = '#4e8a3c';
        ctx.lineWidth = 4;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t.phase;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y - t.r * 0.4);
          ctx.quadraticCurveTo(
            t.x + Math.cos(a) * t.r * 0.8, t.y - t.r * 0.4 + Math.sin(a) * t.r * 0.5 - 6,
            t.x + Math.cos(a) * t.r * 1.3, t.y - t.r * 0.4 + Math.sin(a) * t.r * 0.9);
          ctx.stroke();
      }
      } else {
        ctx.fillStyle = '#3e6e34';
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#56903f';
        ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.65, 0, Math.PI * 2); ctx.fill();
      }
    }
    // City name signs
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    for (const s of this.signs) {
      if (s.x < x0 - 200 || s.x > x1 + 200 || s.y < y0 - 200 || s.y > y1 + 200) continue;
      ctx.fillStyle = '#2a2318';
      ctx.fillRect(s.x - 86, s.y - 18, 172, 34);
      ctx.strokeStyle = '#ffcf6b';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - 86, s.y - 18, 172, 34);
      ctx.fillStyle = '#ffcf6b';
      ctx.fillText(s.t, s.x, s.y + 7);
    }
  },
};
