// Sunfall City — global tuning constants. Every subsystem reads from CONFIG so
// gameplay knobs live in one place.
const CONFIG = {
  // World: a grid of BLOCK x BLOCK blocks, each block TILE px across, roads between.
  BLOCKS_X: 14,
  BLOCKS_Y: 14,
  TILE: 320,          // block pitch (road + lot)
  ROAD: 46,           // road width inside the pitch
  WATER_COLS: 2,      // easternmost block columns are the bay
  DAY_LENGTH: 150,    // seconds per full day-night cycle
  // Player
  PLAYER_SPEED: 190,
  PLAYER_SPEED_RUN: 190,
  PLAYER_HP: 100,
  PLAYER_MONEY_START: 250,
  RESPAWN_LOSS: 0.2,  // fraction of money lost on death
  // Vehicles
  CAR_ACCEL: 340,
  CAR_BRAKE: 480,
  CAR_MAX_SPEED: 330,
  CAR_TURN: 2.6,      // rad/s at full lock
  CAR_HP: 100,
  CAR_COUNT: 90,      // traffic + parked
  // Police
  WANTED_DECAY: 0.010,   // stars per second while hidden
  WANTED_CRIME: { punch: 0.5, shot: 0.5, pedKill: 1.4, carSteal: 0.7, copHit: 1.2, copKill: 2, explosion: 1.5 },
  POLICE_FOOT: 2,        // officers per star (cap)
  POLICE_CARS: 1,        // cruisers per star above 1
  // Combat
  BULLET_SPEED: 900,
  BULLET_LIFE: 0.7,
  FIRE_COOLDOWN: 0.18,
  PUNCH_RANGE: 34,
  PUNCH_COOLDOWN: 0.4,
  // Peds
  PED_COUNT: 120,
  PED_SPEED: 60,
  // Camera
  CAM_LEAD_DRIVE: 130,
  CAM_SMOOTH: 4.5,
  // Save
  SAVE_KEY: 'sunfall-city-save-v1',
  SAVE_INTERVAL: 5,
};

const WEAPONS = [
  { id: 'fist',  name: 'Fists',  ranged: false, damage: 12, auto: false },
  { id: 'pistol', name: 'Pistol', ranged: true, damage: 26, auto: false },
];
