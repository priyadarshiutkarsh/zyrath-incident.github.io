/**
 * ============================================================================
 * THE ZYRATH INCIDENT - 3D Maze Survival Game
 * ============================================================================
 * 
 * A THREE.js-based survival horror game featuring procedurally generated mazes,
 * intelligent enemy AI with lane-based combat mechanics, and dynamic difficulty.
 * 
 * @file game.js
 * @version 2.0.0
 * @requires THREE.js r150+
 * 
 * ARCHITECTURE:
 * - Procedural maze generation using recursive backtracking algorithm
 * - Physics-based player movement with acceleration and friction
 * - Lane-based combat system with corridor detection
 * - Enemy AI featuring patrol, chase, and attack behaviors
 * - Weapon system with melee (knife) and ranged (pistol) combat
 * - Real-time collision detection with 8-point symmetric checking
 * 
 * GAME MECHANICS:
 * - 30x30 procedurally generated maze
 * - 15 jumping enemies with arcade-style physics
 * - Same-lane attack requirement for balanced gameplay
 * - Weapon switching and ammunition management
 * - Win condition: Eliminate all enemies and reach the exit
 * 
 * TECHNICAL FEATURES:
 * - Top-down camera perspective for strategic gameplay
 * - Parabolic jump arcs for enemy movement
 * - Symmetric collision detection preventing wall clipping
 * - Dynamic lighting with optional flashlight
 * - Responsive UI with real-time HUD updates
 * 
 * ============================================================================
 */

console.log('Game script loaded');

// Verify THREE.js dependency is available
if (typeof THREE === 'undefined') {
    console.error('THREE.js not loaded!');
    alert('Error: THREE.js library failed to load. Please check your internet connection.');
} else {
    console.log('THREE.js loaded successfully. Version:', THREE.REVISION);
}

// ============================================================================
// CORE SCENE OBJECTS
// ============================================================================

/** @type {THREE.Scene} Main THREE.js scene container */
let scene, camera, renderer;

/** @type {Object} Player state object containing position and velocity */
let player, playerMesh;

/** @type {Array} 2D array representing maze structure (0=path, 1=wall) */
let maze, mazeWalls = [];

/** @type {Array<Object>} Collection of enemy entities */
let jumpers = [];

/** @type {THREE.Mesh} Exit point mesh and reference */
let exit, exitMesh, doorExit;

/** @type {Object} Keyboard input state tracker */
let keys = {};

/** @type {boolean} Game mode flag (currently unused, reserved for future features) */
let isPrototypeMode = true;

/** @type {number} Timestamp when game session started */
let gameStartTime = Date.now();

/** @type {boolean} Flag indicating if game loop should process updates */
let gameActive = true;

/** @type {number} RequestAnimationFrame ID for cleanup */
let animationId;

/** @type {IntroAnimation} Intro animation controller */
let introAnimation;

/** @type {boolean} Flag to check if intro has been shown */
let introShown = false;

/** @type {string} Current game mode: 'hunt' or 'survival' */
let gameMode = null;

/** @type {number} Interval for spawning monsters in survival mode */
let monsterSpawnInterval = null;

/** @type {number} Time between monster spawns in survival mode (ms) */
const MONSTER_SPAWN_DELAY = 8000;

/** @type {THREE.Mesh} Door exit mesh for survival mode */
let doorMesh = null;

// ============================================================================
// GAME CONFIGURATION CONSTANTS
// ============================================================================

// Player Movement Settings
/** @const {number} Maximum player movement speed (units per frame) */
const PLAYER_SPEED = 0.09;

/** @const {number} Acceleration rate for smooth movement (units per frame²) */
const PLAYER_ACCELERATION = 0.005;

/** @const {number} Friction coefficient for smooth deceleration (0-1 scale) */
const PLAYER_FRICTION = 0.88;

/** @const {number} Player height for camera positioning (world units) */
const PLAYER_HEIGHT = 1.5;

// Maze Configuration
/** @const {number} Maze dimensions (30x30 grid cells) */
const MAZE_SIZE = 30;

/** @const {number} Height of maze walls (world units) */
const WALL_HEIGHT = 3;

// Enemy Configuration
/** @const {number} Total number of enemies to spawn in maze */
const JUMPER_COUNT = 15;

/** @const {number} Base movement speed for enemies (units per frame) */
const JUMPER_SPEED = 0.08;

/** @const {number} Chase speed (matched to base speed for consistency) */
const JUMPER_CHASE_SPEED = 0.08;

/** @const {number} Maximum jump height for arcade-style enemy movement */
const JUMP_HEIGHT = 1.4;

/** @const {number} Jump animation frequency (normalized 0-1 scale) */
const JUMP_FREQUENCY = 0.20;

// Camera Settings
/** @const {number} Height of top-down camera above ground plane */
const CAMERA_HEIGHT = 9; // Zoomed in from 12 to 9

// Combat Configuration
/** @const {number} Projectile velocity for pistol (units per frame) */
const BULLET_SPEED = 0.5;

/** @const {number} Minimum time between pistol shots (milliseconds) */
const SHOOT_COOLDOWN = 300;

/** @const {number} Effective range for knife melee attacks (world units) - Circular 360° area, balanced difficulty */
const KNIFE_RANGE = 2.8;

/** @const {number} Minimum time between knife attacks (milliseconds) */
const KNIFE_COOLDOWN = 200;

// ============================================================================
// INPUT STATE MANAGEMENT
// ============================================================================

/** @type {number} Mouse horizontal position for aiming */
let mouseX = 0;

/** @type {number} Mouse vertical position for aiming */
let mouseY = 0;

/** @type {boolean} Pointer lock API state flag */
let isPointerLocked = false;

// ============================================================================
// WEAPON SYSTEM STATE
// ============================================================================

/** @type {Array<Object>} Active projectiles in scene */
let bullets = [];

/** @type {number} Timestamp of last weapon discharge */
let lastShotTime = 0;

/** @type {number} Current pistol ammunition count */
let ammoCount = 30;

/** @type {number} Enemy kill counter */
let kills = 0;

/** @type {number} Player score accumulator */
let score = 0;

/** @type {number} Coin counter - earned by killing enemies */
let coins = 0;

/** @const {number} Coins awarded per enemy kill */
const COINS_PER_KILL = 10;

/** @type {string} Currently equipped weapon ('knife' or 'pistol') */
let currentWeapon = 'knife';

// ============================================================================
// COSMETIC SHOP SYSTEM - Among Us Style
// ============================================================================

/** @type {boolean} Shop UI visibility state */
let shopOpen = false;

/** @type {string} Current shop category tab */
let currentShopCategory = 'hats';

/** @type {Object} Currently equipped cosmetics */
let equippedCosmetics = {
    hat: 'none',
    weapon: 'standard',
    outfit: 'none',
    effect: 'none'
};

/** @type {Set<string>} Collection of purchased cosmetic IDs */
let purchasedCosmetics = new Set(['none', 'standard']);

/** @type {Object} Preview scene for shop */
let previewScene = null;
let previewCamera = null;
let previewRenderer = null;
let previewPlayer = null;

// ============================================================================
// COSMETIC DATABASE
// ============================================================================

/** @const {Object} Hat cosmetics */
const HATS = {
    none: { id: 'none', name: 'No Hat', icon: '⭕', price: 0, accessory: 'none', rarity: 'common' },
    military_cap: { id: 'military_cap', name: 'Military Beret', icon: '🪖', price: 30, accessory: 'military_cap', accessoryColor: 0x2F4F2F, rarity: 'common' },
    police_cap: { id: 'police_cap', name: 'Police Cap', icon: '👮‍♂️', price: 40, accessory: 'police_cap', accessoryColor: 0x000080, badgeColor: 0xFFD700, rarity: 'common' },
    tactical_mask: { id: 'tactical_mask', name: 'Tactical Mask', icon: '😷', price: 50, accessory: 'tactical_mask', accessoryColor: 0x000000, rarity: 'rare' },
    gas_mask: { id: 'gas_mask', name: 'Gas Mask', icon: '🎭', price: 60, accessory: 'tactical_mask', accessoryColor: 0x3C3C3C, rarity: 'rare' },
    headlamp: { id: 'headlamp', name: 'Mining Headlamp', icon: '💡', price: 45, accessory: 'headlamp', accessoryColor: 0xFFFFFF, lampColor: 0x00ffff, rarity: 'rare' },
    welding_goggles: { id: 'welding_goggles', name: 'Welding Goggles', icon: '🥽', price: 50, accessory: 'welding_goggles', accessoryColor: 0x4A4A4A, lensColor: 0xFFD700, rarity: 'rare' },
    ski_goggles: { id: 'ski_goggles', name: 'Ski Goggles', icon: '⛷️', price: 45, accessory: 'welding_goggles', accessoryColor: 0xFF4500, lensColor: 0x00FFFF, rarity: 'rare' },
    night_vision: { id: 'night_vision', name: 'Night Vision', icon: '🔬', price: 70, accessory: 'welding_goggles', accessoryColor: 0x004d00, lensColor: 0x00FF00, rarity: 'epic' },
    cowl_mask: { id: 'cowl_mask', name: 'Vigilante Cowl', icon: '🦇', price: 80, accessory: 'cowl_mask', accessoryColor: 0x000000, rarity: 'epic' },
    combat_helmet: { id: 'combat_helmet', name: 'Sci-Fi Helmet', icon: '🛡️', price: 90, accessory: 'combat_helmet', accessoryColor: 0x8B0000, visorColor: 0xFF00FF, rarity: 'epic' },
    riot_helmet: { id: 'riot_helmet', name: 'Riot Helmet', icon: '🚨', price: 75, accessory: 'combat_helmet', accessoryColor: 0x1C1C1C, visorColor: 0x87CEEB, rarity: 'epic' },
    astronaut_helmet: { id: 'astronaut_helmet', name: 'Space Helmet', icon: '🚀', price: 95, accessory: 'combat_helmet', accessoryColor: 0xFFFFFF, visorColor: 0x4169E1, rarity: 'epic' },
    fedora: { id: 'fedora', name: 'Detective Fedora', icon: '🕵️', price: 50, accessory: 'fedora_sunglasses', accessoryColor: 0x654321, glassesColor: 0x000000, rarity: 'rare' },
    wizard_hat: { id: 'wizard_hat', name: 'Wizard Hat', icon: '🧙‍♂️', price: 60, accessory: 'wizard_hat', accessoryColor: 0x4B0082, rarity: 'rare' },
    top_hat: { id: 'top_hat', name: 'Top Hat', icon: '🎩', price: 55, accessory: 'military_cap', accessoryColor: 0x000000, rarity: 'rare' },
    crown: { id: 'crown', name: 'Royal Crown', icon: '👑', price: 100, accessory: 'crown', accessoryColor: 0xFFD700, rarity: 'legendary' },
    halo: { id: 'halo', name: 'Angel Halo', icon: '😇', price: 85, accessory: 'angel_halo', accessoryColor: 0xFFFFFF, rarity: 'legendary' },
    horns: { id: 'horns', name: 'Devil Horns', icon: '😈', price: 65, accessory: 'devil_horns', accessoryColor: 0x8B0000, rarity: 'epic' },
    santa_hat: { id: 'santa_hat', name: 'Santa Hat', icon: '🎅', price: 55, accessory: 'santa_hat', accessoryColor: 0xFF0000, rarity: 'rare' },
    viking_helmet: { id: 'viking_helmet', name: 'Viking Helmet', icon: '⚔️', price: 70, accessory: 'combat_helmet', accessoryColor: 0xC0C0C0, visorColor: 0xFFD700, rarity: 'epic' }
};

/** @const {Object} Weapon cosmetics - All are melee weapons (knives/blades) */
const WEAPONS = {
    standard: { id: 'standard', name: 'Standard Knife', icon: '🔪', price: 0, knifeStyle: 'standard', knifeColor: 0xe8e8e8, knifeGlow: 0x666666, width: 0.08, length: 0.5, rarity: 'common' },
    tactical: { id: 'tactical', name: 'Tactical Blade', icon: '🗡️', price: 30, knifeStyle: 'tactical', knifeColor: 0x2F4F2F, knifeGlow: 0x00ff00, width: 0.12, length: 0.6, rarity: 'rare' },
    combat: { id: 'combat', name: 'Combat Dagger', icon: '⚔️', price: 40, knifeStyle: 'dagger', knifeColor: 0x1C1C1C, knifeGlow: 0xff0000, width: 0.06, length: 0.45, rarity: 'rare' },
    butterfly: { id: 'butterfly', name: 'Butterfly Knife', icon: '🦋', price: 50, knifeStyle: 'butterfly', knifeColor: 0xFFD700, knifeGlow: 0xFFFF00, width: 0.05, length: 0.4, rarity: 'rare' },
    bowie: { id: 'bowie', name: 'Bowie Knife', icon: '🏕️', price: 45, knifeStyle: 'bowie', knifeColor: 0x8B4513, knifeGlow: 0xFF8C00, width: 0.1, length: 0.55, rarity: 'rare' },
    machete: { id: 'machete', name: 'Machete', icon: '🌿', price: 55, knifeStyle: 'machete', knifeColor: 0x696969, knifeGlow: 0xC0C0C0, width: 0.15, length: 0.8, rarity: 'epic' },
    cleaver: { id: 'cleaver', name: 'Meat Cleaver', icon: '🥩', price: 60, knifeStyle: 'cleaver', knifeColor: 0x8B0000, knifeGlow: 0xFF0000, width: 0.2, length: 0.5, rarity: 'epic' },
    karambit: { id: 'karambit', name: 'Karambit', icon: '🌙', price: 70, knifeStyle: 'karambit', knifeColor: 0x4A4A4A, knifeGlow: 0x00FFFF, width: 0.07, length: 0.35, rarity: 'epic' },
    katana: { id: 'katana', name: 'Katana', icon: '⚔️', price: 85, knifeStyle: 'katana', knifeColor: 0xC0C0C0, knifeGlow: 0x00FFFF, width: 0.04, length: 0.9, rarity: 'epic' },
    plasma_blade: { id: 'plasma_blade', name: 'Plasma Blade', icon: '⚡', price: 90, knifeStyle: 'plasma', knifeColor: 0xFF6600, knifeGlow: 0xFF00FF, width: 0.06, length: 0.7, rarity: 'legendary' },
    energy_sword: { id: 'energy_sword', name: 'Energy Sword', icon: '✨', price: 100, knifeStyle: 'energy', knifeColor: 0x00FFFF, knifeGlow: 0x00FFFF, width: 0.05, length: 0.75, rarity: 'legendary' },
    lightsaber: { id: 'lightsaber', name: 'Lightsaber', icon: '💡', price: 120, knifeStyle: 'lightsaber', knifeColor: 0x00FF00, knifeGlow: 0x00FF00, width: 0.03, length: 0.85, rarity: 'legendary' }
};

/** @const {Object} Outfit cosmetics */
const OUTFITS = {
    none: { id: 'none', name: 'Default Outfit', icon: '⭕', price: 0, rarity: 'common' }
};

/** @const {Object} Trail/Aura effects (visible particles following player) */
const EFFECTS = {
    none: { id: 'none', name: 'No Trail', icon: '⭕', price: 0, trailColor: null, rarity: 'common' },
    fire_trail: { id: 'fire_trail', name: 'Fire Trail', icon: '🔥', price: 30, trailColor: 0xFF4500, trailIntensity: 0.8, rarity: 'common' },
    ice_trail: { id: 'ice_trail', name: 'Ice Trail', icon: '❄️', price: 30, trailColor: 0x87CEEB, trailIntensity: 0.7, rarity: 'common' },
    toxic_trail: { id: 'toxic_trail', name: 'Toxic Trail', icon: '☢️', price: 35, trailColor: 0x00FF00, trailIntensity: 0.9, rarity: 'rare' },
    electric_trail: { id: 'electric_trail', name: 'Electric Trail', icon: '⚡', price: 40, trailColor: 0x00FFFF, trailIntensity: 1.0, rarity: 'rare' },
    shadow_trail: { id: 'shadow_trail', name: 'Shadow Trail', icon: '🌑', price: 45, trailColor: 0x1C1C1C, trailIntensity: 0.6, rarity: 'rare' },
    golden_trail: { id: 'golden_trail', name: 'Golden Trail', icon: '✨', price: 60, trailColor: 0xFFD700, trailIntensity: 1.2, rarity: 'epic' },
    blood_trail: { id: 'blood_trail', name: 'Blood Trail', icon: '�', price: 55, trailColor: 0x8B0000, trailIntensity: 0.85, rarity: 'epic' },
    cosmic_trail: { id: 'cosmic_trail', name: 'Cosmic Trail', icon: '🌌', price: 70, trailColor: 0x8B00FF, trailIntensity: 1.1, rarity: 'epic' },
    rainbow_trail: { id: 'rainbow_trail', name: 'Rainbow Trail', icon: '🌈', price: 100, trailColor: 0xFFFFFF, trailIntensity: 1.5, rainbow: true, rarity: 'legendary' },
    phoenix_trail: { id: 'phoenix_trail', name: 'Phoenix Trail', icon: '🦅', price: 90, trailColor: 0xFF6347, trailIntensity: 1.3, rarity: 'legendary' },
    divine_trail: { id: 'divine_trail', name: 'Divine Trail', icon: '�', price: 120, trailColor: 0xFFFFFF, trailIntensity: 1.4, rarity: 'legendary' }
};

/** @const {Object} Avatar definitions with visual properties and prices */
/** @type {THREE.Mesh|null} Pistol pickup object reference */
let pistolPickup = null;

/** @type {THREE.Mesh|null} Knife mesh attached to player camera */
let knifeObject = null;

/** @type {THREE.SpotLight|null} Player flashlight light source */
let flashlight = null;

/** @type {boolean} Flashlight power state */
let flashlightOn = false;

// ============================================================================
// ENEMY AI SYSTEM
// ============================================================================

/** @type {Object|null} Reference to enemy currently in active chase state */
let chasingJumper = null;

/** @type {Array<Object>} Queue of enemies awaiting chase opportunity */
let jumperQueue = [];

/** @type {Map<string, Object>} Lane occupation tracker for AI pathfinding */
let occupiedLanes = new Map();

// ============================================================================
// AUDIO SYSTEM (DISABLED)
// ============================================================================

/** @type {AudioContext|null} Web Audio API context (currently unused) */
let audioContext;

/** @type {THREE.AudioListener|null} THREE.js audio listener (currently unused) */
let audioListener;

/** @type {Object|null} Ambient sound reference (currently unused) */
let ambientSound;

/** @type {boolean} Audio system initialization flag */
let audioInitialized = false;

/** @type {boolean} Background music started flag */
let bgmStarted = false;

/** @const {number} Interval between ambient enemy sounds (milliseconds) */
const ZOMBIE_GROAN_INTERVAL = 12000;

/** @type {number} Timestamp of last ambient sound playback */
let lastZombieGroanTime = 0;

/** @const {number} Interval between footstep sounds (milliseconds) */
const FOOTSTEP_INTERVAL = 600;

/** @type {number} Timestamp of last footstep sound */
let lastFootstepTime = 0;

// ============================================================================
// AUDIO SYSTEM
// ============================================================================

/** @type {Object} HTML5 Audio sound effects collection */
let soundEffects = {
    gunshot: null,
    knife: null,
    hit: null,
    pickup: null,
    enemyEat: null,     // Death sound (first 4 seconds)
    coinGain: null,     // Coin collection sound
    bgm: null           // Background music
};

/** @type {boolean} Audio system initialization flag */
let audioSystemReady = false;

/**
 * Initializes the audio system and loads all sound effects
 * Creates HTML5 Audio elements for each sound effect
 * @returns {void}
 */
function initAudioSystem() {
    if (audioSystemReady) return;
    
    try {
        // Load background music - loops continuously with reduced volume
        soundEffects.bgm = new Audio('audio/game_bgm.mp3');
        soundEffects.bgm.volume = 0.15;  // Subtle background volume (15% - less than SFX)
        soundEffects.bgm.loop = true;     // Loop continuously
        soundEffects.bgm.preload = 'auto';
        
        // Load enemy eating sound (plays on death) - only first 4 seconds
        soundEffects.enemyEat = new Audio('audio/enemy_eat.mp3');
        soundEffects.enemyEat.volume = 0.7;
        soundEffects.enemyEat.preload = 'auto';
        // Stop after 4 seconds when played
        soundEffects.enemyEat.addEventListener('loadedmetadata', function() {
            this.setAttribute('data-duration', '4');
        });
        
        // Load coin gain sound
        soundEffects.coinGain = new Audio('audio/coin_gain.mp3');
        soundEffects.coinGain.volume = 0.6;
        soundEffects.coinGain.preload = 'auto';
        
        // Note: gunshot, knife, and hit sounds use Web Audio API (synthesized)
        // so we don't need to load audio files for them
        
        audioSystemReady = true;
        console.log('Audio system initialized successfully');
    } catch (error) {
        console.warn('Audio system initialization failed (files may not exist):', error);
    }
}

/**
 * Plays a sound effect with error handling
 * Special handling for enemyEat (stops after 4 seconds)
 * @param {string} soundName - Name of sound effect to play
 * @returns {void}
 */
function playSound(soundName) {
    if (!audioSystemReady || !soundEffects[soundName]) return;
    
    try {
        const sound = soundEffects[soundName];
        sound.currentTime = 0;  // Reset to start
        
        // Special handling for enemy eat sound - stop after 4 seconds
        if (soundName === 'enemyEat') {
            sound.play().catch(err => console.warn(`Could not play ${soundName}:`, err));
            setTimeout(() => {
                sound.pause();
                sound.currentTime = 0;
            }, 4000);  // Stop after 4 seconds
        } else {
            sound.play().catch(err => console.warn(`Could not play ${soundName}:`, err));
        }
    } catch (error) {
        console.warn(`Error playing ${soundName}:`, error);
    }
}

/**
 * Starts playing background music
 * Automatically loops and maintains low volume to not overpower sound effects
 * Only starts once per game session (respects browser autoplay policies)
 * Handles errors gracefully if audio file is not available
 * @returns {void}
 */
function startBackgroundMusic() {
    // Only start once
    if (bgmStarted) return;
    
    if (!audioSystemReady || !soundEffects.bgm) {
        console.warn('Background music not available');
        return;
    }
    
    try {
        // Reset to beginning and play
        soundEffects.bgm.currentTime = 0;
        soundEffects.bgm.play()
            .then(() => {
                bgmStarted = true;
                console.log('Background music started');
            })
            .catch(err => {
                console.warn('Could not play background music (user interaction may be required):', err);
            });
    } catch (error) {
        console.warn('Error starting background music:', error);
    }
}

/**
 * Stops background music playback
 * Resets playback position to beginning for next play
 * @returns {void}
 */
function stopBackgroundMusic() {
    if (!audioSystemReady || !soundEffects.bgm) return;
    
    try {
        soundEffects.bgm.pause();
        soundEffects.bgm.currentTime = 0;
        console.log('Background music stopped');
    } catch (error) {
        console.warn('Error stopping background music:', error);
    }
}

// ============================================================================
// ASSET LOADING SYSTEM
// ============================================================================

/** @type {THREE.GLTFLoader|null} GLTF model loader instance */
let gltfLoader, textureLoader, objLoader;

/** @type {boolean} Asset loading completion flag */
let assetsLoaded = false;

// ============================================================================
// GAMEPLAY TIP SYSTEM
// ============================================================================

/** @const {Array<string>} Rotating gameplay tips displayed on loading screen */
const gameplayTips = [
    '"Use WASD to move through the maze"',
    '"Press Q to switch between knife and pistol"',
    '"Click or SPACE to attack enemies"',
    '"Press F to toggle your flashlight"',
    '"Stay in the same corridor to attack jumpers"',
    '"Jumpers patrol their lanes - watch for patterns"',
    '"Find the exit or eliminate all enemies to win"',
    '"The darkness hides many secrets..."'
];

/** @type {number} Current index in gameplay tips array */
let currentTipIndex = Math.floor(Math.random() * gameplayTips.length);

/**
 * Updates the gameplay tip displayed on loading screen
 * Cycles through tips array sequentially with wraparound
 * @returns {void}
 */
function updateGameTip() {
    const tipElement = document.getElementById('gameTip');
    if (tipElement) {
        currentTipIndex = (currentTipIndex + 1) % gameplayTips.length;
        tipElement.textContent = gameplayTips[currentTipIndex];
    }
}

// ============================================================================
// CORE INITIALIZATION SYSTEM
// ============================================================================

/**
 * Initializes the game engine and all core systems
 * Sets up THREE.js scene, camera, renderer, maze generation, player, enemies, and UI
 * 
 * @throws {Error} If critical initialization steps fail
 * @returns {void}
 * 
 * @description
 * Initialization sequence:
 * 1. Creates THREE.js scene with dark atmosphere and fog
 * 2. Configures top-down perspective camera
 * 3. Initializes WebGL renderer with anti-aliasing
 * 4. Generates procedural maze using recursive backtracking
 * 5. Spawns player at maze entrance
 * 6. Creates 15 jumping enemies with lane-based AI
 * 7. Places exit point and pistol pickup
 * 8. Sets up lighting (ambient + directional)
 * 9. Configures input handlers and HUD
 * 10. Starts main animation loop
 */
function init() {
    try {
        console.log('Initializing game...');
        
        // Scene setup with dark apocalyptic atmosphere
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a0a0a); // Lighter reddish background
        scene.fog = new THREE.Fog(0x2a0505, 5, 25); // Lighter red fog, matches background
        console.log('Scene created');
        
        // Camera configuration for top-down strategic view
        camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, CAMERA_HEIGHT, 0);
        camera.lookAt(0, 0, 0);
        console.log('Camera created (close zoom view)');
        
        // WebGL renderer initialization
        const canvas = document.createElement('canvas');
        canvas.id = 'gameCanvas';
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(renderer.domElement);
        
        console.log('THREE.js version:', THREE.REVISION);
        console.log('Renderer created successfully');
        
        // Initialize intro animation system
        if (typeof IntroAnimation !== 'undefined' && !introShown) {
            introAnimation = new IntroAnimation(scene, camera, renderer);
            
            // Hide loading screen
            setTimeout(() => {
                const loadingScreen = document.getElementById('loadingScreen');
                if (loadingScreen) {
                    loadingScreen.classList.add('hidden');
                }
                
                // Play intro animation
                introAnimation.play(() => {
                    // Callback when intro completes - show mode selection
                    console.log('Intro animation completed');
                    introShown = true;
                    showGameModeSelection();
                });
            }, 500);
        } else {
            // Skip intro if already shown - show mode selection
            showGameModeSelection();
        }
        
    } catch (error) {
        console.error('Error during initialization:', error);
        alert('Failed to initialize game. Please refresh the page.');
    }
}

/**
 * Shows the game mode selection screen
 */
function showGameModeSelection() {
    const modeScreen = document.getElementById('gameModeScreen');
    if (modeScreen) {
        modeScreen.classList.add('visible');
    }
}

/**
 * Selects a game mode and starts the game
 * @param {string} mode - 'hunt' or 'survival'
 */
function selectGameMode(mode) {
    gameMode = mode;
    console.log(`🎮 Game mode selected: ${mode}`);
    console.log(`🎮 Global gameMode variable is now: ${gameMode}`);
    
    // Hide mode selection screen
    const modeScreen = document.getElementById('gameModeScreen');
    if (modeScreen) {
        modeScreen.classList.remove('visible');
    }
    
    console.log(`🎮 Starting game with mode: ${gameMode}`);
    
    // Start the game with selected mode
    startGame();
}

// Make selectGameMode globally accessible
window.selectGameMode = selectGameMode;

/**
 * Start the actual game after intro and mode selection
 */
function startGame() {
    try {
        console.log(`🚀 startGame() called with gameMode: ${gameMode}`);
        
        // Lighting
        setupLighting();
        console.log('Lighting setup complete');
        
        // Generate maze
        generateMaze();
        console.log('Maze generated');
        
        // Create player
        createPlayer();
        console.log('Player created');
        
        console.log(`🎯 Checking game mode for setup... gameMode = "${gameMode}"`);
        
        // Mode-specific setup
        if (gameMode === 'hunt') {
            console.log('🎯 HUNT MODE ACTIVATED');
            // Hunt Mode: Create exit and spawn all enemies at start
            createExit();
            console.log('Exit created (Hunt Mode)');
            
            createJumpers();
            console.log('Jumping enemies created (Hunt Mode)');
        } else if (gameMode === 'survival') {
            console.log('🎯 SURVIVAL MODE ACTIVATED');
            // Survival Mode: Create door exit and USE SAME SPAWN AS HUNT MODE
            createDoorExit();
            console.log('Door exit created (Survival Mode)');
            
            // Use the EXACT same spawning as hunt mode
            createJumpers();
            console.log('Jumping enemies created (Survival Mode - using hunt mode spawning)');
            
            // NOTE: Monsters spawn automatically when one is killed (2 for every 1 killed)
        }
        
        // Create pistol pickup
        createPistolPickup();
        console.log('Pistol pickup created');
        
        // Setup controls
        setupControls();
        console.log('Controls setup complete');
        
        // Initialize audio system
        initAudioSystem();
        console.log('Audio system ready');
        
        // Setup loaders for Full mode
        setupLoaders();
        
        // Initialize HUD
        updateWeaponDisplay();
        updateAmmoDisplay();
        updateFlashlightDisplay();
        
        // Load shop data from localStorage
        loadShopData();
        
        // Hide loading screen if not already hidden
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
            loadingScreen.classList.add('hidden');
        }
        
        // Note: Background music will start on first user interaction (browser autoplay policy)
        
        // Reset game start time
        gameStartTime = Date.now();
        
        // Set game as active
        gameActive = true;
        
        // Start animation loop
        animate();
        console.log('Game started successfully!');
        
        // Show mobile controls on touch devices
        if ('ontouchstart' in window) {
            const mobileControls = document.getElementById('mobileControls');
            if (mobileControls) {
                mobileControls.classList.add('show');
            }
        }
        
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Error starting game: ' + error.message);
    }
}

// ============= AUDIO SYSTEM =============

/**
 * Initializes the Web Audio API context for synthesized sound effects
 * Must be called after user interaction due to browser autoplay policies
 * Creates AudioContext instance for generating procedural audio
 * @returns {void}
 */
function initAudio() {
    console.log('initAudio called - audioInitialized:', audioInitialized);
    if (audioInitialized) return;
    
    // Create lightweight sound effects using Web Audio API properly
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioInitialized = true;
        console.log('Lightweight audio system initialized - audioContext:', audioContext);
    } catch (error) {
        console.error('Failed to initialize audio:', error);
        audioInitialized = false;
    }
}

/**
 * Plays gunshot sound effect using Web Audio API synthesis
 * Generates a sharp, percussive sound using square wave oscillator
 * No audio file required - uses procedural audio generation
 * @returns {void}
 */
function playGunshotSound() {
    // Always use Web Audio API for synthesized gunshot sound
    if (!audioContext) {
        console.warn('No audioContext for gunshot sound');
        return;
    }
    try {
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'square';
        osc.frequency.value = 100;
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    } catch (e) {
        console.error('Error playing gunshot sound:', e);
    }
}

/**
 * Plays knife swing sound effect using Web Audio API synthesis
 * Generates a swoosh sound using sawtooth wave with frequency sweep
 * Creates a whooshing effect by ramping frequency from high to low
 * No audio file required - uses procedural audio generation
 * @returns {void}
 */
function playKnifeSound() {
    // Always use Web Audio API for synthesized knife sound
    if (!audioContext) {
        console.warn('No audioContext for knife sound');
        return;
    }
    try {
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    } catch (e) {
        console.error('Error playing knife sound:', e);
    }
}

/**
 * Plays enemy hit/death sound effect using Web Audio API synthesis
 * Generates a low-frequency impact sound using sine wave oscillator
 * No audio file required - uses procedural audio generation
 * @returns {void}
 */
function playHitSound() {
    // Always use Web Audio API for synthesized hit sound
    if (!audioContext) {
        console.warn('No audioContext for hit sound');
        return;
    }
    try {
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = 80;
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    } catch (e) {
        console.error('Error playing hit sound:', e);
    }
}

/**
 * Plays zombie growl sound effect using Web Audio API synthesis
 * Generates a deep, menacing growl using square wave with frequency modulation
 * Creates an ominous atmosphere for zombie presence
 * @returns {void}
 */
function playZombieGrowlSound() {
    if (!audioContext) {
        console.warn('No audioContext for zombie growl sound');
        return;
    }
    try {
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        // Deep, menacing growl sound
        osc.type = 'square';
        osc.frequency.setValueAtTime(40, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.8);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.8);
    } catch (e) {
        console.error('Error playing zombie growl sound:', e);
    }
}

/**
 * Plays ammo pickup sound effect using Web Audio API synthesis
 * Generates an ascending melodic tone to indicate successful pickup
 * Creates a positive feedback sound for item collection
 * @returns {void}
 */
function playPickupSound() {
    if (!audioContext) {
        console.warn('No audioContext for pickup sound');
        return;
    }
    try {
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    } catch (e) {
        console.error('Error playing pickup sound:', e);
    }
}

/**
 * Creates ambient background sound using Web Audio API synthesis
 * Generates atmospheric noise for immersive game environment
 * Currently unused but available for future implementation
 * @returns {void}
 */
function createAmbientSound() {
    if (!audioContext) return;
    
    // Simplified ambient sound for better performance
    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.10; // Keep it subtle
    
    // Layer 1: Low rumble (distant thunder/destruction)
    const rumbleOsc = audioContext.createOscillator();
    rumbleOsc.type = 'sine';
    rumbleOsc.frequency.value = 40;
    const rumbleGain = audioContext.createGain();
    rumbleGain.gain.value = 0.4;
    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(masterGain);
    
    // Layer 2: Eerie drone
    const droneOsc = audioContext.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 110;
    const droneGain = audioContext.createGain();
    droneGain.gain.value = 0.08;
    droneOsc.connect(droneGain);
    droneGain.connect(masterGain);
    
    // Connect to destination
    masterGain.connect(audioContext.destination);
    
    // Start oscillators
    rumbleOsc.start();
    droneOsc.start();
    
    console.log('Ambient sound started (optimized)');
}

function playBulletImpactSound() {
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    // Sharp impact noise
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.05, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.05);
}

function playKnifeSlashSound() {
    if (!audioContext || !audioInitialized) return;
    
    try {
        const now = audioContext.currentTime;
        
        // Swoosh sound
        const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.3, audioContext.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length);
        }
        
        const noiseSource = audioContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
        
        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        
        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        
        noiseSource.start(now);
        noiseSource.stop(now + 0.3);
    } catch (error) {
        console.error('Error playing knife slash sound:', error);
    }
}

function playKnifeKillSound() {
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    // Wet impact sound (visceral)
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.2, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / noiseData.length * 5);
    }
    
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 2;
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.2);
    
    // Add low thud
    const thudOsc = audioContext.createOscillator();
    thudOsc.frequency.value = 60;
    const thudGain = audioContext.createGain();
    thudGain.gain.setValueAtTime(0.4, now);
    thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    thudOsc.connect(thudGain);
    thudGain.connect(audioContext.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.15);
}

function playZombieGroanSound(position) {
    if (!audioContext || !audioListener) return;
    
    const now = audioContext.currentTime;
    
    // Create positional audio
    const sound = new THREE.PositionalAudio(audioListener);
    
    // Create groan using oscillators
    const osc1 = audioContext.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(80 + Math.random() * 40, now);
    osc1.frequency.linearRampToValueAtTime(60 + Math.random() * 30, now + 1.5);
    
    const osc2 = audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(120 + Math.random() * 60, now);
    osc2.frequency.linearRampToValueAtTime(90 + Math.random() * 40, now + 1.5);
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
    gain.gain.linearRampToValueAtTime(0.25, now + 1.0);
    gain.gain.linearRampToValueAtTime(0, now + 1.5);
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 2;
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(filter);
    filter.connect(sound.getOutput());
    
    sound.setRefDistance(5);
    sound.setMaxDistance(30);
    sound.position.copy(position);
    
    // Add to a temporary object to position in 3D space
    const tempObject = new THREE.Object3D();
    tempObject.position.copy(position);
    tempObject.add(sound);
    scene.add(tempObject);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.5);
    osc2.stop(now + 1.5);
    
    // Clean up
    setTimeout(() => {
        scene.remove(tempObject);
    }, 2000);
}

function playZombieDeathSound(position) {
    if (!audioContext || !audioListener) return;
    
    const now = audioContext.currentTime;
    
    // Create positional audio
    const sound = new THREE.PositionalAudio(audioListener);
    
    // Death gurgle/scream
    const osc = audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.8);
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.8);
    
    osc.connect(gain);
    gain.connect(filter);
    filter.connect(sound.getOutput());
    
    sound.setRefDistance(5);
    sound.setMaxDistance(25);
    sound.position.copy(position);
    
    const tempObject = new THREE.Object3D();
    tempObject.position.copy(position);
    tempObject.add(sound);
    scene.add(tempObject);
    
    osc.start(now);
    osc.stop(now + 0.8);
    
    setTimeout(() => {
        scene.remove(tempObject);
    }, 1000);
}

function playPickupSound() {
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    // Metallic pickup sound
    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.start(now);
    osc.stop(now + 0.1);
}

function playFlashlightSound() {
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    // Click sound
    const osc = audioContext.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 200;
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.start(now);
    osc.stop(now + 0.05);
}

function playFootstepSound() {
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    // Subtle footstep
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.08, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.08);
}

// ============= END AUDIO SYSTEM =============

function setupLighting() {
    // Reddish ambient light - brighter for visibility
    const ambientLight = new THREE.AmbientLight(0x6a2a2a, 0.5); // Reddish, decent brightness
    scene.add(ambientLight);
    
    // Directional light - reddish moonlight
    const moonLight = new THREE.DirectionalLight(0x8a3a3a, 0.6); // Brighter reddish tint
    moonLight.position.set(50, 100, 50);
    moonLight.castShadow = true;
    moonLight.shadow.camera.left = -50;
    moonLight.shadow.camera.right = 50;
    moonLight.shadow.camera.top = 50;
    moonLight.shadow.camera.bottom = -50;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    scene.add(moonLight);
    
    // Red hemisphere light for hellish atmosphere
    const hemiLight = new THREE.HemisphereLight(0x6a2a2a, 0x3a1010, 0.5); // Brighter red atmosphere
    scene.add(hemiLight);
    
    // Add fog for atmospheric depth - lighter red fog
    scene.fog = new THREE.Fog(0x2a0808, 12, 30); // Lighter red fog, starts further away
    
    // Exit light - green glow (hope in darkness)
    const exitLight = new THREE.PointLight(0x00ff44, 2, 15);
    exitLight.position.set(MAZE_SIZE - 2, 3, MAZE_SIZE - 2);
    scene.add(exitLight);
    
    // Add more scattered atmospheric red lights around the map
    for (let i = 0; i < 8; i++) {
        const dangerLight = new THREE.PointLight(0xff3333, 1.5, 12);
        dangerLight.position.set(
            Math.random() * MAZE_SIZE - MAZE_SIZE/2,
            2,
            Math.random() * MAZE_SIZE - MAZE_SIZE/2
        );
        scene.add(dangerLight);
    }
}

// ============================================================================
// PROCEDURAL MAZE GENERATION
// ============================================================================

/**
 * Generates a procedural maze using recursive backtracking algorithm
 * Creates a perfect maze (single solution) with guaranteed path from entrance to exit
 * 
 * @returns {void}
 * 
 * @description
 * Algorithm phases:
 * 1. Initializes MAZE_SIZE x MAZE_SIZE grid filled with walls (value 1)
 * 2. Creates ground plane with dark bloodstained texture
 * 3. Applies recursive backtracking to carve corridors (value 0)
 * 4. Ensures no isolated sections - all paths are connected
 * 5. Constructs 3D wall meshes with dark red material
 * 6. Optimizes mesh count using geometry merging
 * 
 * The algorithm creates organic, winding corridors with dead ends,
 * providing strategic gameplay opportunities and navigation challenges.
 */
function generateMaze() {
    // Ground plane setup with apocalyptic texture
    const groundGeometry = new THREE.PlaneGeometry(MAZE_SIZE * 2, MAZE_SIZE * 2);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a0f0f,
        roughness: 0.95,
        metalness: 0.0
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Initialize maze grid with all walls
    maze = [];
    for (let i = 0; i < MAZE_SIZE; i++) {
        maze[i] = [];
        for (let j = 0; j < MAZE_SIZE; j++) {
            maze[i][j] = 1;
        }
    }
    
    // Recursive backtracking maze generation algorithm
    const stack = [];
    const visited = new Set();
    
    /**
     * Gets unvisited neighboring cells at distance 2 (creating corridors)
     * @param {number} x - Current X coordinate
     * @param {number} y - Current Y coordinate
     * @returns {Array<Array<number>>} Array of [neighborX, neighborY, wallX, wallY]
     */
    function getNeighbors(x, y) {
        const neighbors = [];
        const directions = [[0, 2], [2, 0], [0, -2], [-2, 0]];
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 1 && nx < MAZE_SIZE - 1 && ny >= 1 && ny < MAZE_SIZE - 1) {
                const key = `${nx},${ny}`;
                if (!visited.has(key)) {
                    neighbors.push([nx, ny, x + dx/2, y + dy/2]);
                }
            }
        }
        return neighbors;
    }
    
    // Begin maze carving from entrance position
    let current = [1, 1];
    visited.add('1,1');
    maze[1][1] = 0;
    
    while (true) {
        const neighbors = getNeighbors(current[0], current[1]);
        
        if (neighbors.length > 0) {
            // Choose random neighbor
            const [nx, ny, wallX, wallY] = neighbors[Math.floor(Math.random() * neighbors.length)];
            
            // Clear the wall between current and neighbor
            maze[wallX][wallY] = 0;
            maze[nx][ny] = 0;
            
            visited.add(`${nx},${ny}`);
            stack.push(current);
            current = [nx, ny];
        } else if (stack.length > 0) {
            current = stack.pop();
        } else {
            break;
        }
    }
    
    // Add some random dead ends and false paths for confusion
    for (let attempts = 0; attempts < 15; attempts++) {
        const x = Math.floor(Math.random() * (MAZE_SIZE - 4)) + 2;
        const y = Math.floor(Math.random() * (MAZE_SIZE - 4)) + 2;
        
        if (maze[x][y] === 1) {
            // Create a small dead end branch
            maze[x][y] = 0;
            if (Math.random() > 0.5 && x + 1 < MAZE_SIZE - 1) maze[x + 1][y] = 0;
            if (Math.random() > 0.5 && y + 1 < MAZE_SIZE - 1) maze[x][y + 1] = 0;
        }
    }
    
    // Ensure path to exit exists - clear final area
    maze[MAZE_SIZE - 2][MAZE_SIZE - 2] = 0;
    maze[MAZE_SIZE - 2][MAZE_SIZE - 3] = 0;
    maze[MAZE_SIZE - 3][MAZE_SIZE - 2] = 0;
    maze[MAZE_SIZE - 3][MAZE_SIZE - 3] = 0;
    
    // Clear pistol pickup area (convert world coordinates to maze indices)
    // Pistol at (-6, 0.5, 3) translates to maze coordinates
    const pistolMazeX = Math.floor(-6 + MAZE_SIZE/2);
    const pistolMazeZ = Math.floor(3 + MAZE_SIZE/2);
    
    // Clear a small area around the pistol location
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const x = pistolMazeX + dx;
            const z = pistolMazeZ + dz;
            if (x >= 0 && x < MAZE_SIZE && z >= 0 && z < MAZE_SIZE) {
                maze[x][z] = 0;
            }
        }
    }
    
    // Create wall meshes
    createWalls();
}

function createWalls() {
    // Clear existing walls
    mazeWalls.forEach(wall => scene.remove(wall));
    mazeWalls = [];
    
    let wallMaterial;
    
    if (isPrototypeMode) {
        wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a1a1a, // Darker stone with red tint
            roughness: 0.95,
            metalness: 0.05,
            emissive: 0x1a0505,
            emissiveIntensity: 0.1
        });
    } else {
        // In Full mode, we could load textures here
        wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4a4a,
            roughness: 0.9,
            metalness: 0.1,
            // If textures are loaded, apply them here
        });
    }
    
    for (let i = 0; i < MAZE_SIZE; i++) {
        for (let j = 0; j < MAZE_SIZE; j++) {
            if (maze[i][j] === 1) {
                // Create SOLID BLOCK walls - no cross shape, just solid cubes
                const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
                const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
                wallMesh.castShadow = true;
                wallMesh.receiveShadow = true;
                
                wallMesh.position.set(
                    i - MAZE_SIZE / 2,
                    WALL_HEIGHT / 2,
                    j - MAZE_SIZE / 2
                );
                scene.add(wallMesh);
                mazeWalls.push(wallMesh);
            }
        }
    }
}

function createPlayer() {
    player = {
        position: new THREE.Vector3(-MAZE_SIZE / 2 + 1.5, PLAYER_HEIGHT, -MAZE_SIZE / 2 + 1.5),
        velocity: new THREE.Vector3(),
        acceleration: new THREE.Vector3(),
        rotation: 0
    };
    
    if (isPrototypeMode) {
        // Prototype: realistic player character
        const playerGroup = new THREE.Group();
        
        // Body - shirt/torso
        const bodyGeometry = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x4169E1, // Royal blue shirt
            roughness: 0.7,
            metalness: 0.0
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        playerGroup.add(body);
        
        // Head - realistic skin tone
        const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFDBAC, // Skin tone
            roughness: 0.6,
            metalness: 0.0
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.9;
        head.castShadow = true;
        playerGroup.add(head);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.0
        });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.12, 0.95, 0.25);
        playerGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 0.95, 0.25);
        playerGroup.add(rightEye);
        
        // Pupils
        const pupilGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        const pupilMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.5
        });
        
        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(-0.12, 0.95, 0.32);
        playerGroup.add(leftPupil);
        
        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(0.12, 0.95, 0.32);
        playerGroup.add(rightPupil);
        
        playerMesh = playerGroup;
    } else {
        // Full mode: could load a character model
        const playerGroup = new THREE.Group();
        
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x0088ff,
            emissive: 0x003366,
            roughness: 0.5,
            metalness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        playerGroup.add(body);
        
        const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 0.8;
        head.castShadow = true;
        playerGroup.add(head);
        
        playerMesh = playerGroup;
    }
    
    // Create butcher knife attached to player
    createKnife();
    
    // Create flashlight attached to player
    createFlashlight();
    
    scene.add(playerMesh);
    
    // Position camera behind player
    camera.position.copy(player.position);
    camera.position.y += 0.4;
}

// ============================================================================
// AVATAR ACCESSORY CREATION FUNCTIONS
// ============================================================================

/**
 * Creates a military-style cap accessory
 * @param {number} color - Hex color for the cap
 * @returns {THREE.Group} Military cap mesh group
 */
function createMilitaryCap(color) {
    const capGroup = new THREE.Group();
    
    // Cap bill/brim (front visor) - LARGER
    const billGeometry = new THREE.BoxGeometry(0.6, 0.06, 0.35);
    const capMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.8,
        metalness: 0.1
    });
    const bill = new THREE.Mesh(billGeometry, capMaterial);
    bill.position.set(0, 1.15, 0.25);
    bill.rotation.x = -0.2;
    capGroup.add(bill);
    
    // Cap crown (top rounded part) - TALLER
    const crownGeometry = new THREE.CylinderGeometry(0.32, 0.36, 0.3, 16);
    const crown = new THREE.Mesh(crownGeometry, capMaterial);
    crown.position.set(0, 1.25, 0);
    capGroup.add(crown);
    
    // Military star emblem on front
    const starGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 5);
    const starMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFD700, // Gold
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0xFFD700,
        emissiveIntensity: 0.3
    });
    const star = new THREE.Mesh(starGeometry, starMaterial);
    star.position.set(0, 1.2, 0.38);
    star.rotation.x = Math.PI / 2;
    capGroup.add(star);
    
    // Camouflage stripes for military look
    for (let i = 0; i < 3; i++) {
        const stripeGeometry = new THREE.BoxGeometry(0.3, 0.03, 0.02);
        const stripeMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d4a2b, // Dark green camo
            roughness: 0.9
        });
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.position.set(0.1 * (i - 1), 1.15 + (i * 0.05), 0.32);
        capGroup.add(stripe);
    }
    
    return capGroup;
}

/**
 * Creates a police cap with badge
 * @param {number} capColor - Hex color for the cap
 * @param {number} badgeColor - Hex color for the badge
 * @returns {THREE.Group} Police cap mesh group
 */
function createPoliceCap(capColor, badgeColor) {
    const capGroup = new THREE.Group();
    
    // Cap bill/brim - LARGER
    const billGeometry = new THREE.BoxGeometry(0.6, 0.06, 0.35);
    const capMaterial = new THREE.MeshStandardMaterial({
        color: capColor,
        roughness: 0.7,
        metalness: 0.2
    });
    const bill = new THREE.Mesh(billGeometry, capMaterial);
    bill.position.set(0, 1.15, 0.25);
    bill.rotation.x = -0.15;
    capGroup.add(bill);
    
    // Cap crown - TALLER
    const crownGeometry = new THREE.CylinderGeometry(0.32, 0.35, 0.28, 16);
    const crown = new THREE.Mesh(crownGeometry, capMaterial);
    crown.position.set(0, 1.25, 0);
    capGroup.add(crown);
    
    // Police badge (LARGER gold star shield)
    const badgeGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 6);
    const badgeMaterial = new THREE.MeshStandardMaterial({
        color: badgeColor,
        roughness: 0.1,
        metalness: 0.95,
        emissive: badgeColor,
        emissiveIntensity: 0.4
    });
    const badge = new THREE.Mesh(badgeGeometry, badgeMaterial);
    badge.position.set(0, 1.2, 0.4);
    badge.rotation.x = Math.PI / 2;
    capGroup.add(badge);
    
    // Badge center detail (star)
    const starGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 5);
    const starMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF, // White
        roughness: 0.1,
        metalness: 0.95,
        emissive: 0xFFFFFF,
        emissiveIntensity: 0.5
    });
    const star = new THREE.Mesh(starGeometry, starMaterial);
    star.position.set(0, 1.2, 0.43);
    star.rotation.x = Math.PI / 2;
    capGroup.add(star);
    
    // White stripe on cap
    const stripeGeometry = new THREE.BoxGeometry(0.5, 0.04, 0.02);
    const stripeMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        roughness: 0.8
    });
    const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    stripe.position.set(0, 1.12, 0.33);
    capGroup.add(stripe);
    
    return capGroup;
}

/**
 * Creates a tactical face mask
 * @param {number} color - Hex color for the mask
 * @returns {THREE.Group} Tactical mask mesh group
 */
function createTacticalMask(color) {
    const maskGroup = new THREE.Group();
    
    // Lower face mask (covers nose and mouth) - LARGER
    const maskGeometry = new THREE.BoxGeometry(0.45, 0.3, 0.18);
    const maskMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.6,
        metalness: 0.3
    });
    const mask = new THREE.Mesh(maskGeometry, maskMaterial);
    mask.position.set(0, 0.85, 0.3);
    maskGroup.add(mask);
    
    // Breathing filter/vent on front (tech detail)
    const ventGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
    const ventMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333, // Dark gray
        roughness: 0.4,
        metalness: 0.7
    });
    const vent = new THREE.Mesh(ventGeometry, ventMaterial);
    vent.position.set(0, 0.82, 0.4);
    vent.rotation.x = Math.PI / 2;
    maskGroup.add(vent);
    
    // Red glowing LED indicator (tactical tech)
    const ledGeometry = new THREE.SphereGeometry(0.03, 8, 8);
    const ledMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF0000, // Red
        emissive: 0xFF0000,
        emissiveIntensity: 0.8,
        roughness: 0.1
    });
    const led = new THREE.Mesh(ledGeometry, ledMaterial);
    led.position.set(-0.15, 0.9, 0.38);
    maskGroup.add(led);
    
    // Side straps
    const strapGeometry = new THREE.BoxGeometry(0.03, 0.25, 0.03);
    const strapMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.8
    });
    const leftStrap = new THREE.Mesh(strapGeometry, strapMaterial);
    leftStrap.position.set(-0.23, 0.85, 0.15);
    maskGroup.add(leftStrap);
    
    const rightStrap = new THREE.Mesh(strapGeometry, strapMaterial);
    rightStrap.position.set(0.23, 0.85, 0.15);
    maskGroup.add(rightStrap);
    
    return maskGroup;
}

/**
 * Creates a medical headlamp
 * @param {number} bandColor - Hex color for the headband
 * @param {number} lampColor - Hex color for the lamp light
 * @returns {THREE.Group} Headlamp mesh group
 */
function createHeadlamp(bandColor, lampColor) {
    const lampGroup = new THREE.Group();
    
    // Headband - THICKER
    const bandGeometry = new THREE.TorusGeometry(0.37, 0.04, 8, 16);
    const bandMaterial = new THREE.MeshStandardMaterial({
        color: bandColor,
        roughness: 0.7
    });
    const band = new THREE.Mesh(bandGeometry, bandMaterial);
    band.position.set(0, 1.05, 0);
    band.rotation.x = Math.PI / 2;
    lampGroup.add(band);
    
    // Lamp housing (on forehead) - LARGER
    const lampGeometry = new THREE.CylinderGeometry(0.1, 0.12, 0.15, 8);
    const lampMaterial = new THREE.MeshStandardMaterial({
        color: 0xCCCCCC, // Lighter metallic
        roughness: 0.2,
        metalness: 0.8
    });
    const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
    lamp.position.set(0, 1.05, 0.38);
    lamp.rotation.x = Math.PI / 2;
    lampGroup.add(lamp);
    
    // Lamp light (glowing) - LARGER AND BRIGHTER
    const lightGeometry = new THREE.CircleGeometry(0.09, 12);
    const lightMaterial = new THREE.MeshStandardMaterial({
        color: lampColor,
        emissive: lampColor,
        emissiveIntensity: 1.2,
        roughness: 0.1
    });
    const light = new THREE.Mesh(lightGeometry, lightMaterial);
    light.position.set(0, 1.05, 0.45);
    lampGroup.add(light);
    
    // Medical cross symbol on headband
    const crossH = new THREE.BoxGeometry(0.08, 0.02, 0.02);
    const crossV = new THREE.BoxGeometry(0.02, 0.08, 0.02);
    const crossMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF0000, // Red medical cross
        emissive: 0xFF0000,
        emissiveIntensity: 0.3,
        roughness: 0.5
    });
    const crossH1 = new THREE.Mesh(crossH, crossMaterial);
    crossH1.position.set(-0.3, 1.05, 0);
    lampGroup.add(crossH1);
    
    const crossV1 = new THREE.Mesh(crossV, crossMaterial);
    crossV1.position.set(-0.3, 1.05, 0);
    lampGroup.add(crossV1);
    
    // Second cross on other side
    const crossH2 = new THREE.Mesh(crossH, crossMaterial);
    crossH2.position.set(0.3, 1.05, 0);
    lampGroup.add(crossH2);
    
    const crossV2 = new THREE.Mesh(crossV, crossMaterial);
    crossV2.position.set(0.3, 1.05, 0);
    lampGroup.add(crossV2);
    
    return lampGroup;
}

/**
 * Creates welding/industrial goggles
 * @param {number} frameColor - Hex color for goggle frames
 * @param {number} lensColor - Hex color for lenses
 * @returns {THREE.Group} Goggles mesh group
 */
function createWeldingGoggles(frameColor, lensColor) {
    const gogglesGroup = new THREE.Group();
    
    // Left lens - LARGER
    const lensGeometry = new THREE.CylinderGeometry(0.13, 0.13, 0.07, 16);
    const lensMaterial = new THREE.MeshStandardMaterial({
        color: lensColor,
        roughness: 0.05,
        metalness: 0.95,
        emissive: lensColor,
        emissiveIntensity: 0.5
    });
    const leftLens = new THREE.Mesh(lensGeometry, lensMaterial);
    leftLens.position.set(-0.15, 0.95, 0.34);
    leftLens.rotation.x = Math.PI / 2;
    gogglesGroup.add(leftLens);
    
    // Right lens - LARGER
    const rightLens = new THREE.Mesh(lensGeometry, lensMaterial);
    rightLens.position.set(0.15, 0.95, 0.34);
    rightLens.rotation.x = Math.PI / 2;
    gogglesGroup.add(rightLens);
    
    // Thick metal frames around lenses
    const frameGeometry = new THREE.TorusGeometry(0.14, 0.025, 8, 16);
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: frameColor,
        roughness: 0.3,
        metalness: 0.8
    });
    const leftFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    leftFrame.position.set(-0.15, 0.95, 0.34);
    gogglesGroup.add(leftFrame);
    
    const rightFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    rightFrame.position.set(0.15, 0.95, 0.34);
    gogglesGroup.add(rightFrame);
    
    // Bridge connector - THICKER
    const bridgeGeometry = new THREE.BoxGeometry(0.1, 0.06, 0.06);
    const bridge = new THREE.Mesh(bridgeGeometry, frameMaterial);
    bridge.position.set(0, 0.95, 0.34);
    gogglesGroup.add(bridge);
    
    // Side protective shields
    const shieldGeometry = new THREE.BoxGeometry(0.04, 0.2, 0.15);
    const leftShield = new THREE.Mesh(shieldGeometry, frameMaterial);
    leftShield.position.set(-0.25, 0.95, 0.3);
    gogglesGroup.add(leftShield);
    
    const rightShield = new THREE.Mesh(shieldGeometry, frameMaterial);
    rightShield.position.set(0.25, 0.95, 0.3);
    gogglesGroup.add(rightShield);
    
    // Strap/band (goes around head) - THICKER
    const strapGeometry = new THREE.TorusGeometry(0.37, 0.03, 8, 16);
    const strap = new THREE.Mesh(strapGeometry, frameMaterial);
    strap.position.set(0, 0.95, 0);
    strap.rotation.x = Math.PI / 2;
    gogglesGroup.add(strap);
    
    return gogglesGroup;
}

/**
 * Creates a Batman-style cowl/mask
 * @param {number} color - Hex color for the cowl
 * @returns {THREE.Group} Cowl mesh group
 */
function createCowlMask(color) {
    const cowlGroup = new THREE.Group();
    
    // Main cowl (covers top and back of head) - LARGER
    const cowlGeometry = new THREE.SphereGeometry(0.39, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7);
    const cowlMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.3,
        metalness: 0.5
    });
    const cowl = new THREE.Mesh(cowlGeometry, cowlMaterial);
    cowl.position.set(0, 0.9, 0);
    cowlGroup.add(cowl);
    
    // Bat ears (pointed) - MUCH TALLER AND WIDER
    const earGeometry = new THREE.ConeGeometry(0.11, 0.4, 8);
    const leftEar = new THREE.Mesh(earGeometry, cowlMaterial);
    leftEar.position.set(-0.22, 1.35, 0);
    cowlGroup.add(leftEar);
    
    const rightEar = new THREE.Mesh(earGeometry, cowlMaterial);
    rightEar.position.set(0.22, 1.35, 0);
    cowlGroup.add(rightEar);
    
    // Face mask part (covers nose area) - LARGER
    const faceGeometry = new THREE.BoxGeometry(0.38, 0.2, 0.12);
    const faceMask = new THREE.Mesh(faceGeometry, cowlMaterial);
    faceMask.position.set(0, 0.88, 0.34);
    cowlGroup.add(faceMask);
    
    // Yellow bat symbol on forehead
    const batSymbolGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.02);
    const batSymbolMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFD700, // Gold
        emissive: 0xFFD700,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.8
    });
    const batSymbol = new THREE.Mesh(batSymbolGeometry, batSymbolMaterial);
    batSymbol.position.set(0, 1.1, 0.37);
    cowlGroup.add(batSymbol);
    
    // Sharp jawline pieces
    const jawGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.08);
    const leftJaw = new THREE.Mesh(jawGeometry, cowlMaterial);
    leftJaw.position.set(-0.18, 0.8, 0.28);
    cowlGroup.add(leftJaw);
    
    const rightJaw = new THREE.Mesh(jawGeometry, cowlMaterial);
    rightJaw.position.set(0.18, 0.8, 0.28);
    cowlGroup.add(rightJaw);
    
    return cowlGroup;
}

/**
 * Creates a combat helmet with visor
 * @param {number} helmetColor - Hex color for helmet
 * @param {number} visorColor - Hex color for visor
 * @returns {THREE.Group} Combat helmet mesh group
 */
function createCombatHelmet(helmetColor, visorColor) {
    const helmetGroup = new THREE.Group();
    
    // Main helmet shell - LARGER
    const helmetGeometry = new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const helmetMaterial = new THREE.MeshStandardMaterial({
        color: helmetColor,
        roughness: 0.2,
        metalness: 0.8
    });
    const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
    helmet.position.set(0, 0.9, 0);
    helmetGroup.add(helmet);
    
    // Visor (transparent glowing) - TALLER AND BRIGHTER
    const visorGeometry = new THREE.BoxGeometry(0.55, 0.22, 0.03);
    const visorMaterial = new THREE.MeshStandardMaterial({
        color: visorColor,
        roughness: 0.05,
        metalness: 0.95,
        emissive: visorColor,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.8
    });
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 0.93, 0.38);
    helmetGroup.add(visor);
    
    // Armor plates on sides
    const plateGeometry = new THREE.BoxGeometry(0.12, 0.2, 0.08);
    const leftPlate = new THREE.Mesh(plateGeometry, helmetMaterial);
    leftPlate.position.set(-0.28, 0.88, 0.1);
    helmetGroup.add(leftPlate);
    
    const rightPlate = new THREE.Mesh(plateGeometry, helmetMaterial);
    rightPlate.position.set(0.28, 0.88, 0.1);
    helmetGroup.add(rightPlate);
    
    // Top crest/ridge
    const crestGeometry = new THREE.BoxGeometry(0.08, 0.25, 0.3);
    const crest = new THREE.Mesh(crestGeometry, helmetMaterial);
    crest.position.set(0, 1.15, 0.05);
    helmetGroup.add(crest);
    
    // LED status lights on helmet
    const ledGeometry = new THREE.SphereGeometry(0.025, 8, 8);
    const ledMaterial = new THREE.MeshStandardMaterial({
        color: 0x00FF00, // Green
        emissive: 0x00FF00,
        emissiveIntensity: 1.0,
        roughness: 0.1
    });
    const led1 = new THREE.Mesh(ledGeometry, ledMaterial);
    led1.position.set(-0.25, 1.05, 0.25);
    helmetGroup.add(led1);
    
    const led2 = new THREE.Mesh(ledGeometry, ledMaterial);
    led2.position.set(0.25, 1.05, 0.25);
    helmetGroup.add(led2);
    
    return helmetGroup;
}

/**
 * Creates a fedora hat with sunglasses (detective style)
 * @param {number} hatColor - Hex color for fedora
 * @param {number} glassesColor - Hex color for sunglasses
 * @returns {THREE.Group} Fedora and sunglasses mesh group
 */
function createFedoraSunglasses(hatColor, glassesColor) {
    const group = new THREE.Group();
    
    // Fedora brim - WIDER
    const brimGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.04, 16);
    const hatMaterial = new THREE.MeshStandardMaterial({
        color: hatColor,
        roughness: 0.8,
        metalness: 0.1
    });
    const brim = new THREE.Mesh(brimGeometry, hatMaterial);
    brim.position.set(0, 1.22, 0);
    group.add(brim);
    
    // Fedora crown - TALLER
    const crownGeometry = new THREE.CylinderGeometry(0.3, 0.32, 0.3, 16);
    const crown = new THREE.Mesh(crownGeometry, hatMaterial);
    crown.position.set(0, 1.38, 0);
    group.add(crown);
    
    // Hat band with buckle
    const bandGeometry = new THREE.TorusGeometry(0.31, 0.02, 8, 16);
    const bandMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000, // Black
        roughness: 0.6
    });
    const band = new THREE.Mesh(bandGeometry, bandMaterial);
    band.position.set(0, 1.25, 0);
    band.rotation.x = Math.PI / 2;
    group.add(band);
    
    // Sunglasses - LARGER with individual lenses
    const lensGeometry = new THREE.BoxGeometry(0.16, 0.14, 0.03);
    const glassesMaterial = new THREE.MeshStandardMaterial({
        color: glassesColor,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.9
    });
    const leftLens = new THREE.Mesh(lensGeometry, glassesMaterial);
    leftLens.position.set(-0.12, 0.95, 0.36);
    group.add(leftLens);
    
    const rightLens = new THREE.Mesh(lensGeometry, glassesMaterial);
    rightLens.position.set(0.12, 0.95, 0.36);
    group.add(rightLens);
    
    // Sunglasses bridge
    const bridgeGeometry = new THREE.BoxGeometry(0.06, 0.03, 0.03);
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.3,
        metalness: 0.8
    });
    const bridge = new THREE.Mesh(bridgeGeometry, frameMaterial);
    bridge.position.set(0, 0.95, 0.36);
    group.add(bridge);
    
    // Sunglasses arms
    const armGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.25);
    const leftArm = new THREE.Mesh(armGeometry, frameMaterial);
    leftArm.position.set(-0.2, 0.95, 0.15);
    group.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeometry, frameMaterial);
    rightArm.position.set(0.2, 0.95, 0.15);
    group.add(rightArm);
    
    return group;
}

/**
 * Creates a santa hat
 * @param {number} hatColor - Hex color for santa hat (red)
 * @returns {THREE.Group} Santa hat mesh group
 */
function createSantaHat(hatColor) {
    const group = new THREE.Group();
    
    // Main cone of the hat (red) - FIXED: No tilt, perfectly centered
    const coneGeometry = new THREE.ConeGeometry(0.35, 0.5, 16);
    const hatMaterial = new THREE.MeshStandardMaterial({
        color: hatColor || 0xFF0000,
        roughness: 0.8,
        metalness: 0.1
    });
    const cone = new THREE.Mesh(coneGeometry, hatMaterial);
    cone.position.set(0, 1.35, 0); // Centered above head
    // No rotation - keep it upright
    group.add(cone);
    
    // White fur trim at base
    const trimGeometry = new THREE.TorusGeometry(0.35, 0.06, 12, 16);
    const whiteMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        roughness: 0.9
    });
    const trim = new THREE.Mesh(trimGeometry, whiteMaterial);
    trim.position.set(0, 1.15, 0);
    trim.rotation.x = Math.PI / 2;
    group.add(trim);
    
    // White pom-pom at tip - FIXED: Centered above cone
    const pompomGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    const pompom = new THREE.Mesh(pompomGeometry, whiteMaterial);
    pompom.position.set(0, 1.6, 0); // Directly above, no offset
    group.add(pompom);
    
    return group;
}

/**
 * Creates a wizard hat
 * @param {number} hatColor - Hex color for wizard hat (purple)
 * @returns {THREE.Group} Wizard hat mesh group
 */
function createWizardHat(hatColor) {
    const group = new THREE.Group();
    
    // Tall pointed cone
    const coneGeometry = new THREE.ConeGeometry(0.3, 0.7, 16);
    const hatMaterial = new THREE.MeshStandardMaterial({
        color: hatColor || 0x4B0082,
        roughness: 0.7,
        metalness: 0.2
    });
    const cone = new THREE.Mesh(coneGeometry, hatMaterial);
    cone.position.set(0, 1.5, 0);
    group.add(cone);
    
    // Wide brim at base
    const brimGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.04, 16);
    const brim = new THREE.Mesh(brimGeometry, hatMaterial);
    brim.position.set(0, 1.18, 0);
    group.add(brim);
    
    // Golden stars decoration
    const starGeometry = new THREE.SphereGeometry(0.03, 8, 8);
    const starMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        emissive: 0xFFD700,
        emissiveIntensity: 0.5,
        metalness: 0.9
    });
    
    // Add 3 golden stars on the hat
    for (let i = 0; i < 3; i++) {
        const star = new THREE.Mesh(starGeometry, starMaterial);
        const angle = (i / 3) * Math.PI * 2;
        star.position.set(
            Math.cos(angle) * 0.25,
            1.3 + (i * 0.15),
            Math.sin(angle) * 0.25
        );
        group.add(star);
    }
    
    return group;
}

/**
 * Creates devil horns accessory
 * @param {number} hornColor - Hex color for horns (default dark red)
 * @returns {THREE.Group} Devil horns mesh group
 */
function createDevilHorns(hornColor) {
    const group = new THREE.Group();
    
    const hornMaterial = new THREE.MeshStandardMaterial({
        color: hornColor || 0x8B0000,
        roughness: 0.3,
        metalness: 0.4,
        emissive: hornColor || 0x8B0000,
        emissiveIntensity: 0.2
    });
    
    // Left horn - curved upward
    const hornSegments = 8;
    const leftHornGroup = new THREE.Group();
    for (let i = 0; i < hornSegments; i++) {
        const scale = 1 - (i / hornSegments) * 0.7; // Taper
        const hornSegGeo = new THREE.ConeGeometry(0.06 * scale, 0.08, 8);
        const hornSeg = new THREE.Mesh(hornSegGeo, hornMaterial);
        hornSeg.position.y = i * 0.06;
        hornSeg.rotation.z = -i * 0.15; // Curve outward
        leftHornGroup.add(hornSeg);
    }
    leftHornGroup.position.set(-0.2, 1.3, 0.1);
    leftHornGroup.rotation.z = 0.3;
    group.add(leftHornGroup);
    
    // Right horn - curved upward (mirrored)
    const rightHornGroup = new THREE.Group();
    for (let i = 0; i < hornSegments; i++) {
        const scale = 1 - (i / hornSegments) * 0.7;
        const hornSegGeo = new THREE.ConeGeometry(0.06 * scale, 0.08, 8);
        const hornSeg = new THREE.Mesh(hornSegGeo, hornMaterial);
        hornSeg.position.y = i * 0.06;
        hornSeg.rotation.z = i * 0.15; // Curve outward
        rightHornGroup.add(hornSeg);
    }
    rightHornGroup.position.set(0.2, 1.3, 0.1);
    rightHornGroup.rotation.z = -0.3;
    group.add(rightHornGroup);
    
    // Horn tips glow
    const tipGlowGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const tipGlowMat = new THREE.MeshStandardMaterial({
        color: 0xFF4500,
        emissive: 0xFF4500,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.8
    });
    
    const leftTip = new THREE.Mesh(tipGlowGeo, tipGlowMat);
    leftTip.position.set(-0.25, 1.75, 0.05);
    group.add(leftTip);
    
    const rightTip = new THREE.Mesh(tipGlowGeo, tipGlowMat);
    rightTip.position.set(0.25, 1.75, 0.05);
    group.add(rightTip);
    
    return group;
}

/**
 * Creates angel halo accessory
 * @param {number} haloColor - Hex color for halo (default white/gold)
 * @returns {THREE.Group} Angel halo mesh group
 */
function createAngelHalo(haloColor) {
    const group = new THREE.Group();
    
    // Main halo ring
    const haloGeometry = new THREE.TorusGeometry(0.35, 0.04, 16, 32);
    const haloMaterial = new THREE.MeshStandardMaterial({
        color: haloColor || 0xFFFFFF,
        roughness: 0.1,
        metalness: 1.0,
        emissive: haloColor || 0xFFFFFF,
        emissiveIntensity: 0.8
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.position.set(0, 1.55, 0);
    halo.rotation.x = Math.PI / 2;
    group.add(halo);
    
    // Inner glow ring
    const innerGlowGeometry = new THREE.TorusGeometry(0.35, 0.06, 16, 32);
    const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFF00,
        emissive: 0xFFFF00,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.5
    });
    const innerGlow = new THREE.Mesh(innerGlowGeometry, glowMaterial);
    innerGlow.position.set(0, 1.55, 0);
    innerGlow.rotation.x = Math.PI / 2;
    group.add(innerGlow);
    
    // Sparkle points around halo
    const sparkleGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const sparkleMat = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        emissive: 0xFFFFFF,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.9
    });
    
    for (let i = 0; i < 8; i++) {
        const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
        const angle = (i / 8) * Math.PI * 2;
        sparkle.position.set(
            Math.cos(angle) * 0.35,
            1.55,
            Math.sin(angle) * 0.35
        );
        group.add(sparkle);
    }
    
    return group;
}

/**
 * Creates a royal crown
 * @param {number} crownColor - Hex color for crown (gold)
 * @returns {THREE.Group} Crown mesh group
 */
function createCrown(crownColor) {
    const group = new THREE.Group();
    
    // Crown base (golden band with decorative pattern)
    const bandGeometry = new THREE.CylinderGeometry(0.36, 0.38, 0.15, 32);
    const crownMaterial = new THREE.MeshStandardMaterial({
        color: crownColor || 0xFFD700,
        roughness: 0.15,
        metalness: 1.0,
        emissive: crownColor || 0xFFD700,
        emissiveIntensity: 0.4
    });
    const band = new THREE.Mesh(bandGeometry, crownMaterial);
    band.position.set(0, 1.2, 0);
    group.add(band);
    
    // Decorative ridges on band
    for (let i = 0; i < 16; i++) {
        const ridgeGeometry = new THREE.BoxGeometry(0.02, 0.16, 0.01);
        const ridge = new THREE.Mesh(ridgeGeometry, crownMaterial);
        const angle = (i / 16) * Math.PI * 2;
        ridge.position.set(
            Math.cos(angle) * 0.37,
            1.2,
            Math.sin(angle) * 0.37
        );
        ridge.rotation.y = -angle;
        group.add(ridge);
    }
    
    // Crown spikes (5 main points) - taller and more elegant
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        
        // Main spike
        const spikeGeometry = new THREE.ConeGeometry(0.1, 0.35, 8);
        const spike = new THREE.Mesh(spikeGeometry, crownMaterial);
        spike.position.set(
            Math.cos(angle) * 0.35,
            1.42,
            Math.sin(angle) * 0.35
        );
        group.add(spike);
        
        // Smaller spike between main spikes
        const smallSpikeGeometry = new THREE.ConeGeometry(0.06, 0.2, 8);
        const smallSpike = new THREE.Mesh(smallSpikeGeometry, crownMaterial);
        const betweenAngle = angle + (Math.PI / 5);
        smallSpike.position.set(
            Math.cos(betweenAngle) * 0.36,
            1.34,
            Math.sin(betweenAngle) * 0.36
        );
        group.add(smallSpike);
        
        // Jewel at base of each main spike
        const jewelGeometry = new THREE.SphereGeometry(0.05, 12, 12);
        const jewelMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF0000,
            roughness: 0.05,
            metalness: 1.0,
            emissive: 0xFF0000,
            emissiveIntensity: 0.8
        });
        const jewel = new THREE.Mesh(jewelGeometry, jewelMaterial);
        jewel.position.set(
            Math.cos(angle) * 0.35,
            1.26,
            Math.sin(angle) * 0.35
        );
        group.add(jewel);
        
        // Small emeralds on small spikes
        const emeraldGeo = new THREE.SphereGeometry(0.03, 8, 8);
        const emeraldMat = new THREE.MeshStandardMaterial({
            color: 0x00FF00,
            roughness: 0.1,
            metalness: 0.9,
            emissive: 0x00FF00,
            emissiveIntensity: 0.5
        });
        const emerald = new THREE.Mesh(emeraldGeo, emeraldMat);
        emerald.position.set(
            Math.cos(betweenAngle) * 0.36,
            1.24,
            Math.sin(betweenAngle) * 0.36
        );
        group.add(emerald);
    }
    
    return group;
}

/**
 * Adds appropriate accessory to player mesh based on avatar
 * @param {string} accessoryType - Type of accessory to create
 * @param {Object} avatar - Avatar data with accessory colors
 * @returns {void}
 */
function addPlayerAccessory(accessoryType, avatar) {
    if (!playerMesh || accessoryType === 'none') return;
    
    // Remove any existing accessories first
    removePlayerAccessory();
    
    let accessory = null;
    
    switch(accessoryType) {
        case 'military_cap':
            accessory = createMilitaryCap(avatar.accessoryColor);
            break;
        case 'police_cap':
            accessory = createPoliceCap(avatar.accessoryColor, avatar.badgeColor);
            break;
        case 'tactical_mask':
            accessory = createTacticalMask(avatar.accessoryColor);
            break;
        case 'headlamp':
            accessory = createHeadlamp(avatar.accessoryColor, avatar.lampColor);
            break;
        case 'welding_goggles':
            accessory = createWeldingGoggles(avatar.accessoryColor, avatar.lensColor);
            break;
        case 'cowl_mask':
            accessory = createCowlMask(avatar.accessoryColor);
            break;
        case 'combat_helmet':
            accessory = createCombatHelmet(avatar.accessoryColor, avatar.visorColor);
            break;
        case 'fedora_sunglasses':
            accessory = createFedoraSunglasses(avatar.accessoryColor, avatar.glassesColor);
            break;
        case 'santa_hat':
            accessory = createSantaHat(avatar.accessoryColor);
            break;
        case 'wizard_hat':
            accessory = createWizardHat(avatar.accessoryColor);
            break;
        case 'crown':
            accessory = createCrown(avatar.accessoryColor);
            break;
        case 'angel_halo':
            accessory = createAngelHalo(avatar.accessoryColor);
            break;
        case 'devil_horns':
            accessory = createDevilHorns(avatar.accessoryColor);
            break;
    }
    
    if (accessory) {
        accessory.name = 'playerAccessory'; // Tag for easy removal
        playerMesh.add(accessory);
        console.log(`Added ${accessoryType} accessory to player`);
    }
}

/**
 * Removes current accessory from player mesh
 * @returns {void}
 */
function removePlayerAccessory() {
    if (!playerMesh) return;
    
    const existingAccessory = playerMesh.getObjectByName('playerAccessory');
    if (existingAccessory) {
        playerMesh.remove(existingAccessory);
        console.log('Removed existing accessory');
    }
}

// Trail particle system
let trailParticles = [];
let trailActive = false;
let trailRainbow = false;
let trailHue = 0;

/**
 * Adds particle trail effect to player
 * @param {number} color - Hex color for trail
 * @param {number} intensity - Trail intensity (0-2)
 * @param {boolean} rainbow - Whether to use rainbow cycling
 */
function addPlayerTrail(color, intensity = 1.0, rainbow = false) {
    trailActive = true;
    trailRainbow = rainbow;
    console.log(`Trail activated: color=${color.toString(16)}, intensity=${intensity}, rainbow=${rainbow}`);
}

/**
 * Removes player trail effect
 */
function removePlayerTrail() {
    trailActive = false;
    trailRainbow = false;
    // Clean up existing particles
    trailParticles.forEach(particle => {
        if (particle.parent) {
            particle.parent.remove(particle);
        }
    });
    trailParticles = [];
}

/**
 * Updates trail particles (called every frame)
 */
function updateTrailParticles() {
    if (!trailActive || !playerMesh) return;
    
    const effect = EFFECTS[equippedCosmetics.effect];
    if (!effect || !effect.trailColor) return;
    
    const effectType = equippedCosmetics.effect;
    
    // Spawn new particles every few frames
    if (Math.random() < 0.4) {
        let particleColor = effect.trailColor;
        let particleGeometry, particleMaterial, particle;
        
        // Different particle effects based on trail type
        switch(effectType) {
            case 'fire_trail':
                // Fire particles with flickering
                particleGeometry = new THREE.SphereGeometry(0.12, 8, 8);
                particleColor = Math.random() > 0.5 ? 0xFF4500 : 0xFF8C00;
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: particleColor,
                    emissive: particleColor,
                    emissiveIntensity: 1.5,
                    transparent: true,
                    opacity: 0.9
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.flicker = true;
                particle.userData.riseSpeed = 0.05;
                break;
                
            case 'ice_trail':
                // Icy crystals
                particleGeometry = new THREE.OctahedronGeometry(0.1, 0);
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: 0x87CEEB,
                    emissive: 0xADD8E6,
                    emissiveIntensity: 0.8,
                    transparent: true,
                    opacity: 0.8,
                    metalness: 0.9,
                    roughness: 0.1
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.spin = true;
                particle.userData.fallSpeed = 0.02;
                break;
                
            case 'electric_trail':
                // Electric sparks
                particleGeometry = new THREE.SphereGeometry(0.08, 6, 6);
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: 0x00FFFF,
                    emissive: 0x00FFFF,
                    emissiveIntensity: 2.0,
                    transparent: true,
                    opacity: 1.0
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.jitter = true;
                particle.userData.jitterAmount = 0.15;
                break;
                
            case 'toxic_trail':
                // Toxic bubbles
                particleGeometry = new THREE.SphereGeometry(0.15, 8, 8);
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: 0x00FF00,
                    emissive: 0x00FF00,
                    emissiveIntensity: 1.2,
                    transparent: true,
                    opacity: 0.6
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.float = true;
                particle.userData.wobble = true;
                break;
                
            case 'shadow_trail':
                // Dark smoke
                particleGeometry = new THREE.SphereGeometry(0.18, 8, 8);
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: 0x1C1C1C,
                    emissive: 0x000000,
                    emissiveIntensity: 0.3,
                    transparent: true,
                    opacity: 0.7
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.expand = true;
                break;
                
            case 'golden_trail':
                // Golden stars
                particleGeometry = new THREE.OctahedronGeometry(0.1, 0);
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: 0xFFD700,
                    emissive: 0xFFD700,
                    emissiveIntensity: 1.8,
                    transparent: true,
                    opacity: 0.95,
                    metalness: 1.0,
                    roughness: 0.0
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.twinkle = true;
                particle.userData.spin = true;
                break;
                
            case 'blood_trail':
                // Blood drops
                particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: 0x8B0000,
                    emissive: 0x660000,
                    emissiveIntensity: 0.5,
                    transparent: true,
                    opacity: 0.85
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.drip = true;
                particle.userData.fallSpeed = 0.03;
                break;
                
            case 'cosmic_trail':
                // Cosmic nebula
                particleGeometry = new THREE.SphereGeometry(0.12, 8, 8);
                const cosmicColors = [0x8B00FF, 0xFF00FF, 0x4B0082];
                particleColor = cosmicColors[Math.floor(Math.random() * cosmicColors.length)];
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: particleColor,
                    emissive: particleColor,
                    emissiveIntensity: 1.5,
                    transparent: true,
                    opacity: 0.8
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.pulse = true;
                particle.userData.spin = true;
                break;
                
            case 'rainbow_trail':
                // Rainbow cycling
                trailHue = (trailHue + 2) % 360;
                particleColor = new THREE.Color().setHSL(trailHue / 360, 1.0, 0.5).getHex();
                particleGeometry = new THREE.SphereGeometry(0.12, 8, 8);
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: particleColor,
                    emissive: particleColor,
                    emissiveIntensity: 1.8,
                    transparent: true,
                    opacity: 0.9
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.rainbow = true;
                break;
                
            case 'energy_trail':
                // Energy plasma
                particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: 0x00FFFF,
                    emissive: 0x00FFFF,
                    emissiveIntensity: 2.0,
                    transparent: true,
                    opacity: 0.9
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.energyPulse = true;
                break;
                
            case 'neon_trail':
                // Neon glow
                particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
                const neonColors = [0xFF1493, 0x00FFFF, 0x7FFF00];
                particleColor = neonColors[Math.floor(Math.random() * neonColors.length)];
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: particleColor,
                    emissive: particleColor,
                    emissiveIntensity: 2.5,
                    transparent: true,
                    opacity: 1.0
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.userData.neonFlash = true;
                break;
                
            default:
                // Default sphere
                particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
                particleMaterial = new THREE.MeshStandardMaterial({
                    color: particleColor,
                    emissive: particleColor,
                    emissiveIntensity: effect.trailIntensity || 1.0,
                    transparent: true,
                    opacity: 0.8
                });
                particle = new THREE.Mesh(particleGeometry, particleMaterial);
        }
        
        particle.position.copy(playerMesh.position);
        particle.position.y += 0.5; // Mid-body height
        particle.userData.life = 1.0; // Particle lifetime
        particle.userData.baseScale = 1.0;
        particle.userData.time = 0;
        
        scene.add(particle);
        trailParticles.push(particle);
    }
    
    // Update existing particles with unique behaviors
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const particle = trailParticles[i];
        particle.userData.life -= 0.02;
        particle.userData.time += 0.1;
        
        // Apply special effects based on particle type
        if (particle.userData.flicker) {
            // Fire flickers
            particle.material.emissiveIntensity = 1.5 + Math.sin(particle.userData.time * 5) * 0.5;
            particle.position.y += particle.userData.riseSpeed;
        }
        
        if (particle.userData.spin) {
            particle.rotation.x += 0.1;
            particle.rotation.y += 0.15;
        }
        
        if (particle.userData.jitter) {
            // Electric jitter
            particle.position.x += (Math.random() - 0.5) * particle.userData.jitterAmount;
            particle.position.z += (Math.random() - 0.5) * particle.userData.jitterAmount;
        }
        
        if (particle.userData.float) {
            // Toxic float up slowly
            particle.position.y += 0.02;
        }
        
        if (particle.userData.wobble) {
            // Wobble side to side
            particle.position.x += Math.sin(particle.userData.time) * 0.02;
        }
        
        if (particle.userData.expand) {
            // Shadow expands
            particle.userData.baseScale += 0.02;
        }
        
        if (particle.userData.twinkle) {
            // Stars twinkle
            particle.material.emissiveIntensity = 1.8 + Math.sin(particle.userData.time * 3) * 0.8;
        }
        
        if (particle.userData.drip) {
            // Blood drips down
            particle.position.y -= particle.userData.fallSpeed;
        }
        
        if (particle.userData.pulse) {
            // Cosmic pulse
            const pulse = Math.sin(particle.userData.time * 2) * 0.3 + 1.0;
            particle.material.emissiveIntensity = pulse * 1.5;
        }
        
        if (particle.userData.rainbow) {
            // Rainbow color shift
            const hue = (particle.userData.time * 10) % 360;
            const color = new THREE.Color().setHSL(hue / 360, 1.0, 0.5);
            particle.material.color.copy(color);
            particle.material.emissive.copy(color);
        }
        
        if (particle.userData.energyPulse) {
            // Energy pulse effect
            const pulse = Math.sin(particle.userData.time * 4) * 0.5 + 1.0;
            particle.material.emissiveIntensity = pulse * 2.0;
        }
        
        if (particle.userData.neonFlash) {
            // Neon flash effect
            particle.material.emissiveIntensity = 2.5 + Math.random() * 0.5;
        }
        
        if (particle.userData.fallSpeed) {
            // Fall down
            particle.position.y -= particle.userData.fallSpeed;
        }
        
        // Fade out and scale
        particle.material.opacity = particle.userData.life * 0.8;
        const scale = particle.userData.life * particle.userData.baseScale;
        particle.scale.setScalar(scale);
        
        // Remove dead particles
        if (particle.userData.life <= 0) {
            scene.remove(particle);
            trailParticles.splice(i, 1);
        }
    }
    
    // Limit max particles for performance
    while (trailParticles.length > 60) {
        const oldest = trailParticles.shift();
        scene.remove(oldest);
    }
}

/**
 * Removes player body glow/aura
 */
function removeBodyGlow() {
    if (!playerMesh) return;
    const bodyGlow = playerMesh.getObjectByName('bodyGlow');
    if (bodyGlow) {
        playerMesh.remove(bodyGlow);
    }
}

/**
 * Adds glowing aura around player body (highly visible from top-down)
 * @param {number} glowColor - Hex color for the glow
 * @param {number} intensity - Glow intensity (0-2)
 * @param {boolean} rainbow - Whether to use rainbow effect
 * @param {boolean} pulse - Whether to pulse the glow
 */
function addBodyGlow(glowColor, intensity = 0.5, rainbow = false, pulse = false) {
    if (!playerMesh) return;
    
    const group = new THREE.Group();
    group.name = 'bodyGlow';
    
    // Create multiple glowing rings around the player for maximum visibility
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
        const radius = 0.4 + i * 0.15;
        const ringGeo = new THREE.TorusGeometry(radius, 0.05 + i * 0.02, 8, 32);
        const ringMat = new THREE.MeshStandardMaterial({
            color: glowColor,
            emissive: glowColor,
            emissiveIntensity: intensity - i * 0.3,
            transparent: true,
            opacity: 0.7 - i * 0.15,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2; // Lay flat for top-down visibility
        ring.position.y = 0.1 + i * 0.1;
        group.add(ring);
        
        // Store for animation
        ring.userData.baseY = ring.position.y;
        ring.userData.ringIndex = i;
    }
    
    // Add vertical glow pillars for side visibility
    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.5, 16, 1, true);
    const pillarMat = new THREE.MeshStandardMaterial({
        color: glowColor,
        emissive: glowColor,
        emissiveIntensity: intensity * 0.6,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 0.5;
    group.add(pillar);
    
    // Add top glow disc (most visible from top-down)
    const discGeo = new THREE.CircleGeometry(0.5, 32);
    const discMat = new THREE.MeshStandardMaterial({
        color: glowColor,
        emissive: glowColor,
        emissiveIntensity: intensity * 1.5,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const topDisc = new THREE.Mesh(discGeo, discMat);
    topDisc.rotation.x = -Math.PI / 2;
    topDisc.position.y = 1.2;
    group.add(topDisc);
    
    const bottomDisc = new THREE.Mesh(discGeo, discMat);
    bottomDisc.rotation.x = -Math.PI / 2;
    bottomDisc.position.y = -0.2;
    group.add(bottomDisc);
    
    // Store animation data
    group.userData.rainbow = rainbow;
    group.userData.pulse = pulse;
    group.userData.baseIntensity = intensity;
    group.userData.time = 0;
    
    playerMesh.add(group);
}

/**
 * Animates body glow effects (rainbow, pulse, rotation)
 */
function updateBodyGlowAnimation() {
    if (!playerMesh) return;
    
    const bodyGlow = playerMesh.getObjectByName('bodyGlow');
    if (!bodyGlow) return;
    
    bodyGlow.userData.time = (bodyGlow.userData.time || 0) + 0.02;
    const time = bodyGlow.userData.time;
    
    // Animate all children
    bodyGlow.children.forEach((child, index) => {
        if (!child.material) return;
        
        // Rainbow effect
        if (bodyGlow.userData.rainbow) {
            const hue = (time * 0.5 + index * 0.1) % 1;
            const color = new THREE.Color().setHSL(hue, 1, 0.5);
            child.material.color.copy(color);
            child.material.emissive.copy(color);
        }
        
        // Pulse effect
        if (bodyGlow.userData.pulse) {
            const pulse = 0.5 + Math.sin(time * 2) * 0.5;
            child.material.emissiveIntensity = bodyGlow.userData.baseIntensity * (0.5 + pulse);
            if (child.material.opacity) {
                child.material.opacity = 0.3 + pulse * 0.4;
            }
        }
        
        // Rotate rings
        if (child.geometry.type === 'TorusGeometry' && child.userData.ringIndex !== undefined) {
            child.rotation.z = time * (0.5 + child.userData.ringIndex * 0.2);
            // Float up and down
            child.position.y = child.userData.baseY + Math.sin(time + child.userData.ringIndex) * 0.05;
        }
    });
}

function createFlashlight() {
    // Create SpotLight for flashlight effect - brighter for dark environment
    flashlight = new THREE.SpotLight(0xffffdd, 8, 25, Math.PI / 4.5, 0.3, 1); // Much brighter and wider cone
    flashlight.position.set(0, 0.5, 0);
    flashlight.target.position.set(0, 0, 5);
    flashlight.castShadow = false; // Disable shadows for better performance
    
    // Start with flashlight OFF
    flashlight.visible = false;
    
    playerMesh.add(flashlight);
    playerMesh.add(flashlight.target);
    
    console.log('Flashlight created and attached to player');
}

function toggleFlashlight() {
    flashlightOn = !flashlightOn;
    if (flashlight) {
        flashlight.visible = flashlightOn;
        console.log('Flashlight toggled:', flashlightOn ? 'ON' : 'OFF');
    } else {
        console.error('Flashlight not initialized!');
    }
    // playFlashlightSound(); // DISABLED
    updateFlashlightDisplay();
}

function createKnife(knifeStyle = 'standard', knifeColor = 0xe8e8e8, knifeGlow = 0x666666) {
    // Remove existing knife if any
    if (knifeObject) {
        playerMesh.remove(knifeObject);
        knifeObject = null;
    }
    
    const knifeGroup = new THREE.Group();
    
    // Different knife designs based on avatar
    switch(knifeStyle) {
        case 'combat': // Military combat knife
            createCombatKnife(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'butterfly': // Butterfly knife
            createButterflyKnife(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'baton': // Police baton
            createPoliceBaton(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'stealth': // Silent assassin blade
            createStealthBlade(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'scalpel': // Medical scalpel
            createScalpel(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'plasma': // Plasma cutter
            createPlasmaCutter(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'batarang': // Batarang blade
            createBatarang(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'energy': // Energy sword
            createEnergySword(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'revolver': // Detective revolver
            createRevolver(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'katana': // Katana sword
            createKatana(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'cleaver': // Meat cleaver
            createCleaver(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'karambit': // Karambit blade
            createKarambit(knifeGroup, knifeColor, knifeGlow);
            break;
        case 'lightsaber': // Lightsaber
            createLightsaber(knifeGroup, knifeColor, knifeGlow);
            break;
        default: // Standard butcher knife
            createStandardKnife(knifeGroup, knifeColor, knifeGlow);
            break;
    }
    
    // Position knife BEHIND player
    knifeGroup.position.set(0.25, 0.3, -0.4);
    knifeGroup.rotation.z = -Math.PI / 8;
    knifeGroup.rotation.x = Math.PI / 6;
    knifeGroup.rotation.y = Math.PI / 8;
    
    // Store original position for animation
    knifeGroup.userData.originalPosition = knifeGroup.position.clone();
    knifeGroup.userData.originalRotation = knifeGroup.rotation.clone();
    knifeGroup.userData.isSwinging = false;
    
    playerMesh.add(knifeGroup);
    knifeObject = knifeGroup;
}

// Standard butcher knife
function createStandardKnife(knifeGroup, color, glow) {
    const bladeGeometry = new THREE.BoxGeometry(0.12, 0.9, 0.025);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.95,
        roughness: 0.05,
        emissive: glow,
        emissiveIntensity: 0.2
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.45;
    blade.castShadow = true;
    knifeGroup.add(blade);
    
    // Serrations
    for (let i = 0; i < 5; i++) {
        const serrGeometry = new THREE.BoxGeometry(0.13, 0.04, 0.01);
        const serr = new THREE.Mesh(serrGeometry, bladeMaterial);
        serr.position.y = 0.2 + (i * 0.15);
        serr.position.z = 0.02;
        knifeGroup.add(serr);
    }
    
    // Tip
    const tipGeometry = new THREE.ConeGeometry(0.06, 0.18, 4);
    const tip = new THREE.Mesh(tipGeometry, bladeMaterial);
    tip.position.y = 0.99;
    tip.rotation.z = Math.PI / 4;
    knifeGroup.add(tip);
    
    // Handle
    const handleGeometry = new THREE.CylinderGeometry(0.055, 0.075, 0.45, 12);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x3d1f0f,
        roughness: 0.7,
        emissive: 0x1a0a00,
        emissiveIntensity: 0.1
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.22;
    knifeGroup.add(handle);
    
    // Guard
    const guardGeometry = new THREE.BoxGeometry(0.25, 0.06, 0.1);
    const guardMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        metalness: 0.9,
        roughness: 0.2
    });
    const guard = new THREE.Mesh(guardGeometry, guardMaterial);
    guard.position.y = 0;
    knifeGroup.add(guard);
}

// Combat military knife
function createCombatKnife(knifeGroup, color, glow) {
    const bladeGeometry = new THREE.BoxGeometry(0.1, 0.95, 0.03);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.98,
        roughness: 0.02,
        emissive: glow,
        emissiveIntensity: 0.4
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.48;
    knifeGroup.add(blade);
    
    // Tactical serrated edge
    for (let i = 0; i < 8; i++) {
        const serrGeometry = new THREE.BoxGeometry(0.11, 0.02, 0.01);
        const serr = new THREE.Mesh(serrGeometry, bladeMaterial);
        serr.position.y = 0.1 + (i * 0.1);
        serr.position.z = 0.02;
        knifeGroup.add(serr);
    }
    
    // Handle with tactical grip
    const handleGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x2F4F2F, // Olive green
        roughness: 0.8
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.2;
    knifeGroup.add(handle);
    
    // Pommel with compass
    const pommelGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12);
    const pommelMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 0.6,
        metalness: 0.9
    });
    const pommel = new THREE.Mesh(pommelGeometry, pommelMaterial);
    pommel.position.y = -0.45;
    knifeGroup.add(pommel);
}

// Butterfly knife - Dual blade design
function createButterflyKnife(knifeGroup, color, glow) {
    // Main blade
    const bladeGeometry = new THREE.BoxGeometry(0.06, 0.55, 0.02);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.98,
        roughness: 0.02,
        emissive: glow,
        emissiveIntensity: 0.6
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.35;
    knifeGroup.add(blade);
    
    // Blade edge glow
    const edgeGeometry = new THREE.BoxGeometry(0.065, 0.55, 0.008);
    const edgeMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.6
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.position.set(0, 0.35, 0.015);
    knifeGroup.add(edge);
    
    // Sharp tip
    const tipGeometry = new THREE.ConeGeometry(0.03, 0.12, 4);
    const tip = new THREE.Mesh(tipGeometry, bladeMaterial);
    tip.position.y = 0.68;
    tip.rotation.z = Math.PI / 4;
    knifeGroup.add(tip);
    
    // Handle pivot point
    const pivotGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.08, 12);
    const pivotMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.95,
        roughness: 0.1
    });
    const pivot = new THREE.Mesh(pivotGeometry, pivotMaterial);
    pivot.position.y = 0.05;
    pivot.rotation.x = Math.PI / 2;
    knifeGroup.add(pivot);
    
    // Left handle (opened position)
    const leftHandleGeometry = new THREE.BoxGeometry(0.04, 0.5, 0.12);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.9,
        roughness: 0.2,
        emissive: glow,
        emissiveIntensity: 0.3
    });
    const leftHandle = new THREE.Mesh(leftHandleGeometry, handleMaterial);
    leftHandle.position.set(-0.06, -0.2, 0);
    knifeGroup.add(leftHandle);
    
    // Right handle (opened position)
    const rightHandle = new THREE.Mesh(leftHandleGeometry, handleMaterial);
    rightHandle.position.set(0.06, -0.2, 0);
    knifeGroup.add(rightHandle);
    
    // Handle holes/cutouts for style
    for (let i = 0; i < 2; i++) {
        const holeGeometry = new THREE.TorusGeometry(0.03, 0.008, 8, 12);
        const holeMaterial = new THREE.MeshStandardMaterial({
            color: glow,
            emissive: glow,
            emissiveIntensity: 1.0
        });
        
        const leftHole = new THREE.Mesh(holeGeometry, holeMaterial);
        leftHole.position.set(-0.06, -0.25 + i * 0.15, 0);
        leftHole.rotation.y = Math.PI / 2;
        knifeGroup.add(leftHole);
        
        const rightHole = new THREE.Mesh(holeGeometry, holeMaterial);
        rightHole.position.set(0.06, -0.25 + i * 0.15, 0);
        rightHole.rotation.y = Math.PI / 2;
        knifeGroup.add(rightHole);
    }
    
    // Tang connecting handles to blade
    const tangGeometry = new THREE.BoxGeometry(0.02, 0.15, 0.02);
    const tang = new THREE.Mesh(tangGeometry, pivotMaterial);
    tang.position.y = 0.125;
    knifeGroup.add(tang);
    
    // Latch/lock mechanism
    const latchGeometry = new THREE.BoxGeometry(0.08, 0.02, 0.015);
    const latchMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        metalness: 1.0,
        emissive: glow,
        emissiveIntensity: 0.5
    });
    const latch = new THREE.Mesh(latchGeometry, latchMaterial);
    latch.position.y = -0.45;
    knifeGroup.add(latch);
}


// Police baton
function createPoliceBaton(knifeGroup, color, glow) {
    const batonGeometry = new THREE.CylinderGeometry(0.05, 0.06, 1.0, 12);
    const batonMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.7,
        roughness: 0.3,
        emissive: glow,
        emissiveIntensity: 0.3
    });
    const baton = new THREE.Mesh(batonGeometry, batonMaterial);
    baton.position.y = 0.3;
    knifeGroup.add(baton);
    
    // LED strips
    for (let i = 0; i < 3; i++) {
        const ledGeometry = new THREE.TorusGeometry(0.07, 0.01, 8, 12);
        const ledMaterial = new THREE.MeshStandardMaterial({
            color: glow,
            emissive: glow,
            emissiveIntensity: 0.9,
            metalness: 1.0
        });
        const led = new THREE.Mesh(ledGeometry, ledMaterial);
        led.position.y = 0.2 + (i * 0.2);
        led.rotation.x = Math.PI / 2;
        knifeGroup.add(led);
    }
    
    // Handle grip
    const handleGeometry = new THREE.CylinderGeometry(0.07, 0.07, 0.25, 12);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.9
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.3;
    knifeGroup.add(handle);
}

// Stealth assassin blade
function createStealthBlade(knifeGroup, color, glow) {
    const bladeGeometry = new THREE.BoxGeometry(0.08, 1.1, 0.015);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.99,
        roughness: 0.01,
        emissive: glow,
        emissiveIntensity: 0.5
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.55;
    knifeGroup.add(blade);
    
    // Red glowing edge
    const edgeGeometry = new THREE.BoxGeometry(0.09, 1.1, 0.005);
    const edgeMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.7
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.position.y = 0.55;
    edge.position.z = 0.01;
    knifeGroup.add(edge);
    
    // Handle
    const handleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.35, 12);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.9
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.18;
    knifeGroup.add(handle);
}

// Medical scalpel
function createScalpel(knifeGroup, color, glow) {
    const bladeGeometry = new THREE.BoxGeometry(0.05, 0.4, 0.01);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 1.0,
        roughness: 0.0,
        emissive: glow,
        emissiveIntensity: 0.6
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.5;
    knifeGroup.add(blade);
    
    // Sterile glow
    const glowGeometry = new THREE.BoxGeometry(0.06, 0.42, 0.03);
    const glowMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.5
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.position.y = 0.5;
    knifeGroup.add(glowMesh);
    
    // Medical handle
    const handleGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 12);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        roughness: 0.5,
        metalness: 0.3
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = 0;
    knifeGroup.add(handle);
}

// Plasma cutter
function createPlasmaCutter(knifeGroup, color, glow) {
    const handleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 12);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF8C00, // Orange
        roughness: 0.4,
        metalness: 0.6
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = 0.1;
    knifeGroup.add(handle);
    
    // Plasma blade
    const plasmaGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.05);
    const plasmaMaterial = new THREE.MeshStandardMaterial({
        color: color,
        emissive: glow,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.8,
        metalness: 1.0
    });
    const plasma = new THREE.Mesh(plasmaGeometry, plasmaMaterial);
    plasma.position.y = 0.7;
    knifeGroup.add(plasma);
    
    // Electric sparks
    for (let i = 0; i < 4; i++) {
        const sparkGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        const sparkMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            emissive: 0xFFD700,
            emissiveIntensity: 1.5
        });
        const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
        spark.position.y = 0.5 + Math.random() * 0.5;
        spark.position.x = (Math.random() - 0.5) * 0.1;
        knifeGroup.add(spark);
    }
}

// Batarang blade - Dark knight throwing blade
function createBatarang(knifeGroup, color, glow) {
    // Main central body
    const bodyGeometry = new THREE.BoxGeometry(0.35, 0.12, 0.03);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.96,
        roughness: 0.1,
        emissive: glow,
        emissiveIntensity: 0.5
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    knifeGroup.add(body);
    
    // Sharp edges glow
    const edgeGeometry = new THREE.BoxGeometry(0.36, 0.13, 0.01);
    const edgeMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.6
    });
    const edgeGlow = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edgeGlow.position.set(0, 0.5, 0.02);
    knifeGroup.add(edgeGlow);
    
    // Left wing blade
    const leftWingGeometry = new THREE.ConeGeometry(0.14, 0.25, 3);
    const leftWing = new THREE.Mesh(leftWingGeometry, bodyMaterial);
    leftWing.position.set(-0.18, 0.52, 0);
    leftWing.rotation.z = -Math.PI / 2.5;
    knifeGroup.add(leftWing);
    
    // Left wing glow
    const leftWingGlow = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.26, 3),
        edgeMaterial
    );
    leftWingGlow.position.set(-0.18, 0.52, 0.015);
    leftWingGlow.rotation.z = -Math.PI / 2.5;
    knifeGroup.add(leftWingGlow);
    
    // Right wing blade
    const rightWing = new THREE.Mesh(leftWingGeometry, bodyMaterial);
    rightWing.position.set(0.18, 0.52, 0);
    rightWing.rotation.z = Math.PI / 2.5;
    knifeGroup.add(rightWing);
    
    // Right wing glow
    const rightWingGlow = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.26, 3),
        edgeMaterial
    );
    rightWingGlow.position.set(0.18, 0.52, 0.015);
    rightWingGlow.rotation.z = Math.PI / 2.5;
    knifeGroup.add(rightWingGlow);
    
    // Center spike
    const spikeGeometry = new THREE.ConeGeometry(0.04, 0.15, 4);
    const spike = new THREE.Mesh(spikeGeometry, bodyMaterial);
    spike.position.y = 0.625;
    spike.rotation.z = Math.PI / 4;
    knifeGroup.add(spike);
    
    // Bat symbol cutout (center circle)
    const centerHoleGeometry = new THREE.TorusGeometry(0.06, 0.01, 8, 16);
    const centerHoleMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.5
    });
    const centerHole = new THREE.Mesh(centerHoleGeometry, centerHoleMaterial);
    centerHole.position.y = 0.5;
    knifeGroup.add(centerHole);
    
    // Grip handle
    const gripGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.15, 12);
    const gripMaterial = new THREE.MeshStandardMaterial({
        color: 0x1C1C1C,
        roughness: 0.9
    });
    const grip = new THREE.Mesh(gripGeometry, gripMaterial);
    grip.position.y = 0.38;
    knifeGroup.add(grip);
    
    // Decorative notches on wings
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 3; i++) {
            const notchGeometry = new THREE.BoxGeometry(0.02, 0.05, 0.02);
            const notch = new THREE.Mesh(notchGeometry, bodyMaterial);
            notch.position.set(side * (0.05 + i * 0.05), 0.5 + i * 0.03, 0);
            notch.rotation.z = side * Math.PI / 6;
            knifeGroup.add(notch);
        }
    }
}

// Energy sword - High-tech plasma blade
function createEnergySword(knifeGroup, color, glow) {
    // Handle base
    const handleGeometry = new THREE.CylinderGeometry(0.065, 0.085, 0.45, 16);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x2C2C2C,
        roughness: 0.3,
        metalness: 0.85,
        emissive: glow,
        emissiveIntensity: 0.2
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.12;
    knifeGroup.add(handle);
    
    // Power core rings on handle
    for (let i = 0; i < 5; i++) {
        const ringGeometry = new THREE.TorusGeometry(0.07, 0.008, 8, 16);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: glow,
            emissive: glow,
            emissiveIntensity: 1.2 - i * 0.1,
            metalness: 1.0
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.y = -0.05 - i * 0.07;
        ring.rotation.x = Math.PI / 2;
        knifeGroup.add(ring);
    }
    
    // Guard/emitter
    const guardGeometry = new THREE.CylinderGeometry(0.09, 0.07, 0.08, 6);
    const guardMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        metalness: 0.95,
        roughness: 0.1
    });
    const guard = new THREE.Mesh(guardGeometry, guardMaterial);
    guard.position.y = 0.14;
    knifeGroup.add(guard);
    
    // Energy blade core - white hot center
    const coreGeometry = new THREE.BoxGeometry(0.09, 1.25, 0.045);
    const coreMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        emissive: 0xFFFFFF,
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 0.9
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 0.78;
    knifeGroup.add(core);
    
    // Main energy blade
    const bladeGeometry = new THREE.BoxGeometry(0.12, 1.25, 0.07);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        emissive: glow,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.85,
        metalness: 0.9,
        roughness: 0.0
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.78;
    knifeGroup.add(blade);
    
    // Outer energy glow
    const glowGeometry = new THREE.BoxGeometry(0.15, 1.25, 0.09);
    const glowMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.5
    });
    const glowBlade = new THREE.Mesh(glowGeometry, glowMaterial);
    glowBlade.position.y = 0.78;
    knifeGroup.add(glowBlade);
    
    // Energy particles along blade
    for (let i = 0; i < 8; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        const particleMaterial = new THREE.MeshStandardMaterial({
            color: glow,
            emissive: glow,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.7
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.set(
            (Math.random() - 0.5) * 0.08,
            0.25 + i * 0.15,
            (Math.random() - 0.5) * 0.05
        );
        knifeGroup.add(particle);
    }
    
    // Blade tip point
    const tipGeometry = new THREE.ConeGeometry(0.06, 0.18, 4);
    const tip = new THREE.Mesh(tipGeometry, bladeMaterial);
    tip.position.y = 1.5;
    tip.rotation.z = Math.PI / 4;
    knifeGroup.add(tip);
    
    // Pommel power cell
    const pommelGeometry = new THREE.SphereGeometry(0.05, 12, 12);
    const pommelMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.8,
        metalness: 0.9
    });
    const pommel = new THREE.Mesh(pommelGeometry, pommelMaterial);
    pommel.position.y = -0.38;
    knifeGroup.add(pommel);
}

// Detective revolver
function createRevolver(knifeGroup, color, glow) {
    // Barrel
    const barrelGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 12);
    const gunMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.9,
        roughness: 0.2,
        emissive: glow,
        emissiveIntensity: 0.2
    });
    const barrel = new THREE.Mesh(barrelGeometry, gunMaterial);
    barrel.position.y = 0.35;
    barrel.rotation.x = Math.PI / 2;
    knifeGroup.add(barrel);
    
    // Cylinder
    const cylinderGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.12, 6);
    const cylinder = new THREE.Mesh(cylinderGeometry, gunMaterial);
    cylinder.position.y = 0.1;
    cylinder.rotation.x = Math.PI / 2;
    knifeGroup.add(cylinder);
    
    // Handle
    const handleGeometry = new THREE.BoxGeometry(0.08, 0.3, 0.12);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321, // Brown wood
        roughness: 0.8
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.15;
    knifeGroup.add(handle);
    
    // Hammer
    const hammerGeometry = new THREE.BoxGeometry(0.03, 0.08, 0.06);
    const hammer = new THREE.Mesh(hammerGeometry, gunMaterial);
    hammer.position.set(0, 0.08, -0.08);
    knifeGroup.add(hammer);
}

// Katana sword - Enhanced fantasy design
function createKatana(knifeGroup, color, glow) {
    // Main blade with curved shape
    const bladeGeometry = new THREE.BoxGeometry(0.06, 0.9, 0.015);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.98,
        roughness: 0.01,
        emissive: glow,
        emissiveIntensity: 0.6
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.48;
    knifeGroup.add(blade);
    
    // Decorative edge glow
    const edgeGeometry = new THREE.BoxGeometry(0.065, 0.9, 0.005);
    const edgeMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.6
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.position.set(0, 0.48, 0.01);
    knifeGroup.add(edge);
    
    // Sharp tip
    const tipGeometry = new THREE.ConeGeometry(0.03, 0.12, 4);
    const tip = new THREE.Mesh(tipGeometry, bladeMaterial);
    tip.position.y = 0.98;
    tip.rotation.z = Math.PI / 4;
    knifeGroup.add(tip);
    
    // Ornate guard (tsuba) with decorative pattern
    const guardGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.02, 6);
    const guardMaterial = new THREE.MeshStandardMaterial({
        color: 0xC0C0C0,
        metalness: 1.0,
        roughness: 0.2,
        emissive: glow,
        emissiveIntensity: 0.3
    });
    const guard = new THREE.Mesh(guardGeometry, guardMaterial);
    guard.position.y = 0.03;
    knifeGroup.add(guard);
    
    // Decorative swirls on guard
    for (let i = 0; i < 6; i++) {
        const swirlGeometry = new THREE.TorusGeometry(0.04, 0.008, 6, 8, Math.PI);
        const swirlMaterial = new THREE.MeshStandardMaterial({
            color: glow,
            emissive: glow,
            emissiveIntensity: 0.8,
            metalness: 1.0
        });
        const swirl = new THREE.Mesh(swirlGeometry, swirlMaterial);
        swirl.position.y = 0.035;
        swirl.rotation.y = (i * Math.PI) / 3;
        swirl.rotation.z = Math.PI / 2;
        knifeGroup.add(swirl);
    }
    
    // Handle (tsuka) with ornate wrapping
    const handleGeometry = new THREE.CylinderGeometry(0.045, 0.05, 0.32, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x4B0082, // Deep purple
        roughness: 0.6,
        metalness: 0.4
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.16;
    knifeGroup.add(handle);
    
    // Diamond wrap pattern
    for (let i = 0; i < 5; i++) {
        const wrapGeometry = new THREE.TorusGeometry(0.052, 0.006, 6, 12);
        const wrapMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            metalness: 1.0,
            emissive: 0xFFD700,
            emissiveIntensity: 0.3
        });
        const wrap = new THREE.Mesh(wrapGeometry, wrapMaterial);
        wrap.position.y = -0.05 - i * 0.06;
        wrap.rotation.x = Math.PI / 2;
        knifeGroup.add(wrap);
    }
    
    // Ornate pommel with gem
    const pommelGeometry = new THREE.CylinderGeometry(0.06, 0.045, 0.04, 8);
    const pommelMaterial = new THREE.MeshStandardMaterial({
        color: 0xC0C0C0,
        metalness: 1.0,
        roughness: 0.1
    });
    const pommel = new THREE.Mesh(pommelGeometry, pommelMaterial);
    pommel.position.y = -0.34;
    knifeGroup.add(pommel);
    
    // Glowing gem in pommel
    const gemGeometry = new THREE.SphereGeometry(0.025, 12, 12);
    const gemMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.8
    });
    const gem = new THREE.Mesh(gemGeometry, gemMaterial);
    gem.position.y = -0.34;
    knifeGroup.add(gem);
}

// Meat cleaver
function createCleaver(knifeGroup, color, glow) {
    // Wide, rectangular blade
    const bladeGeometry = new THREE.BoxGeometry(0.2, 0.5, 0.04);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.95,
        roughness: 0.1,
        emissive: glow,
        emissiveIntensity: 0.3
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.3;
    knifeGroup.add(blade);
    
    // Blade hole (for hanging)
    const holeGeometry = new THREE.TorusGeometry(0.04, 0.01, 8, 12);
    const holeMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        metalness: 0.5
    });
    const hole = new THREE.Mesh(holeGeometry, holeMaterial);
    hole.position.set(0, 0.45, 0);
    hole.rotation.y = Math.PI / 2;
    knifeGroup.add(hole);
    
    // Blood stains
    const stainGeometry = new THREE.CircleGeometry(0.03, 8);
    const stainMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B0000,
        roughness: 0.9
    });
    for (let i = 0; i < 3; i++) {
        const stain = new THREE.Mesh(stainGeometry, stainMaterial);
        stain.position.set(Math.random() * 0.1 - 0.05, 0.2 + i * 0.1, 0.021);
        knifeGroup.add(stain);
    }
    
    // Handle
    const handleGeometry = new THREE.BoxGeometry(0.06, 0.25, 0.1);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x3d1f0f,
        roughness: 0.7
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.1;
    knifeGroup.add(handle);
    
    // Rivets on handle
    for (let i = 0; i < 3; i++) {
        const rivetGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.11, 8);
        const rivetMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.9
        });
        const rivet = new THREE.Mesh(rivetGeometry, rivetMaterial);
        rivet.position.set(0, -0.05 - i * 0.08, 0);
        rivet.rotation.x = Math.PI / 2;
        knifeGroup.add(rivet);
    }
}

// Karambit blade - Enhanced tactical design
function createKarambit(knifeGroup, color, glow) {
    // Main curved blade with serrations
    const bladeGeometry = new THREE.BoxGeometry(0.08, 0.4, 0.025);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.98,
        roughness: 0.02,
        emissive: glow,
        emissiveIntensity: 0.7
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.22;
    blade.rotation.z = Math.PI / 5; // Curved angle
    knifeGroup.add(blade);
    
    // Glowing edge
    const edgeGeometry = new THREE.BoxGeometry(0.085, 0.4, 0.01);
    const edgeMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.7
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.position.y = 0.22;
    edge.position.z = 0.018;
    edge.rotation.z = Math.PI / 5;
    knifeGroup.add(edge);
    
    // Serrated back edge
    for (let i = 0; i < 6; i++) {
        const serrGeometry = new THREE.BoxGeometry(0.09, 0.015, 0.015);
        const serr = new THREE.Mesh(serrGeometry, bladeMaterial);
        const angle = Math.PI / 5;
        const yOffset = 0.05 + i * 0.06;
        serr.position.x = -yOffset * Math.sin(angle);
        serr.position.y = yOffset * Math.cos(angle);
        serr.position.z = -0.015;
        serr.rotation.z = angle;
        knifeGroup.add(serr);
    }
    
    // Hooked tip
    const hookGeometry = new THREE.TorusGeometry(0.09, 0.02, 8, 12, Math.PI);
    const hook = new THREE.Mesh(hookGeometry, bladeMaterial);
    hook.position.set(0.08, 0.38, 0);
    hook.rotation.y = Math.PI / 2;
    hook.rotation.z = -Math.PI / 2.5;
    knifeGroup.add(hook);
    
    // Hook glow
    const hookGlowGeometry = new THREE.TorusGeometry(0.095, 0.015, 8, 12, Math.PI);
    const hookGlow = new THREE.Mesh(hookGlowGeometry, edgeMaterial);
    hookGlow.position.set(0.08, 0.38, 0);
    hookGlow.rotation.y = Math.PI / 2;
    hookGlow.rotation.z = -Math.PI / 2.5;
    knifeGroup.add(hookGlow);
    
    // Tactical handle with texture
    const handleGeometry = new THREE.BoxGeometry(0.055, 0.18, 0.09);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x1C1C1C,
        roughness: 0.8,
        metalness: 0.2
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = 0;
    knifeGroup.add(handle);
    
    // Grip grooves
    for (let i = 0; i < 4; i++) {
        const grooveGeometry = new THREE.BoxGeometry(0.06, 0.01, 0.095);
        const grooveMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 1.0
        });
        const groove = new THREE.Mesh(grooveGeometry, grooveMaterial);
        groove.position.y = -0.06 + i * 0.04;
        knifeGroup.add(groove);
    }
    
    // Reinforced finger ring
    const ringGeometry = new THREE.TorusGeometry(0.065, 0.015, 12, 20);
    const ringMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.95,
        roughness: 0.1,
        emissive: glow,
        emissiveIntensity: 0.4
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(0, -0.12, 0);
    ring.rotation.x = Math.PI / 2;
    knifeGroup.add(ring);
    
    // Ring safety notches
    for (let i = 0; i < 3; i++) {
        const notchGeometry = new THREE.BoxGeometry(0.01, 0.02, 0.01);
        const notch = new THREE.Mesh(notchGeometry, bladeMaterial);
        const angle = (i * Math.PI * 2) / 3;
        notch.position.set(
            Math.cos(angle) * 0.065,
            -0.12,
            Math.sin(angle) * 0.065
        );
        knifeGroup.add(notch);
    }
    
    // Lanyard hole
    const lanyardGeometry = new THREE.TorusGeometry(0.015, 0.005, 8, 12);
    const lanyard = new THREE.Mesh(lanyardGeometry, ringMaterial);
    lanyard.position.set(0, -0.09, -0.05);
    lanyard.rotation.x = Math.PI / 2;
    knifeGroup.add(lanyard);
}

// Lightsaber - Enhanced sci-fi energy blade
function createLightsaber(knifeGroup, color, glow) {
    // Core energy blade - bright inner glow
    const coreGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.88, 16);
    const coreMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        emissive: 0xFFFFFF,
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 0.95
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 0.52;
    knifeGroup.add(core);
    
    // Main energy blade
    const bladeGeometry = new THREE.CylinderGeometry(0.028, 0.028, 0.88, 16);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.2,
        roughness: 0.1,
        emissive: glow,
        emissiveIntensity: 2.2,
        transparent: true,
        opacity: 0.85
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.52;
    knifeGroup.add(blade);
    
    // Outer glow halo
    const glowGeometry = new THREE.CylinderGeometry(0.045, 0.045, 0.88, 16);
    const glowMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.4
    });
    const glowBlade = new THREE.Mesh(glowGeometry, glowMaterial);
    glowBlade.position.y = 0.52;
    knifeGroup.add(glowBlade);
    
    // Extended outer aura
    const auraGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.88, 16);
    const auraMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.2
    });
    const aura = new THREE.Mesh(auraGeometry, auraMaterial);
    aura.position.y = 0.52;
    knifeGroup.add(aura);
    
    // Emitter (top of hilt where blade emerges)
    const emitterGeometry = new THREE.CylinderGeometry(0.035, 0.05, 0.06, 16);
    const hiltMaterial = new THREE.MeshStandardMaterial({
        color: 0xA8A8A8,
        metalness: 0.95,
        roughness: 0.15
    });
    const emitter = new THREE.Mesh(emitterGeometry, hiltMaterial);
    emitter.position.y = 0.11;
    knifeGroup.add(emitter);
    
    // Emitter glow ring
    const emitterGlowGeometry = new THREE.TorusGeometry(0.04, 0.008, 8, 16);
    const emitterGlowMaterial = new THREE.MeshStandardMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.5
    });
    const emitterGlow = new THREE.Mesh(emitterGlowGeometry, emitterGlowMaterial);
    emitterGlow.position.y = 0.09;
    emitterGlow.rotation.x = Math.PI / 2;
    knifeGroup.add(emitterGlow);
    
    // Main hilt body
    const hiltGeometry = new THREE.CylinderGeometry(0.045, 0.05, 0.32, 16);
    const hilt = new THREE.Mesh(hiltGeometry, hiltMaterial);
    hilt.position.y = -0.08;
    knifeGroup.add(hilt);
    
    // Activation switch/button
    const buttonGeometry = new THREE.BoxGeometry(0.02, 0.04, 0.025);
    const buttonMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF0000,
        emissive: 0xFF0000,
        emissiveIntensity: 1.2,
        metalness: 0.8
    });
    const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    button.position.set(0.052, 0.02, 0);
    knifeGroup.add(button);
    
    // Control panel
    const panelGeometry = new THREE.BoxGeometry(0.055, 0.08, 0.015);
    const panelMaterial = new THREE.MeshStandardMaterial({
        color: 0x1C1C1C,
        metalness: 0.6,
        roughness: 0.3
    });
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panel.position.set(0.048, 0, 0);
    knifeGroup.add(panel);
    
    // LED indicator lights
    for (let i = 0; i < 3; i++) {
        const ledGeometry = new THREE.SphereGeometry(0.006, 8, 8);
        const ledMaterial = new THREE.MeshStandardMaterial({
            color: i === 0 ? 0x00FF00 : (i === 1 ? 0x00FF00 : 0xFF0000),
            emissive: i === 0 ? 0x00FF00 : (i === 1 ? 0x00FF00 : 0xFF0000),
            emissiveIntensity: 1.5
        });
        const led = new THREE.Mesh(ledGeometry, ledMaterial);
        led.position.set(0.053, -0.02 - i * 0.02, 0);
        knifeGroup.add(led);
    }
    
    // Grip rings
    for (let i = 0; i < 4; i++) {
        const ringGeometry = new THREE.TorusGeometry(0.051, 0.004, 8, 16);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            metalness: 0.7,
            roughness: 0.4
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.y = -0.06 - i * 0.06;
        ring.rotation.x = Math.PI / 2;
        knifeGroup.add(ring);
    }
    
    // Pommel (bottom cap)
    const pommelGeometry = new THREE.CylinderGeometry(0.038, 0.055, 0.08, 16);
    const pommel = new THREE.Mesh(pommelGeometry, hiltMaterial);
    pommel.position.y = -0.28;
    knifeGroup.add(pommel);
    
    // Pommel accent ring
    const pommelRingGeometry = new THREE.TorusGeometry(0.046, 0.006, 8, 16);
    const pommelRing = new THREE.Mesh(pommelRingGeometry, emitterGlowMaterial);
    pommelRing.position.y = -0.25;
    pommelRing.rotation.x = Math.PI / 2;
    knifeGroup.add(pommelRing);
}

function createExit() {
    exit = new THREE.Vector3(MAZE_SIZE / 2 - 1.5, 0, MAZE_SIZE / 2 - 1.5);
    
    // Create UFO flying in the sky with blue ray effects - SMALLER VERSION
    const ufoGroup = new THREE.Group();
    
    // UFO Main Body (disc shape) - REDUCED SIZE
    const ufoBodyGeometry = new THREE.CylinderGeometry(0.8, 1.0, 0.3, 32);
    const ufoBodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x333366,
        emissiveIntensity: 0.3
    });
    const ufoBody = new THREE.Mesh(ufoBodyGeometry, ufoBodyMaterial);
    ufoGroup.add(ufoBody);
    
    // UFO Dome (top) - SMALLER
    const ufoDomeGeometry = new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const ufoDomeMaterial = new THREE.MeshStandardMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.7,
        emissive: 0x2244aa,
        emissiveIntensity: 0.5
    });
    const ufoDome = new THREE.Mesh(ufoDomeGeometry, ufoDomeMaterial);
    ufoDome.position.y = 0.15;
    ufoGroup.add(ufoDome);
    
    // UFO Lights around the rim - SMALLER AND FEWER
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const lightGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const lightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 1.0
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.x = Math.cos(angle) * 0.9;
        light.position.z = Math.sin(angle) * 0.9;
        light.position.y = -0.1;
        ufoGroup.add(light);
        
        // Point lights for each rim light
        const pointLight = new THREE.PointLight(0xffffff, 0.3, 3);
        pointLight.position.copy(light.position);
        ufoGroup.add(pointLight);
    }
    
    // Blue tractor beam cone - MUCH NARROWER
    const beamGeometry = new THREE.ConeGeometry(1.2, 5, 16, 1, true);
    const beamMaterial = new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        transparent: true,
        opacity: 0.25,
        emissive: 0x0066cc,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = -2.5;
    beam.rotation.x = Math.PI;
    ufoGroup.add(beam);
    
    // Blue ray circle on ground - VERY SMALL CIRCLE
    const groundBeamGeometry = new THREE.CircleGeometry(1.2, 32);
    const groundBeamMaterial = new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        transparent: true,
        opacity: 0.5,
        emissive: 0x0066cc,
        emissiveIntensity: 0.6
    });
    const groundBeam = new THREE.Mesh(groundBeamGeometry, groundBeamMaterial);
    groundBeam.rotation.x = -Math.PI / 2;
    groundBeam.position.y = 0.1;
    ufoGroup.add(groundBeam);
    
    // Main blue beam light from UFO - REDUCED INTENSITY
    const beamLight = new THREE.SpotLight(0x0088ff, 2, 8, Math.PI / 6, 0.5, 1);
    beamLight.position.set(0, 2, 0);
    beamLight.target.position.set(0, 0, 0);
    ufoGroup.add(beamLight);
    ufoGroup.add(beamLight.target);
    
    // Additional blue point light for ground illumination - REDUCED
    const groundLight = new THREE.PointLight(0x0088ff, 1.5, 6);
    groundLight.position.set(0, 1, 0);
    ufoGroup.add(groundLight);
    
    // Position UFO just above the end of maze, close to walls (lower height)
    ufoGroup.position.set(exit.x, 5, exit.z);
    ufoGroup.userData.originalY = 5;
    ufoGroup.userData.time = 0;
    
    scene.add(ufoGroup);
    exitMesh = ufoGroup;
    
    console.log('UFO exit created at position:', ufoGroup.position);
}

// ============================================================================
// ENEMY SPAWNING SYSTEM
// ============================================================================

/**
 * Creates and spawns jumping enemies throughout the maze corridors
 * Implements intelligent distribution algorithm for balanced gameplay
 * 
 * @returns {void}
 * 
 * @description
 * Spawn algorithm:
 * 1. Scans entire maze to identify horizontal and vertical corridors
 * 2. Filters corridors by minimum length (2+ cells) to ensure mobility
 * 3. Prioritizes longer corridors (5+ cells) for better enemy placement
 * 4. Spawns JUMPER_COUNT (15) enemies with minimum 4-unit spacing
 * 5. Creates red sphere meshes with glowing emissive material
 * 6. Initializes AI state: position, velocity, patrol corridor, jump phase
 * 7. Adds each enemy to scene and jumpers array for game loop updates
 * 
 * Each enemy is confined to their spawn corridor for lane-based combat,
 * creating predictable but challenging patrol patterns.
 */
function createJumpers() {
    console.log('Initializing enemy spawn system...');
    
    // Clear any existing enemy entities
    jumpers.forEach(jumper => scene.remove(jumper.mesh));
    jumpers = [];
    
    console.log(`Maze size: ${MAZE_SIZE}x${MAZE_SIZE}, looking for corridors...`);
    
    // Corridor detection phase - find all valid spawn locations
    const corridors = [];
    const usedCorridors = new Set();
    
    // Detect horizontal corridors (consecutive clear cells in rows)
    for (let z = 1; z < MAZE_SIZE - 1; z++) {
        let startX = -1;
        let length = 0;
        
        for (let x = 1; x < MAZE_SIZE - 1; x++) {
            if (maze[x][z] === 0) {
                if (startX === -1) startX = x;
                length++;
            } else {
                if (length >= 2) {
                    const corridorId = `H_${startX}_${z}_${length}`;
                    if (!usedCorridors.has(corridorId)) {
                        corridors.push({
                            type: 'horizontal',
                            startX: startX,
                            endX: startX + length - 1,
                            z: z,
                            length: length,
                            id: corridorId
                        });
                        usedCorridors.add(corridorId);
                    }
                }
                startX = -1;
                length = 0;
            }
        }
        if (length >= 2) {
            const corridorId = `H_${startX}_${z}_${length}`;
            if (!usedCorridors.has(corridorId)) {
                corridors.push({
                    type: 'horizontal',
                    startX: startX,
                    endX: startX + length - 1,
                    z: z,
                    length: length,
                    id: corridorId
                });
                usedCorridors.add(corridorId);
            }
        }
    }
    
    // Find vertical corridors (columns with consecutive clear cells)
    for (let x = 1; x < MAZE_SIZE - 1; x++) {
        let startZ = -1;
        let length = 0;
        
        for (let z = 1; z < MAZE_SIZE - 1; z++) {
            if (maze[x][z] === 0) {
                if (startZ === -1) startZ = z;
                length++;
            } else {
                if (length >= 2) {
                    const corridorId = `V_${x}_${startZ}_${length}`;
                    if (!usedCorridors.has(corridorId)) {
                        corridors.push({
                            type: 'vertical',
                            x: x,
                            startZ: startZ,
                            endZ: startZ + length - 1,
                            length: length,
                            id: corridorId
                        });
                        usedCorridors.add(corridorId);
                    }
                }
                startZ = -1;
                length = 0;
            }
        }
        if (length >= 2) {
            const corridorId = `V_${x}_${startZ}_${length}`;
            if (!usedCorridors.has(corridorId)) {
                corridors.push({
                    type: 'vertical',
                    x: x,
                    startZ: startZ,
                    endZ: startZ + length - 1,
                    length: length,
                    id: corridorId
                });
                usedCorridors.add(corridorId);
            }
        }
    }
    
    // Shuffle corridors for MAXIMUM distribution across the maze
    // Sort by position to spread them out, then shuffle within groups
    corridors.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        if (a.type === 'horizontal') {
            return a.z - b.z; // Sort by row
        } else {
            return a.x - b.x; // Sort by column
        }
    });
    
    console.log(`✅ Found ${corridors.length} unique corridors in the maze`);
    
    // PRIORITIZE LONG CORRIDORS - ensure they get enemies
    corridors.sort((a, b) => b.length - a.length); // Sort by length, longest first
    
    // Select corridors with good spacing, prioritizing long ones
    const selectedCorridors = [];
    const minDistanceBetweenJumpers = 4.0; // Good separation
    
    if (corridors.length > 0) {
        // First pass: Select long corridors (length >= 5)
        for (const corridor of corridors) {
            if (selectedCorridors.length >= JUMPER_COUNT) break;
            
            if (corridor.length >= 5) {
                // Check spacing
                let tooClose = false;
                for (const selected of selectedCorridors) {
                    const dist = Math.abs(
                        corridor.type === 'horizontal' ? 
                        (corridor.z - selected.z) : 
                        (corridor.x - selected.x)
                    );
                    if (corridor.type === selected.type && dist < minDistanceBetweenJumpers) {
                        tooClose = true;
                        break;
                    }
                }
                
                if (!tooClose) {
                    selectedCorridors.push(corridor);
                }
            }
        }
        
        // Second pass: Fill remaining slots with any corridors
        for (const corridor of corridors) {
            if (selectedCorridors.length >= JUMPER_COUNT) break;
            if (selectedCorridors.includes(corridor)) continue;
            
            let tooClose = false;
            for (const selected of selectedCorridors) {
                const dist = Math.abs(
                    corridor.type === 'horizontal' ? 
                    (corridor.z - selected.z) : 
                    (corridor.x - selected.x)
                );
                if (corridor.type === selected.type && dist < 2.0) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                selectedCorridors.push(corridor);
            }
        }
    }
    
    console.log(`📍 Creating ${selectedCorridors.length} jumping enemies (prioritizing long corridors)`);
    
    if (selectedCorridors.length === 0) {
        console.error('❌ NO CORRIDORS FOUND! Cannot create jumpers!');
        return;
    }
    
    for (let i = 0; i < selectedCorridors.length; i++) {
        const corridor = selectedCorridors[i];
        let position, patrolMin, patrolMax, patrolAxis, fixedCoord, lane;
        
        if (corridor.type === 'horizontal') {
            const worldZ = corridor.z - MAZE_SIZE / 2;
            const worldStartX = corridor.startX - MAZE_SIZE / 2;
            const worldEndX = corridor.endX - MAZE_SIZE / 2;
            
            // Spawn in CENTER of corridor, away from walls
            const centerX = (worldStartX + worldEndX) / 2;
            position = new THREE.Vector3(centerX, 0.3, worldZ);
            patrolMin = worldStartX + 1.0; // Stay away from walls
            patrolMax = worldEndX - 1.0;
            patrolAxis = 'x';
            fixedCoord = worldZ;
            
            lane = {
                xMin: worldStartX + 0.5,
                xMax: worldEndX - 0.5,
                zMin: worldZ - 0.5,
                zMax: worldZ + 0.5,
                axis: 'x',
                name: `H-Lane ${i+1}`,
                fixedCoord: worldZ
            };
        } else {
            const worldX = corridor.x - MAZE_SIZE / 2;
            const worldStartZ = corridor.startZ - MAZE_SIZE / 2;
            const worldEndZ = corridor.endZ - MAZE_SIZE / 2;
            
            // Spawn in CENTER of corridor, away from walls
            const centerZ = (worldStartZ + worldEndZ) / 2;
            position = new THREE.Vector3(worldX, 0.3, centerZ);
            patrolMin = worldStartZ + 1.0; // Stay away from walls
            patrolMax = worldEndZ - 1.0;
            patrolAxis = 'z';
            fixedCoord = worldX;
            
            lane = {
                xMin: worldX - 0.5,
                xMax: worldX + 0.5,
                zMin: worldStartZ + 0.5,
                zMax: worldEndZ - 0.5,
                axis: 'z',
                name: `V-Lane ${i+1}`,
                fixedCoord: worldX
            };
        }
        
        // Create highly visible jumping enemy - bright and aggressive
        const jumperGroup = new THREE.Group();
        
        // Compact body - smaller than player but VERY visible
        const bodyGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF3300, // Bright red-orange infected color
            roughness: 0.5,
            metalness: 0.3,
            emissive: 0xFF1100,
            emissiveIntensity: 0.6 // Stronger glow
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        jumperGroup.add(body);
        
        // Glowing eyes - VERY visible with strong emission
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFF00,
            emissive: 0xFFFF00,
            emissiveIntensity: 2.0 // Maximum glow
        });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.12, 0.1, 0.25);
        jumperGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 0.1, 0.25);
        jumperGroup.add(rightEye);
        
        // Glowing ring around body for extra visibility
        const ringGeometry = new THREE.TorusGeometry(0.35, 0.03, 8, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF6600,
            transparent: true,
            opacity: 0.6
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        jumperGroup.add(ring);
        
        // Small legs for jumping effect
        const legGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF3300,
            roughness: 0.7
        });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.12, -0.35, 0);
        jumperGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.12, -0.35, 0);
        jumperGroup.add(rightLeg);
        
        jumperGroup.position.set(position.x, 0.8, position.z);
        jumperGroup.castShadow = true;
        jumperGroup.visible = true; // Force visible
        scene.add(jumperGroup);
        
        console.log(`Adding jumper ${i} to scene at (${position.x.toFixed(2)}, 0.8, ${position.z.toFixed(2)}), corridor: ${corridor.type} length: ${corridor.length}`);
        
        // Store jumper with INDEPENDENT position object (not a reference!)
        const jumperPosition = new THREE.Vector3(position.x, 0.8, position.z);
        
        jumpers.push({
            mesh: jumperGroup,
            position: jumperPosition, // Independent position for tracking
            direction: new THREE.Vector3(patrolAxis === 'x' ? 1 : 0, 0, patrolAxis === 'z' ? 1 : 0),
            speed: JUMPER_SPEED,
            state: 'hopping',
            health: 100,
            lastAttackTime: 0,
            laneInfo: lane,
            patrolAxis: patrolAxis,
            patrolMin: patrolMin,
            patrolMax: patrolMax,
            patrolDirection: 1,
            laneName: lane.name,
            chaseRange: 5, // Attack when player gets within 5 units!
            jumpPhase: Math.random() * Math.PI * 2,
            baseY: 0.8 // Higher base Y for better visibility
        });
        
        console.log(`Created jumper ${i} in ${lane.name}, patrol: ${patrolMin.toFixed(1)} to ${patrolMax.toFixed(1)}, position: (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`);
    }
    
    console.log(`✅ Total jumpers created: ${jumpers.length}`);
    
    // Update enemy count display
    updateJumperCount();
}

/**
 * Creates a door exit for survival mode
 */
function createDoorExit() {
    exit = new THREE.Vector3(MAZE_SIZE / 2 - 1.5, 0, MAZE_SIZE / 2 - 1.5);
    
    // Create ornate door with glowing frame
    const doorGroup = new THREE.Group();
    
    // Door frame
    const frameGeometry = new THREE.BoxGeometry(2, 3, 0.2);
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.7,
        metalness: 0.3
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    doorGroup.add(frame);
    
    // Door panels
    const panelGeometry = new THREE.BoxGeometry(0.9, 2.6, 0.15);
    const panelMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321,
        roughness: 0.8,
        metalness: 0.2
    });
    const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    leftPanel.position.set(-0.5, 0, 0.05);
    doorGroup.add(leftPanel);
    
    const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    rightPanel.position.set(0.5, 0, 0.05);
    doorGroup.add(rightPanel);
    
    // Glowing green "EXIT" sign above door
    const signGeometry = new THREE.BoxGeometry(1.5, 0.4, 0.1);
    const signMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 1.0,
        roughness: 0.3,
        metalness: 0.7
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.y = 1.8;
    doorGroup.add(sign);
    
    // Green spotlight from above
    const doorLight = new THREE.SpotLight(0x00ff00, 2, 10, Math.PI / 4, 0.5, 1);
    doorLight.position.set(0, 4, 0);
    doorLight.target.position.set(0, 0, 0);
    doorGroup.add(doorLight);
    doorGroup.add(doorLight.target);
    
    // Green glow ring on ground
    const glowGeometry = new THREE.CircleGeometry(2, 32);
    const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.4,
        emissive: 0x00ff00,
        emissiveIntensity: 0.8
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.1;
    doorGroup.add(glow);
    
    // Position door at exit location
    doorGroup.position.set(exit.x, 1.5, exit.z);
    
    scene.add(doorGroup);
    doorMesh = doorGroup;
    
    console.log('Door exit created at position:', doorGroup.position);
}

/**
 * Spawns a specific number of monsters for survival mode
 * @param {number} count - Number of monsters to spawn
 */
function spawnSurvivalMonsters(count) {
    console.log(`🔴 spawnSurvivalMonsters called with count: ${count}`);
    
    // Safety check - make sure maze exists
    if (!maze || maze.length === 0) {
        console.error('❌ Cannot spawn monsters - maze not generated yet!');
        console.error('Maze:', maze);
        return;
    }
    
    console.log(`✅ Maze exists, size: ${maze.length}x${maze[0].length}`);
    
    // Find valid spawn corridors (same logic as createJumpers)
    const corridors = [];
    
    console.log('🔍 Detecting horizontal corridors...');
    
    // Detect horizontal corridors
    for (let z = 1; z < MAZE_SIZE - 1; z++) {
        let startX = -1;
        let length = 0;
        
        for (let x = 1; x < MAZE_SIZE - 1; x++) {
            if (maze[x][z] === 0) {
                if (startX === -1) startX = x;
                length++;
            } else {
                if (length >= 2) {
                    corridors.push({
                        type: 'horizontal',
                        startX: startX,
                        endX: startX + length - 1,
                        z: z,
                        length: length
                    });
                }
                startX = -1;
                length = 0;
            }
        }
        if (length >= 2) {
            corridors.push({
                type: 'horizontal',
                startX: startX,
                endX: startX + length - 1,
                z: z,
                length: length
            });
        }
    }
    
    // Detect vertical corridors
    for (let x = 1; x < MAZE_SIZE - 1; x++) {
        let startZ = -1;
        let length = 0;
        
        for (let z = 1; z < MAZE_SIZE - 1; z++) {
            if (maze[x][z] === 0) {
                if (startZ === -1) startZ = z;
                length++;
            } else {
                if (length >= 2) {
                    corridors.push({
                        type: 'vertical',
                        x: x,
                        startZ: startZ,
                        endZ: startZ + length - 1,
                        length: length
                    });
                }
                startZ = -1;
                length = 0;
            }
        }
        if (length >= 2) {
            corridors.push({
                type: 'vertical',
                x: x,
                startZ: startZ,
                endZ: startZ + length - 1,
                length: length
            });
        }
    }
    
    console.log(`📊 Found ${corridors.length} total corridors`);
    
    if (corridors.length === 0) {
        console.error('❌ No corridors found for monster spawning!');
        return;
    }
    
    console.log(`✅ Spawning ${count} monsters in ${corridors.length} available corridors...`);
    
    // Spawn monsters in random corridors - preferring far away spots
    for (let i = 0; i < count; i++) {
        console.log(`   Creating monster ${i+1}/${count}...`);
        
        // SMART SPAWNING: Pick a corridor far from the player
        let selectedCorridor = null;
        let maxDistance = -1;
        const attempts = Math.min(10, corridors.length); // Try up to 10 random corridors
        
        for (let attempt = 0; attempt < attempts; attempt++) {
            const testCorridor = corridors[Math.floor(Math.random() * corridors.length)];
            
            // Calculate approximate center of this corridor
            let testX, testZ;
            if (testCorridor.type === 'horizontal') {
                testX = ((testCorridor.startX + testCorridor.endX) / 2) - MAZE_SIZE / 2;
                testZ = testCorridor.z - MAZE_SIZE / 2;
            } else {
                testX = testCorridor.x - MAZE_SIZE / 2;
                testZ = ((testCorridor.startZ + testCorridor.endZ) / 2) - MAZE_SIZE / 2;
            }
            
            // Calculate distance to player
            const dx = testX - player.position.x;
            const dz = testZ - player.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > maxDistance) {
                maxDistance = distance;
                selectedCorridor = testCorridor;
            }
        }
        
        const corridor = selectedCorridor;
        console.log(`   Corridor selected (${maxDistance.toFixed(2)} units from player):`, corridor);
        let position, patrolMin, patrolMax, patrolAxis, fixedCoord, lane;
        
        if (corridor.type === 'horizontal') {
            const worldZ = corridor.z - MAZE_SIZE / 2;
            const worldStartX = corridor.startX - MAZE_SIZE / 2;
            const worldEndX = corridor.endX - MAZE_SIZE / 2;
            
            console.log(`   Horizontal corridor: worldZ=${worldZ}, worldStartX=${worldStartX}, worldEndX=${worldEndX}`);
            
            const centerX = (worldStartX + worldEndX) / 2;
            console.log(`   Calculated centerX=${centerX}`);
            position = new THREE.Vector3(centerX, 0.3, worldZ);
            console.log(`   Created position:`, position);
            patrolMin = worldStartX + 1.0;
            patrolMax = worldEndX - 1.0;
            patrolAxis = 'x';
            fixedCoord = worldZ;
            
            lane = {
                type: 'horizontal',
                axis: 'x',
                fixedCoord: fixedCoord,
                fixedZ: fixedCoord,
                xMin: worldStartX,
                xMax: worldEndX,
                name: `H_${corridor.z}_${corridor.startX}_${corridor.endX}`
            };
        } else {
            const worldX = corridor.x - MAZE_SIZE / 2;
            const worldStartZ = corridor.startZ - MAZE_SIZE / 2;
            const worldEndZ = corridor.endZ - MAZE_SIZE / 2;
            
            console.log(`   Vertical corridor: worldX=${worldX}, worldStartZ=${worldStartZ}, worldEndZ=${worldEndZ}`);
            
            const centerZ = (worldStartZ + worldEndZ) / 2;
            console.log(`   Calculated centerZ=${centerZ}`);
            position = new THREE.Vector3(worldX, 0.3, centerZ);
            console.log(`   Created position:`, position);
            patrolMin = worldStartZ + 1.0;
            patrolMax = worldEndZ - 1.0;
            patrolAxis = 'z';
            fixedCoord = worldX;
            
            lane = {
                type: 'vertical',
                axis: 'z',
                fixedCoord: fixedCoord,
                fixedX: fixedCoord,
                zMin: worldStartZ,
                zMax: worldEndZ,
                name: `V_${corridor.x}_${corridor.startZ}_${corridor.endZ}`
            };
        }
        
        // Create monster mesh (same as jumper design)
        const jumperGroup = new THREE.Group();
        
        const bodyGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF3300,
            roughness: 0.5,
            metalness: 0.3,
            emissive: 0xFF1100,
            emissiveIntensity: 0.6
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        jumperGroup.add(body);
        
        // Glowing eyes
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFF00,
            emissive: 0xFFFF00,
            emissiveIntensity: 2.0
        });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.12, 0.1, 0.25);
        jumperGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 0.1, 0.25);
        jumperGroup.add(rightEye);
        
        // Glowing ring
        const ringGeometry = new THREE.TorusGeometry(0.35, 0.03, 8, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF6600,
            transparent: true,
            opacity: 0.6
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        jumperGroup.add(ring);
        
        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF3300,
            roughness: 0.7
        });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.12, -0.35, 0);
        jumperGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.12, -0.35, 0);
        jumperGroup.add(rightLeg);
        
        jumperGroup.position.set(position.x, 0.8, position.z);
        jumperGroup.castShadow = true;
        jumperGroup.visible = true;
        scene.add(jumperGroup);
        
        console.log(`Survival monster ${i+1}/${count} spawned at (${position.x.toFixed(2)}, 0.8, ${position.z.toFixed(2)}) in ${corridor.type} corridor`);
        
        const jumperPosition = new THREE.Vector3(position.x, 0.8, position.z);
        
        jumpers.push({
            mesh: jumperGroup,
            position: jumperPosition,
            direction: new THREE.Vector3(patrolAxis === 'x' ? 1 : 0, 0, patrolAxis === 'z' ? 1 : 0),
            speed: JUMPER_SPEED,
            state: 'hopping',
            health: 100,
            lastAttackTime: 0,
            laneInfo: lane,
            patrolAxis: patrolAxis,
            patrolMin: patrolMin,
            patrolMax: patrolMax,
            patrolDirection: 1,
            laneName: lane.name,
            chaseRange: 5,
            jumpPhase: Math.random() * Math.PI * 2,
            baseY: 0.8
        });
    }
    
    console.log(`✅✅✅ Spawned ${count} monsters. Total monsters in game: ${jumpers.length}`);
    console.log(`Monster array:`, jumpers.map(j => `(${j.position.x.toFixed(1)}, ${j.position.z.toFixed(1)})`));
    
    // DEBUG: Verify monsters are in the scene
    console.log('🔍 DEBUG: Checking scene for monsters...');
    jumpers.forEach((j, idx) => {
        console.log(`Monster ${idx}: mesh.visible=${j.mesh.visible}, mesh.position=(${j.mesh.position.x.toFixed(2)}, ${j.mesh.position.y.toFixed(2)}, ${j.mesh.position.z.toFixed(2)}), in scene=${scene.children.includes(j.mesh)}`);
    });
    
    updateJumperCount();
}

/**
 * Spawns 2 monsters for every kill in survival mode (legacy timed spawning removed)
 * Now triggers on monster death instead of timer
 */
function startMonsterSpawning() {
    console.log('Survival Mode: Monster spawning is event-based (2 spawned per kill)');
    // No longer using timed intervals - spawning happens on kill
}

/**
 * Stops the monster spawning system
 */
function stopMonsterSpawning() {
    if (monsterSpawnInterval) {
        clearInterval(monsterSpawnInterval);
        monsterSpawnInterval = null;
        console.log('Monster spawning system stopped');
    }
}

function createPistolPickup() {
    // Create pistol pickup near the center of the maze
    const pickupGroup = new THREE.Group();
    
    // Enhanced Pistol body - more realistic design
    const handleGeometry = new THREE.BoxGeometry(0.12, 0.35, 0.08);
    const triggerGuardGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.06);
    const barrelGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8);
    const slideGeometry = new THREE.BoxGeometry(0.1, 0.08, 0.38);
    
    const pistolMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x333333,
        emissiveIntensity: 0.3
    });
    
    // Handle/Grip
    const handle = new THREE.Mesh(handleGeometry, pistolMaterial);
    handle.position.set(0, -0.1, 0);
    handle.rotation.z = Math.PI / 8;
    pickupGroup.add(handle);
    
    // Trigger guard
    const triggerGuard = new THREE.Mesh(triggerGuardGeometry, pistolMaterial);
    triggerGuard.position.set(0, 0.05, 0);
    pickupGroup.add(triggerGuard);
    
    // Barrel
    const barrel = new THREE.Mesh(barrelGeometry, pistolMaterial);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.15, 0.15, 0);
    pickupGroup.add(barrel);
    
    // Slide
    const slide = new THREE.Mesh(slideGeometry, pistolMaterial);
    slide.position.set(0.05, 0.15, 0);
    pickupGroup.add(slide);
    
    // Bright Orange Glowing Ring - Much More Visible
    const ringGeometry = new THREE.TorusGeometry(0.8, 0.08, 16, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xff8800,
        transparent: true,
        opacity: 0.9
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.2;
    pickupGroup.add(ring);
    
    // Secondary inner glow ring
    const innerRingGeometry = new THREE.TorusGeometry(0.6, 0.05, 16, 32);
    const innerRingMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.7
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -0.15;
    pickupGroup.add(innerRing);
    
    // Bright Orange Point Light for visibility
    const pickupLight = new THREE.PointLight(0xff6600, 3, 12);
    pickupLight.position.set(0, 1, 0);
    pickupGroup.add(pickupLight);
    
    // Additional spotlight for better visibility
    const spotlight = new THREE.SpotLight(0xff8800, 2, 15, Math.PI / 3, 0.3, 1);
    spotlight.position.set(0, 3, 0);
    spotlight.target.position.set(0, 0, 0);
    pickupGroup.add(spotlight);
    pickupGroup.add(spotlight.target);
    
    // Position in a separate area between walls (side corridor)
    pickupGroup.position.set(-6, 0.5, 3); // Side area away from center and start
    pickupGroup.userData.rotation = 0; // For spinning animation
    
    scene.add(pickupGroup);
    pistolPickup = pickupGroup;
    
    console.log('Pistol pickup created at position:', pickupGroup.position);
}

function shoot() {
    const now = Date.now();
    
    if (currentWeapon === 'knife') {
        // Knife melee attack - optimized for fast enemies
        if (now - lastShotTime < KNIFE_COOLDOWN) return;
        if (knifeObject && knifeObject.userData.isSwinging) return;
        
        lastShotTime = now;
        
        // Play knife slash sound
        playKnifeSound();
        
        // Animate knife swing
        animateKnifeSwing();
        
        // Check for jumping enemies in knife range - 360° CIRCULAR AREA
        // Balanced difficulty: shorter range but hits all around
        console.log(`Knife attack! Checking ${jumpers.length} jumpers in 360° range`);
        let hitCount = 0;
        const maxHits = 1; // Only hit 1 zombie per swing (moderate difficulty)
        
        for (let i = jumpers.length - 1; i >= 0 && hitCount < maxHits; i--) {
            const jumper = jumpers[i];
            const distance = player.position.distanceTo(jumper.position);
            
            // Check if player and jumper are in the same lane/corridor
            let inSameLane = false;
            const lane = jumper.laneInfo;
            const tolerance = 0.8;
            
            if (jumper.patrolAxis === 'x') {
                const playerInLaneZ = Math.abs(player.position.z - lane.fixedCoord) < tolerance;
                const playerInLaneX = player.position.x >= lane.xMin - 0.5 && player.position.x <= lane.xMax + 0.5;
                inSameLane = playerInLaneZ && playerInLaneX;
            } else {
                const playerInLaneX = Math.abs(player.position.x - lane.fixedCoord) < tolerance;
                const playerInLaneZ = player.position.z >= lane.zMin - 0.5 && player.position.z <= lane.zMax + 0.5;
                inSameLane = playerInLaneX && playerInLaneZ;
            }
            
            // Hit if: in same lane AND within circular range (360° around player)
            // No direction check - can hit zombies from any angle
            if (inSameLane && distance < KNIFE_RANGE) {
                // Kill jumper with knife
                console.log(`Knife killed jumper ${i} in ${lane.name}! Distance: ${distance.toFixed(2)}`);
                playHitSound();
                createExplosion(jumper.position);
                removeJumper(jumper, i);
                
                hitCount++;
                
                // Hunt mode only: Check if all jumpers are dead - VICTORY!
                if (gameMode === 'hunt' && jumpers.length === 0) {
                    setTimeout(() => {
                        winGame();
                    }, 500);
                }
            }
        }
        
        // Visual feedback for successful hits
        if (hitCount > 0) {
            createKnifeHitFlash();
        }
    } else if (currentWeapon === 'pistol') {
        // Pistol shooting
        console.log(`Pistol shot attempt. Cooldown check: ${now - lastShotTime} >= ${SHOOT_COOLDOWN}, Ammo: ${ammoCount}`);
        if (now - lastShotTime < SHOOT_COOLDOWN) return;
        if (ammoCount <= 0) {
            console.log('No ammo left!');
            return;
        }
        
        lastShotTime = now;
        ammoCount--;
        updateAmmoDisplay();
        
        // Play gunshot sound - lightweight
        playGunshotSound();
        
        // Create realistic bullet - LARGER AND MORE VISIBLE
        const bulletGroup = new THREE.Group();
        
        // Bullet casing (brass) - BIGGER
        const casingGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
        const casingMaterial = new THREE.MeshStandardMaterial({
            color: 0xffdd33, // Brighter gold/brass
            metalness: 0.9,
            roughness: 0.2,
            emissive: 0xffaa00,
            emissiveIntensity: 0.3
        });
        const casing = new THREE.Mesh(casingGeometry, casingMaterial);
        casing.rotation.x = Math.PI / 2;
        casing.castShadow = true;
        bulletGroup.add(casing);
        
        // Bullet tip (lead/copper) - BIGGER
        const tipGeometry = new THREE.ConeGeometry(0.08, 0.16, 8);
        const tipMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6600, // Brighter copper
            metalness: 0.8,
            roughness: 0.3,
            emissive: 0xff3300,
            emissiveIntensity: 0.2
        });
        const tip = new THREE.Mesh(tipGeometry, tipMaterial);
        tip.position.z = 0.23;
        tip.rotation.x = -Math.PI / 2;
        tip.castShadow = true;
        bulletGroup.add(tip);
        
        // Add glow effect to bullet
        const glowGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.6
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        bulletGroup.add(glow);
        
        // Position bullet at player location
        bulletGroup.position.copy(player.position);
        bulletGroup.position.y = 0.8;
        
        // Bullet direction based on player rotation
        const direction = new THREE.Vector3(
            Math.sin(playerMesh.rotation.y),
            0,
            Math.cos(playerMesh.rotation.y)
        );
        
        // Rotate bullet to face direction
        bulletGroup.rotation.y = playerMesh.rotation.y;
        
        scene.add(bulletGroup);
        
        bullets.push({
            mesh: bulletGroup,
            velocity: direction.multiplyScalar(BULLET_SPEED),
            lifetime: 0
        });
        
        console.log(`Bullet created! Total bullets: ${bullets.length}, Direction:`, direction);
        
        // Play shoot sound effect (visual feedback)
        createMuzzleFlash();
    }
}

function animateKnifeSwing() {
    if (!knifeObject) return;
    
    knifeObject.userData.isSwinging = true;
    
    const swingDuration = 180; // ms - much faster for rapid attacks
    const startTime = Date.now();
    const originalRotation = knifeObject.userData.originalRotation.clone();
    const originalPosition = knifeObject.userData.originalPosition?.clone() || knifeObject.position.clone();
    
    function swingStep() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / swingDuration, 1);
        
        // Faster, more aggressive slicing animation
        const angle = progress * Math.PI; // 0 to PI radians (180 degrees)
        const radius = 0.4; // Slightly larger radius for better reach
        
        // Create circular motion around player
        const centerX = originalPosition.x;
        const centerZ = originalPosition.z - 0.2; // Slightly in front
        
        knifeObject.position.x = centerX + Math.sin(angle) * radius;
        knifeObject.position.z = centerZ + Math.cos(angle) * radius - radius; // Start from right
        
        // More dramatic rotation for faster swing
        knifeObject.rotation.z = originalRotation.z - angle * 1.5; // Enhanced rotation
        knifeObject.rotation.y = originalRotation.y + Math.sin(angle) * 0.4; // More side tilt
        knifeObject.rotation.x = originalRotation.x + Math.cos(angle) * 0.3; // More forward tilt
        
        // Enhanced scale effect for impact
        const scaleEffect = 1 + Math.sin(angle) * 0.3;
        knifeObject.scale.set(scaleEffect, scaleEffect, scaleEffect);
        
        if (progress < 1) {
            requestAnimationFrame(swingStep);
        } else {
            // Reset to original state
            knifeObject.rotation.copy(originalRotation);
            knifeObject.position.copy(originalPosition);
            knifeObject.scale.set(1, 1, 1);
            knifeObject.userData.isSwinging = false;
        }
    }
    
    swingStep();
}

function createKnifeHitFlash() {
    // Create bright red flash for successful knife hits
    const flashGroup = new THREE.Group();
    
    // Main flash sphere - red for knife
    const flashGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 1.0
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flashGroup.add(flash);
    
    // Outer glow - blood red
    const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.6
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    flashGroup.add(glow);
    
    // Position at player location
    flashGroup.position.copy(player.position);
    flashGroup.position.y = 0.8;
    
    // Add point light for lighting effect
    const flashLight = new THREE.PointLight(0xff4444, 1.5, 8);
    flashLight.position.copy(player.position);
    flashLight.position.y = 0.8;
    scene.add(flashLight);
    
    scene.add(flashGroup);
    
    // Animate fade out - faster for knife
    let fadeProgress = 0;
    const fadeInterval = setInterval(() => {
        fadeProgress += 0.15; // Faster fade
        flash.material.opacity = 1.0 - fadeProgress;
        glow.material.opacity = 0.6 - (fadeProgress * 0.6);
        flashLight.intensity = 1.5 - (fadeProgress * 1.5);
        
        if (fadeProgress >= 1.0) {
            clearInterval(fadeInterval);
            scene.remove(flashGroup);
            scene.remove(flashLight);
        }
    }, 15); // Faster animation
}

function createMuzzleFlash() {
    // Create bright muzzle flash with multiple elements
    const flashGroup = new THREE.Group();
    
    // Main flash sphere
    const flashGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 1.0
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flashGroup.add(flash);
    
    // Outer glow
    const glowGeometry = new THREE.SphereGeometry(0.6, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.5
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    flashGroup.add(glow);
    
    // Position at player location
    flashGroup.position.copy(player.position);
    flashGroup.position.y = 0.8;
    
    // Add point light for lighting effect
    const flashLight = new THREE.PointLight(0xffff00, 2, 10);
    flashLight.position.copy(player.position);
    flashLight.position.y = 0.8;
    scene.add(flashLight);
    
    scene.add(flashGroup);
    
    // Animate fade out
    let fadeProgress = 0;
    const fadeInterval = setInterval(() => {
        fadeProgress += 0.1;
        flash.material.opacity = 1.0 - fadeProgress;
        glow.material.opacity = 0.5 - (fadeProgress * 0.5);
        flashLight.intensity = 2 - (fadeProgress * 2);
        
        if (fadeProgress >= 1.0) {
            clearInterval(fadeInterval);
            scene.remove(flashGroup);
            scene.remove(flashLight);
        }
    }, 20);
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // Move bullet
        bullet.mesh.position.add(bullet.velocity);
        bullet.lifetime++;
        
        // Check collision with walls
        if (isWallAt(bullet.mesh.position) || bullet.lifetime > 200) {
            scene.remove(bullet.mesh);
            bullets.splice(i, 1);
            continue;
        }
        
        // Check collision with jumping enemies - MUST BE IN SAME LANE
        for (let j = jumpers.length - 1; j >= 0; j--) {
            const jumper = jumpers[j];
            const hitDistance = bullet.mesh.position.distanceTo(jumper.position);
            
            // Check if bullet and jumper are in the same lane/corridor
            let inSameLane = false;
            const lane = jumper.laneInfo;
            const tolerance = 0.8;
            
            if (jumper.patrolAxis === 'x') {
                const bulletInLaneZ = Math.abs(bullet.mesh.position.z - lane.fixedCoord) < tolerance;
                const bulletInLaneX = bullet.mesh.position.x >= lane.xMin - 0.5 && bullet.mesh.position.x <= lane.xMax + 0.5;
                inSameLane = bulletInLaneZ && bulletInLaneX;
            } else {
                const bulletInLaneX = Math.abs(bullet.mesh.position.x - lane.fixedCoord) < tolerance;
                const bulletInLaneZ = bullet.mesh.position.z >= lane.zMin - 0.5 && bullet.mesh.position.z <= lane.zMax + 0.5;
                inSameLane = bulletInLaneX && bulletInLaneZ;
            }
            
            if (inSameLane && hitDistance < 0.7) { // Slightly smaller hitbox for smaller enemy
                // Hit jumper!
                console.log(`Bullet hit jumper ${j} in ${lane.name}! Distance: ${hitDistance.toFixed(2)}`);
                playHitSound();
                createExplosion(jumper.position);
                scene.remove(bullet.mesh);
                removeJumper(jumper, j);
                bullets.splice(i, 1);
                
                // Hunt mode only: Check if all jumpers are dead - VICTORY!
                if (gameMode === 'hunt' && jumpers.length === 0) {
                    setTimeout(() => {
                        winGame();
                    }, 500);
                }
                break;
            }
        }
    }
}

function createExplosion(position) {
    const explosionGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.8
    });
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(position);
    scene.add(explosion);
    
    // Animate explosion
    let scale = 1;
    const explosionInterval = setInterval(() => {
        scale += 0.2;
        explosion.scale.set(scale, scale, scale);
        explosion.material.opacity -= 0.1;
        
        if (explosion.material.opacity <= 0) {
            scene.remove(explosion);
            clearInterval(explosionInterval);
        }
    }, 30);
}

function updateAmmoDisplay() {
    const ammoElement = document.getElementById('ammoCount');
    if (currentWeapon === 'knife') {
        ammoElement.textContent = '∞'; // Infinite for knife
    } else {
        ammoElement.textContent = ammoCount;
    }
}

function updateWeaponDisplay() {
    const weaponElement = document.getElementById('weaponName');
    if (weaponElement) {
        if (currentWeapon === 'knife') {
            weaponElement.textContent = '🔪 KNIFE';
        } else if (currentWeapon === 'pistol') {
            weaponElement.textContent = '🔫 PISTOL';
        }
    }
}

function updateFlashlightDisplay() {
    const flashlightElement = document.getElementById('flashlightStatus');
    if (flashlightElement) {
        flashlightElement.textContent = flashlightOn ? '🔦 ON' : '🔦 OFF';
        flashlightElement.style.color = flashlightOn ? '#ffff00' : '#888888';
    }
}

function updateKillsDisplay() {
    document.getElementById('killCount').textContent = kills;
}

function setupControls() {
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        // Initialize simple audio on first interaction
        if (!audioInitialized) {
            initAudio();
            // Start background music on first user interaction
            startBackgroundMusic();
        }
        
        keys[e.key.toLowerCase()] = true;
        
        // Space bar to shoot
        if (e.code === 'Space' && gameActive) {
            e.preventDefault();
            shoot();
        }
        
        // F key to toggle flashlight
        if (e.key.toLowerCase() === 'f' && gameActive) {
            e.preventDefault();
            toggleFlashlight();
        }
        
        // Q key to switch weapons (re-enabled)
        if (e.key.toLowerCase() === 'q' && gameActive) {
            e.preventDefault();
            switchWeapon();
        }
        
        // B key to toggle shop
        if (e.key.toLowerCase() === 'b') {
            e.preventDefault();
            toggleShop();
        }
        
        // Q key removed - melee only mode
        // if (e.key.toLowerCase() === 'q' && gameActive) {
        //     e.preventDefault();
        //     switchWeapon();
        // }
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });
    
    // Mouse click to shoot
    document.addEventListener('click', (e) => {
        // Initialize simple audio on first interaction
        if (!audioInitialized) {
            initAudio();
            // Start background music on first user interaction
            startBackgroundMusic();
        }
        
        if (gameActive && e.target.tagName !== 'BUTTON') {
            shoot();
        }
    });
    
    // Mouse move for aiming (optional - player auto-rotates with movement)
    document.addEventListener('mousemove', (e) => {
        if (gameActive) {
            // Could use for aiming direction in future
        }
    });
    
    // Mobile touch controls
    const controlButtons = document.querySelectorAll('.control-btn');
    controlButtons.forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const key = btn.getAttribute('data-key');
            keys[key] = true;
        });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            const key = btn.getAttribute('data-key');
            keys[key] = false;
        });
    });
    
    // Mode toggle button - check if it exists
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', toggleMode);
    } else {
        console.warn('Mode toggle button not found in DOM');
    }
    
    // Restart button - ensure it's properly bound
    const restartButton = document.getElementById('restartBtn');
    if (restartButton) {
        restartButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Restart button clicked!');
            updateGameTip(); // Update the tip on restart
            restartGame();
        });
    } else {
        console.error('Restart button not found!');
    }
    
    // Change Game Mode button
    const changeGameModeButton = document.getElementById('changeGameModeBtn');
    if (changeGameModeButton) {
        changeGameModeButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Change Game Mode button clicked!');
            
            // Stop game and clear scene completely
            gameActive = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            
            // Reset game state variables
            gameStartTime = Date.now();
            kills = 0;
            score = 0;
            currentWeapon = 'knife';
            flashlightOn = false;
            ammoCount = 30;
            
            // Clear enemy AI state
            chasingJumper = null;
            jumperQueue = [];
            occupiedLanes.clear();
            
            // Clear all game objects from scene
            if (playerMesh) {
                scene.remove(playerMesh);
                playerMesh = null;
            }
            if (player) {
                player = null;
            }
            if (exitMesh) {
                scene.remove(exitMesh);
                exitMesh = null;
            }
            if (doorMesh) {
                scene.remove(doorMesh);
                doorMesh = null;
            }
            if (pistolPickup) {
                scene.remove(pistolPickup);
                pistolPickup = null;
            }
            
            jumpers.forEach(jumper => {
                if (jumper.mesh) scene.remove(jumper.mesh);
            });
            jumpers = [];
            
            mazeWalls.forEach(wall => scene.remove(wall));
            mazeWalls = [];
            
            bullets.forEach(bullet => {
                if (bullet.mesh) scene.remove(bullet.mesh);
            });
            bullets = [];
            
            // Hide game over screen
            const gameOverScreen = document.getElementById('gameOver');
            if (gameOverScreen) {
                gameOverScreen.classList.remove('show');
                gameOverScreen.style.display = 'none';
            }
            
            // Show game mode selection screen
            const gameModeScreen = document.getElementById('gameModeScreen');
            if (gameModeScreen) {
                gameModeScreen.classList.add('visible');
            }
            
            // Reset game mode
            gameMode = null;
            console.log('Scene cleared, returning to game mode selection');
        });
    } else {
        console.warn('Change Game Mode button not found!');
    }
    
    // Window resize
    window.addEventListener('resize', onWindowResize);
    
    // Shop category tab event listeners
    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.dataset.category;
            if (category) {
                switchShopCategory(category);
            }
        });
    });
}

function setupLoaders() {
    // Setup loaders for Full mode (GLTF, OBJ, Texture)
    // In a real implementation, you would import these from THREE
    // For now, we'll prepare the structure
    
    if (typeof THREE.GLTFLoader !== 'undefined') {
        gltfLoader = new THREE.GLTFLoader();
    }
    
    if (typeof THREE.OBJLoader !== 'undefined') {
        objLoader = new THREE.OBJLoader();
    }
    
    textureLoader = new THREE.TextureLoader();
}

function toggleMode() {
    isPrototypeMode = !isPrototypeMode;
    
    const modeBtn = document.getElementById('modeToggle');
    const modeDisplay = document.getElementById('currentMode');
    
    if (isPrototypeMode) {
        modeBtn.textContent = 'Switch to FULL MODE';
        modeDisplay.textContent = 'PROTOTYPE';
    } else {
        modeBtn.textContent = 'Switch to PROTOTYPE MODE';
        modeDisplay.textContent = 'FULL';
    }
    
    // Recreate scene elements with new mode
    recreateSceneForMode();
}

function recreateSceneForMode() {
    // Remove old meshes
    if (playerMesh) scene.remove(playerMesh);
    if (exitMesh) scene.remove(exitMesh);
    jumpers.forEach(j => scene.remove(j.mesh));
    
    // Recreate with new mode
    createWalls();
    createPlayer();
    createExit();
    createJumpers();
}

// Function to switch weapons with Q key
function switchWeapon() {
    if (currentWeapon === 'knife' && pistolPickup === null) {
        // Only switch to pistol if we've picked it up (pistolPickup is null when picked up)
        // Check if we have ammo
        if (ammoCount > 0) {
            currentWeapon = 'pistol';
            console.log('Switched to PISTOL');
            if (knifeObject) {
                knifeObject.visible = false;
            }
        } else {
            console.log('No pistol or ammo available');
        }
    } else if (currentWeapon === 'pistol') {
        currentWeapon = 'knife';
        console.log('Switched to KNIFE');
        if (knifeObject) {
            knifeObject.visible = true;
        }
    }
    
    // Update weapon display
    updateWeaponDisplay();
}

// ============================================================================
// PLAYER UPDATE SYSTEM
// ============================================================================

/**
 * Updates player position, velocity, and collision detection each frame
 * Handles keyboard input, physics simulation, and wall collision response
 * 
 * @returns {void}
 * 
 * @description
 * Update pipeline (executed every frame):
 * 1. Input Processing: Reads WASD/arrow keys and builds input vector
 * 2. Player Rotation: Orients player mesh toward movement direction
 * 3. Physics Simulation:
 *    - Applies acceleration based on input
 *    - Adds friction for smooth deceleration
 *    - Caps velocity at PLAYER_SPEED maximum
 * 4. Collision Detection:
 *    - Tests new position against 8-point wall check
 *    - Implements sliding system for smooth corridor navigation
 *    - Prevents wall clipping with symmetric boundary testing
 * 5. Camera Tracking: Keeps top-down camera centered on player
 * 6. Exit Detection: Checks win condition proximity
 * 7. Enemy Collision: Detects contact damage from jumpers
 * 
 * Movement uses arcade-style physics with acceleration/friction for responsive feel.
 */
function updatePlayer() {
    if (!gameActive) return;
    
    const inputVector = new THREE.Vector3();
    
    // Keyboard input processing for top-down controls
    if (keys['w'] || keys['arrowup']) {
        inputVector.z -= 1;
    }
    if (keys['s'] || keys['arrowdown']) {
        inputVector.z += 1;
    }
    if (keys['a'] || keys['arrowleft']) {
        inputVector.x -= 1;
    }
    if (keys['d'] || keys['arrowright']) {
        inputVector.x += 1;
    }
    
    // Input normalization for consistent diagonal speed
    if (inputVector.length() > 0) {
        inputVector.normalize();
        
        // Rotate player mesh to face movement direction
        const angle = Math.atan2(inputVector.x, inputVector.z);
        playerMesh.rotation.y = angle;
    }
    
    // Apply acceleration-based movement physics
    player.acceleration.copy(inputVector).multiplyScalar(PLAYER_ACCELERATION);
    player.velocity.add(player.acceleration);
    
    // Apply friction for smooth stopping
    player.velocity.multiplyScalar(PLAYER_FRICTION);
    
    // Enforce maximum velocity limit
    if (player.velocity.length() > PLAYER_SPEED) {
        player.velocity.normalize().multiplyScalar(PLAYER_SPEED);
    }
    
    // Position update with collision detection
    if (player.velocity.length() > 0.001) {
        const newPosition = player.position.clone().add(player.velocity);
        
        // Play footstep sound periodically while moving - DISABLED
        const now = Date.now();
        if (now - lastFootstepTime > FOOTSTEP_INTERVAL && player.velocity.length() > 0.05) {
            // playFootstepSound(); // DISABLED
            lastFootstepTime = now;
        }
        
        // IMPROVED WALL collision detection - smoother movement in corridors
        if (!isWallAt(newPosition)) {
            // No collision, move freely
            player.position.copy(newPosition);
        } else {
            // Advanced sliding system for narrow corridors
            let moved = false;
            
            // Try X movement only (horizontal sliding)
            const slideX = player.position.clone();
            slideX.x = newPosition.x;
            if (!isWallAt(slideX)) {
                player.position.x = slideX.x;
                moved = true;
            }
            
            // Try Z movement only (vertical sliding)
            const slideZ = player.position.clone();
            slideZ.z = newPosition.z;
            if (!isWallAt(slideZ)) {
                player.position.z = slideZ.z;
                moved = true;
            }
            
            // If completely stuck, try smaller micro-movements
            if (!moved) {
                const microDistance = 0.005;
                const currentPos = player.position.clone();
                
                // Try very small movements in all directions
                const microDirections = [
                    new THREE.Vector3(microDistance, 0, 0),    // Right
                    new THREE.Vector3(-microDistance, 0, 0),   // Left  
                    new THREE.Vector3(0, 0, microDistance),    // Forward
                    new THREE.Vector3(0, 0, -microDistance),   // Back
                    new THREE.Vector3(microDistance, 0, microDistance),   // Diagonal moves
                    new THREE.Vector3(-microDistance, 0, microDistance),
                    new THREE.Vector3(microDistance, 0, -microDistance),
                    new THREE.Vector3(-microDistance, 0, -microDistance)
                ];
                
                for (const dir of microDirections) {
                    const microPos = currentPos.clone().add(dir);
                    if (!isWallAt(microPos)) {
                        player.position.copy(microPos);
                        break;
                    }
                }
            }
        }
        
        // Player rotation now happens immediately on input (see above)
        // No need to rotate based on velocity anymore
    }
    
    // Update player mesh
    playerMesh.position.copy(player.position);
    
    // Camera follows player from above
    camera.position.x = player.position.x;
    camera.position.z = player.position.z;
    camera.position.y = CAMERA_HEIGHT;
    camera.lookAt(player.position.x, 0, player.position.z);
    
    // Pistol pickup system - RE-ENABLED
    if (pistolPickup && currentWeapon === 'knife') {
        const distanceToPickup = player.position.distanceTo(pistolPickup.position);
        
        // Debug: Show distance when close
        if (distanceToPickup < 5.0) {
            // console.log(`Distance to pistol: ${distanceToPickup.toFixed(2)}`);
        }
        
        if (distanceToPickup < 2.0) { // Pickup range
            // Pick up pistol
            console.log('Pistol picked up!');
            playPickupSound();
            currentWeapon = 'pistol';
            ammoCount = 30;
            scene.remove(pistolPickup);
            pistolPickup = null;
            
            // Hide knife when using pistol
            if (knifeObject) {
                knifeObject.visible = false;
            }
            
            updateAmmoDisplay();
            updateWeaponDisplay();
        }
    }
    
    // Check collision with jumping enemies
    jumpers.forEach((jumper, index) => {
        const distance = player.position.distanceTo(jumper.position);
        
        // Survival mode with global chase: Check simple distance
        if (jumper.globalChase && gameMode === 'survival') {
            if (distance < 0.9) {
                console.log(`💀 Survival jumper ${index} killed player! Distance: ${distance.toFixed(2)}`);
                loseGame();
                return;
            }
        } else {
            // Hunt mode or non-chasing: Check if in same lane
            let inSameLane = false;
            const lane = jumper.laneInfo;
            const tolerance = 0.8; // Lane width tolerance
            
            if (jumper.patrolAxis === 'x') {
                // Horizontal lane - check if player's Z matches jumper's lane
                const playerInLaneZ = Math.abs(player.position.z - lane.fixedCoord) < tolerance;
                const playerInLaneX = player.position.x >= lane.xMin - 0.5 && player.position.x <= lane.xMax + 0.5;
                inSameLane = playerInLaneZ && playerInLaneX;
            } else {
                // Vertical lane - check if player's X matches jumper's lane
                const playerInLaneX = Math.abs(player.position.x - lane.fixedCoord) < tolerance;
                const playerInLaneZ = player.position.z >= lane.zMin - 0.5 && player.position.z <= lane.zMax + 0.5;
                inSameLane = playerInLaneX && playerInLaneZ;
            }
            
            // Only kill if in same lane AND close enough
            if (inSameLane && distance < 0.9) {
                console.log(`💀 Jumper ${index} in ${lane.name} killed player! Distance: ${distance.toFixed(2)}`);
                loseGame();
                return;
            }
        }
    });
    
    // Win condition check - different for each game mode
    if (gameMode === 'hunt') {
        // Hunt Mode: Player must kill all enemies THEN reach the UFO beam
        if (player.position.distanceTo(exit) < 1.2 && jumpers.length === 0) {
            // Player entered the beam AND killed all jumpers - trigger abduction sequence
            console.log('Player entered UFO beam - all jumpers eliminated - beginning abduction sequence!');
            
            // Stop monster spawning if somehow still active
            stopMonsterSpawning();
            
            // Make player disappear with a beam effect
            if (playerMesh && playerMesh.material) {
                playerMesh.material.transparent = true;
                
                // Fade out animation
                const fadeOut = () => {
                    if (playerMesh.material.opacity > 0) {
                        playerMesh.material.opacity -= 0.05;
                        requestAnimationFrame(fadeOut);
                    } else {
                        // Player completely disappeared
                        scene.remove(playerMesh);
                        winGame();
                    }
                };
                fadeOut();
            } else {
                winGame();
            }
        } else if (player.position.distanceTo(exit) < 1.2 && jumpers.length > 0) {
            // Near exit but enemies still alive - show warning
            if (!document.getElementById('exitWarning')) {
                const warning = document.createElement('div');
                warning.id = 'exitWarning';
                warning.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ff3333; font-size: 24px; font-family: "Metal Mania", cursive; text-align: center; text-shadow: 0 0 10px rgba(255,51,51,0.8); z-index: 1000;';
                warning.textContent = `⚠️ ELIMINATE ALL ENEMIES FIRST!\n${jumpers.length} REMAINING`;
                document.body.appendChild(warning);
                setTimeout(() => warning.remove(), 2000);
            }
        }
    } else if (gameMode === 'survival') {
        // Survival Mode: Player just needs to reach the door exit
        if (player.position.distanceTo(exit) < 2.0) {
            console.log('Player reached the door exit - escaping survival mode!');
            
            // Stop monster spawning
            stopMonsterSpawning();
            
            // Door opening effect
            if (doorMesh) {
                const doorPanels = doorMesh.children.filter(child => child.geometry && child.geometry.type === 'BoxGeometry');
                let openProgress = 0;
                const openDoor = () => {
                    if (openProgress < 1.5) {
                        openProgress += 0.05;
                        doorPanels.forEach((panel, index) => {
                            panel.position.x = index === 0 ? -0.5 - openProgress : 0.5 + openProgress;
                        });
                        requestAnimationFrame(openDoor);
                    } else {
                        // Player escapes through door
                        winGame();
                    }
                };
                openDoor();
            } else {
                winGame();
            }
        }
    }
}

// Helper function to remove the exit warning
function removeExitWarning() {
    const warning = document.getElementById('exitWarning');
    if (warning) {
        warning.remove();
    }
}

// Helper function to get lane ID from position
function getLaneId(position) {
    const gridX = Math.floor(position.x + MAZE_SIZE / 2);
    const gridZ = Math.floor(position.z + MAZE_SIZE / 2);
    return `${gridX},${gridZ}`; // Unique lane identifier
}

// Helper function to check if lane is occupied by another zombie
function isLaneOccupied(position, currentZombie) {
    const laneId = getLaneId(position);
    const occupier = occupiedLanes.get(laneId);
    return occupier && occupier !== currentZombie;
}

// Helper function to check if there's a zombie blocking the path
function isZombieBlocking(fromPos, toPos, currentZombie) {
    const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
    const distance = fromPos.distanceTo(toPos);
    
    for (let i = 0; i < zombies.length; i++) {
        const otherZombie = zombies[i];
        if (otherZombie === currentZombie) continue;
        
        // Check if other zombie is in the path
        const toOther = new THREE.Vector3().subVectors(otherZombie.position, fromPos);
        const projectionLength = toOther.dot(direction);
        
        if (projectionLength > 0 && projectionLength < distance) {
            const projection = direction.clone().multiplyScalar(projectionLength);
            const perpendicular = toOther.clone().sub(projection);
            
            // If zombie is close to the path, it's blocking
            if (perpendicular.length() < 0.8) {
                return true;
            }
        }
    }
    
    return false;
}

// Helper function to get available movement directions from current position
function getAvailableDirections(position, currentZombie = null) {
    const directions = [];
    const testDistance = 0.8;
    
    // Check all four cardinal directions for walls
    const cardinalDirs = [
        { dir: new THREE.Vector3(1, 0, 0), name: 'east' },
        { dir: new THREE.Vector3(-1, 0, 0), name: 'west' },
        { dir: new THREE.Vector3(0, 0, 1), name: 'south' },
        { dir: new THREE.Vector3(0, 0, -1), name: 'north' }   // Backward
    ];
    
    cardinalDirs.forEach(cardinalDir => {
        const testPos = position.clone().add(cardinalDir.dir.clone().multiplyScalar(testDistance));
        
        // Check wall collision
        if (isWallAtZombie(testPos)) return;
        
        // Check if another zombie is blocking this direction
        if (currentZombie && isZombieBlocking(position, testPos, currentZombie)) return;
        
        // Check if target lane is occupied
        if (currentZombie && isLaneOccupied(testPos, currentZombie)) return;
        
        directions.push(cardinalDir);
    });
    
    return directions;
}

// Helper function to find best lane direction for zombie
function getBestLaneDirection(zombie, availableDirections) {
    if (availableDirections.length === 0) return zombie.direction;
    
    let bestDirection = zombie.direction;
    let bestScore = -1;
    
    availableDirections.forEach(dirInfo => {
        let score = 0;
        
        if (zombie.state === 'chasing') {
            // When chasing, prefer direction toward player but only if path is clear
            const toPlayer = new THREE.Vector3()
                .subVectors(player.position, zombie.position)
                .normalize();
            const alignment = dirInfo.dir.dot(toPlayer);
            
            // Check if this direction leads toward player without hitting other zombies
            const testPos = zombie.position.clone().add(dirInfo.dir.clone().multiplyScalar(2));
            if (!isZombieBlocking(zombie.position, testPos, zombie)) {
                score += alignment * 2; // Bonus for moving toward player
            }
        } else {
            // When patrolling, move back and forth in lane
            const momentum = dirInfo.dir.dot(zombie.direction.clone().normalize());
            score += momentum * 1.5;
            
            // Bonus for staying in patrol lane
            if (zombie.patrolAxis === 'x' && Math.abs(dirInfo.dir.z) < 0.1) {
                score += 2.0; // Prefer X-axis movement for X patrol
            } else if (zombie.patrolAxis === 'z' && Math.abs(dirInfo.dir.x) < 0.1) {
                score += 2.0; // Prefer Z-axis movement for Z patrol
            }
        }
        
        // Bonus for directions that lead to longer corridors
        const ahead = zombie.position.clone().add(dirInfo.dir.clone().multiplyScalar(3));
        if (!isWallAtZombie(ahead) && !isLaneOccupied(ahead, zombie)) {
            score += 0.5; // Prefer longer paths
        }
        
        // Small random factor to avoid predictability
        score += (Math.random() - 0.5) * 0.2; // Reduced randomness for more predictable behavior
        
        if (score > bestScore) {
            bestScore = score;
            bestDirection = dirInfo.dir;
        }
    });
    
    return bestDirection;
}

// Helper function to check if zombie should change direction
function shouldChangeDirection(zombie) {
    // Change direction if:
    // 1. Timer expired - for regular back-and-forth movement
    if (zombie.changeDirectionTimer <= 0) return true;
    
    // 2. About to hit a wall - MUST change direction
    const ahead = zombie.position.clone().add(zombie.direction.clone().multiplyScalar(1.2)); // Look further ahead for faster zombies
    if (isWallAtZombie(ahead)) return true;
    
    // 3. Another zombie is blocking the path
    if (isZombieBlocking(zombie.position, ahead, zombie)) return true;
    
    // 4. Target lane is occupied
    if (isLaneOccupied(ahead, zombie)) return true;
    
    // 5. If stuck for too long, force direction change (faster recovery)
    if (zombie.isStuck && zombie.stuckTimer > 15) return true;
    
    return false;
}

// Helper function to remove a zombie and manage chase queue
function removeJumper(jumper, jumperIndex) {
    // Remove from scene
    scene.remove(jumper.mesh);
    
    // Handle chase queue management
    if (jumper === chasingJumper) {
        chasingJumper = null;
        // Promote next jumper from queue
        if (jumperQueue.length > 0) {
            const nextChaser = jumperQueue.shift();
            chasingJumper = nextChaser;
            nextChaser.state = 'chasing';
        }
    } else {
        // Remove from queue if it was waiting
        const queueIndex = jumperQueue.indexOf(jumper);
        if (queueIndex !== -1) {
            jumperQueue.splice(queueIndex, 1);
        }
    }
    
    // Remove from jumpers array
    jumpers.splice(jumperIndex, 1);
    
    // Update counters and award coins
    kills++;
    score += 10;
    coins += COINS_PER_KILL;  // Award coins for kill
    
    // Play coin collection sound
    playSound('coinGain');
    
    // Update UI displays and save shop data
    updateKillCount();
    updateJumperCount();
    updateCoinDisplay();
    saveShopData();  // Save coins to localStorage
    
    // Show floating coin notification
    showCoinNotification('+10 🪙');
    
    // Survival mode: Spawn 2 monsters for every 1 killed
    if (gameMode === 'survival') {
        setTimeout(() => {
            spawnSurvivalMonsters(2);
            console.log('Survival Mode: Spawned 2 new monsters after kill');
        }, 500); // Small delay before spawning
    }
    
    // Hunt mode only: Check if all jumpers are dead - VICTORY!
    if (gameMode === 'hunt' && jumpers.length === 0) {
        setTimeout(() => {
            winGame();
        }, 500);
    }
}

// Helper function to check if two positions are in the same corridor lane
function isInSameCorridorLane(pos1, pos2) {
    // Check if both positions are in the same horizontal corridor
    if (Math.abs(pos1.z - pos2.z) < 1.0) {
        // Same Z row - check if there's a clear horizontal path
        const minX = Math.min(pos1.x, pos2.x);
        const maxX = Math.max(pos1.x, pos2.x);
        
        // Check if entire horizontal path is clear
        for (let x = minX; x <= maxX; x += 0.5) {
            const testPos = new THREE.Vector3(x, pos1.y, pos1.z);
            if (isWallAt(testPos)) {
                return false; // Wall blocks the path
            }
        }
        return true;
    }
    
    // Check if both positions are in the same vertical corridor
    if (Math.abs(pos1.x - pos2.x) < 1.0) {
        // Same X column - check if there's a clear vertical path
        const minZ = Math.min(pos1.z, pos2.z);
        const maxZ = Math.max(pos1.z, pos2.z);
        
        // Check if entire vertical path is clear
        for (let z = minZ; z <= maxZ; z += 0.5) {
            const testPos = new THREE.Vector3(pos1.x, pos1.y, z);
            if (isWallAt(testPos)) {
                return false; // Wall blocks the path
            }
        }
        return true;
    }
    
    return false; // Not in same lane
}

function updateJumpers() {
    if (!gameActive) return;
    
    // Periodic logging for monitoring enemy state (once per second)
    if (Date.now() % 1000 < 16 && jumpers.length > 0) {
        console.log(`Updating ${jumpers.length} jumpers. First jumper at:`, 
            jumpers[0].mesh.position, 'Visible:', jumpers[0].mesh.visible);
    }
    
    // NOTE: We DON'T remove jumpers for being in walls since they're spawned in valid corridors
    // The wall check was causing valid jumpers to be removed incorrectly
    
    // Clear lane occupancy map
    occupiedLanes.clear();
    
    // Register current jumper positions in lanes
    jumpers.forEach(jumper => {
        const laneId = getLaneId(jumper.position);
        occupiedLanes.set(laneId, jumper);
    });
    
    // Manage jumper state - DIFFERENT BEHAVIOR for hunt vs survival mode
    jumpers.forEach((jumper, index) => {
        const distanceToPlayer = jumper.position.distanceTo(player.position);
        
        // Check if player is in jumper's lane (used by both modes)
        let playerInLane = false;
        const lane = jumper.laneInfo;
        const tolerance = 1.2;
        
        if (jumper.patrolAxis === 'x') {
            const playerInLaneZ = Math.abs(player.position.z - lane.fixedCoord) < tolerance;
            const playerInLaneX = player.position.x >= lane.xMin - 1.0 && player.position.x <= lane.xMax + 1.0;
            playerInLane = playerInLaneZ && playerInLaneX;
        } else {
            const playerInLaneX = Math.abs(player.position.x - lane.fixedCoord) < tolerance;
            const playerInLaneZ = player.position.z >= lane.zMin - 1.0 && player.position.z <= lane.zMax + 1.0;
            playerInLane = playerInLaneX && playerInLaneZ;
        }
        
        if (gameMode === 'survival') {
            // SURVIVAL MODE: They spot you in their lane and NEVER stop chasing
            if (playerInLane && jumper.state !== 'chasing') {
                jumper.state = 'chasing';
                jumper.globalChase = true;
                console.log(`👹 SURVIVAL: Jumper ${index} SPOTTED YOU in corridor ${lane.name}!`);
            }
            // Once they spot you, they NEVER give up (no return to patrol)
        } else {
            // HUNT MODE: Standard lane-based behavior
            const shouldAttack = playerInLane;
            
            if (shouldAttack && jumper.state !== 'chasing') {
                jumper.state = 'chasing';
                console.log(`🎯 Jumper ${index} in ${lane.name} ATTACKING! Distance: ${distanceToPlayer.toFixed(2)}`);
            } else if (!shouldAttack && jumper.state === 'chasing') {
                jumper.state = 'hopping';
                console.log(`👻 Jumper ${index} returning to patrol - player left ${lane.name}`);
            }
        }
    });
    
    // Update each jumper with STEP-BY-STEP JUMPING
    jumpers.forEach(jumper => {
        let targetDirection = jumper.direction.clone();
        const lane = jumper.laneInfo;
        const currentPos = jumper.patrolAxis === 'x' ? jumper.position.x : jumper.position.z;
        
        // Update jump phase for ARCADE-STYLE smooth animation
        jumper.jumpPhase += JUMP_FREQUENCY;
        
        // Arcade-style jumping with SMOOTH physics
        const jumpCycle = jumper.jumpPhase % (Math.PI * 2);
        const isInAir = jumpCycle < Math.PI * 0.6; // Shorter air time = snappier
        
        // Smooth parabolic jump arc (arcade physics)
        let jumpHeight = 0;
        if (isInAir) {
            const t = jumpCycle / (Math.PI * 0.6); // Normalize to 0-1
            jumpHeight = JUMP_HEIGHT * (4 * t * (1 - t)); // Parabola: peaks at t=0.5
        }
        
        const jumpProgress = isInAir ? jumpHeight / JUMP_HEIGHT : 0;
        
        // HOPPING: Move full length of lane with jumps
        if (jumper.state === 'hopping') {
            if (currentPos >= jumper.patrolMax - 0.3) {
                jumper.patrolDirection = -1;
            } else if (currentPos <= jumper.patrolMin + 0.3) {
                jumper.patrolDirection = 1;
            }
            
            if (jumper.patrolAxis === 'x') {
                targetDirection.set(jumper.patrolDirection, 0, 0);
            } else {
                targetDirection.set(0, 0, jumper.patrolDirection);
            }
        }
        // CHASING: Different behavior for survival vs hunt mode
        else if (jumper.state === 'chasing') {
            if (jumper.globalChase && gameMode === 'survival') {
                // SURVIVAL MODE: Navigate toward player through corridors
                // Check both axes to see which direction gets closer to player
                const canMoveX = jumper.patrolAxis === 'x';
                const canMoveZ = jumper.patrolAxis === 'z';
                
                const dx = player.position.x - jumper.position.x;
                const dz = player.position.z - jumper.position.z;
                
                // Try to move on their patrol axis first
                if (canMoveX && Math.abs(dx) > 0.5) {
                    // Move along X axis
                    targetDirection.set(dx > 0 ? 1 : -1, 0, 0);
                } else if (canMoveZ && Math.abs(dz) > 0.5) {
                    // Move along Z axis
                    targetDirection.set(0, 0, dz > 0 ? 1 : -1);
                } else {
                    // At intersection - can turn to follow player
                    // Check which axis brings us closer
                    if (Math.abs(dx) > Math.abs(dz)) {
                        // Need to move more in X direction
                        targetDirection.set(dx > 0 ? 1 : -1, 0, 0);
                        jumper.patrolAxis = 'x'; // Switch to horizontal corridor
                    } else {
                        // Need to move more in Z direction
                        targetDirection.set(0, 0, dz > 0 ? 1 : -1);
                        jumper.patrolAxis = 'z'; // Switch to vertical corridor
                    }
                }
            } else {
                // HUNT MODE: Standard lane-based chasing
                if (jumper.patrolAxis === 'x') {
                    if (player.position.x > jumper.position.x) {
                        targetDirection.set(1, 0, 0);
                    } else {
                        targetDirection.set(-1, 0, 0);
                    }
                } else {
                    if (player.position.z > jumper.position.z) {
                        targetDirection.set(0, 0, 1);
                    } else {
                        targetDirection.set(0, 0, -1);
                    }
                }
            }
        }
        // QUEUED: Slow hopping
        else if (jumper.state === 'queued') {
            if (currentPos >= jumper.patrolMax - 0.3) {
                jumper.patrolDirection = -1;
            } else if (currentPos <= jumper.patrolMin + 0.3) {
                jumper.patrolDirection = 1;
            }
            
            if (jumper.patrolAxis === 'x') {
                targetDirection.set(jumper.patrolDirection, 0, 0);
            } else {
                targetDirection.set(0, 0, jumper.patrolDirection);
            }
        }
        
        if (targetDirection.length() > 0.1) {
            jumper.direction.copy(targetDirection.normalize());
        }
        
        // Calculate movement speed - MUCH slower for survival mode
        let moveSpeed = JUMPER_SPEED;
        if (jumper.state === 'queued') {
            moveSpeed = JUMPER_SPEED * 0.7;
        } else if (jumper.globalChase && gameMode === 'survival') {
            // SURVIVAL MODE: Much slower when chasing (50% speed)
            moveSpeed = JUMPER_SPEED * 0.5;
        }
        
        // Calculate new position
        const newPosition = jumper.position.clone();
        if (jumper.direction.length() > 0.1) {
            newPosition.add(jumper.direction.clone().multiplyScalar(moveSpeed));
        }
        
        // Wall collision check for survival mode - SIMPLIFIED
        if (jumper.globalChase && gameMode === 'survival') {
            // Check if new position would be in a wall
            const mazeX = Math.floor(newPosition.x + MAZE_SIZE / 2);
            const mazeZ = Math.floor(newPosition.z + MAZE_SIZE / 2);
            
            // If hitting wall, stay in current position
            if (mazeX < 0 || mazeX >= MAZE_SIZE || mazeZ < 0 || mazeZ >= MAZE_SIZE || maze[mazeX][mazeZ] === 1) {
                newPosition.copy(jumper.position);
            }
        } else {
            // HUNT MODE: Keep them in their lanes
            if (lane) {
                if (lane.axis === 'x') {
                    newPosition.z = lane.fixedCoord;
                } else {
                    newPosition.x = lane.fixedCoord;
                }
            }
            
            // CLAMP to lane boundaries
            if (jumper.patrolAxis === 'x') {
                newPosition.x = Math.max(jumper.patrolMin, Math.min(jumper.patrolMax, newPosition.x));
            } else {
                newPosition.z = Math.max(jumper.patrolMin, Math.min(jumper.patrolMax, newPosition.z));
            }
        }
        
        // Apply step-by-step jumping - higher jumps when chasing
        const chaseMultiplier = jumper.state === 'chasing' ? 1.4 : 1.0;
        
        // Apply movement to mesh position with jump AND update position reference
        jumper.mesh.position.x = newPosition.x;
        jumper.mesh.position.z = newPosition.z;
        jumper.mesh.position.y = jumper.baseY + (jumpHeight * chaseMultiplier);
        
        // IMPORTANT: Copy back to jumper.position to keep them in sync
        jumper.position.x = newPosition.x;
        jumper.position.z = newPosition.z;
        jumper.position.y = jumper.mesh.position.y;
        
        // Rotate towards movement direction - EYES FACE FORWARD
        if (jumper.direction.length() > 0.1) {
            const angle = Math.atan2(jumper.direction.x, jumper.direction.z);
            jumper.mesh.rotation.y = angle;
        }
        
        // Simple tilt based on jump
        const tiltAmount = jumpProgress * 0.15;
        jumper.mesh.rotation.x = tiltAmount;
        
        // Keep scale normal - no squash/stretch
        jumper.mesh.scale.set(1.0, 1.0, 1.0);
        
        // Pulse the glow ring when chasing
        if (jumper.mesh.children[3]) { // The ring
            jumper.mesh.children[3].material.opacity = jumper.state === 'chasing' ? 
                0.8 + Math.sin(jumper.jumpPhase * 2) * 0.2 : 0.5;
            // Spin the ring when jumping
            jumper.mesh.children[3].rotation.z = jumper.jumpPhase * 0.5;
        }
        
        // Make eyes glow brighter when chasing
        if (jumper.mesh.children[1] && jumper.mesh.children[2]) {
            const eyeIntensity = jumper.state === 'chasing' ? 3.0 : 2.0;
            jumper.mesh.children[1].material.emissiveIntensity = eyeIntensity;
            jumper.mesh.children[2].material.emissiveIntensity = eyeIntensity;
        }
    });
}

function isWallAt(position) {
    // Convert world position to grid coordinates
    const gridX = Math.floor(position.x + MAZE_SIZE / 2);
    const gridZ = Math.floor(position.z + MAZE_SIZE / 2);
    
    // SOLID boundary - can't go outside maze
    if (gridX < 0 || gridX >= MAZE_SIZE || gridZ < 0 || gridZ >= MAZE_SIZE) {
        return true;
    }
    
    // SOLID walls - if center is in wall, blocked
    if (maze[gridX][gridZ] === 1) {
        return true;
    }
    
    // SOLID edge checking - player body can't overlap walls
    const playerGridX = position.x + MAZE_SIZE / 2;
    const playerGridZ = position.z + MAZE_SIZE / 2;
    const playerRadius = 0.35; // Increased collision radius to prevent wall clipping
    
    // Check 8 points around player (not just 4 corners) for SOLID collision
    const checkPoints = [
        { x: playerGridX - playerRadius, z: playerGridZ - playerRadius }, // SW
        { x: playerGridX + playerRadius, z: playerGridZ - playerRadius }, // SE
        { x: playerGridX - playerRadius, z: playerGridZ + playerRadius }, // NW
        { x: playerGridX + playerRadius, z: playerGridZ + playerRadius }, // NE
        { x: playerGridX - playerRadius, z: playerGridZ },                // W
        { x: playerGridX + playerRadius, z: playerGridZ },                // E
        { x: playerGridX, z: playerGridZ - playerRadius },                // S
        { x: playerGridX, z: playerGridZ + playerRadius }                 // N
    ];
    
    // Check ALL points - if ANY touches wall, SOLID block
    for (const point of checkPoints) {
        const cx = Math.floor(point.x);
        const cz = Math.floor(point.z);
        
        // Check boundaries
        if (cx < 0 || cx >= MAZE_SIZE || cz < 0 || cz >= MAZE_SIZE) {
            return true;
        }
        
        // Check walls - SOLID collision
        if (maze[cx][cz] === 1) {
            return true;
        }
    }
    
    return false;
}
// Special collision function for zombies - SOLID WALLS with visibility buffer
function isWallAtZombie(position) {
    const gridX = Math.floor(position.x + MAZE_SIZE / 2);
    const gridZ = Math.floor(position.z + MAZE_SIZE / 2);
    
    // Strict boundary checking - no clipping for zombies either
    if (gridX < 0 || gridX >= MAZE_SIZE || gridZ < 0 || gridZ >= MAZE_SIZE) {
        return true;
    }
    
    // ABSOLUTE WALL COLLISION for zombies - no wall grid occupation allowed
    if (maze[gridX][gridZ] === 1) {
        return true;
    }
    
    // Check zombie bounds against wall grid with visibility buffer
    const cellX = position.x + MAZE_SIZE / 2;
    const cellZ = position.z + MAZE_SIZE / 2;
    const zombieRadius = 0.001; // Reduced radius to allow movement in 1-cell wide corridors
    
    // Check all 4 corners of zombie bounding box with buffer
    const corners = [
        { x: cellX - zombieRadius, z: cellZ - zombieRadius }, // Bottom-left
        { x: cellX + zombieRadius, z: cellZ - zombieRadius }, // Bottom-right  
        { x: cellX - zombieRadius, z: cellZ + zombieRadius }, // Top-left
        { x: cellX + zombieRadius, z: cellZ + zombieRadius }  // Top-right
    ];
    
    for (const corner of corners) {
        const cornerGridX = Math.floor(corner.x);
        const cornerGridZ = Math.floor(corner.z);
        
        // If any corner is in bounds and hits a wall, collision detected
        if (cornerGridX >= 0 && cornerGridX < MAZE_SIZE && 
            cornerGridZ >= 0 && cornerGridZ < MAZE_SIZE) {
            if (maze[cornerGridX][cornerGridZ] === 1) {
                return true;
            }
        }
    }
    
    return false;
}

function updateStats() {
    const currentTime = Math.floor((Date.now() - gameStartTime) / 1000);
    document.getElementById('timeDisplay').textContent = currentTime + 's';
    
    const distance = player.position.distanceTo(exit).toFixed(1);
    document.getElementById('distanceDisplay').textContent = distance + 'm';
}

function updateJumperCount() {
    const jumperCountElement = document.getElementById('zombieCount');
    if (jumperCountElement) {
        jumperCountElement.textContent = jumpers.length;
        console.log('Updated jumper count display:', jumpers.length);
    } else {
        console.warn('zombieCount element not found in DOM');
    }
}

function updateKillCount() {
    const killCountElement = document.getElementById('killCount');
    if (killCountElement) {
        killCountElement.textContent = kills;
    }
    
    // Also update the game over screen kill stats
    const killStatsElement = document.getElementById('killStats');
    if (killStatsElement) {
        killStatsElement.textContent = `Kills: ${kills}`;
    }
}

/**
 * Updates the coin display in the HUD
 * Shows total coins collected from killing enemies
 * Adds a pulse animation when coins change
 * @returns {void}
 */
function updateCoinDisplay() {
    const coinCountElement = document.getElementById('coinCount');
    if (coinCountElement) {
        coinCountElement.textContent = coins;
        
        // Add pulse animation
        coinCountElement.style.animation = 'none';
        setTimeout(() => {
            coinCountElement.style.animation = 'coinPulse 0.5s ease-out';
        }, 10);
    }
    
    // Also update shop coin display
    const shopCoinDisplay = document.getElementById('shopCoinDisplay');
    if (shopCoinDisplay) {
        shopCoinDisplay.textContent = coins;
    }
}

/**
 * Shows a floating coin notification when coins are earned
 * @param {string} text - Text to display (e.g., "+10 🪙")
 * @returns {void}
 */
function showCoinNotification(text) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'coin-notification';
    notification.textContent = text;
    
    // Position in center of screen
    notification.style.position = 'fixed';
    notification.style.left = '50%';
    notification.style.top = '40%';
    notification.style.transform = 'translate(-50%, -50%)';
    notification.style.fontFamily = "'Metal Mania', cursive";
    notification.style.fontSize = '32px';
    notification.style.color = '#FFD700';
    notification.style.fontWeight = 'bold';
    notification.style.textShadow = '0 0 20px rgba(255, 215, 0, 1), 0 0 40px rgba(255, 215, 0, 0.6)';
    notification.style.pointerEvents = 'none';
    notification.style.zIndex = '9999';
    notification.style.animation = 'floatCoin 1.5s ease-out forwards';
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Remove after animation
    setTimeout(() => notification.remove(), 1500);
}

// ============================================================================
// SHOP SYSTEM FUNCTIONS
// ============================================================================

/**
 * Initializes the shop preview scene with 3D character
 * @returns {void}
 */
function initShopPreview() {
    const canvas = document.getElementById('previewCanvas');
    if (!canvas) {
        console.warn('Preview canvas not found');
        return;
    }
    
    previewRenderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        alpha: true, 
        antialias: true 
    });
    previewRenderer.setSize(280, 280);
    
    previewScene = new THREE.Scene();
    previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    previewCamera.position.set(0, 2, 5);
    previewCamera.lookAt(0, 0, 0);
    
    // Add lights
    const light1 = new THREE.DirectionalLight(0xffffff, 1);
    light1.position.set(5, 10, 5);
    previewScene.add(light1);
    
    const light2 = new THREE.AmbientLight(0x404040, 0.8);
    previewScene.add(light2);
    
    // Create preview player
    createPreviewPlayer();
    
    // Animate rotation
    function animatePreview() {
        requestAnimationFrame(animatePreview);
        if (previewPlayer) {
            previewPlayer.rotation.y += 0.01;
        }
        previewRenderer.render(previewScene, previewCamera);
    }
    animatePreview();
    
    console.log('✅ Shop preview initialized');
}

/**
 * Creates the preview player model for shop
 * @returns {void}
 */
function createPreviewPlayer() {
    previewPlayer = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4169E1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0;
    body.name = 'preview_body';
    previewPlayer.add(body);
    
    // Head
    const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xFFDBAC });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.9;
    head.name = 'preview_head';
    previewPlayer.add(head);
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 0.95, 0.28);
    leftEye.name = 'preview_eye';
    previewPlayer.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 0.95, 0.28);
    rightEye.name = 'preview_eye';
    previewPlayer.add(rightEye);
    
    // Pupils
    const pupilGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(-0.12, 0.95, 0.33);
    leftPupil.name = 'preview_pupil';
    previewPlayer.add(leftPupil);
    
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0.12, 0.95, 0.33);
    rightPupil.name = 'preview_pupil';
    previewPlayer.add(rightPupil);
    
    previewScene.add(previewPlayer);
}

/**
 * Creates a preview weapon for the shop
 * @param {Object} weaponData - Weapon cosmetic data
 * @returns {THREE.Group} Weapon group
 */
function createPreviewWeapon(weaponData) {
    const weaponGroup = new THREE.Group();
    
    const width = weaponData.width || 0.08;
    const length = weaponData.length || 0.5;
    const style = weaponData.knifeStyle;
    const color = weaponData.knifeColor;
    const glow = weaponData.knifeGlow;
    
    // For energy weapons, use the full creation functions
    if (style === 'lightsaber') {
        createLightsaber(weaponGroup, color, glow);
        weaponGroup.scale.set(1.5, 1.5, 1.5); // Make it bigger for preview
        return weaponGroup;
    }
    if (style === 'energy') {
        createEnergySword(weaponGroup, color, glow);
        weaponGroup.scale.set(1.2, 1.2, 1.2);
        return weaponGroup;
    }
    if (style === 'plasma') {
        createPlasmaCutter(weaponGroup, color, glow);
        weaponGroup.scale.set(1.3, 1.3, 1.3);
        return weaponGroup;
    }
    if (style === 'katana') {
        createKatana(weaponGroup, color, glow);
        weaponGroup.scale.set(1.2, 1.2, 1.2);
        return weaponGroup;
    }
    if (style === 'karambit') {
        createKarambit(weaponGroup, color, glow);
        weaponGroup.scale.set(1.5, 1.5, 1.5);
        return weaponGroup;
    }
    if (style === 'butterfly') {
        createButterflyKnife(weaponGroup, color, glow);
        weaponGroup.scale.set(1.4, 1.4, 1.4);
        return weaponGroup;
    }
    if (style === 'cleaver') {
        createCleaver(weaponGroup, color, glow);
        weaponGroup.scale.set(1.3, 1.3, 1.3);
        return weaponGroup;
    }
    if (style === 'batarang') {
        createBatarang(weaponGroup, color, glow);
        weaponGroup.scale.set(1.4, 1.4, 1.4);
        return weaponGroup;
    }
    
    // For standard knives, create simplified preview
    let bladeGeo;
    
    switch(style) {
        case 'machete':
            bladeGeo = new THREE.BoxGeometry(width, length, 0.03);
            break;
        case 'dagger':
            bladeGeo = new THREE.BoxGeometry(width * 0.7, length * 0.9, 0.015);
            break;
        case 'bowie':
            bladeGeo = new THREE.BoxGeometry(width, length, 0.03);
            break;
        case 'tactical':
            bladeGeo = new THREE.BoxGeometry(width, length, 0.025);
            break;
        default:
            bladeGeo = new THREE.BoxGeometry(width, length, 0.02);
    }
    
    const bladeMat = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.95,
        roughness: 0.05,
        emissive: glow,
        emissiveIntensity: 0.4
    });
    
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = length / 2;
    weaponGroup.add(blade);
    
    // Handle
    const handleLength = 0.15;
    const handleGeo = new THREE.BoxGeometry(width * 0.6, handleLength, width * 0.8);
    const handleMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.6,
        metalness: 0.3
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = -handleLength / 2;
    weaponGroup.add(handle);
    
    weaponGroup.scale.set(1.2, 1.2, 1.2); // Make all weapons bigger in preview
    
    return weaponGroup;
}

/**
 * Switches shop category tab
 * @param {string} category - Category to switch to (hats/weapons/outfits/effects)
 * @returns {void}
 */
function switchShopCategory(category) {
    currentShopCategory = category;
    
    // Update active tab
    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.category === category) {
            tab.classList.add('active');
        }
    });
    
    // Render items for this category
    renderCosmeticItems();
    
    // Update preview to show/hide weapon
    updatePreviewPlayer();
}

/**
 * Renders cosmetic items for current category
 * @returns {void}
 */
function renderCosmeticItems() {
    const grid = document.getElementById('cosmeticGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    let items = {};
    if (currentShopCategory === 'hats') items = HATS;
    else if (currentShopCategory === 'weapons') items = WEAPONS;
    else if (currentShopCategory === 'outfits') items = OUTFITS;
    else if (currentShopCategory === 'effects') items = EFFECTS;
    
    // Convert to array for filtering/sorting
    let itemArray = Object.values(items);
    
    // Apply search filter
    const searchTerm = document.getElementById('shopSearch')?.value.toLowerCase() || '';
    if (searchTerm) {
        itemArray = itemArray.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.icon.includes(searchTerm)
        );
    }
    
    // Apply rarity filter
    const rarityFilter = document.getElementById('shopRarityFilter')?.value || 'all';
    if (rarityFilter !== 'all') {
        itemArray = itemArray.filter(item => item.rarity === rarityFilter);
    }
    
    // Apply sort
    const sortBy = document.getElementById('shopSort')?.value || 'default';
    switch(sortBy) {
        case 'price-low':
            itemArray.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            itemArray.sort((a, b) => b.price - a.price);
            break;
        case 'rarity':
            const rarityOrder = { 'legendary': 0, 'epic': 1, 'rare': 2, 'common': 3 };
            itemArray.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);
            break;
        case 'name':
            itemArray.sort((a, b) => a.name.localeCompare(b.name));
            break;
    }
    
    // Render items
    for (const cosmetic of itemArray) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cosmetic-item';
        
        // Add rarity attribute for CSS styling
        if (cosmetic.rarity) {
            itemDiv.setAttribute('data-rarity', cosmetic.rarity);
        }
        
        // Check if owned/equipped
        const categoryKey = currentShopCategory.slice(0, -1); // Remove 's'
        const isEquipped = equippedCosmetics[categoryKey] === cosmetic.id;
        const isOwned = purchasedCosmetics.has(cosmetic.id);
        const canAfford = coins >= cosmetic.price;
        
        if (isEquipped) itemDiv.classList.add('equipped');
        else if (isOwned) itemDiv.classList.add('owned');
        else if (!canAfford && cosmetic.price > 0) itemDiv.classList.add('locked');
        
        itemDiv.innerHTML = `
            <div class="cosmetic-icon">${cosmetic.icon}</div>
            <div class="cosmetic-name">${cosmetic.name}</div>
            ${cosmetic.price > 0 ? `<div class="cosmetic-price">🪙 ${cosmetic.price}</div>` : '<div class="cosmetic-price">FREE</div>'}
            <div class="cosmetic-badge"></div>
        `;
        
        itemDiv.onclick = () => selectCosmetic(cosmetic, currentShopCategory);
        grid.appendChild(itemDiv);
    }
    
    // Update filter stats
    updateFilterStats();
}

/**
 * Selects a cosmetic (purchases if needed, then equips)
 * @param {Object} cosmetic - Cosmetic object to select
 * @param {string} category - Category of cosmetic
 * @returns {void}
 */
function selectCosmetic(cosmetic, category) {
    const categoryKey = category.slice(0, -1); // Remove 's' from 'hats' -> 'hat'
    
    // If not owned and not free
    if (!purchasedCosmetics.has(cosmetic.id) && cosmetic.price > 0) {
        if (coins >= cosmetic.price) {
            coins -= cosmetic.price;
            purchasedCosmetics.add(cosmetic.id);
            updateCoinDisplay();
            console.log(`✅ Purchased ${cosmetic.name} for ${cosmetic.price} coins`);
        } else {
            console.log(`❌ Not enough coins! Need ${cosmetic.price}, have ${coins}`);
            return;
        }
    }
    
    // Equip the cosmetic
    equippedCosmetics[categoryKey] = cosmetic.id;
    updatePreviewPlayer();
    updatePreviewStats();
    renderCosmeticItems();
    updateFilterStats();
    saveShopData();
}

/**
 * Applies search/filter to cosmetic items
 * @returns {void}
 */
function applySearchFilter() {
    renderCosmeticItems();
    updateFilterStats();
}

/**
 * Applies sort to cosmetic items
 * @returns {void}
 */
function applySortFilter() {
    renderCosmeticItems();
}

/**
 * Applies rarity filter
 * @returns {void}
 */
function applyRarityFilter() {
    renderCosmeticItems();
    updateFilterStats();
}

/**
 * Updates filter statistics
 * @returns {void}
 */
function updateFilterStats() {
    let items = {};
    if (currentShopCategory === 'hats') items = HATS;
    else if (currentShopCategory === 'weapons') items = WEAPONS;
    else if (currentShopCategory === 'outfits') items = OUTFITS;
    else if (currentShopCategory === 'effects') items = EFFECTS;
    
    const itemArray = Object.values(items);
    const searchTerm = document.getElementById('shopSearch')?.value.toLowerCase() || '';
    const rarityFilter = document.getElementById('shopRarityFilter')?.value || 'all';
    
    // Apply filters
    const filteredItems = itemArray.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm);
        const matchesRarity = rarityFilter === 'all' || item.rarity === rarityFilter;
        return matchesSearch && matchesRarity;
    });
    
    const ownedCount = filteredItems.filter(item => purchasedCosmetics.has(item.id)).length;
    
    // Update stats display
    const itemCountEl = document.getElementById('itemCount');
    const ownedCountEl = document.getElementById('ownedCount');
    
    if (itemCountEl) itemCountEl.textContent = `${filteredItems.length} items`;
    if (ownedCountEl) ownedCountEl.textContent = `${ownedCount} owned`;
}

/**
 * Updates the preview player with equipped cosmetics
 * @returns {void}
 */
function updatePreviewPlayer() {
    if (!previewPlayer) return;
    
    // Get currently equipped cosmetics
    const hat = HATS[equippedCosmetics.hat];
    const weapon = WEAPONS[equippedCosmetics.weapon];
    const outfit = OUTFITS[equippedCosmetics.outfit];
    const effect = EFFECTS[equippedCosmetics.effect];
    
    // Hide/show character based on category
    if (currentShopCategory === 'weapons') {
        // Hide the character when viewing weapons
        previewPlayer.children.forEach(child => {
            if (child.name === 'preview_body' || child.name === 'preview_head' || 
                child.name === 'preview_eye' || child.name === 'preview_pupil') {
                child.visible = false;
            }
        });
    } else {
        // Show the character for other categories
        previewPlayer.children.forEach(child => {
            if (child.name === 'preview_body' || child.name === 'preview_head' || 
                child.name === 'preview_eye' || child.name === 'preview_pupil') {
                child.visible = true;
            }
        });
    }
    
    // Remove old accessories
    const oldAccessory = previewPlayer.getObjectByName('preview_accessory');
    if (oldAccessory) previewPlayer.remove(oldAccessory);
    
    // Remove old face accessory
    const oldFaceAccessory = previewPlayer.getObjectByName('preview_face_accessory');
    if (oldFaceAccessory) previewPlayer.remove(oldFaceAccessory);
    
    // Remove old weapon preview
    const oldWeapon = previewPlayer.getObjectByName('preview_weapon');
    if (oldWeapon) previewPlayer.remove(oldWeapon);
    
    // Add weapon preview (show weapon prominently in center)
    if (weapon && currentShopCategory === 'weapons') {
        const weaponPreview = createPreviewWeapon(weapon);
        if (weaponPreview) {
            weaponPreview.name = 'preview_weapon';
            weaponPreview.scale.set(2.2, 2.2, 2.2); // Larger for better visibility
            weaponPreview.position.set(0, 0, 0); // Centered at origin
            weaponPreview.rotation.set(0, Math.PI / 4, Math.PI / 8); // Angled for 3D view
            previewPlayer.add(weaponPreview);
        }
    }
    
    // Add new accessory (hat) if not "none" - but NOT when viewing weapons
    if (hat && hat.accessory !== 'none' && currentShopCategory !== 'weapons') {
        let accessory = null;
        switch(hat.accessory) {
            case 'military_cap':
                accessory = createMilitaryCap(hat.accessoryColor);
                break;
            case 'police_cap':
                accessory = createPoliceCap(hat.accessoryColor, hat.badgeColor);
                break;
            case 'tactical_mask':
                accessory = createTacticalMask(hat.accessoryColor);
                break;
            case 'headlamp':
                accessory = createHeadlamp(hat.accessoryColor, hat.lampColor);
                break;
            case 'welding_goggles':
                accessory = createWeldingGoggles(hat.accessoryColor, hat.lensColor);
                break;
            case 'cowl_mask':
                accessory = createCowlMask(hat.accessoryColor);
                break;
            case 'combat_helmet':
                accessory = createCombatHelmet(hat.accessoryColor, hat.visorColor);
                break;
            case 'fedora_sunglasses':
                accessory = createFedoraSunglasses(hat.accessoryColor, hat.glassesColor);
                break;
            case 'santa_hat':
                accessory = createSantaHat(hat.accessoryColor);
                break;
            case 'wizard_hat':
                accessory = createWizardHat(hat.accessoryColor);
                break;
            case 'crown':
                accessory = createCrown(hat.accessoryColor);
                break;
            case 'angel_halo':
                accessory = createAngelHalo(hat.accessoryColor);
                break;
            case 'devil_horns':
                accessory = createDevilHorns(hat.accessoryColor);
                break;
        }
        if (accessory) {
            accessory.name = 'preview_accessory';
            previewPlayer.add(accessory);
        }
    }
    
    // Add face accessory if selected
    if (outfit && outfit.faceAccessory && outfit.faceAccessory !== 'none') {
        const faceGroup = new THREE.Group();
        faceGroup.name = 'preview_face_accessory';
        
        switch(outfit.faceAccessory) {
            case 'glasses':
                const lensGeo = new THREE.BoxGeometry(0.14, 0.12, 0.02);
                const glassMat = new THREE.MeshStandardMaterial({
                    color: outfit.glassesColor,
                    transparent: true,
                    opacity: 0.7,
                    metalness: 0.5
                });
                
                const leftLens = new THREE.Mesh(lensGeo, glassMat);
                leftLens.position.set(-0.12, 0.95, 0.35);
                faceGroup.add(leftLens);
                
                const rightLens = new THREE.Mesh(lensGeo, glassMat);
                rightLens.position.set(0.12, 0.95, 0.35);
                faceGroup.add(rightLens);
                break;
                
            case 'glowingeyes':
                const eyeGlowGeo = new THREE.SphereGeometry(0.09, 12, 12);
                const eyeGlowMat = new THREE.MeshStandardMaterial({
                    color: outfit.eyeGlowColor,
                    emissive: outfit.eyeGlowColor,
                    emissiveIntensity: 1.5
                });
                
                const leftGlow = new THREE.Mesh(eyeGlowGeo, eyeGlowMat);
                leftGlow.position.set(-0.12, 0.95, 0.33);
                faceGroup.add(leftGlow);
                
                const rightGlow = new THREE.Mesh(eyeGlowGeo, eyeGlowMat);
                rightGlow.position.set(0.12, 0.95, 0.33);
                faceGroup.add(rightGlow);
                break;
                
            case 'thirdeye':
                const thirdEyeGeo = new THREE.SphereGeometry(0.06, 12, 12);
                const thirdEyeMat = new THREE.MeshStandardMaterial({
                    color: outfit.thirdEyeColor,
                    emissive: outfit.thirdEyeColor,
                    emissiveIntensity: 1.2
                });
                const thirdEye = new THREE.Mesh(thirdEyeGeo, thirdEyeMat);
                thirdEye.position.set(0, 1.05, 0.35);
                faceGroup.add(thirdEye);
                break;
        }
        
        previewPlayer.add(faceGroup);
    }
}

/**
 * Updates preview stats display
 * @returns {void}
 */
function updatePreviewStats() {
    const hatEl = document.getElementById('previewHat');
    const weaponEl = document.getElementById('previewWeapon');
    const outfitEl = document.getElementById('previewOutfit');
    const effectEl = document.getElementById('previewEffect');
    
    if (hatEl) hatEl.textContent = HATS[equippedCosmetics.hat].name;
    if (weaponEl) weaponEl.textContent = WEAPONS[equippedCosmetics.weapon].name;
    if (outfitEl) outfitEl.textContent = OUTFITS[equippedCosmetics.outfit].name;
    if (effectEl) effectEl.textContent = EFFECTS[equippedCosmetics.effect].name;
}

/**
 * Toggles the shop UI visibility
 * @returns {void}
 */
function toggleShop() {
    shopOpen = !shopOpen;
    const shopModal = document.getElementById('shopModal');
    if (shopModal) {
        if (shopOpen) {
            shopModal.classList.add('show');
            // Initialize with hats category
            if (!currentShopCategory) currentShopCategory = 'hats';
            switchShopCategory(currentShopCategory);
            updateCoinDisplay();
            updatePreviewStats();
            if (!previewScene) initShopPreview();
            
            // Setup search/filter event listeners (only once)
            if (!shopModal.hasAttribute('data-listeners-added')) {
                const searchInput = document.getElementById('shopSearch');
                if (searchInput) {
                    searchInput.addEventListener('input', applySearchFilter);
                }
                shopModal.setAttribute('data-listeners-added', 'true');
            }
        } else {
            shopModal.classList.remove('show');
            // Apply equipped cosmetics to actual player
            applyEquippedCosmetics();
        }
    }
}

/**
 * Applies equipped cosmetics to the actual player in-game
 * @returns {void}
 */
function applyEquippedCosmetics() {
    if (!playerMesh) {
        console.warn('Cannot apply cosmetics: playerMesh not found');
        return;
    }
    
    // Migration: replace old outfit IDs with new default
    const oldOutfitIds = ['default_blue', 'default_skin', 'pale_skin', 'tan_skin', 'dark_skin', 
                          'zombie_green', 'alien_gray', 'robot_chrome', 'vampire_pale', 
                          'demon_red', 'golden_statue', 'ice_blue', 'rainbow_shift',
                          'basic_glasses', 'sunglasses', 'eye_patch', 'nerd_glasses',
                          'red_eyes', 'blue_visor', 'monocle', 'scar', 'face_paint',
                          'golden_eyes', 'third_eye', 'blue_aura', 'green_aura', 'red_aura',
                          'purple_aura', 'fire_glow', 'ice_glow', 'toxic_glow', 'shadow_aura',
                          'golden_radiance', 'plasma_energy', 'cosmic_power', 'rainbow_energy'];
    if (oldOutfitIds.includes(equippedCosmetics.outfit)) {
        console.log(`Migrating old outfit '${equippedCosmetics.outfit}' to 'none'`);
        equippedCosmetics.outfit = 'none';
        saveShopData();
    }
    
    const hat = HATS[equippedCosmetics.hat];
    const weapon = WEAPONS[equippedCosmetics.weapon];
    const outfit = OUTFITS[equippedCosmetics.outfit];
    const effect = EFFECTS[equippedCosmetics.effect];
    
    // Safety check - if any cosmetic is undefined, use defaults
    if (!hat || !weapon || !outfit || !effect) {
        console.error('Invalid cosmetic detected, resetting to defaults');
        if (!hat) equippedCosmetics.hat = 'none';
        if (!weapon) equippedCosmetics.weapon = 'standard';
        if (!outfit) equippedCosmetics.outfit = 'none';
        if (!effect) equippedCosmetics.effect = 'none';
        saveShopData();
        return applyEquippedCosmetics(); // Retry with defaults
    }
    
    console.log('Applying equipped cosmetics:', {
        hat: hat.name,
        weapon: weapon.name,
        outfit: outfit.name,
        effect: effect.name
    });
    
    // Remove old accessories and trail
    removePlayerAccessory();
    removePlayerTrail();
    
    // Add new accessory (hat) if not "none"
    if (hat.accessory !== 'none') {
        addPlayerAccessory(hat.accessory, hat);
    }
    
    // Add trail effect if selected
    if (effect.trailColor) {
        addPlayerTrail(effect.trailColor, effect.trailIntensity, effect.rainbow);
    }
    
    // Update weapon (knife) based on equipped weapon cosmetic
    if (currentWeapon === 'knife') {
        createKnife(weapon.knifeStyle, weapon.knifeColor, weapon.knifeGlow);
    }
    
    console.log('✅ Applied equipped cosmetics to player');
}

/**
 * DEPRECATED: Body decorations removed in favor of particle trails
 * Removes existing body decorations
 */
/*
function removeBodyDecorations() {
    if (!playerMesh) return;
    
    const decorations = playerMesh.children.filter(child => child.name === 'bodyDecoration');
    decorations.forEach(decoration => playerMesh.remove(decoration));
}
*/

/**
 * DEPRECATED: Body decorations removed in favor of particle trails
 * Adds body decorations based on avatar
 */
/*
function addBodyDecorations(avatar) {
    if (!playerMesh) return;
    
    // Shoulder badges (Police)
    if (avatar.shoulderBadges) {
        const badgeGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 6);
        const badgeMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            metalness: 0.95,
            roughness: 0.1,
            emissive: 0xFFD700,
            emissiveIntensity: 0.3
        });
        
        const leftBadge = new THREE.Mesh(badgeGeometry, badgeMaterial);
        leftBadge.position.set(-0.25, 0.6, 0);
        leftBadge.rotation.z = Math.PI / 2;
        leftBadge.name = 'bodyDecoration';
        playerMesh.add(leftBadge);
        
        const rightBadge = new THREE.Mesh(badgeGeometry, badgeMaterial);
        rightBadge.position.set(0.25, 0.6, 0);
        rightBadge.rotation.z = Math.PI / 2;
        rightBadge.name = 'bodyDecoration';
        playerMesh.add(rightBadge);
    }
    
    // Cyber lines (Stealth)
    if (avatar.cyberLines) {
        for (let i = 0; i < 4; i++) {
            const lineGeometry = new THREE.BoxGeometry(0.35, 0.02, 0.02);
            const lineMaterial = new THREE.MeshStandardMaterial({
                color: 0xFF0000,
                emissive: 0xFF0000,
                emissiveIntensity: 0.8
            });
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.position.set(0, 0.2 + (i * 0.15), 0.22);
            line.name = 'bodyDecoration';
            playerMesh.add(line);
        }
    }
    
    // Medical cross (Medic)
    if (avatar.medicalCross) {
        const crossH = new THREE.BoxGeometry(0.15, 0.03, 0.03);
        const crossV = new THREE.BoxGeometry(0.03, 0.15, 0.03);
        const crossMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF0000,
            emissive: 0xFF0000,
            emissiveIntensity: 0.4
        });
        
        const crossH1 = new THREE.Mesh(crossH, crossMaterial);
        crossH1.position.set(0, 0.5, 0.22);
        crossH1.name = 'bodyDecoration';
        playerMesh.add(crossH1);
        
        const crossV1 = new THREE.Mesh(crossV, crossMaterial);
        crossV1.position.set(0, 0.5, 0.22);
        crossV1.name = 'bodyDecoration';
        playerMesh.add(crossV1);
    }
    
    // Tech panels (Engineer)
    if (avatar.techPanels) {
        for (let i = 0; i < 3; i++) {
            const panelGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.02);
            const panelMaterial = new THREE.MeshStandardMaterial({
                color: 0xFF8C00,
                emissive: 0xFFD700,
                emissiveIntensity: 0.5,
                metalness: 0.8
            });
            const panel = new THREE.Mesh(panelGeometry, panelMaterial);
            panel.position.set((i - 1) * 0.15, 0.4, 0.22);
            panel.name = 'bodyDecoration';
            playerMesh.add(panel);
        }
    }
    
    // Bat symbol (Superhero)
    if (avatar.batSymbol) {
        const batGeometry = new THREE.BoxGeometry(0.2, 0.12, 0.03);
        const batMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            emissive: 0xFFD700,
            emissiveIntensity: 0.6
        });
        const batSymbol = new THREE.Mesh(batGeometry, batMaterial);
        batSymbol.position.set(0, 0.5, 0.23);
        batSymbol.name = 'bodyDecoration';
        playerMesh.add(batSymbol);
        
        // Bat wings
        const wingGeometry = new THREE.ConeGeometry(0.08, 0.12, 3);
        const leftWing = new THREE.Mesh(wingGeometry, batMaterial);
        leftWing.position.set(-0.12, 0.5, 0.23);
        leftWing.rotation.z = -Math.PI / 6;
        leftWing.name = 'bodyDecoration';
        playerMesh.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeometry, batMaterial);
        rightWing.position.set(0.12, 0.5, 0.23);
        rightWing.rotation.z = Math.PI / 6;
        rightWing.name = 'bodyDecoration';
        playerMesh.add(rightWing);
    }
    
    // Armor plates (Elite Commander)
    if (avatar.armorPlates) {
        for (let i = 0; i < 3; i++) {
            const plateGeometry = new THREE.BoxGeometry(0.25, 0.08, 0.03);
            const plateMaterial = new THREE.MeshStandardMaterial({
                color: 0xFFD700,
                metalness: 0.95,
                roughness: 0.1,
                emissive: 0xFF00FF,
                emissiveIntensity: 0.2
            });
            const plate = new THREE.Mesh(plateGeometry, plateMaterial);
            plate.position.set(0, 0.25 + (i * 0.15), 0.23);
            plate.name = 'bodyDecoration';
            playerMesh.add(plate);
        }
    }
    
    // Power core (Elite Commander)
    if (avatar.powerCore) {
        const coreGeometry = new THREE.SphereGeometry(0.08, 12, 12);
        const coreMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF00FF,
            emissive: 0xFF00FF,
            emissiveIntensity: 1.2,
            transparent: true,
            opacity: 0.8
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.position.set(0, 0.5, 0.25);
        core.name = 'bodyDecoration';
        playerMesh.add(core);
    }
}
*/

/**
 * Saves shop data to localStorage
 * @returns {void}
 */
function saveShopData() {
    try {
        const shopData = {
            coins: coins,
            equippedCosmetics: equippedCosmetics,
            purchasedCosmetics: Array.from(purchasedCosmetics)
        };
        localStorage.setItem('zyrath_shop_data', JSON.stringify(shopData));
    } catch (error) {
        console.warn('Failed to save shop data:', error);
    }
}

/**
 * Loads shop data from localStorage
 * @returns {void}
 */
function loadShopData() {
    try {
        const saved = localStorage.getItem('zyrath_shop_data');
        if (saved) {
            const shopData = JSON.parse(saved);
            coins = shopData.coins || 0;
            equippedCosmetics = shopData.equippedCosmetics || { 
                hat: 'none', 
                weapon: 'standard', 
                outfit: 'none', 
                effect: 'none' 
            };
            purchasedCosmetics = new Set(shopData.purchasedCosmetics || ['none', 'standard']);
            
            // Migration: Fix old outfit IDs (skins) to new system (face accessories)
            const oldSkinIds = ['default_skin', 'pale_skin', 'tan_skin', 'dark_skin', 'zombie_green', 
                               'alien_gray', 'robot_chrome', 'vampire_pale', 'demon_red', 'golden_statue', 
                               'ice_blue', 'rainbow_shift', 'default_blue'];
            if (oldSkinIds.includes(equippedCosmetics.outfit)) {
                equippedCosmetics.outfit = 'none';
            }
            oldSkinIds.forEach(id => {
                if (purchasedCosmetics.has(id)) {
                    purchasedCosmetics.delete(id);
                }
            });
            
            console.log('Shop data loaded:', shopData);
            
            // Update displays
            updateCoinDisplay();
            if (playerMesh) {
                applyEquippedCosmetics();
            }
        }
    } catch (error) {
        console.warn('Failed to load shop data:', error);
    }
}


function winGame() {
    if (!gameActive) return;
    
    console.log('Game Won!');
    gameActive = false;
    const finalTime = Math.floor((Date.now() - gameStartTime) / 1000);
    
    // Stop background music
    stopBackgroundMusic();
    
    // Stop monster spawning in survival mode
    stopMonsterSpawning();
    
    // Stop the game animation
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    // Victory screen with mode-specific messages
    const gameOverElement = document.getElementById('gameOver');
    const titleElement = document.getElementById('gameOverTitle');
    const survivalTimeElement = document.getElementById('survivalTime');
    const killStatsElement = document.getElementById('killStats');
    
    if (gameMode === 'hunt') {
        // Hunt Mode victory message
        if (titleElement) {
            titleElement.textContent = 'ABDUCTED & RESCUED';
            titleElement.style.color = '#0088ff';
        }
        if (survivalTimeElement) survivalTimeElement.textContent = `Survived: ${finalTime}s`;
        if (killStatsElement) killStatsElement.textContent = `Kills: ${kills} | Escaped via UFO`;
    } else if (gameMode === 'survival') {
        // Survival Mode victory message
        if (titleElement) {
            titleElement.textContent = 'ESCAPED ALIVE!';
            titleElement.style.color = '#00ff00';
        }
        if (survivalTimeElement) survivalTimeElement.textContent = `Survived: ${finalTime}s`;
        if (killStatsElement) killStatsElement.textContent = `Kills: ${kills} | Escaped through the door`;
    }
    
    // Force show the victory screen
    if (gameOverElement) {
        gameOverElement.classList.add('show');
        gameOverElement.style.display = 'block';
    }
    
    console.log('Victory screen displayed');
}

function loseGame() {
    if (!gameActive) return;
    
    console.log('Game Over - Player killed by zombie!');
    gameActive = false;
    const finalTime = Math.floor((Date.now() - gameStartTime) / 1000);
    
    // Stop background music
    stopBackgroundMusic();
    
    // Stop monster spawning in survival mode
    stopMonsterSpawning();
    
    // Play enemy eating sound on death (first 4 seconds only)
    playSound('enemyEat');
    
    // Stop the game animation
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    // Death screen
    const gameOverElement = document.getElementById('gameOver');
    const titleElement = document.getElementById('gameOverTitle');
    const survivalTimeElement = document.getElementById('survivalTime');
    const killStatsElement = document.getElementById('killStats');
    
    if (titleElement) {
        titleElement.textContent = 'DEVOURED';
        titleElement.style.color = '#ff0000';
    }
    if (survivalTimeElement) survivalTimeElement.textContent = `Survived: ${finalTime}s`;
    if (killStatsElement) {
        const modeText = gameMode === 'survival' ? '(Survival Mode)' : '(Hunt Mode)';
        killStatsElement.textContent = `Kills: ${kills} ${modeText}`;
    }
    
    // Force show the game over screen
    if (gameOverElement) {
        gameOverElement.classList.add('show');
        gameOverElement.style.display = 'block';
    }
    
    console.log('Game over screen should be visible now');
}

function restartGame() {
    console.log('Restart initiated: Resetting game state and scene...');
    
    // Phase 1: Terminate current game session
    gameActive = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    // Phase 2: Hide game over UI
    const gameOverEl = document.getElementById('gameOver');
    if (gameOverEl) {
        gameOverEl.classList.remove('show');
        gameOverEl.style.display = 'none';
    }
    
    // Phase 3: Reset game state variables
    gameStartTime = Date.now();
    mouseX = 0;
    mouseY = 0;
    ammoCount = 30;
    kills = 0;
    score = 0;
    // DON'T reset coins - they persist between games for shop purchases
    currentWeapon = 'knife';
    flashlightOn = false;
    lastShotTime = 0;
    lastZombieGroanTime = 0;
    lastFootstepTime = 0;
    
    // Phase 4: Clear enemy AI state
    chasingJumper = null;
    jumperQueue = [];
    occupiedLanes.clear();
    
    // Phase 5: Remove active projectiles
    bullets.forEach(bullet => {
        if (bullet.mesh) {
            scene.remove(bullet.mesh);
        }
    });
    bullets = [];
    
    // Phase 6: Clear scene of game objects
    if (playerMesh) {
        scene.remove(playerMesh);
        playerMesh = null;
    }
    if (exitMesh) {
        scene.remove(exitMesh);
        exitMesh = null;
    }
    if (doorMesh) {
        scene.remove(doorMesh);
        doorMesh = null;
    }
    if (pistolPickup) {
        scene.remove(pistolPickup);
        pistolPickup = null;
    }
    
    // Clear jumping enemies
    jumpers.forEach(jumper => {
        if (jumper.mesh) {
            scene.remove(jumper.mesh);
        }
    });
    jumpers = [];
    
    // Clear walls
    mazeWalls.forEach(wall => {
        scene.remove(wall);
    });
    mazeWalls = [];
    
    console.log('Scene cleanup complete: All previous game objects removed');
    
    // Phase 7: Regenerate game world
    console.log('Regenerating maze and spawning entities...');
    generateMaze();
    createWalls();
    createPlayer();
    
    // Mode-specific setup (same as startGame)
    if (gameMode === 'hunt') {
        createExit();
        createJumpers();
    } else if (gameMode === 'survival') {
        createDoorExit();
        createJumpers();
    }
    
    // Recreate pistol pickup
    createPistolPickup();
    
    // Phase 8: Reset player to spawn position
    const startX = -MAZE_SIZE / 2 + 1.5;
    const startZ = -MAZE_SIZE / 2 + 1.5;
    
    if (player) {
        player.position.set(startX, PLAYER_HEIGHT, startZ);
        player.velocity.set(0, 0, 0);
        player.acceleration.set(0, 0, 0);
        player.rotation = 0;
        console.log('Player logical state reset to spawn position:', player.position);
    }
    
    if (playerMesh) {
        playerMesh.position.set(startX, PLAYER_HEIGHT, startZ);
        playerMesh.rotation.set(0, 0, 0);
        console.log('✅ Player mesh position reset to:', playerMesh.position);
    }
    
    // Phase 9: Reset camera positioning
    if (camera) {
        camera.position.set(startX, CAMERA_HEIGHT, startZ);
        camera.lookAt(startX, 0, startZ);
        console.log('Camera repositioned to track player');
    }
    
    // Phase 10: Reset lighting systems
    if (flashlight) {
        flashlight.visible = false;
        flashlightOn = false;
    }
    
    // Phase 11: Update HUD displays
    updateAmmoDisplay();
    updateKillsDisplay();
    updateJumperCount();
    updateWeaponDisplay();
    updateFlashlightDisplay();
    updateCoinDisplay();  // Update coin display (coins persist between games)
    
    // Re-apply current cosmetics after player recreation
    applyEquippedCosmetics();
    
    // STEP 12: Resume background music if it was playing
    if (bgmStarted && audioSystemReady && soundEffects.bgm) {
        soundEffects.bgm.play().catch(err => console.warn('Could not resume BGM:', err));
        console.log('✅ Background music resumed');
    }
    
    // STEP 13: Restart the game
    gameActive = true;
    console.log('✅ Game state set to active');
    
    // STEP 14: Restart animation loop if it's not running
    if (!animationId) {
        animate();
        console.log('✅ Animation loop restarted');
    }
    
    console.log('🎉 GAME RESTART COMPLETE! Player should be at starting position.');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================================
// GAME LOOP WITH 60 FPS CAP
// ============================================================================

/** @type {number} Target frame rate (frames per second) */
const TARGET_FPS = 60;

/** @const {number} Target frame duration (milliseconds) */
const FRAME_DURATION = 1000 / TARGET_FPS;

/** @type {number} Timestamp of last frame render */
let lastFrameTime = 0;

/**
 * Main game loop with 60 FPS cap
 * Uses delta time to ensure consistent frame rate
 * @returns {void}
 */
function animate() {
    animationId = requestAnimationFrame(animate);
    
    // 60 FPS frame rate limiting
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTime;
    
    // Skip frame if not enough time has passed
    if (deltaTime < FRAME_DURATION) {
        return;
    }
    
    // Update last frame time (with correction for drift)
    lastFrameTime = currentTime - (deltaTime % FRAME_DURATION);
    
    // Update game systems
    updatePlayer();
    updateJumpers();
    updateBullets();
    updateStats();
    updateTrailParticles(); // Update particle trail effect
    
    // Periodic jumper sounds - DISABLED
    const now = Date.now();
    if (jumpers.length > 0 && now - lastZombieGroanTime > ZOMBIE_GROAN_INTERVAL) {
        const randomJumper = jumpers[Math.floor(Math.random() * jumpers.length)];
        // playZombieGroanSound(randomJumper.position); // DISABLED
        lastZombieGroanTime = now;
    }
    
    // Animate UFO (floating and rotating)
    if (exitMesh) {
        exitMesh.userData.time += 0.02;
        
        // Floating motion
        exitMesh.position.y = exitMesh.userData.originalY + Math.sin(exitMesh.userData.time) * 1.5;
        
        // Slow rotation
        exitMesh.rotation.y += 0.01;
        
        // Pulsating beam effect
        const beamIntensity = 0.5 + Math.sin(exitMesh.userData.time * 2) * 0.3;
        const beamChildren = exitMesh.children.filter(child => 
            child.material && (child.material.color.getHex() === 0x0088ff || child.material.emissive.getHex() === 0x0066cc)
        );
        beamChildren.forEach(child => {
            if (child.material.emissive) {
                child.material.emissiveIntensity = beamIntensity;
            }
            if (child.material.opacity !== undefined) {
                child.material.opacity = 0.3 + beamIntensity * 0.4;
            }
        });
        
        // Rotating rim lights
        const rimLights = exitMesh.children.filter(child => 
            child.material && child.material.emissive.getHex() === 0xffffff
        );
        rimLights.forEach((light, index) => {
            const lightIntensity = 0.8 + Math.sin(exitMesh.userData.time * 3 + index) * 0.2;
            light.material.emissiveIntensity = lightIntensity;
        });
    }
    
    // Animate pistol pickup (spinning and bobbing) - Enhanced
    if (pistolPickup) {
        pistolPickup.rotation.y += 0.04; // Faster spin for attention
        pistolPickup.position.y = 0.5 + Math.sin(Date.now() * 0.005) * 0.2; // More dramatic bobbing
        
        // Pulsating rings
        const rings = pistolPickup.children.filter(child => 
            child.geometry && child.geometry.type === 'TorusGeometry'
        );
        rings.forEach((ring, index) => {
            const pulseFactor = 1 + Math.sin(Date.now() * 0.008 + index) * 0.1;
            ring.scale.set(pulseFactor, pulseFactor, pulseFactor);
        });
    }
    
    renderer.render(scene, camera);
}

// Start the game when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
