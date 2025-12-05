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
let exit, exitMesh;

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

// ============================================================================
// GAME CONFIGURATION CONSTANTS
// ============================================================================

// Player Movement Settings
/** @const {number} Maximum player movement speed (units per frame) */
const PLAYER_SPEED = 0.08;

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
const CAMERA_HEIGHT = 12;

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
        scene.background = new THREE.Color(0x1a0a0a);
        scene.fog = new THREE.Fog(0x2a0505, 5, 25);
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
        
        // Lighting
        setupLighting();
        console.log('Lighting setup complete');
        
        // Generate maze
        generateMaze();
        console.log('Maze generated');
        
        // Create player
        createPlayer();
        console.log('Player created');
        
        // Create exit
        createExit();
        console.log('Exit created');
        
        // Create jumping enemies
        createJumpers();
        console.log('Jumping enemies created');
        
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
        
        // Hide loading screen after everything is loaded
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
        }, 500);
        
        // Note: Background music will start on first user interaction (browser autoplay policy)
        
        // Start animation loop
        animate();
        console.log('Game initialized successfully!');
        
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
    // Brighter ambient light so game is visible before flashlight
    const ambientLight = new THREE.AmbientLight(0x6a3a3a, 0.6); // Increased from 0.3 to 0.6
    scene.add(ambientLight);
    
    // Directional light - brighter moonlight with red tint
    const moonLight = new THREE.DirectionalLight(0x8a4a4a, 0.7); // Increased from 0.4 to 0.7
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
    const hemiLight = new THREE.HemisphereLight(0x6a3a3a, 0x2a0a0a, 0.6); // Increased from 0.4 to 0.6
    scene.add(hemiLight);
    
    // Exit light - green glow (hope in darkness)
    const exitLight = new THREE.PointLight(0x00ff44, 2, 15);
    exitLight.position.set(MAZE_SIZE - 2, 3, MAZE_SIZE - 2);
    scene.add(exitLight);
    
    // Add some scattered red danger lights
    for (let i = 0; i < 4; i++) {
        const dangerLight = new THREE.PointLight(0xff0000, 1, 8);
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

function createFlashlight() {
    // Create SpotLight for flashlight effect
    flashlight = new THREE.SpotLight(0xffffdd, 5, 20, Math.PI / 5, 0.3, 1); // Stronger and wider
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

function createKnife() {
    // Create a beautiful, detailed butcher knife
    const knifeGroup = new THREE.Group();
    
    // Blade - long, sharp, and polished
    const bladeGeometry = new THREE.BoxGeometry(0.12, 0.9, 0.025);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8, // Bright silver
        metalness: 0.95,
        roughness: 0.05,
        emissive: 0x666666,
        emissiveIntensity: 0.2
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.45;
    blade.castShadow = true;
    knifeGroup.add(blade);
    
    // Blade edge highlights (serrations)
    for (let i = 0; i < 5; i++) {
        const serrGeometry = new THREE.BoxGeometry(0.13, 0.04, 0.01);
        const serrMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 1.0,
            roughness: 0.0,
            emissive: 0x888888,
            emissiveIntensity: 0.3
        });
        const serration = new THREE.Mesh(serrGeometry, serrMaterial);
        serration.position.y = 0.2 + (i * 0.15);
        serration.position.z = 0.02;
        knifeGroup.add(serration);
    }
    
    // Blade tip (pointed and sharp)
    const tipGeometry = new THREE.ConeGeometry(0.06, 0.18, 4);
    const tip = new THREE.Mesh(tipGeometry, bladeMaterial);
    tip.position.y = 0.99;
    tip.rotation.z = Math.PI / 4;
    tip.castShadow = true;
    knifeGroup.add(tip);
    
    // Handle - rich wooden grip with texture
    const handleGeometry = new THREE.CylinderGeometry(0.055, 0.075, 0.45, 12);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x3d1f0f, // Rich dark wood
        roughness: 0.7,
        metalness: 0.0,
        emissive: 0x1a0a00,
        emissiveIntensity: 0.1
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.22;
    handle.castShadow = true;
    knifeGroup.add(handle);
    
    // Handle grip rings (decorative)
    for (let i = 0; i < 3; i++) {
        const ringGeometry = new THREE.TorusGeometry(0.08, 0.01, 8, 12);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.8,
            roughness: 0.2
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.y = -0.35 + (i * 0.13);
        ring.rotation.x = Math.PI / 2;
        knifeGroup.add(ring);
    }
    
    // Guard (between blade and handle) - ornate
    const guardGeometry = new THREE.BoxGeometry(0.25, 0.06, 0.1);
    const guardMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        metalness: 0.9,
        roughness: 0.2,
        emissive: 0x222222,
        emissiveIntensity: 0.15
    });
    const guard = new THREE.Mesh(guardGeometry, guardMaterial);
    guard.position.y = 0;
    guard.castShadow = true;
    knifeGroup.add(guard);
    
    // Pommel (end of handle) - decorative cap
    const pommelGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    const pommel = new THREE.Mesh(pommelGeometry, guardMaterial);
    pommel.position.y = -0.5;
    pommel.castShadow = true;
    knifeGroup.add(pommel);
    
    // Position knife BEHIND player so it doesn't block movement
    // Positioned at back-right, visible but out of collision path
    knifeGroup.position.set(0.25, 0.3, -0.4); // MOVED TO BACK
    knifeGroup.rotation.z = -Math.PI / 8; // Slight angle
    knifeGroup.rotation.x = Math.PI / 6; // Less aggressive angle
    knifeGroup.rotation.y = Math.PI / 8; // Rotate slightly toward back
    
    // Store original position for animation
    knifeGroup.userData.originalPosition = knifeGroup.position.clone();
    knifeGroup.userData.originalRotation = knifeGroup.rotation.clone();
    knifeGroup.userData.isSwinging = false;
    
    playerMesh.add(knifeGroup);
    knifeObject = knifeGroup;
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
                
                // Check if all jumpers killed
                if (jumpers.length === 0) {
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
        
        // Development key: Press 'T' to trigger game over screen
        if (e.key.toLowerCase() === 't' && gameActive) {
            e.preventDefault();
            console.log('Manual game over triggered for testing');
            loseGame();
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
    
    // Window resize
    window.addEventListener('resize', onWindowResize);
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
        
        if (distanceToPickup < 2.0) { // Increased pickup range
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
    
    // Check collision with jumping enemies - MUST BE IN SAME LANE!
    jumpers.forEach((jumper, index) => {
        const distance = player.position.distanceTo(jumper.position);
        
        // Check if player and jumper are in the same lane/corridor
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
    });
    
    // Check if player reached UFO beam (smaller pickup area matching new beam size)
    // ONLY allow escape if ALL jumping enemies are killed
    if (player.position.distanceTo(exit) < 1.2 && jumpers.length === 0) {
        // Player entered the beam AND killed all jumpers - trigger abduction sequence
        console.log('Player entered UFO beam - all jumpers eliminated - beginning abduction sequence!');
        
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
    
    // Update UI displays
    updateKillCount();
    updateJumperCount();
    updateCoinDisplay();
    
    // Check if all jumpers are dead - VICTORY!
    if (jumpers.length === 0) {
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
    
    // Manage jumper state - PERSISTENT chasing when player in lane
    jumpers.forEach((jumper, index) => {
        const distanceToPlayer = jumper.position.distanceTo(player.position);
        
        // Check if player entered THIS jumper's specific lane
        let playerInLane = false;
        const lane = jumper.laneInfo;
        const tolerance = 1.2; // Wider lane detection - don't give up easily!
        
        if (jumper.patrolAxis === 'x') {
            const playerInLaneZ = Math.abs(player.position.z - lane.fixedCoord) < tolerance;
            const playerInLaneX = player.position.x >= lane.xMin - 1.0 && player.position.x <= lane.xMax + 1.0;
            playerInLane = playerInLaneZ && playerInLaneX;
        } else {
            const playerInLaneX = Math.abs(player.position.x - lane.fixedCoord) < tolerance;
            const playerInLaneZ = player.position.z >= lane.zMin - 1.0 && player.position.z <= lane.zMax + 1.0;
            playerInLane = playerInLaneX && playerInLaneZ;
        }
        
        // AGGRESSIVE: Chase if player in lane (don't check distance - chase to the end!)
        const shouldAttack = playerInLane;
        
        // Switch to chasing when conditions are met
        if (shouldAttack && jumper.state !== 'chasing') {
            jumper.state = 'chasing';
            console.log(`🎯 Jumper ${index} in ${lane.name} ATTACKING! Distance: ${distanceToPlayer.toFixed(2)}`);
        } else if (!shouldAttack && jumper.state === 'chasing') {
            jumper.state = 'hopping';
            console.log(`👻 Jumper ${index} returning to patrol - player left ${lane.name}`);
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
        // CHASING: Jump towards player - GO TO THE END OF THE LANE!
        else if (jumper.state === 'chasing') {
            if (jumper.patrolAxis === 'x') {
                if (player.position.x > jumper.position.x) {
                    targetDirection.set(1, 0, 0);
                } else {
                    targetDirection.set(-1, 0, 0);
                }
                // Don't stop at edges - chase to the end!
            } else {
                if (player.position.z > jumper.position.z) {
                    targetDirection.set(0, 0, 1);
                } else {
                    targetDirection.set(0, 0, -1);
                }
                // Don't stop at edges - chase to the end!
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
        
        // Calculate movement speed - SAME SPEED for hopping and chasing
        let moveSpeed = JUMPER_SPEED; // Consistent speed always
        if (jumper.state === 'queued') {
            moveSpeed = JUMPER_SPEED * 0.7;
        }
        
        // Calculate new position - ALWAYS MOVE at consistent speed
        const newPosition = jumper.position.clone();
        if (jumper.direction.length() > 0.1) {
            // Smooth consistent movement - same speed whether hopping or chasing
            newPosition.add(jumper.direction.clone().multiplyScalar(moveSpeed));
        }
        
        // FORCE LANE ALIGNMENT
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
    const playerRadius = 0.25; // Collision radius
    
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
 * @returns {void}
 */
function updateCoinDisplay() {
    const coinCountElement = document.getElementById('coinCount');
    if (coinCountElement) {
        coinCountElement.textContent = coins;
    }
}

function winGame() {
    if (!gameActive) return;
    
    console.log('Game Won - Player escaped via UFO abduction!');
    gameActive = false;
    const finalTime = Math.floor((Date.now() - gameStartTime) / 1000);
    
    // Stop background music
    stopBackgroundMusic();
    
    // Stop the game animation
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    // Victory screen with UFO escape theme
    const gameOverElement = document.getElementById('gameOver');
    const titleElement = document.getElementById('gameOverTitle');
    const survivalTimeElement = document.getElementById('survivalTime');
    const killStatsElement = document.getElementById('killStats');
    
    if (titleElement) {
        titleElement.textContent = 'ABDUCTED & RESCUED';
        titleElement.style.color = '#0088ff';
    }
    if (survivalTimeElement) survivalTimeElement.textContent = `Survived: ${finalTime}s`;
    if (killStatsElement) killStatsElement.textContent = `Kills: ${kills} | Escaped via UFO`;
    
    // Force show the victory screen
    if (gameOverElement) {
        gameOverElement.classList.add('show');
        gameOverElement.style.display = 'block';
    }
    
    console.log('UFO escape victory screen should be visible now');
}

function loseGame() {
    if (!gameActive) return;
    
    console.log('Game Over - Player killed by zombie!');
    gameActive = false;
    const finalTime = Math.floor((Date.now() - gameStartTime) / 1000);
    
    // Stop background music
    stopBackgroundMusic();
    
    // Play enemy eating sound on death (first 4 seconds only)
    playSound('enemyEat');
    
    // Stop the game animation
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    // Death screen with new clean design
    const gameOverElement = document.getElementById('gameOver');
    const titleElement = document.getElementById('gameOverTitle');
    const survivalTimeElement = document.getElementById('survivalTime');
    const killStatsElement = document.getElementById('killStats');
    
    if (titleElement) {
        titleElement.textContent = 'DEVOURED';
        titleElement.style.color = '#ff0000';
    }
    if (survivalTimeElement) survivalTimeElement.textContent = `Survived: ${finalTime}s`;
    if (killStatsElement) killStatsElement.textContent = `Kills: ${kills}`;
    
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
    coins = 0;  // Reset coin counter
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
    createExit();
    createJumpers();
    
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
    updateCoinDisplay();  // Reset coin display to 0
    
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
