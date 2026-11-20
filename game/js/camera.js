// Sunfall City — camera. Smoothly follows a target (the player or their car),
// leads ahead of the velocity while driving, eases out while driving for a
// wider action view, and shakes on explosions.
const Camera = {
  x: 0, y: 0,
  shake: 0,     // decays; offsets the view each frame
  zoom: 1,      // eased per-frame toward the target zoom

  snapTo(x, y) { this.x = x; this.y = y; this.shake = 0; this.zoom = 1; },

  update(dt, target, driving, vx, vy) {
    const lead = driving ? CONFIG.CAM_LEAD_DRIVE : 22;
    let tx = target.x + vx * 0.12, ty = target.y + vy * 0.12;
    // Keep the camera's lead on the aim/drive direction, not the raw velocity magnitude.
    const sp = Math.hypot(vx, vy) || 1;
    tx = target.x + (vx / sp) * lead;
    ty = target.y + (vy / sp) * lead;
    const k = clamp(CONFIG.CAM_SMOOTH * dt, 0, 1);
    this.x = lerp(this.x, tx, k);
    this.y = lerp(this.y, ty, k);
    // Pull back slightly at speed: shows more road and reads faster.
    const targetZoom = driving ? 0.82 : 1.0;
    this.zoom = lerp(this.zoom, targetZoom, clamp(2.5 * dt, 0, 1));
    this.shake = Math.max(0, this.shake - dt * 3.2);
  },

  addShake(amount) { this.shake = Math.min(1.2, this.shake + amount); },

  // Apply the transform for world drawing; returns nothing.
  apply(ctx, vw, vh) {
    let ox = 0, oy = 0;
    if (this.shake > 0) {
      ox = (Math.random() * 2 - 1) * this.shake * 12;
      oy = (Math.random() * 2 - 1) * this.shake * 12;
    }
    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-vw / 2, -vh / 2);
    ctx.translate(vw / 2 - this.x + ox, vh / 2 - this.y + oy);
  },

  restore(ctx) { ctx.restore(); },
};
