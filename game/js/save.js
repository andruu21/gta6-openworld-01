// Sunfall City — save/load through localStorage. Autosaves every few seconds
// and on every mission completion; the start screen offers Continue.
const SaveSys = {
  has() {
    try { return !!localStorage.getItem(CONFIG.SAVE_KEY); } catch (e) { return false; }
  },
  data(state) {
    return {
      money: state.money,
      x: state.player.x,
      y: state.player.y,
      missionsDone: state.missions.done.slice(),
      missionIndex: state.missions.index,
      stats: state.stats,
      time: state.time,
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
