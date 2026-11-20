// Sunfall City — save/load through localStorage. Autosaves every few seconds
// and on every mission completion; the start screen offers Continue.
const SaveSys = {
  has() {
    try { return !!localStorage.getItem(CONFIG.SAVE_KEY); } catch (e) { return false; }
  },
  data() {
    return {
      money: Player.money,
      x: Player.x,
      y: Player.y,
      missionsDone: Missions.done.slice(),
      missionIndex: Missions.index,
      stats: (typeof Game !== 'undefined' && Game.world) ? Game.world.stats : {},
      time: (typeof Game !== 'undefined' && Game.world) ? Game.world.time : 0,
    };
  },
  write(state) {
    try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(this.data(state))); } catch (e) {}
  },
  read() {
    try { return JSON.parse(localStorage.getItem(CONFIG.SAVE_KEY)); } catch (e) { return null; }
  },
  clear() {
    try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch (e) {}
  },
};
