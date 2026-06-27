/* ============================================================================
   PIXEL ADVENTURE RPG - MAIN GAME ENGINE
   ============================================================================ */

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

const CONFIG = {
    CANVAS_WIDTH: 1280,
    CANVAS_HEIGHT: 720,
    FPS: 60,
    TILE_SIZE: 32,
    GRAVITY: 0.6,
    DIFFICULTY: {
        easy: { enemyHealth: 15, enemyDamage: 5, xpReward: 80 },
        normal: { enemyHealth: 20, enemyDamage: 10, xpReward: 100 },
        hard: { enemyHealth: 30, enemyDamage: 15, xpReward: 150 }
    },
    MAX_LEVEL: 15,
    BOSS_LEVELS: [5, 10, 15]
};

// ============================================================================
// GAME STATE & DATA
// ============================================================================

let gameState = {
    screen: 'startMenu',
    isPaused: false,
    currentLevel: 1,
    difficulty: 'normal',
    soundEnabled: true,
    musicEnabled: true,
    volume: 70,
    gameOver: false,
    victory: false,
    lastSaveTime: 0
};

let playerStats = {
    hp: 100,
    maxHp: 100,
    xp: 0,
    xpRequired: 100,
    level: 1,
    coins: 0,
    gems: 0,
    damage: 10,
    defense: 0,
    speed: 3,
    enemiesDefeated: 0
};

let inventory = {
    items: {
        'potion': { name: 'Health Potion', icon: '🧪', quantity: 0, effect: 'Restore 50 HP', cost: 30 },
        'sword': { name: 'Iron Sword', icon: '⚔', quantity: 0, effect: 'Damage +15', cost: 50, equipped: false },
        'shield': { name: 'Iron Shield', icon: '🛡', quantity: 0, effect: 'Defense +5', cost: 40, equipped: false },
        'chest': { name: 'Steel Armor', icon: '🎖', quantity: 0, effect: 'Defense +10', cost: 80, equipped: false },
        'gem': { name: 'Gem Upgrade', icon: '💎', quantity: 0, effect: 'XP +25%', cost: 100, equipped: false }
    }
};

let shopItems = [
    { id: 'potion', name: 'Health Potion', icon: '🧪', cost: 30, effect: 'Restore 50 HP' },
    { id: 'sword', name: 'Iron Sword', icon: '⚔', cost: 50, effect: 'Damage +15' },
    { id: 'shield', name: 'Iron Shield', icon: '🛡', cost: 40, effect: 'Defense +5' },
    { id: 'chest', name: 'Steel Armor', icon: '🎖', cost: 80, effect: 'Defense +10' },
    { id: 'gem', name: 'Gem Upgrade', icon: '💎', cost: 100, effect: 'XP +25%' }
];

// ============================================================================
// GAME OBJECTS
// ============================================================================

class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    distance(v) {
        const dx = v.x - this.x;
        const dy = v.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    clone() {
        return new Vector2(this.x, this.y);
    }
}

class Player {
    constructor(x, y) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(0, 0);
        this.width = 24;
        this.height = 32;
        this.speed = playerStats.speed;
        this.jumping = false;
        this.direction = 1;
        this.animationFrame = 0;
        this.animationCounter = 0;
        this.attacking = false;
        this.attackCounter = 0;
        this.invulnerable = false;
        this.invulnerableCounter = 0;
    }

    update(keys, platforms) {
        // Horizontal movement
        this.vel.x = 0;
        if (keys['w'] || keys['ArrowUp']) {
            this.vel.y = -this.speed * 2;
        }
        if (keys['s'] || keys['ArrowDown']) {
            this.vel.y = this.speed * 2;
        }
        if (keys['a'] || keys['ArrowLeft']) {
            this.vel.x = -this.speed;
            this.direction = -1;
        }
        if (keys['d'] || keys['ArrowRight']) {
            this.vel.x = this.speed;
            this.direction = 1;
        }

        // Apply gravity (less gravity for top-down game)
        this.vel.y += CONFIG.GRAVITY * 0.3;

        // Collision detection with platforms
        this.pos.add(this.vel);

        for (let platform of platforms) {
            if (this.collidesWith(platform)) {
                if (this.vel.y > 0) {
                    this.pos.y = platform.y - this.height;
                    this.vel.y = 0;
                    this.jumping = false;
                } else if (this.vel.y < 0) {
                    this.pos.y = platform.y + platform.height;
                    this.vel.y = 0;
                }
            }
        }

        // Wrap around screen edges
        if (this.pos.x < 0) this.pos.x = CONFIG.CANVAS_WIDTH;
        if (this.pos.x > CONFIG.CANVAS_WIDTH) this.pos.x = 0;
        if (this.pos.y < 0) this.pos.y = CONFIG.CANVAS_HEIGHT;
        if (this.pos.y > CONFIG.CANVAS_HEIGHT) this.pos.y = 0;

        // Animation
        this.animationCounter++;
        if (this.animationCounter > 8) {
            this.animationFrame = (this.animationFrame + 1) % 4;
            this.animationCounter = 0;
        }

        // Attack animation
        if (this.attacking) {
            this.attackCounter++;
            if (this.attackCounter > 10) {
                this.attacking = false;
                this.attackCounter = 0;
            }
        }

        // Invulnerability timer
        if (this.invulnerable) {
            this.invulnerableCounter--;
            if (this.invulnerableCounter <= 0) {
                this.invulnerable = false;
            }
        }
    }

    collidesWith(rect) {
        return this.pos.x < rect.x + rect.width &&
               this.pos.x + this.width > rect.x &&
               this.pos.y < rect.y + rect.height &&
               this.pos.y + this.height > rect.y;
    }

    draw(ctx, cameraX, cameraY) {
        const screenX = this.pos.x - cameraX;
        const screenY = this.pos.y - cameraY;

        // Draw player with animation
        ctx.fillStyle = this.invulnerable && Math.floor(gameState.gameTimer / 5) % 2 === 0 ? 'rgba(100, 200, 255, 0.5)' : '#FF6B35';
        ctx.fillRect(screenX, screenY, this.width, this.height);

        // Draw attack effect
        if (this.attacking) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screenX + this.width / 2, screenY + this.height / 2, 30, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw direction indicator
        ctx.fillStyle = '#FFF';
        ctx.fillRect(screenX + (this.direction === 1 ? this.width - 8 : 0), screenY + 4, 8, 8);
    }
}

class Enemy {
    constructor(x, y, type = 'goblin') {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(0, 0);
        this.width = 20;
        this.height = 24;
        this.type = type;
        this.hp = this.getHealthByType();
        this.maxHp = this.hp;
        this.speed = this.getSpeedByType();
        this.damage = this.getDamageByType();
        this.attackRange = 40;
        this.sightRange = 200;
        this.attackCooldown = 0;
        this.animationFrame = 0;
        this.animationCounter = 0;
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.targetPlayer = null;
    }

    getHealthByType() {
        const diffData = CONFIG.DIFFICULTY[gameState.difficulty];
        const multiplier = gameState.currentLevel / 5;
        return Math.floor(diffData.enemyHealth * multiplier);
    }

    getSpeedByType() {
        const speeds = { goblin: 1.5, orc: 1, skeleton: 2, troll: 0.8, demon: 2.5 };
        return speeds[this.type] || 1;
    }

    getDamageByType() {
        const diffData = CONFIG.DIFFICULTY[gameState.difficulty];
        const damages = { goblin: 5, orc: 10, skeleton: 8, troll: 15, demon: 20 };
        return Math.floor((damages[this.type] || 5) * (diffData.enemyDamage / 10));
    }

    update(player, platforms) {
        this.attackCooldown = Math.max(0, this.attackCooldown - 1);

        // AI logic
        const distToPlayer = this.pos.distance(player.pos);

        if (distToPlayer < this.sightRange) {
            this.targetPlayer = player;
            // Move towards player
            const dx = player.pos.x - this.pos.x;
            this.direction = dx > 0 ? 1 : -1;
            this.vel.x = this.speed * this.direction;

            if (distToPlayer < this.attackRange && this.attackCooldown === 0) {
                this.attackCooldown = 60;
            }
        } else {
            this.targetPlayer = null;
            // Random patrol
            if (Math.random() < 0.02) {
                this.direction *= -1;
            }
            this.vel.x = this.speed * 0.5 * this.direction;
        }

        this.vel.y += CONFIG.GRAVITY * 0.3;
        this.pos.add(this.vel);

        // Platform collision
        for (let platform of platforms) {
            if (this.collidesWith(platform)) {
                if (this.vel.y > 0) {
                    this.pos.y = platform.y - this.height;
                    this.vel.y = 0;
                } else if (this.vel.y < 0) {
                    this.pos.y = platform.y + platform.height;
                    this.vel.y = 0;
                }
            }
        }

        // Wrap around screen
        if (this.pos.x < -50) this.pos.x = CONFIG.CANVAS_WIDTH + 50;
        if (this.pos.x > CONFIG.CANVAS_WIDTH + 50) this.pos.x = -50;

        // Animation
        this.animationCounter++;
        if (this.animationCounter > 10) {
            this.animationFrame = (this.animationFrame + 1) % 4;
            this.animationCounter = 0;
        }
    }

    collidesWith(rect) {
        return this.pos.x < rect.x + rect.width &&
               this.pos.x + this.width > rect.x &&
               this.pos.y < rect.y + rect.height &&
               this.pos.y + this.height > rect.y;
    }

    draw(ctx, cameraX, cameraY) {
        const screenX = this.pos.x - cameraX;
        const screenY = this.pos.y - cameraY;

        // Determine color by type
        const colors = {
            goblin: '#4CAF50',
            orc: '#8B4513',
            skeleton: '#CCCCCC',
            troll: '#556B2F',
            demon: '#8B0000'
        };

        ctx.fillStyle = colors[this.type] || '#FF0000';
        ctx.fillRect(screenX, screenY, this.width, this.height);

        // Draw health bar
        const healthBarWidth = this.width;
        const healthPercent = this.hp / this.maxHp;
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(screenX, screenY - 5, healthBarWidth, 3);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(screenX, screenY - 5, healthBarWidth * healthPercent, 3);
    }

    takeDamage(amount) {
        this.hp -= amount;
        playSound('hit');
        return this.hp <= 0;
    }
}

class Particle {
    constructor(x, y, color, life = 30) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4 - 2);
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }

    update() {
        this.pos.add(this.vel);
        this.vel.y += 0.1;
        this.life--;
    }

    draw(ctx, cameraX, cameraY) {
        const screenX = this.pos.x - cameraX;
        const screenY = this.pos.y - cameraY;
        const alpha = this.life / this.maxLife;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class Collectible {
    constructor(x, y, type = 'coin') {
        this.pos = new Vector2(x, y);
        this.type = type;
        this.rotation = 0;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update() {
        this.rotation += 0.1;
        this.pos.y += Math.sin(this.rotation + this.bobOffset) * 0.5;
    }

    draw(ctx, cameraX, cameraY) {
        const screenX = this.pos.x - cameraX;
        const screenY = this.pos.y - cameraY;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.rotation);

        if (this.type === 'coin') {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'gem') {
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    collidesWith(player) {
        return Math.abs(this.pos.x - player.pos.x) < 20 &&
               Math.abs(this.pos.y - player.pos.y) < 20;
    }
}

// ============================================================================
// GAME OBJECTS & LEVEL DATA
// ============================================================================

let gameObjects = {
    player: null,
    enemies: [],
    particles: [],
    collectibles: [],
    platforms: [],
    camera: { x: 0, y: 0 }
};

// Level maps with platforms and enemy spawns
const LEVEL_DATA = {
    1: {
        name: 'Forest Start',
        platforms: [
            { x: 0, y: 650, width: 1280, height: 70 },
            { x: 200, y: 550, width: 300, height: 20 },
            { x: 800, y: 550, width: 300, height: 20 },
            { x: 400, y: 450, width: 200, height: 20 }
        ],
        enemies: [
            { x: 300, y: 550, type: 'goblin' },
            { x: 900, y: 550, type: 'goblin' }
        ],
        collectibles: [
            { x: 250, y: 520, type: 'coin' },
            { x: 850, y: 520, type: 'coin' },
            { x: 500, y: 420, type: 'coin' }
        ]
    },
    2: {
        name: 'Deep Forest',
        platforms: [
            { x: 0, y: 650, width: 1280, height: 70 },
            { x: 100, y: 500, width: 250, height: 20 },
            { x: 550, y: 550, width: 250, height: 20 },
            { x: 950, y: 500, width: 250, height: 20 }
        ],
        enemies: [
            { x: 150, y: 470, type: 'goblin' },
            { x: 600, y: 520, type: 'goblin' },
            { x: 1000, y: 470, type: 'goblin' }
        ],
        collectibles: [
            { x: 150, y: 470, type: 'coin' },
            { x: 600, y: 520, type: 'coin' },
            { x: 1000, y: 470, type: 'coin' },
            { x: 500, y: 300, type: 'gem' }
        ]
    },
    3: {
        name: 'Dark Caves',
        platforms: [
            { x: 0, y: 650, width: 1280, height: 70 },
            { x: 0, y: 400, width: 300, height: 20 },
            { x: 500, y: 350, width: 300, height: 20 },
            { x: 1000, y: 400, width: 280, height: 20 },
            { x: 250, y: 500, width: 250, height: 20 }
        ],
        enemies: [
            { x: 150, y: 370, type: 'orc' },
            { x: 550, y: 320, type: 'goblin' },
            { x: 1050, y: 370, type: 'skeleton' }
        ],
        collectibles: [
            { x: 150, y: 370, type: 'coin' },
            { x: 550, y: 320, type: 'coin' },
            { x: 1050, y: 370, type: 'coin' },
            { x: 640, y: 200, type: 'gem' }
        ]
    },
    4: {
        name: 'Skeleton Realm',
        platforms: [
            { x: 0, y: 650, width: 1280, height: 70 },
            { x: 150, y: 480, width: 200, height: 20 },
            { x: 450, y: 420, width: 200, height: 20 },
            { x: 750, y: 480, width: 200, height: 20 },
            { x: 1050, y: 420, width: 150, height: 20 }
        ],
        enemies: [
            { x: 200, y: 450, type: 'skeleton' },
            { x: 500, y: 390, type: 'skeleton' },
            { x: 800, y: 450, type: 'orc' },
            { x: 1100, y: 390, type: 'skeleton' }
        ],
        collectibles: [
            { x: 200, y: 450, type: 'coin' },
            { x: 500, y: 390, type: 'coin' },
            { x: 800, y: 450, type: 'coin' },
            { x: 1100, y: 390, type: 'coin' },
            { x: 640, y: 250, type: 'gem' }
        ]
    },
    5: {
        name: 'Dark Lord Tower',
        isBoss: true,
        platforms: [
            { x: 0, y: 650, width: 1280, height: 70 },
            { x: 350, y: 500, width: 200, height: 20 },
            { x: 750, y: 500, width: 200, height: 20 },
            { x: 550, y: 300, width: 200, height: 20 }
        ],
        enemies: [
            { x: 640, y: 250, type: 'demon' }
        ],
        collectibles: [
            { x: 640, y: 200, type: 'gem' },
            { x: 400, y: 470, type: 'coin' },
            { x: 800, y: 470, type: 'coin' }
        ]
    }
};

// Extend level data to 15 levels
for (let i = 6; i <= 15; i++) {
    const difficulty = Math.ceil(i / 5);
    LEVEL_DATA[i] = {
        name: `Level ${i}`,
        isBoss: CONFIG.BOSS_LEVELS.includes(i),
        platforms: generateRandomPlatforms(difficulty),
        enemies: generateRandomEnemies(difficulty),
        collectibles: generateRandomCollectibles(difficulty)
    };
}

function generateRandomPlatforms(difficulty) {
    const platforms = [{ x: 0, y: 650, width: 1280, height: 70 }];
    const count = 4 + difficulty * 2;
    for (let i = 0; i < count; i++) {
        platforms.push({
            x: Math.random() * (1280 - 300),
            y: 200 + Math.random() * 400,
            width: 200 + Math.random() * 150,
            height: 20
        });
    }
    return platforms;
}

function generateRandomEnemies(difficulty) {
    const enemies = [];
    const count = 2 + difficulty * 2;
    const types = ['goblin', 'orc', 'skeleton', 'troll', 'demon'];
    for (let i = 0; i < count; i++) {
        const type = types[Math.min(difficulty - 1, types.length - 1)];
        enemies.push({
            x: Math.random() * 1200,
            y: Math.random() * 300 + 200,
            type: type
        });
    }
    return enemies;
}

function generateRandomCollectibles(difficulty) {
    const collectibles = [];
    const coinCount = 3 + difficulty;
    const gemCount = 1 + Math.floor(difficulty / 2);
    for (let i = 0; i < coinCount; i++) {
        collectibles.push({
            x: Math.random() * 1200,
            y: Math.random() * 400 + 100,
            type: 'coin'
        });
    }
    for (let i = 0; i < gemCount; i++) {
        collectibles.push({
            x: Math.random() * 1200,
            y: Math.random() * 300 + 100,
            type: 'gem'
        });
    }
    return collectibles;
}

// ============================================================================
// SOUND SYSTEM
// ============================================================================

const soundContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = soundContext.createGain();
masterGain.connect(soundContext.destination);

function playSound(type) {
    if (!gameState.soundEnabled || soundContext.state === 'suspended') return;

    const audioContext = soundContext;
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.connect(masterGain);
    gain.gain.setValueAtTime(gameState.volume / 100 * 0.3, now);

    if (type === 'hit') {
        const osc = audioContext.createOscillator();
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'coin') {
        const osc = audioContext.createOscillator();
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'powerup') {
        const osc = audioContext.createOscillator();
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.2);
    }
}

// ============================================================================
// GAME INITIALIZATION & LEVEL LOADING
// ============================================================================

function initLevel(levelNum) {
    gameState.currentLevel = Math.min(levelNum, CONFIG.MAX_LEVEL);
    gameState.gameOver = false;
    gameState.victory = false;

    const levelData = LEVEL_DATA[gameState.currentLevel] || LEVEL_DATA[1];

    // Reset player
    gameObjects.player = new Player(100, 400);
    gameObjects.enemies = [];
    gameObjects.particles = [];
    gameObjects.collectibles = [];
    gameObjects.platforms = levelData.platforms;

    // Create enemies
    for (let enemyData of levelData.enemies) {
        gameObjects.enemies.push(new Enemy(enemyData.x, enemyData.y, enemyData.type));
    }

    // Create collectibles
    for (let collectData of levelData.collectibles) {
        gameObjects.collectibles.push(new Collectible(collectData.x, collectData.y, collectData.type));
    }

    updateHUD();
}

function restartLevel() {
    playerStats.hp = playerStats.maxHp;
    initLevel(gameState.currentLevel);
    changeScreen('gameScreen');
    gameState.gameTimer = 0;
}

function nextLevel() {
    if (gameState.currentLevel < CONFIG.MAX_LEVEL) {
        playerStats.hp = playerStats.maxHp;
        initLevel(gameState.currentLevel + 1);
        changeScreen('gameScreen');
        gameState.gameTimer = 0;
    } else {
        // Game completed!
        changeScreen('startMenu');
        saveGameData();
    }
}

// ============================================================================
// GAME LOOP
// ============================================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

let lastTime = 0;
let gameTime = 0;
gameState.gameTimer = 0;

const keys = {};

// Input handling
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (e.key === 'p' || e.key === 'P') {
        if (gameState.screen === 'gameScreen') {
            gameState.isPaused = !gameState.isPaused;
            updatePauseMenu();
        }
    }

    if (e.key === 'i' || e.key === 'I') {
        if (gameState.screen === 'gameScreen' && !gameState.isPaused) {
            changeScreen('inventoryScreen');
        }
    }

    if (e.key === 's' || e.key === 'S') {
        if (gameState.screen === 'gameScreen' && !gameState.isPaused) {
            changeScreen('shopScreen');
        }
    }

    if (e.key === ' ') {
        if (gameState.screen === 'gameScreen' && gameObjects.player) {
            e.preventDefault();
            gameObjects.player.attacking = true;
            gameObjects.player.attackCounter = 0;
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Touch controls for mobile
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

document.addEventListener('touchmove', (e) => {
    if (gameState.screen !== 'gameScreen') return;
    e.preventDefault();

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchX - touchStartX;
    const deltaY = touchY - touchStartY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 30) keys['d'] = true;
        else if (deltaX < -30) keys['a'] = true;
    } else {
        if (deltaY > 30) keys['s'] = true;
        else if (deltaY < -30) keys['w'] = true;
    }
});

document.addEventListener('touchend', () => {
    keys['w'] = keys['a'] = keys['s'] = keys['d'] = false;
    keys['ArrowUp'] = keys['ArrowLeft'] = keys['ArrowDown'] = keys['ArrowRight'] = false;
});

function gameLoop(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.016);
    lastTime = currentTime;

    gameTime += deltaTime;
    gameState.gameTimer++;

    if (gameState.screen === 'gameScreen' && !gameState.isPaused && !gameState.gameOver) {
        update();
        draw();
    } else if (gameState.screen === 'gameScreen') {
        draw();
    }

    requestAnimationFrame(gameLoop);
}

function update() {
    if (!gameObjects.player) return;

    // Update player
    gameObjects.player.update(keys, gameObjects.platforms);

    // Update enemies
    for (let enemy of gameObjects.enemies) {
        enemy.update(gameObjects.player, gameObjects.platforms);

        // Player attack
        if (gameObjects.player.attacking) {
            const distance = gameObjects.player.pos.distance(enemy.pos);
            if (distance < 50) {
                const damage = Math.floor(playerStats.damage * (0.8 + Math.random() * 0.4));
                if (enemy.takeDamage(damage)) {
                    gameObjects.enemies = gameObjects.enemies.filter(e => e !== enemy);
                    playerStats.enemiesDefeated++;
                    const xpGain = Math.floor(CONFIG.DIFFICULTY[gameState.difficulty].xpReward * (gameState.currentLevel / 5));
                    gainXP(xpGain);
                    createParticles(enemy.pos.x, enemy.pos.y, 10, '#FFD700');
                }
            }
        }

        // Enemy attack
        if (enemy.attackCooldown === 60) {
            const distance = gameObjects.player.pos.distance(enemy.pos);
            if (distance < enemy.attackRange && !gameObjects.player.invulnerable) {
                playerStats.hp -= Math.max(1, enemy.damage - playerStats.defense);
                gameObjects.player.invulnerable = true;
                gameObjects.player.invulnerableCounter = 120;
                createParticles(gameObjects.player.pos.x, gameObjects.player.pos.y, 8, '#FF0000');
                playSound('hit');

                if (playerStats.hp <= 0) {
                    playerStats.hp = 0;
                    endGame(false);
                }
            }
        }
    }

    // Update collectibles
    for (let collectible of gameObjects.collectibles) {
        collectible.update();
        if (collectible.collidesWith(gameObjects.player)) {
            if (collectible.type === 'coin') {
                playerStats.coins += 10;
                playSound('coin');
            } else if (collectible.type === 'gem') {
                playerStats.gems += 1;
                playSound('powerup');
            }
            gameObjects.collectibles = gameObjects.collectibles.filter(c => c !== collectible);
            createParticles(collectible.pos.x, collectible.pos.y, 15, collectible.type === 'gem' ? '#00FFFF' : '#FFD700');
        }
    }

    // Update particles
    gameObjects.particles = gameObjects.particles.filter(p => p.life > 0);
    for (let particle of gameObjects.particles) {
        particle.update();
    }

    // Check level completion
    if (gameObjects.enemies.length === 0 && gameObjects.collectibles.length === 0) {
        endGame(true);
    }

    updateHUD();
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#1a472a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!gameObjects.player) return;

    // Update camera to follow player
    gameObjects.camera.x = gameObjects.player.pos.x - canvas.width / 3;
    gameObjects.camera.y = gameObjects.player.pos.y - canvas.height / 3;

    // Draw background elements
    drawBackground();

    // Draw platforms
    ctx.fillStyle = '#34495e';
    for (let platform of gameObjects.platforms) {
        ctx.fillRect(platform.x - gameObjects.camera.x, platform.y - gameObjects.camera.y, platform.width, platform.height);
        // Add texture
        ctx.fillStyle = '#2c3e50';
        for (let i = 0; i < platform.width; i += 10) {
            ctx.fillRect(platform.x + i - gameObjects.camera.x, platform.y - gameObjects.camera.y, 5, platform.height);
        }
        ctx.fillStyle = '#34495e';
    }

    // Draw collectibles
    for (let collectible of gameObjects.collectibles) {
        collectible.draw(ctx, gameObjects.camera.x, gameObjects.camera.y);
    }

    // Draw enemies
    for (let enemy of gameObjects.enemies) {
        enemy.draw(ctx, gameObjects.camera.x, gameObjects.camera.y);
    }

    // Draw player
    gameObjects.player.draw(ctx, gameObjects.camera.x, gameObjects.camera.y);

    // Draw particles
    for (let particle of gameObjects.particles) {
        particle.draw(ctx, gameObjects.camera.x, gameObjects.camera.y);
    }

    // Draw UI overlay on canvas
    drawCanvasUI();
}

function drawBackground() {
    const scrollX = gameObjects.camera.x * 0.5;
    const scrollY = gameObjects.camera.y * 0.5;

    // Draw parallax stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 5; i++) {
        const x = ((i * 300 - scrollX) % (canvas.width * 2)) || canvas.width;
        const y = ((i * 250 - scrollY) % (canvas.height * 2)) || canvas.height;
        ctx.fillRect(x, y, 100, 100);
    }
}

function drawCanvasUI() {
    // Draw level name
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 20px Arial';
    const levelName = LEVEL_DATA[gameState.currentLevel]?.name || `Level ${gameState.currentLevel}`;
    ctx.fillText(levelName, 20, 40);

    // Draw enemy count
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Enemies: ${gameObjects.enemies.length}`, 20, 70);
}

function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        gameObjects.particles.push(new Particle(x, y, color));
    }
}

function endGame(victory) {
    gameState.gameOver = true;
    gameState.victory = victory;

    const screen = document.getElementById('gameOverScreen');
    if (victory) {
        document.getElementById('gameOverTitle').textContent = '🎉 LEVEL COMPLETE!';
        document.getElementById('gameOverTitle').classList.add('victory');
        screen.classList.add('victory');

        if (gameState.currentLevel < CONFIG.MAX_LEVEL) {
            document.getElementById('nextLevelBtn').style.display = 'block';
            document.getElementById('retryBtn').style.display = 'none';
        } else {
            document.getElementById('nextLevelBtn').style.display = 'none';
            document.getElementById('retryBtn').style.display = 'block';
            document.getElementById('gameOverTitle').textContent = '🏆 GAME COMPLETED!';
        }

        playSound('powerup');
        saveGameData();
    } else {
        document.getElementById('gameOverTitle').textContent = '💀 GAME OVER';
        document.getElementById('gameOverTitle').classList.remove('victory');
        screen.classList.remove('victory');
        document.getElementById('nextLevelBtn').style.display = 'none';
        document.getElementById('retryBtn').style.display = 'block';
    }

    document.getElementById('gameOverLevel').textContent = gameState.currentLevel;
    document.getElementById('gameOverCoins').textContent = playerStats.coins;
    document.getElementById('gameOverGems').textContent = playerStats.gems;
    document.getElementById('gameOverEnemies').textContent = playerStats.enemiesDefeated;

    changeScreen('gameOverScreen');
}

// ============================================================================
// UI & SCREEN MANAGEMENT
// ============================================================================

function changeScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenName).classList.add('active');
    gameState.screen = screenName;

    if (screenName === 'gameScreen') {
        gameState.isPaused = false;
        document.getElementById('pauseMenu').style.display = 'none';
    }

    if (screenName === 'levelSelectScreen') {
        populateLevelGrid();
    }

    if (screenName === 'inventoryScreen') {
        populateInventory();
    }

    if (screenName === 'shopScreen') {
        populateShop();
    }
}

function updateHUD() {
    document.getElementById('healthBarFill').style.width = `${(playerStats.hp / playerStats.maxHp) * 100}%`;
    document.getElementById('healthText').textContent = `${playerStats.hp}/${playerStats.maxHp}`;

    document.getElementById('xpBarFill').style.width = `${(playerStats.xp / playerStats.xpRequired) * 100}%`;
    document.getElementById('xpText').textContent = `${playerStats.xp}/${playerStats.xpRequired}`;

    document.getElementById('levelDisplay').textContent = `Level ${playerStats.level}`;
    document.getElementById('coinText').textContent = playerStats.coins;
    document.getElementById('gemText').textContent = playerStats.gems;

    document.getElementById('menuHighScore').textContent = playerStats.coins;
    document.getElementById('menuLevelsUnlocked').textContent = gameState.currentLevel;
}

function updatePauseMenu() {
    const pauseMenu = document.getElementById('pauseMenu');
    if (gameState.isPaused) {
        pauseMenu.style.display = 'flex';
    } else {
        pauseMenu.style.display = 'none';
    }
}

function gainXP(amount) {
    const xpBoost = inventory.items.gem.equipped ? 1.25 : 1;
    playerStats.xp += Math.floor(amount * xpBoost);

    if (playerStats.xp >= playerStats.xpRequired) {
        playerStats.level++;
        playerStats.xp = 0;
        playerStats.xpRequired = Math.floor(playerStats.xpRequired * 1.2);
        playerStats.maxHp += 10;
        playerStats.hp = playerStats.maxHp;
        playerStats.damage += 5;
        playSound('powerup');
        createParticles(gameObjects.player.pos.x, gameObjects.player.pos.y, 20, '#00FFFF');
    }
}

// ============================================================================
// SETTINGS & CONTROLS
// ============================================================================

document.getElementById('volumeSlider').addEventListener('input', (e) => {
    gameState.volume = parseInt(e.target.value);
    document.getElementById('volumeValue').textContent = gameState.volume + '%';
    masterGain.gain.value = gameState.volume / 100;
    saveGameData();
});

document.getElementById('soundToggle').addEventListener('click', (e) => {
    gameState.soundEnabled = !gameState.soundEnabled;
    e.target.classList.toggle('active');
    e.target.textContent = gameState.soundEnabled ? 'ON' : 'OFF';
    saveGameData();
});

document.getElementById('musicToggle').addEventListener('click', (e) => {
    gameState.musicEnabled = !gameState.musicEnabled;
    e.target.classList.toggle('active');
    e.target.textContent = gameState.musicEnabled ? 'ON' : 'OFF';
    saveGameData();
});

document.getElementById('difficultySelect').addEventListener('change', (e) => {
    gameState.difficulty = e.target.value;
    saveGameData();
});

document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (confirm('Are you sure? This will reset all game progress!')) {
        resetGameData();
    }
});

// ============================================================================
// LEVEL SELECT
// ============================================================================

function populateLevelGrid() {
    const grid = document.getElementById('levelGrid');
    grid.innerHTML = '';

    for (let i = 1; i <= CONFIG.MAX_LEVEL; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        if (CONFIG.BOSS_LEVELS.includes(i)) btn.classList.add('boss-level');
        btn.textContent = i;

        if (i > gameState.currentLevel) {
            btn.disabled = true;
        }

        btn.addEventListener('click', () => {
            initLevel(i);
            changeScreen('gameScreen');
        });

        grid.appendChild(btn);
    }
}

// ============================================================================
// INVENTORY SYSTEM
// ============================================================================

function populateInventory() {
    const grid = document.getElementById('inventoryGrid');
    grid.innerHTML = '';

    for (const [key, item] of Object.entries(inventory.items)) {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        if (item.equipped) div.classList.add('equipped');

        div.innerHTML = `
            <div class="inventory-item-icon">${item.icon}</div>
            <div class="inventory-item-name">${item.name}</div>
            <div class="inventory-item-quantity">×${item.quantity}</div>
            <div class="inventory-item-effect">${item.effect}</div>
            ${item.equipped ? '<div class="inventory-item-equipped-badge">✓ EQUIPPED</div>' : ''}
        `;

        div.addEventListener('click', () => {
            if (key === 'potion' && item.quantity > 0) {
                playerStats.hp = Math.min(playerStats.maxHp, playerStats.hp + 50);
                item.quantity--;
                playSound('powerup');
                populateInventory();
                updateHUD();
            } else if (key !== 'potion') {
                item.equipped = !item.equipped;
                if (item.equipped) {
                    if (key === 'sword') playerStats.damage += 15;
                    if (key === 'shield') playerStats.defense += 5;
                    if (key === 'chest') playerStats.defense += 10;
                } else {
                    if (key === 'sword') playerStats.damage -= 15;
                    if (key === 'shield') playerStats.defense -= 5;
                    if (key === 'chest') playerStats.defense -= 10;
                }
                playSound('coin');
                populateInventory();
                updateHUD();
            }
        });

        grid.appendChild(div);
    }
}

// ============================================================================
// SHOP SYSTEM
// ============================================================================

function populateShop() {
    const grid = document.getElementById('shopGrid');
    document.getElementById('shopCoins').textContent = playerStats.coins;
    grid.innerHTML = '';

    for (const item of shopItems) {
        const div = document.createElement('div');
        div.className = 'shop-item';

        div.innerHTML = `
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-effect">${item.effect}</div>
            <div class="shop-item-price">💰 ${item.cost}</div>
        `;

        div.addEventListener('click', () => {
            if (playerStats.coins >= item.cost) {
                playerStats.coins -= item.cost;
                inventory.items[item.id].quantity++;
                playSound('coin');
                populateShop();
                updateHUD();
            }
        });

        grid.appendChild(div);
    }
}

// ============================================================================
// SAVE/LOAD SYSTEM (LocalStorage)
// ============================================================================

function saveGameData() {
    const saveData = {
        playerStats,
        inventory,
        gameState: {
            currentLevel: gameState.currentLevel,
            difficulty: gameState.difficulty,
            volume: gameState.volume,
            soundEnabled: gameState.soundEnabled,
            musicEnabled: gameState.musicEnabled
        },
        timestamp: Date.now()
    };
    localStorage.setItem('pixelAdventureRPG', JSON.stringify(saveData));
}

function loadGameData() {
    const saveData = localStorage.getItem('pixelAdventureRPG');
    if (saveData) {
        try {
            const data = JSON.parse(saveData);
            Object.assign(playerStats, data.playerStats);
            Object.assign(inventory, data.inventory);
            Object.assign(gameState, data.gameState);
            return true;
        } catch (e) {
            console.error('Failed to load game data:', e);
            return false;
        }
    }
    return false;
}

function resetGameData() {
    localStorage.removeItem('pixelAdventureRPG');
    playerStats = {
        hp: 100,
        maxHp: 100,
        xp: 0,
        xpRequired: 100,
        level: 1,
        coins: 0,
        gems: 0,
        damage: 10,
        defense: 0,
        speed: 3,
        enemiesDefeated: 0
    };
    gameState.currentLevel = 1;
    inventory.items.potion.quantity = 0;
    inventory.items.sword.quantity = 0;
    inventory.items.shield.quantity = 0;
    inventory.items.chest.quantity = 0;
    inventory.items.gem.quantity = 0;
    changeScreen('startMenu');
    updateHUD();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Start Menu
document.getElementById('playBtn').addEventListener('click', () => {
    initLevel(gameState.currentLevel);
    changeScreen('gameScreen');
});

document.getElementById('continueBtn').addEventListener('click', () => {
    if (gameState.currentLevel > 1) {
        initLevel(gameState.currentLevel);
        changeScreen('gameScreen');
    }
});

document.getElementById('settingsBtn').addEventListener('click', () => {
    changeScreen('settingsScreen');
});

// Settings Screen
document.getElementById('settingsBackBtn').addEventListener('click', () => {
    changeScreen('startMenu');
});

document.getElementById('levelSelectBackBtn').addEventListener('click', () => {
    changeScreen('startMenu');
});

// Pause Menu
document.getElementById('pauseSettingsBtn').addEventListener('click', () => {
    changeScreen('settingsScreen');
});

document.getElementById('resumeBtn').addEventListener('click', () => {
    gameState.isPaused = false;
    updatePauseMenu();
});

document.getElementById('mainMenuBtn').addEventListener('click', () => {
    playerStats.hp = playerStats.maxHp;
    changeScreen('startMenu');
    saveGameData();
});

// Game Over Screen
document.getElementById('retryBtn').addEventListener('click', restartLevel);
document.getElementById('nextLevelBtn').addEventListener('click', nextLevel);

document.getElementById('mainMenuFromGameOverBtn').addEventListener('click', () => {
    playerStats.hp = playerStats.maxHp;
    changeScreen('startMenu');
    saveGameData();
});

// Inventory Screen
document.getElementById('inventoryCloseBtn').addEventListener('click', () => {
    changeScreen('gameScreen');
});

// Shop Screen
document.getElementById('shopCloseBtn').addEventListener('click', () => {
    changeScreen('gameScreen');
});

// ============================================================================
// INITIALIZATION
// ============================================================================

window.addEventListener('load', () => {
    // Load saved game data
    const hasSaveData = loadGameData();

    if (hasSaveData && gameState.currentLevel > 1) {
        document.getElementById('continueBtn').style.display = 'block';
    }

    // Set initial values
    document.getElementById('volumeSlider').value = gameState.volume;
    document.getElementById('volumeValue').textContent = gameState.volume + '%';
    document.getElementById('difficultySelect').value = gameState.difficulty;
    document.getElementById('soundToggle').classList.toggle('active', gameState.soundEnabled);
    document.getElementById('musicToggle').classList.toggle('active', gameState.musicEnabled);

    masterGain.gain.value = gameState.volume / 100;

    updateHUD();
    changeScreen('startMenu');
    initLevel(1);

    // Resume audio context on first user interaction
    document.addEventListener('click', () => {
        if (soundContext.state === 'suspended') {
            soundContext.resume();
        }
    }, { once: true });

    // Start game loop
    requestAnimationFrame(gameLoop);
});
