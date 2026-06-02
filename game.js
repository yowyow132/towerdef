// Merge TD - 遊戲核心邏輯

// ==========================================
// 1. 遊戲常數與數值設定
// ==========================================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;

const GRID_WIDTH = 70;
const GRID_HEIGHT = 70;
const GRID_SPACING = 15;
const GRID_START = { x: 260, y: 125 };

// 上陣格子解鎖順序對照表 (0~11)
const UNLOCK_ORDER = [
    5,  // Row 1, Col 1 (初始)
    6,  // Row 1, Col 2 (初始)
    1,  // Row 0, Col 1 (初始)
    2,  // Row 0, Col 2 (初始)
    9,  // Row 2, Col 1 (第 5 格解鎖)
    10, // Row 2, Col 2 (第 6 格解鎖)
    4,  // Row 1, Col 0 (第 7 格解鎖)
    7,  // Row 1, Col 3 (第 8 格解鎖)
    0,  // Row 0, Col 0 (第 9 格解鎖)
    3,  // Row 0, Col 3 (第 10 格解鎖)
    8,  // Row 2, Col 0 (第 11 格解鎖)
    11  // Row 2, Col 3 (第 12 格解鎖)
];

// 格子解鎖費用曲線
const UNLOCK_COSTS = [0, 0, 0, 0, 100, 200, 450, 1000, 2000, 4000, 8000, 15000];

// 怪物行進路徑節點 (X, Y 像素)
const PATH_POINTS = [
    { x: 30, y: 55 },
    { x: 770, y: 55 },
    { x: 770, y: 425 },
    { x: 30, y: 425 },
    { x: 30, y: 220 },
    { x: 180, y: 220 } // Portal 出口
];

// ==========================================
// 2. 全域遊戲狀態
// ==========================================
let rogueState = {
    factions: {
        fury:  { level: 0, maxLevel: 5, name: '狂暴', color: '#ef4444', icon: '🔥', baseDesc: '每等提升全場攻擊力 +15% 與暴擊率 +5%', ultName: '核爆連鎖', ultDesc: '暴擊時引發 200% 範圍物理傷害爆炸' },
        swift: { level: 0, maxLevel: 5, name: '迅捷', color: '#22c55e', icon: '⚡', baseDesc: '每等提升全場防禦塔攻擊速度 +20%', ultName: '幻影過載', ultDesc: '連續攻擊同一個目標時攻速持續疊加最高 +150%' },
        frost: { level: 0, maxLevel: 5, name: '霜凍', color: '#3b82f6', icon: '❄️', baseDesc: '攻擊附帶減速 +8% 並擴大砲台濺射半徑 +15px', ultName: '絕對零度', ultDesc: '減速達 60% 時凍結目標 2 秒，對凍結目標傷害 +100%' },
        greed: { level: 0, maxLevel: 5, name: '貪婪', color: '#eab308', icon: '💰', baseDesc: '每等提升擊殺金幣 +30% 且召喚成本降低 12%', ultName: '財團利息', ultDesc: '波次結束時結算剩餘金幣並發放 30% 利息(上限 100)' },
        fate:  { level: 0, maxLevel: 5, name: '命運', color: '#a78bfa', icon: '🎲', baseDesc: '直接召喚高一級塔機率 +10% 且每次增幅獲得重滾次數 +2', ultName: '奇蹟突變', ultDesc: '合併時有 20% 機率直接連升 2 級' }
    },
    fusions: {
        gatling: { active: false, name: '加特林風暴', req: ['fury', 'swift'], color: 'linear-gradient(135deg, #ef4444, #22c55e)', icon: '🏹', desc: '【狂暴+迅捷】所有防禦塔發射分裂箭，每次射擊同時朝三個方向開火，均可暴擊' },
        shatter: { active: false, name: '碎冰核爆', req: ['fury', 'frost'], color: 'linear-gradient(135deg, #ef4444, #3b82f6)', icon: '💥', desc: '【狂暴+霜凍】攻擊減速/凍結怪傷害 +30%，且有 5% 機率秒殺普通與精英怪物' },
        midas:   { active: false, name: '點石成金', req: ['greed', 'fate'], color: 'linear-gradient(135deg, #eab308, #a78bfa)', icon: '🪙', desc: '【貪婪+命運】場上每個最高星級塔每秒產生 2 金幣，召喚塔時 5% 機率直接召喚出當前場上最高等級的塔' },
        bounty:  { active: false, name: '賞金獵手', req: ['swift', 'greed'], color: 'linear-gradient(135deg, #22c55e, #eab308)', icon: '🎯', desc: '【迅捷+貪婪】防禦塔累計發射 50 發子彈後標記懸賞目標，擊殺獲得 5 倍金幣' }
    },
    rerollsLeft: 2,
    totalShots: 0,
    bountyTargetId: null,
    passiveGoldTimer: 0
};

let gameState = {
    gold: 300,
    lives: 20,
    wave: 1,
    waveActive: false,
    activeSlots: 4,      // 初始解鎖 4 格
    speed: 1,            // 1, 2, 3 倍速
    isPaused: false,
    enemiesKilled: 0,
    waveCountdown: 5,
    spawnFinished: false,     // 波次間隔倒數
    waveTimer: null,
    currentSummonLevel: 1,   // 當前召喚等級
    upgradeSummonCost: 200,  // 提升召喚等級費用
    autoWave: false          // 自動下一波
};

// ==========================================
// 3. 全局玩家存檔 (局外養成)
// ==========================================
let playerProfile = {
    gameCoins: 1000, 
    ownedTowers: ['archer', 'magic', 'cannon'],
    ownedFactions: ['fury', 'swift', 'frost', 'greed', 'fate'], // 預設給予初始 5 派系
    globalUpgrades: {
        archer: 1, magic: 1, cannon: 1,
        sniper: 1, poison: 1, tesla: 1, frost: 1, blackhole: 1
    }
};

function saveProfile() {
    localStorage.setItem('mergeTDProfile', JSON.stringify(playerProfile));
}

function loadProfile() {
    const saved = localStorage.getItem('mergeTDProfile');
    if (saved) {
        let parsed = JSON.parse(saved);
        playerProfile.gameCoins = parsed.gameCoins || 0;
        playerProfile.ownedTowers = parsed.ownedTowers || ['archer', 'magic', 'cannon'];
        if(parsed.globalUpgrades) {
            Object.assign(playerProfile.globalUpgrades, parsed.globalUpgrades);
        }
        playerProfile.ownedFactions = parsed.ownedFactions || ['fury', 'swift', 'frost', 'greed', 'fate'];
    }
}
loadProfile();

// 計算全域升級費用的公式
function getUpgradeCost(type) {
    let level = playerProfile.globalUpgrades[type] || 1;
    return Math.floor(100 * Math.pow(1.5, level - 1));
}

// ------------------------------------------
// 視圖切換與生命週期邏輯
// ------------------------------------------
function switchView(viewId) {
    document.querySelectorAll('.view-screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    
    // 更新主選單 UI
    if(viewId === 'home-view') {
        document.getElementById('home-coins').innerText = playerProfile.gameCoins;
    }
}

function initBattle() {
    restartGame(); // 重置單局進度
    switchView('battle-view');
}

function quitBattle() {
    isGameOver = true;
    gameState.waveActive = false;
    clearTimeout(gameState.waveTimer);
    switchView('home-view');
}

// 塔與實體容器
let benchSlots = Array(6).fill(null); // 備戰區 (長度 6)
let fieldSlots = Array(12).fill(null); // 上陣區 (長度 12)
let unlockedSlots = Array(12).fill(false); // 上陣格子是否解鎖

// 初始化前 4 格解鎖狀態
for (let i = 0; i < 4; i++) {
    unlockedSlots[UNLOCK_ORDER[i]] = true;
}

let enemies = [];
let projectiles = [];
let particles = [];
let damageTexts = [];

// Canvas 與 DOM 參考
let canvas, ctx;
let dragInfo = null; // 儲存拖拽狀態

// ==========================================
// 3. 類別定義 (Tower, Enemy, Projectile, Particle)
// ==========================================

class Tower {
    constructor(type, level) {
        this.type = type; // 'archer', 'magic', 'cannon'
        this.level = level; // 1, 2, 3, 4, 5...
        this.lastShot = 0; // 上次射擊時間
        this.angle = 0;
        this.id = Math.random().toString(36).substr(2, 9);
        
        this.consecutiveHits = 0;
        this.lastTargetId = null;
    }

    get ATK() {
        const base = { archer: 16, magic: 26, cannon: 40, sniper: 300, poison: 12, tesla: 35, frost: 20, blackhole: 90 }[this.type];
        const levelMult = Math.pow(1.8, this.level - 1);
        const globalMult = 1 + ((playerProfile.globalUpgrades[this.type] || 1) - 1) * 0.2; // 每升一級 +20%
        const furyMult = 1 + rogueState.factions.fury.level * 0.15;
        return Math.round(base * levelMult * globalMult * furyMult);
    }

    get AS() {
        const base = { archer: 1.2, magic: 0.8, cannon: 0.4, sniper: 0.15, poison: 1.5, tesla: 0.6, frost: 0.7, blackhole: 0.2 }[this.type];
        const levelMult = Math.pow(1.3, this.level - 1);
        const swiftMult = 1 + rogueState.factions.swift.level * 0.20;
        let comboMult = 1;
        if (rogueState.factions.swift.level === 5 && this.consecutiveHits > 0) {
            comboMult += this.consecutiveHits * 0.10;
        }
        return base * levelMult * swiftMult * comboMult; // 射擊頻率（次/秒）
    }

    get range() {
        const base = { archer: 3.5, magic: 3.0, cannon: 4.5, sniper: 8.0, poison: 3.0, tesla: 3.5, frost: 4.0, blackhole: 5.0 }[this.type];
        return base * 75; // 轉為像素距離
    }

    get color() {
        return {
            archer: '#10b981', // 綠色
            magic: '#3b82f6',  // 藍色
            cannon: '#fb923c'  // 橘色
        }[this.type];
    }

    get name() {
        return {
            archer: '弓箭塔',
            magic: '魔法塔',
            cannon: '砲台'
        }[this.type];
    }

    // 計算出售價格
    get sellPrice() {
        if (this.level === 1) return 25; // 50金的半價
        // Lv.2 是 80金買入，半價 40。Lv.3 價值 160金，半價 80 ...
        return 40 * Math.pow(2, this.level - 2);
    }

    // 尋找目標 (最靠近出口且在範圍內的怪物)
    findTarget() {
        let bestTarget = null;
        let maxDist = -1;

        for (let enemy of enemies) {
            if (enemy.hp <= 0) continue;
            let dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (dist <= this.range) {
                // 優先攻擊前進距離最遠的怪
                if (enemy.distanceTraveled > maxDist) {
                    maxDist = enemy.distanceTraveled;
                    bestTarget = enemy;
                }
            }
        }
        return bestTarget;
    }

    update(x, y, timeStep) {
        this.x = x;
        this.y = y;

        let target = this.findTarget();
        if (target) {
            // 旋轉指向目標
            this.angle = Math.atan2(target.y - y, target.x - x);

            // 攻擊冷卻判定（受遊戲速度影響，加速時攻擊間隔縮短）
            let cooldown = 1000 / (this.AS * gameState.speed);
            if (Date.now() - this.lastShot >= cooldown) {
                // 迅捷連擊攻速加成判定
                if (rogueState.factions.swift.level === 5) {
                    if (target.id === this.lastTargetId) {
                        this.consecutiveHits = Math.min(15, this.consecutiveHits + 1);
                    } else {
                        this.consecutiveHits = 0;
                        this.lastTargetId = target.id;
                    }
                } else {
                    this.consecutiveHits = 0;
                    this.lastTargetId = null;
                }

                this.shoot(target);
                this.lastShot = Date.now();
            }
        } else {
            this.consecutiveHits = 0;
            this.lastTargetId = null;
        }
    }

    shoot(target) {
        // 狂暴暴擊率判定
        let isCrit = Math.random() < rogueState.factions.fury.level * 0.05;
        let dmg = this.ATK;
        if (isCrit) dmg *= 2;

        // 賞金獵手發射計數
        if (rogueState.fusions.bounty.active) {
            rogueState.totalShots++;
            if (rogueState.totalShots >= 50) {
                rogueState.totalShots = 0;
                let activeEnemies = enemies.filter(e => e.hp > 0 && e.id !== rogueState.bountyTargetId);
                if (activeEnemies.length > 0) {
                    let randEnemy = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
                    rogueState.bountyTargetId = randEnemy.id;
                }
            }
        }

        if (this.type === 'archer') {
            if (rogueState.fusions.gatling.active) {
                projectiles.push(new Projectile(this.x, this.y, target, 'arrow', dmg, 7, { angleOffset: 0, isCrit: isCrit }));
                projectiles.push(new Projectile(this.x, this.y, target, 'arrow', dmg, 7, { angleOffset: -0.25, isCrit: isCrit }));
                projectiles.push(new Projectile(this.x, this.y, target, 'arrow', dmg, 7, { angleOffset: 0.25, isCrit: isCrit }));
            } else {
                projectiles.push(new Projectile(this.x, this.y, target, 'arrow', dmg, 7, { isCrit: isCrit }));
            }
        } else if (this.type === 'magic') {
            const shootOneLaser = (t) => {
                let finalDmg = dmg;
                t.applySlow(0.15 + (this.level * 0.025), 2000);
                t.damage(finalDmg, isCrit ? '#ef4444' : '#60a5fa', isCrit);
                createLaserEffect(this.x, this.y, t.x, t.y);
            };

            shootOneLaser(target);

            // 加特林風暴對魔法塔的加成 (同時射擊額外兩個目標)
            if (rogueState.fusions.gatling.active) {
                let extraCount = 0;
                for (let enemy of enemies) {
                    if (enemy !== target && enemy.hp > 0 && Math.hypot(enemy.x - this.x, enemy.y - this.y) <= this.range) {
                        shootOneLaser(enemy);
                        extraCount++;
                        if (extraCount >= 2) break;
                    }
                }
            }
        } else if (this.type === 'cannon') {
            let config = {
                splashRadius: 75 + rogueState.factions.frost.level * 15,
                splashRatio: 0.5 + (this.level * 0.05),
                isCrit: isCrit
            };

            if (rogueState.fusions.gatling.active) {
                projectiles.push(new Projectile(this.x, this.y, target, 'bomb', dmg, 4, { ...config, angleOffset: 0 }));
                projectiles.push(new Projectile(this.x, this.y, target, 'bomb', dmg, 4, { ...config, angleOffset: -0.25 }));
                projectiles.push(new Projectile(this.x, this.y, target, 'bomb', dmg, 4, { ...config, angleOffset: 0.25 }));
            } else {
                projectiles.push(new Projectile(this.x, this.y, target, 'bomb', dmg, 4, config));
            }
        } else if (this.type === 'sniper') {
            target.damage(dmg, isCrit ? '#ef4444' : '#d946ef', isCrit);
            createLaserEffect(this.x, this.y, target.x, target.y, '#d946ef', 4);
        } else if (this.type === 'poison') {
            projectiles.push(new Projectile(this.x, this.y, target, 'poison_bolt', dmg, 6, { isCrit: isCrit, duration: 3000 }));
        } else if (this.type === 'tesla') {
            let chainDmg = dmg;
            target.damage(chainDmg, isCrit ? '#ef4444' : '#facc15', isCrit);
            createLaserEffect(this.x, this.y, target.x, target.y, '#facc15', 3);
            let prevTarget = target;
            let bounces = 3;
            for (let i = 0; i < bounces; i++) {
                let nextTarget = enemies.find(e => e.hp > 0 && e !== prevTarget && Math.hypot(e.x - prevTarget.x, e.y - prevTarget.y) < 150);
                if (nextTarget) {
                    chainDmg *= 0.8;
                    nextTarget.damage(chainDmg, isCrit ? '#ef4444' : '#facc15', isCrit);
                    createLaserEffect(prevTarget.x, prevTarget.y, nextTarget.x, nextTarget.y, '#facc15', 2);
                    prevTarget = nextTarget;
                } else break;
            }
        } else if (this.type === 'frost') {
            projectiles.push(new Projectile(this.x, this.y, target, 'frost_orb', dmg, 5, { isCrit: isCrit }));
        } else if (this.type === 'blackhole') {
            projectiles.push(new Projectile(this.x, this.y, target, 'blackhole', dmg, 3, { isCrit: isCrit }));
        }
    }

    draw(ctx, x, y, isHovered = false) {
        ctx.save();
        ctx.translate(x + GRID_WIDTH / 2, y + GRID_HEIGHT / 2);

        // 畫底座
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 20, 30, 0.9)';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = isHovered ? 12 : 5;
        ctx.fill();
        ctx.stroke();

        // 畫發光核心
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // 畫武器砲管/射手箭嘴 (指向目標角度)
        ctx.rotate(this.angle);
        ctx.beginPath();
        if (this.type === 'archer') {
            // 弓形
            ctx.arc(10, 0, 14, -Math.PI / 3, Math.PI / 3);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            // 箭矢
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(22, 0);
            ctx.strokeStyle = this.color;
            ctx.stroke();
        } else if (this.type === 'magic') {
            // 三角聚能環
            ctx.moveTo(8, -12);
            ctx.lineTo(20, 0);
            ctx.lineTo(8, 12);
            ctx.closePath();
            ctx.fillStyle = 'rgba(96, 165, 250, 0.4)';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        } else if (this.type === 'cannon') {
            // 砲管
            ctx.rect(0, -6, 22, 12);
            ctx.fillStyle = '#4b5563';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();

        // 畫星星等級
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 12px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('★' + this.level, x + GRID_WIDTH / 2, y + GRID_HEIGHT - 6);
    }
}

class Enemy {
    constructor(wave, isBoss = false) {
        this.isBoss = isBoss;
        this.id = Math.random().toString(36).substr(2, 9);
        this.isFrozen = false;
        this.frozenTimer = 0;
        this.poisonTimer = 0;
        this.poisonDmg = 0;

        // 難度階梯：每 10 波提升一次 HP 指數成長系數
        const difficultyTier = Math.floor((wave - 1) / 10);
        const hpGrowthRate = 1.20 + Math.min(0.20, difficultyTier * 0.05); // 1.20, 1.25, 1.30, 1.35...
        const baseHp = isBoss ? 1000 : 100;
        const waveHpMultiplier = Math.pow(hpGrowthRate, wave - 1);
        let calculatedHp = Math.round(baseHp * waveHpMultiplier);

        // 決定非 Boss 怪物的類型
        this.enemyType = 'standard';
        if (!isBoss) {
            let roll = Math.random();
            if (wave <= 10) {
                // 1~10波：普通怪 (70%)，迅捷怪 (30%)
                if (roll < 0.30) this.enemyType = 'speedy';
            } else if (wave <= 20) {
                // 11~20波：普通怪 (50%)，迅捷怪 (25%)，重裝怪 (25%)
                if (roll < 0.25) this.enemyType = 'speedy';
                else if (roll < 0.50) this.enemyType = 'armored';
            } else {
                // 21波以上：加入自癒怪
                if (roll < 0.20) this.enemyType = 'speedy';
                else if (roll < 0.40) this.enemyType = 'armored';
                else if (roll < 0.60) this.enemyType = 'regen';
            }
        }

        // 根據類型賦予不同屬性與視覺特徵
        let baseSpeed = 0.9 + Math.random() * 0.3;
        this.radius = 12;
        this.color = '#818cf8';

        if (isBoss) {
            this.enemyType = 'boss';
            baseSpeed = 0.6;
            this.radius = 20;
            this.color = '#ef4444';
            calculatedHp *= (1 + difficultyTier * 0.5); // Boss 在後期階梯額外加強
        } else {
            switch (this.enemyType) {
                case 'speedy':
                    baseSpeed = 1.65;
                    calculatedHp *= 0.55;
                    this.radius = 9;
                    this.color = '#10b981'; // 綠色
                    break;
                case 'armored':
                    baseSpeed = 0.5;
                    calculatedHp *= 2.3;
                    this.radius = 16;
                    this.color = '#94a3b8'; // Slate 灰色
                    break;
                case 'regen':
                    baseSpeed = 0.9;
                    calculatedHp *= 1.35;
                    this.radius = 12;
                    this.color = '#ec4899'; // 自癒粉色
                    break;
                case 'standard':
                default:
                    this.color = '#a78bfa'; // 普通紫色
                    break;
            }
        }

        this.maxHp = Math.round(calculatedHp);
        this.hp = this.maxHp;
        this.speed = baseSpeed;
        
        this.x = PATH_POINTS[0].x;
        this.y = PATH_POINTS[0].y;
        this.pathIndex = 0;
        this.distanceTraveled = 0;
        this.slowAmount = 0; // 當前減速百分比 (0 = 無減速)
        this.slowTimer = 0;  // 減速剩餘時間 (ms)
        this.hitFlash = 0;   // 受傷閃爍計數
    }

    applySlow(amount, duration) {
        // 霜凍派系強化減速效果
        let extraSlow = rogueState.factions.frost.level * 0.08;
        let totalAmount = amount + extraSlow;

        // 減速不疊加，取最大值，重置時間
        this.slowAmount = Math.min(0.85, Math.max(this.slowAmount, totalAmount));
        this.slowTimer = duration;

        // 絕對零度：被減速到上限（或慢於0.6）時被凍結2秒
        if (rogueState.factions.frost.level === 5 && !this.isFrozen && this.slowAmount >= 0.6) {
            this.isFrozen = true;
            this.frozenTimer = 2000;
        }
    }

    applyPoison(dps, duration) {
        this.poisonDmg = Math.max(this.poisonDmg, dps);
        this.poisonTimer = Math.max(this.poisonTimer, duration);
    }

    damage(amount, color = '#f3f4f6', isCrit = false) {
        if (this.hp <= 0) return;

        // 霜凍絕對零度：攻擊被凍結敵人時傷害提升 100%
        if (this.isFrozen) {
            amount *= 2;
        }

        // 碎冰核爆融合技能
        let isShatterKill = false;
        if (rogueState.fusions.shatter.active && (this.slowAmount > 0 || this.isFrozen)) {
            amount = Math.round(amount * 1.30); // 無視防禦加成 30%
            if (!this.isBoss && Math.random() < 0.05) {
                isShatterKill = true;
                amount = this.hp; // 秒殺
            }
        }

        this.hp -= amount;
        this.hitFlash = 3; // 閃爍3幀

        // 製造傷害飄字
        damageTexts.push({
            text: isShatterKill ? '❄️ 碎冰秒殺! ❄️' : (isCrit ? '💥 ' + amount : amount),
            x: this.x + (Math.random() * 20 - 10),
            y: this.y - 15,
            color: isShatterKill ? '#3b82f6' : color,
            alpha: 1.0,
            life: 30,
            scale: isCrit ? 1.5 : 1.0
        });

        // 狂暴 5等終極強化【核爆連鎖】
        if (isCrit && rogueState.factions.fury.level === 5) {
            triggerFuryExplosion(this.x, this.y, Math.round(amount * 2));
        }

        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        // 掉落金幣：Lv1怪 = 3 + wave 錢，Boss 給 10 倍
        let goldReward = (3 + gameState.wave) * (this.isBoss ? 10 : 1);
        
        // 貪婪派系加成 (每等 +30%)
        let greedBonus = 1 + rogueState.factions.greed.level * 0.30;
        goldReward = Math.round(goldReward * greedBonus);

        // 賞金獵手 5 倍金幣
        if (this.id === rogueState.bountyTargetId) {
            goldReward *= 5;
            rogueState.bountyTargetId = null;

            damageTexts.push({
                text: '🎯 懸賞達成 5x 金幣!',
                x: this.x,
                y: this.y - 30,
                color: '#eab308',
                alpha: 1.0,
                life: 50
            });
        }

        addGold(goldReward);

        // 擊殺特效
        createExplosion(this.x, this.y, this.color, this.isBoss ? 30 : 15);
        gameState.enemiesKilled++;
    }

    update(timeStep) {
        // 毒液效果
        if (this.poisonTimer > 0) {
            this.poisonTimer -= (16.6 * gameState.speed);
            this.hp -= (this.poisonDmg / 60) * gameState.speed;
            
            // 中毒特效
            if (Math.random() < 0.1) {
                createExplosion(this.x + (Math.random()*10-5), this.y + (Math.random()*10-5), '#84cc16', 2);
            }
            if (this.hp <= 0) {
                this.hp = 0;
                this.die();
                return;
            }
        }

        // 自癒怪生命再生：每秒回復 2.5% 的最大血量 (被凍結時暫停自癒)
        if (this.enemyType === 'regen' && this.hp < this.maxHp && this.hp > 0 && !this.isFrozen) {
            let regenAmount = (this.maxHp * 0.025) * (timeStep / 1000) * gameState.speed;
            this.hp = Math.min(this.maxHp, this.hp + regenAmount);
        }

        // 更新凍結狀態
        if (this.isFrozen) {
            this.frozenTimer -= (16.6 * gameState.speed);
            if (this.frozenTimer <= 0) {
                this.isFrozen = false;
                this.slowAmount = 0; // 解凍時重設減速
            }
        }

        // 更新減速時間
        if (this.slowTimer > 0 && !this.isFrozen) {
            this.slowTimer -= (16.6 * gameState.speed); // 概估一影格 16.6ms
            if (this.slowTimer <= 0) {
                this.slowAmount = 0;
            }
        }

        // 實際速度計算
        let currentSpeed = this.isFrozen ? 0 : this.speed * (1 - this.slowAmount) * gameState.speed;

        // 朝著下一個節點移動
        if (this.pathIndex < PATH_POINTS.length - 1) {
            let nextPoint = PATH_POINTS[this.pathIndex + 1];
            let dx = nextPoint.x - this.x;
            let dy = nextPoint.y - this.y;
            let dist = Math.hypot(dx, dy);

            if (dist <= currentSpeed) {
                // 到達節點，切換到下一個
                this.x = nextPoint.x;
                this.y = nextPoint.y;
                this.pathIndex++;
            } else {
                // 線性插值移動
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
                this.distanceTraveled += currentSpeed;
            }
        } else {
            // 到達出口，扣減玩家血量
            gameState.lives -= this.isBoss ? 5 : 1;
            updateUI();
            
            // 警示畫面特效
            createExplosion(this.x, this.y, '#ef4444', 25);
            
            // 標記死亡/移除
            this.hp = 0;
            if (this.id === rogueState.bountyTargetId) {
                rogueState.bountyTargetId = null;
            }
            
            if (gameState.lives <= 0) {
                endGame();
            }
        }

        if (this.hitFlash > 0) this.hitFlash--;
    }

    draw(ctx) {
        ctx.save();

        // 畫影子
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 4;

        // 懸賞標記繪製 (如果該怪是懸賞目標)
        if (this.id === rogueState.bountyTargetId) {
            ctx.fillStyle = '#eab308';
            ctx.font = 'bold 16px Outfit';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#eab308';
            ctx.shadowBlur = 8;
            ctx.fillText('🎯', this.x, this.y - this.radius - 18);
        }

        // 怪物發光本體
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        if (this.hitFlash > 0) {
            ctx.fillStyle = '#fff';
        } else {
            ctx.fillStyle = this.color;
            // 被減速/凍結時的特殊特效
            if (this.isFrozen) {
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 4.5;
                ctx.stroke();

                ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.slowAmount > 0) {
                ctx.strokeStyle = '#60a5fa';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }
        ctx.fill();

        // Boss 特有裝飾 (冠冕)
        if (this.isBoss) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.moveTo(this.x - 12, this.y - 18);
            ctx.lineTo(this.x - 6, this.y - 28);
            ctx.lineTo(this.x, this.y - 20);
            ctx.lineTo(this.x + 6, this.y - 28);
            ctx.lineTo(this.x + 12, this.y - 18);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        // 血條渲染
        const barWidth = this.radius * 2;
        const barHeight = 4;
        const barX = this.x - this.radius;
        const barY = this.y - this.radius - 10;

        // 底色
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // 血量比例
        const hpRatio = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = this.isBoss ? '#ef4444' : '#10b981';
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    }
}

class Projectile {
    constructor(startX, startY, target, type, damage, speed, config = null) {
        this.x = startX;
        this.y = startY;
        this.target = target;
        this.type = type; // 'arrow', 'bomb'
        this.damageVal = damage;
        this.speed = speed;
        this.config = config; // 用於爆炸等設定

        this.isCrit = config && config.isCrit ? config.isCrit : false;
        this.angleOffset = config && config.angleOffset !== undefined ? config.angleOffset : null;

        // 加特林分裂箭直線飛行方向計算
        if (this.angleOffset !== null) {
            let dx = target.x - startX;
            let dy = target.y - startY;
            let baseAngle = Math.atan2(dy, dx);
            let finalAngle = baseAngle + this.angleOffset;
            this.vx = Math.cos(finalAngle) * speed;
            this.vy = Math.sin(finalAngle) * speed;
        }
    }

    update() {
        // 直線彈道與碰觸判定
        if (this.angleOffset !== null) {
            let step = gameState.speed;
            this.x += this.vx * step;
            this.y += this.vy * step;

            for (let enemy of enemies) {
                if (enemy.hp > 0) {
                    let d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                    if (d <= enemy.radius + 10) {
                        this.target = enemy;
                        this.hit();
                        return false;
                    }
                }
            }
            if (this.x < 0 || this.x > CANVAS_WIDTH || this.y < 0 || this.y > CANVAS_HEIGHT) {
                return false;
            }
            return true;
        }

        // 一般追蹤彈道
        if (!this.target || this.target.hp <= 0) {
            let closest = null;
            let minDist = Infinity;
            for (let enemy of enemies) {
                if (enemy.hp > 0) {
                    let d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                    if (d < minDist) {
                        minDist = d;
                        closest = enemy;
                    }
                }
            }
            if (closest) {
                this.target = closest;
            } else {
                return false;
            }
        }

        let dx = this.target.x - this.x;
        let dy = this.target.y - this.y;
        let dist = Math.hypot(dx, dy);

        let step = this.speed * gameState.speed;

        if (dist <= step) {
            this.hit();
            return false;
        }

        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        return true;
    }

    hit() {
        // 霜凍派系：命中目標造成額外減速
        if (rogueState.factions.frost.level > 0) {
            this.target.applySlow(0, 2000);
        }

        if (this.type === 'arrow') {
            this.target.damage(this.damageVal, this.isCrit ? '#ef4444' : '#34d399', this.isCrit);
            createExplosion(this.x, this.y, '#34d399', 5);
        } else if (this.type === 'bomb') {
            const radius = this.config.splashRadius;
            const ratio = this.config.splashRatio;

            createExplosion(this.x, this.y, '#fb923c', 20);

            for (let enemy of enemies) {
                if (enemy.hp <= 0) continue;
                let dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (dist <= radius) {
                    // 霜凍減速濺射
                    if (rogueState.factions.frost.level > 0) {
                        enemy.applySlow(0, 2000);
                    }
                    let dmg = (enemy === this.target) ? this.damageVal : Math.round(this.damageVal * ratio);
                    enemy.damage(dmg, this.isCrit ? '#ef4444' : '#fb923c', this.isCrit && (enemy === this.target));
                }
            }
        } else if (this.type === 'poison_bolt') {
            this.target.damage(this.damageVal, this.isCrit ? '#ef4444' : '#84cc16', this.isCrit);
            createExplosion(this.x, this.y, '#84cc16', 5);
            let poisonDur = this.config.duration || 3000;
            this.target.applyPoison(this.damageVal * 0.5, poisonDur);
        } else if (this.type === 'frost_orb') {
            createExplosion(this.x, this.y, '#3b82f6', 20);
            for (let enemy of enemies) {
                if (enemy.hp <= 0) continue;
                if (Math.hypot(enemy.x - this.x, enemy.y - this.y) <= 100) {
                    enemy.damage(this.damageVal, this.isCrit ? '#ef4444' : '#3b82f6', this.isCrit && (enemy === this.target));
                    enemy.applySlow(0.4, 3000); 
                }
            }
        } else if (this.type === 'blackhole') {
            createExplosion(this.x, this.y, '#4f46e5', 40);
            for (let enemy of enemies) {
                if (enemy.hp <= 0) continue;
                let d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (d <= 150) {
                    enemy.damage(this.damageVal, this.isCrit ? '#ef4444' : '#4f46e5', this.isCrit && (enemy === this.target));
                    let dx = this.x - enemy.x;
                    let dy = this.y - enemy.y;
                    if (d > 10 && !enemy.isBoss) {
                        enemy.x += (dx / d) * 30; 
                        enemy.y += (dy / d) * 30;
                    }
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        if (this.type === 'arrow') {
            ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#34d399';
            ctx.shadowColor = '#34d399';
            ctx.shadowBlur = 8;
            ctx.fill();
        } else if (this.type === 'bomb') {
            ctx.arc(this.x, this.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#eab308';
            ctx.shadowColor = '#eab308';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        } else if (this.type === 'poison_bolt') {
            ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#84cc16';
            ctx.shadowColor = '#84cc16';
            ctx.shadowBlur = 8;
            ctx.fill();
        } else if (this.type === 'frost_orb') {
            ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6';
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        } else if (this.type === 'blackhole') {
            ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#1e1b4b'; // deep purple/black core
            ctx.shadowColor = '#4f46e5';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#a5b4fc';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    }
}

// ==========================================
// 4. 特效產生器 (Particles & VFX)
// ==========================================

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = 1 + Math.random() * 4;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 1 + Math.random() * 3,
            color: color,
            alpha: 1.0,
            life: 20 + Math.random() * 20
        });
    }
}

function createLaserEffect(sx, sy, tx, ty) {
    // 建立射線發光線段粒子
    particles.push({
        type: 'laser',
        sx: sx,
        sy: sy,
        tx: tx,
        ty: ty,
        color: '#60a5fa',
        alpha: 1.0,
        life: 8
    });
}

function createMergeEffect(x, y) {
    // 圓形擴散衝擊波
    particles.push({
        type: 'ring',
        x: x,
        y: y,
        radius: 5,
        maxRadius: 50,
        color: '#a78bfa',
        alpha: 1.0,
        life: 15
    });
    // 爆開金色與紫色星屑
    createExplosion(x, y, '#a78bfa', 15);
    createExplosion(x, y, '#facc15', 15);
}

// 狂暴 5等終極強化【核爆連鎖】範圍爆炸傷害
function triggerFuryExplosion(x, y, damage) {
    createExplosion(x, y, '#ef4444', 15);
    particles.push({
        type: 'ring',
        x: x,
        y: y,
        radius: 5,
        maxRadius: 80,
        color: '#ef4444',
        alpha: 1.0,
        life: 12
    });
    
    for (let enemy of enemies) {
        if (enemy.hp <= 0) continue;
        let d = Math.hypot(enemy.x - x, enemy.y - y);
        if (d <= 80) {
            enemy.damage(damage, '#ef4444', false); // 避免範圍內觸發連鎖暴擊
        }
    }
}

// ==========================================
// 5. 局內功能操作 (Summon, Merge, Sell, Unlock)
// ==========================================

// 檢查備戰區空位
function getFreeBenchSlot() {
    for (let i = 0; i < benchSlots.length; i++) {
        if (benchSlots[i] === null) return i;
    }
    return -1;
}

// 召喚塔（使用當前召喚等級）
function summonTower() {
    const level = gameState.currentSummonLevel;
    // 費用公式：Lv1=50, Lv2=100, Lv3=200, Lv4=400... (50 * 2^(level-1))
    const baseCost = 50 * Math.pow(2, level - 1);
    
    // 貪婪派系：召喚1級塔的成本降低（每等降低 12%，取消下限）
    const discount = rogueState.factions.greed.level * 0.12;
    const cost = Math.max(0, Math.round(baseCost * (1 - discount)));
    
    if (gameState.gold < cost) return;

    let freeSlot = getFreeBenchSlot();
    if (freeSlot === -1) {
        alert("備戰區已滿，請先合併或出售防禦塔騰出空位！");
        return;
    }

    // 扣除金幣
    addGold(-cost);

    // 從玩家已擁有的塔池中隨機抽取
    const pool = playerProfile.ownedTowers && playerProfile.ownedTowers.length > 0 ? playerProfile.ownedTowers : ['archer', 'magic', 'cannon'];
    const randType = pool[Math.floor(Math.random() * pool.length)];

    let spawnLevel = level;
    let isMidasTrigger = false;

    // 點石成金 (貪婪+命運)：有 5% 機率直接召喚當前場上最高星級塔
    if (rogueState.fusions.midas.active && Math.random() < 0.05) {
        let maxLvl = 1;
        for (let t of fieldSlots) {
            if (t && t.level > maxLvl) maxLvl = t.level;
        }
        for (let t of benchSlots) {
            if (t && t.level > maxLvl) maxLvl = t.level;
        }
        spawnLevel = maxLvl;
        isMidasTrigger = true;
    } else {
        // 命運派系：直接召喚出2級塔機率 (每等+10%)
        let upgradeChance = rogueState.factions.fate.level * 0.10;
        if (Math.random() < upgradeChance) {
            spawnLevel = level + 1;
        }
    }

    benchSlots[freeSlot] = new Tower(randType, spawnLevel);

    updateUI();
    renderBenchDOM();

    // 在該備戰格製造出生特效
    let slotEl = document.querySelector(`.bench-slot[data-index="${freeSlot}"]`);
    if (slotEl) {
        let rect = slotEl.getBoundingClientRect();
        createExplosion(rect.width / 2, rect.height / 2, '#a78bfa', 10);
    }

    if (isMidasTrigger) {
        damageTexts.push({
            text: `👑 點石成金 Lv.${spawnLevel}!`,
            x: canvas.width / 2,
            y: canvas.height - 120,
            color: '#eab308',
            alpha: 1.0,
            life: 50
        });
    }
}

// 提升召喚等級
function upgradeSummonLevel() {
    const cost = gameState.upgradeSummonCost;
    if (gameState.gold < cost) return;

    addGold(-cost);
    gameState.currentSummonLevel++;
    // 每次提升後費用翻倍
    gameState.upgradeSummonCost = Math.round(cost * 2);

    const newLvl = gameState.currentSummonLevel;

    // 將所有低於新召喚等級的備戰塔升級
    for (let i = 0; i < benchSlots.length; i++) {
        let t = benchSlots[i];
        if (t && t.level < newLvl) {
            t.level = newLvl;
            let slotEl = document.querySelector(`.bench-slot[data-index="${i}"]`);
            if (slotEl) {
                let rect = slotEl.getBoundingClientRect();
                createExplosion(rect.width / 2, rect.height / 2, '#ec4899', 8);
            }
        }
    }

    // 將所有低於新召喚等級的場上塔升級
    for (let i = 0; i < fieldSlots.length; i++) {
        let t = fieldSlots[i];
        if (t && t.level < newLvl) {
            t.level = newLvl;
            let col = i % 4;
            let row = Math.floor(i / 4);
            let cx = GRID_START.x + col * (GRID_WIDTH + GRID_SPACING) + GRID_WIDTH / 2;
            let cy = GRID_START.y + row * (GRID_HEIGHT + GRID_SPACING) + GRID_HEIGHT / 2;
            createExplosion(cx, cy, '#ec4899', 10);
            damageTexts.push({
                text: `▲ Lv.${newLvl}`,
                x: cx,
                y: cy - 20,
                color: '#ec4899',
                alpha: 1.0,
                life: 30
            });
        }
    }

    updateUI();
    renderBenchDOM();

    // 升級特效：在備戰區中央噴發
    createExplosion(canvas.width / 2, canvas.height / 2, '#ec4899', 20);
    damageTexts.push({
        text: `召喚等級 ▲ Lv.${gameState.currentSummonLevel}`,
        x: canvas.width / 2,
        y: canvas.height / 2 - 30,
        color: '#ec4899',
        alpha: 1.0,
        life: 50
    });
}

// 局內全域升級
function upgradeGlobal(type) {
    let cost = upgradeCosts[type];
    if (gameState.gold < cost) return;

    addGold(-cost);
    globalLevels[type]++;
    // 每次升級價格增長 50%
    upgradeCosts[type] = Math.round(cost * 1.5);

    updateUI();

    // 特效：畫面上所有該類別塔飄出升級符號
    for (let i = 0; i < fieldSlots.length; i++) {
        let t = fieldSlots[i];
        if (t && t.type === type) {
            let cx = GRID_START.x + (i % 4) * (GRID_WIDTH + GRID_SPACING) + GRID_WIDTH / 2;
            let cy = GRID_START.y + Math.floor(i / 4) * (GRID_HEIGHT + GRID_SPACING) + GRID_HEIGHT / 2;
            createExplosion(cx, cy, '#10b981', 8);
            damageTexts.push({
                text: 'UPGRADE!',
                x: cx,
                y: cy - 20,
                color: '#10b981',
                alpha: 1.0,
                life: 40
            });
        }
    }
}

// 塔強度分數（用來排序）
function towerStrength(t) {
    // 等級優先，同等級看基礎 ATK
    const atkBase = { archer: 16, magic: 26, cannon: 40 };
    return t.level * 10000 + atkBase[t.type];
}

// 一鍵合成：跨越備戰區和場上，反覆合併直到沒有配對
function mergeAllBench() {
    let merged = true;
    while (merged) {
        merged = false;

        // 建立所有塔的列表（含位置資訊）
        let allSlots = [];
        for (let i = 0; i < benchSlots.length; i++) {
            if (benchSlots[i]) allSlots.push({ area: 'bench', index: i, tower: benchSlots[i] });
        }
        for (let i = 0; i < fieldSlots.length; i++) {
            if (fieldSlots[i]) allSlots.push({ area: 'field', index: i, tower: fieldSlots[i] });
        }

        // 尋找任意一對可合併的塔
        for (let a = 0; a < allSlots.length; a++) {
            for (let b = a + 1; b < allSlots.length; b++) {
                let ta = allSlots[a], tb = allSlots[b];
                if (ta.tower.type === tb.tower.type && ta.tower.level === tb.tower.level) {
                    // 合併！升一級，隨機種類
                    const types = ['archer', 'magic', 'cannon'];
                    const randType = types[Math.floor(Math.random() * types.length)];
                    
                    let nextLevel = ta.tower.level + 1;
                    // 命運派系 5等【奇蹟突變】有20%機率連升兩級
                    if (rogueState.factions.fate.level === 5 && Math.random() < 0.20) {
                        nextLevel = ta.tower.level + 2;
                        damageTexts.push({
                            text: '✨ 奇蹟突變! ✨',
                            x: canvas.width / 2,
                            y: canvas.height / 2,
                            color: '#a78bfa',
                            alpha: 1.0,
                            life: 60
                        });
                    }

                    const newTower = new Tower(randType, nextLevel);

                    // 結果優先放到場上的那個格；若兩個都在場上，放 a；若兩個都在備戰，放 a
                    let destArea, destIndex;
                    if (ta.area === 'field') {
                        destArea = 'field'; destIndex = ta.index;
                    } else if (tb.area === 'field') {
                        destArea = 'field'; destIndex = tb.index;
                    } else {
                        destArea = 'bench'; destIndex = ta.index;
                    }

                    // 清除兩個原始格
                    if (ta.area === 'bench') benchSlots[ta.index] = null;
                    else fieldSlots[ta.index] = null;
                    if (tb.area === 'bench') benchSlots[tb.index] = null;
                    else fieldSlots[tb.index] = null;

                    // 放入結果
                    if (destArea === 'bench') benchSlots[destIndex] = newTower;
                    else fieldSlots[destIndex] = newTower;

                    // 合併特效
                    if (destArea === 'field') {
                        let col = destIndex % 4;
                        let row = Math.floor(destIndex / 4);
                        let cx = GRID_START.x + col * (GRID_WIDTH + GRID_SPACING) + GRID_WIDTH / 2;
                        let cy = GRID_START.y + row * (GRID_HEIGHT + GRID_SPACING) + GRID_HEIGHT / 2;
                        createMergeEffect(cx, cy);
                    } else {
                        createMergeEffect(canvas.width / 2, canvas.height - 60);
                    }

                    merged = true;
                    break;
                }
            }
            if (merged) break;
        }
    }
    updateUI();
    renderBenchDOM();
}

// 一鍵上場：從場上+備戰中挑最強的塔上場，較弱的退到備戰
function deployAllBench() {
    // 收集所有塔進一個池子
    let allTowers = [];
    for (let i = 0; i < benchSlots.length; i++) {
        if (benchSlots[i]) { allTowers.push(benchSlots[i]); benchSlots[i] = null; }
    }
    for (let i = 0; i < fieldSlots.length; i++) {
        if (fieldSlots[i] && unlockedSlots[i]) { allTowers.push(fieldSlots[i]); fieldSlots[i] = null; }
    }

    // 從強到弱排序
    allTowers.sort((a, b) => towerStrength(b) - towerStrength(a));

    // 統計解鎖的格子數量
    let unlockedCount = unlockedSlots.filter(Boolean).length;

    // 依解鎖順序把前 N 強的塔放到場上
    let fieldIdx = 0;
    let fieldFilled = 0;
    for (let ti = 0; ti < allTowers.length; ti++) {
        if (fieldFilled >= unlockedCount) {
            // 場地滿了，剩下的找備戰空格
            for (let bi = 0; bi < benchSlots.length; bi++) {
                if (!benchSlots[bi]) { benchSlots[bi] = allTowers[ti]; break; }
            }
            continue;
        }
        // 找下一個解鎖的場上格
        while (fieldIdx < fieldSlots.length && !unlockedSlots[fieldIdx]) fieldIdx++;
        if (fieldIdx < fieldSlots.length) {
            fieldSlots[fieldIdx] = allTowers[ti];
            // 上場特效
            let col = fieldIdx % 4;
            let row = Math.floor(fieldIdx / 4);
            let cx = GRID_START.x + col * (GRID_WIDTH + GRID_SPACING) + GRID_WIDTH / 2;
            let cy = GRID_START.y + row * (GRID_HEIGHT + GRID_SPACING) + GRID_HEIGHT / 2;
            createExplosion(cx, cy, '#facc15', 10);
            fieldIdx++;
            fieldFilled++;
        }
    }

    updateUI();
    renderBenchDOM();
}

// 解鎖上陣格
function unlockNextSlot() {
    if (gameState.activeSlots >= 12) return;

    let nextUnlockCost = UNLOCK_COSTS[gameState.activeSlots];
    if (gameState.gold < nextUnlockCost) return;

    addGold(-nextUnlockCost);
    
    // 將下一個上陣格解鎖
    let nextIndex = UNLOCK_ORDER[gameState.activeSlots];
    unlockedSlots[nextIndex] = true;
    gameState.activeSlots++;

    updateUI();

    // 在解鎖的格子中心噴發火花
    let col = nextIndex % 4;
    let row = Math.floor(nextIndex / 4);
    let cx = GRID_START.x + col * (GRID_WIDTH + GRID_SPACING) + GRID_WIDTH / 2;
    let cy = GRID_START.y + row * (GRID_HEIGHT + GRID_SPACING) + GRID_HEIGHT / 2;
    createMergeEffect(cx, cy);
}

// 根據 Canvas 點擊座標獲取對應的上陣區格子索引 (0~11)
function getGridCellFromCoords(canvasX, canvasY) {
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
            let cx = GRID_START.x + col * (GRID_WIDTH + GRID_SPACING);
            let cy = GRID_START.y + row * (GRID_HEIGHT + GRID_SPACING);
            if (canvasX >= cx && canvasX <= cx + GRID_WIDTH &&
                canvasY >= cy && canvasY <= cy + GRID_HEIGHT) {
                return row * 4 + col;
            }
        }
    }
    return -1;
}

// ==========================================
// 6. 拖拽與合併核心互動邏輯
// ==========================================

function initDragAndDrop() {
    let container = document.getElementById('game-container');
    let sellZone = document.getElementById('sell-zone');

    // 當滑鼠在備戰格按住時，啟動拖拽
    container.addEventListener('mousedown', function (e) {
        if (gameState.lives <= 0) return;

        let slot = e.target.closest('.bench-slot');
        if (slot) {
            let index = parseInt(slot.dataset.index);
            let tower = benchSlots[index];
            if (tower) {
                startDragging('bench', index, tower, e.clientX, e.clientY);
            }
            return;
        }

        // 也允許在 Canvas 上直接按住拖拽上陣的塔
        let rect = canvas.getBoundingClientRect();
        let mouseX = e.clientX - rect.left;
        let mouseY = e.clientY - rect.top;

        if (mouseX >= 0 && mouseX <= CANVAS_WIDTH && mouseY >= 0 && mouseY <= CANVAS_HEIGHT) {
            let fieldIndex = getGridCellFromCoords(mouseX, mouseY);
            if (fieldIndex !== -1 && fieldSlots[fieldIndex] !== null) {
                let tower = fieldSlots[fieldIndex];
                startDragging('field', fieldIndex, tower, e.clientX, e.clientY);
            }
        }
    });

    function startDragging(sourceType, index, tower, clientX, clientY) {
        dragInfo = {
            sourceType: sourceType, // 'bench' | 'field'
            index: index,
            tower: tower,
            startX: clientX,
            startY: clientY
        };

        // 建立浮動元素，顯示被拖曳的防禦塔頭像
        let floatEl = document.createElement('div');
        floatEl.id = 'drag-floating';
        floatEl.style.position = 'fixed';
        floatEl.style.left = `${clientX - 32}px`;
        floatEl.style.top = `${clientY - 32}px`;
        floatEl.style.width = '64px';
        floatEl.style.height = '64px';
        floatEl.style.borderRadius = '50%';
        floatEl.style.border = `2.5px solid ${tower.color}`;
        floatEl.style.background = 'rgba(20, 20, 30, 0.95)';
        floatEl.style.pointerEvents = 'none';
        floatEl.style.zIndex = '999';
        floatEl.style.display = 'flex';
        floatEl.style.justifyContent = 'center';
        floatEl.style.alignItems = 'center';
        floatEl.style.boxShadow = `0 0 15px ${tower.color}`;

        // 內部文字 (顯示屬性定位與星級)
        let nameIcon = TOWER_DATA[tower.type] ? TOWER_DATA[tower.type].emoji : '❓';
        floatEl.innerHTML = `<span style="font-size:24px;">${nameIcon}</span><span style="position:absolute;bottom:0;color:#facc15;font-weight:800;font-size:12px;">★${tower.level}</span>`;
        document.body.appendChild(floatEl);

        // 暫時隱藏原本格子內的渲染並從陣列中清除其儲存
        if (sourceType === 'bench') {
            benchSlots[index] = null;
            document.querySelector(`.bench-slot[data-index="${index}"]`).innerHTML = '';
        } else {
            // 在 Canvas 畫布中，我們改在 draw 裡面跳過被拖曳的那個格
            fieldSlots[index] = null;
        }

        // 出售區提示半價出售金額
        document.getElementById('sell-price-preview').innerText = `+$${tower.sellPrice}`;
    }

    document.addEventListener('mousemove', function (e) {
        if (!dragInfo) return;

        // 更新浮動元素位置
        let floatEl = document.getElementById('drag-floating');
        if (floatEl) {
            floatEl.style.left = `${e.clientX - 32}px`;
            floatEl.style.top = `${e.clientY - 32}px`;
        }

        // 偵測是否懸停於垃圾桶上
        let sellRect = sellZone.getBoundingClientRect();
        if (e.clientX >= sellRect.left && e.clientX <= sellRect.right &&
            e.clientY >= sellRect.top && e.clientY <= sellRect.bottom) {
            sellZone.className = 'sell-active';
        } else {
            sellZone.className = 'sell-inactive';
        }
    });

    document.addEventListener('mouseup', function (e) {
        if (!dragInfo) return;

        let floatEl = document.getElementById('drag-floating');
        if (floatEl) floatEl.remove();

        sellZone.className = 'sell-inactive';
        document.getElementById('sell-price-preview').innerText = '半價回收';

        let targetPlaced = false;

        // 1. 判定是否丟進了垃圾桶 (出售)
        let sellRect = sellZone.getBoundingClientRect();
        if (e.clientX >= sellRect.left && e.clientX <= sellRect.right &&
            e.clientY >= sellRect.top && e.clientY <= sellRect.bottom) {
            
            // 出售防禦塔
            addGold(dragInfo.tower.sellPrice);
            
            // 出售特效 (在垃圾桶上噴發紅色粒子)
            let trashCenterX = sellRect.left + sellRect.width / 2;
            let trashCenterY = sellRect.top + sellRect.height / 2;
            // 粒子特效在全域
            createExplosion(e.clientX - canvas.getBoundingClientRect().left, e.clientY - canvas.getBoundingClientRect().top, '#ef4444', 15);

            targetPlaced = true;
            dragInfo = null;
            updateUI();
            renderBenchDOM();
            return;
        }

        // 2. 判定是否丟進了 Canvas 上陣區
        let canvasRect = canvas.getBoundingClientRect();
        let mouseX = e.clientX - canvasRect.left;
        let mouseY = e.clientY - canvasRect.top;

        if (mouseX >= 0 && mouseX <= CANVAS_WIDTH && mouseY >= 0 && mouseY <= CANVAS_HEIGHT) {
            let fieldIndex = getGridCellFromCoords(mouseX, mouseY);
            if (fieldIndex !== -1) {
                // 格子必須是已解鎖的
                if (unlockedSlots[fieldIndex]) {
                    let destTower = fieldSlots[fieldIndex];

                    if (destTower === null) {
                        // (1) 目標格為空：直接放入
                        fieldSlots[fieldIndex] = dragInfo.tower;
                        targetPlaced = true;
                    } else if (destTower.type === dragInfo.tower.type && destTower.level === dragInfo.tower.level) {
                        // (2) 同級同職業：合併！
                        let nextLevel = destTower.level + 1;
                        // 命運派系 5等【奇蹟突變】有20%機率連升兩級
                        if (rogueState.factions.fate.level === 5 && Math.random() < 0.20) {
                            nextLevel = destTower.level + 2;
                            let col = fieldIndex % 4;
                            let row = Math.floor(fieldIndex / 4);
                            let cx = GRID_START.x + col * (GRID_WIDTH + GRID_SPACING) + GRID_WIDTH / 2;
                            let cy = GRID_START.y + row * (GRID_HEIGHT + GRID_SPACING) + GRID_HEIGHT / 2;
                            damageTexts.push({
                                text: '✨ 奇蹟突變! ✨',
                                x: cx,
                                y: cy - 30,
                                color: '#a78bfa',
                                alpha: 1.0,
                                life: 60
                            });
                        }
                        
                        // 隨機轉變為另一種更強防禦塔種類
                        const types = ['archer', 'magic', 'cannon'];
                        const randType = types[Math.floor(Math.random() * types.length)];
                        
                        fieldSlots[fieldIndex] = new Tower(randType, nextLevel);
                        
                        // 製造合併波特效 (在該格中心座標)
                        let col = fieldIndex % 4;
                        let row = Math.floor(fieldIndex / 4);
                        let cx = GRID_START.x + col * (GRID_WIDTH + GRID_SPACING) + GRID_WIDTH / 2;
                        let cy = GRID_START.y + row * (GRID_HEIGHT + GRID_SPACING) + GRID_HEIGHT / 2;
                        createMergeEffect(cx, cy);

                        targetPlaced = true;
                    } else {
                        // (3) 不同級或不同職：交換位置
                        if (dragInfo.sourceType === 'bench') {
                            // 與備戰區交換
                            benchSlots[dragInfo.index] = destTower;
                            fieldSlots[fieldIndex] = dragInfo.tower;
                        } else {
                            // 上陣區與上陣區交換
                            fieldSlots[dragInfo.index] = destTower;
                            fieldSlots[fieldIndex] = dragInfo.tower;
                        }
                        targetPlaced = true;
                    }
                }
            }
        }

        // 3. 判定是否放回備戰區
        if (!targetPlaced) {
            // 尋找被拖至的備戰格
            let hoverSlot = document.elementFromPoint(e.clientX, e.clientY);
            let slot = hoverSlot ? hoverSlot.closest('.bench-slot') : null;
            
            if (slot) {
                let benchIndex = parseInt(slot.dataset.index);
                let destTower = benchSlots[benchIndex];

                if (destTower === null) {
                    // 放進備戰區空格
                    benchSlots[benchIndex] = dragInfo.tower;
                    targetPlaced = true;
                } else if (destTower.type === dragInfo.tower.type && destTower.level === dragInfo.tower.level) {
                    // 備備區合併
                    let nextLevel = destTower.level + 1;
                    // 命運派系 5等【奇蹟突變】有20%機率連升兩級
                    if (rogueState.factions.fate.level === 5 && Math.random() < 0.20) {
                        nextLevel = destTower.level + 2;
                        damageTexts.push({
                            text: '✨ 奇蹟突變! ✨',
                            x: mouseX,
                            y: mouseY - 30,
                            color: '#a78bfa',
                            alpha: 1.0,
                            life: 60
                        });
                    }

                    const types = ['archer', 'magic', 'cannon'];
                    const randType = types[Math.floor(Math.random() * types.length)];
                    
                    benchSlots[benchIndex] = new Tower(randType, nextLevel);

                    // 合併特效定位
                    let rect = slot.getBoundingClientRect();
                    createMergeEffect(mouseX, mouseY); // 用滑鼠釋放點展示特效
                    
                    targetPlaced = true;
                } else {
                    // 交換備戰格
                    if (dragInfo.sourceType === 'bench') {
                        benchSlots[dragInfo.index] = destTower;
                        benchSlots[benchIndex] = dragInfo.tower;
                    } else {
                        // 場上與備份格交換
                        fieldSlots[dragInfo.index] = destTower;
                        benchSlots[benchIndex] = dragInfo.tower;
                    }
                    targetPlaced = true;
                }
            }
        }

        // 4. 若不成功放置，回復原狀
        if (!targetPlaced) {
            if (dragInfo.sourceType === 'bench') {
                benchSlots[dragInfo.index] = dragInfo.tower;
            } else {
                fieldSlots[dragInfo.index] = dragInfo.tower;
            }
        }

        dragInfo = null;
        updateUI();
        renderBenchDOM();
    });
}

// ==========================================
// 7. 戰鬥系統與波次控制器 (Wave & Spawner)
// ==========================================

function checkWaveCompletion() {
    if (gameState.waveActive && gameState.spawnFinished && enemies.length === 0) {
        gameState.waveActive = false;
        
        // 完成波次金幣獎勵：100 + wave * 10
        const waveClearReward = 100 + gameState.wave * 10;
        addGold(waveClearReward);

        // 貪婪派系 5等終極強化【財團利息】：每波結束給予 30% 利息 (上限 100)
        if (rogueState.factions.greed.level === 5) {
            let interest = Math.round(gameState.gold * 0.30);
            interest = Math.min(100, interest);
            if (interest > 0) {
                addGold(interest);
                damageTexts.push({
                    text: `利息 +🪙${interest}`,
                    x: canvas.width / 2,
                    y: canvas.height / 2 - 60,
                    color: '#facc15',
                    alpha: 1.0,
                    life: 50
                });
            }
        }

        // 每 3 波觸發隨機天賦三選一
                if (gameState.wave % 3 === 0) {
            triggerTalentSelection();
        } else {
            gameState.wave++;
            
            if (gameState.wave % 10 === 0 && gameState.autoWave) {
                let autoWaveBtn = document.getElementById('btn-auto-wave');
                if (autoWaveBtn) autoWaveBtn.click();
            }

            if (gameState.autoWave) {
                gameState.waveCountdown = 0;
                updateUI();
                startWave(true);
            } else {
                gameState.waveCountdown = 5;
                updateUI();
                startWaveCountdown();
            }
        }
    }
}

function startWaveCountdown() {
    if (gameState.waveTimer) clearInterval(gameState.waveTimer);
    
    gameState.waveTimer = setInterval(() => {
        if (gameState.isPaused) return;

        gameState.waveCountdown--;
        updateUI();

        if (gameState.waveCountdown <= 0) {
            clearInterval(gameState.waveTimer);
            if (gameState.waveActive && gameState.autoWave) {
                skipToNextWave();
            } else {
                startWave();
            }
        }
    }, 1000);
}

function startWave(force = false) {
    if (gameState.waveTimer) clearInterval(gameState.waveTimer);
    if (gameState.waveActive && !force) return;

    gameState.waveActive = true;
    gameState.waveCountdown = 0;
    gameState.spawnFinished = false;
    updateUI();

    let spawnCount = 5 + gameState.wave * 2;
    let isBossWave = (gameState.wave % 10 === 0);

    let spawned = 0;
    const waveNum = gameState.wave; // 鎖定波次以供非同步生怪時使用，支援波次堆疊

    // 難度階梯提升提示
    if ((waveNum - 1) % 10 === 0 && waveNum > 1) {
        let tierNum = Math.floor((waveNum - 1) / 10);
        let tierNames = ["", "生態演變 (重裝甲出現)", "生命畸變 (自癒能力覺醒)", "全面威脅", "終極末日"];
        let tierName = tierNames[tierNum] || "全面進化";
        damageTexts.push({
            text: `⚠️ 難度階梯提升！第 ${tierNum + 1} 階段：${tierName} ⚠️`,
            x: canvas ? canvas.width / 2 : 400,
            y: 80,
            color: '#f87171',
            alpha: 1.0,
            life: 120,
            scale: 1.4
        });
    }
    
    let spawnTimer = setInterval(() => {
        if (gameState.isPaused) return;
        if (gameState.lives <= 0) {
            clearInterval(spawnTimer);
            return;
        }

                if (spawned < spawnCount) {
            let isBoss = isBossWave && (spawned === spawnCount - 1);
            enemies.push(new Enemy(waveNum, isBoss));
            spawned++;
        } else {
            gameState.spawnFinished = true;
            clearInterval(spawnTimer);
        }
    }, 1000 / gameState.speed); // 隨倍速加快怪出生間隔

    // 若啟動自動下波，則在該波開始時自動啟動 5 秒倒數
    if (gameState.autoWave) {
        gameState.waveCountdown = 5;
        updateUI();
        startWaveCountdown();
    }
}

// 立即跳過波次 / 召喚下一波
function skipToNextWave() {
    if (document.getElementById('talent-overlay') && !document.getElementById('talent-overlay').classList.contains('hidden')) {
        return;
    }

    if (gameState.waveCountdown > 0) {
        startWave(true);
        return;
    }

    if (gameState.waveActive) {
        // 如果戰鬥還在進行中，絕對不允許跳關
        return;
    }

    gameState.wave++;
    updateUI();
    startWave(true);
}

// ==========================================
// 8. 介面渲染與 DOM 更新 (UI & HUD)
// ==========================================

function addGold(amount) {
    gameState.gold += amount;
    updateUI();
}

function updateUI() {
    // 頂部數值
    let waveVal = document.querySelector('#stat-wave .stat-value');
    if (waveVal) {
        if (gameState.waveActive && !gameState.autoWave) {
            waveVal.innerText = gameState.wave;
        } else if (gameState.autoWave && gameState.waveActive) {
            waveVal.innerHTML = `${gameState.wave} <span style="font-size:11px;color:#c084fc">(${gameState.waveCountdown}s)</span>`;
        } else {
            waveVal.innerHTML = `${gameState.wave} <span style="font-size:11px;color:var(--text-secondary)">(${gameState.waveCountdown}s)</span>`;
        }
    }
    
    document.querySelector('#stat-gold .stat-value').innerText = gameState.gold;
    document.querySelector('#stat-hp .stat-value').innerText = gameState.lives;
    document.querySelector('#stat-slots .stat-value').innerText = `${gameState.activeSlots} / 12`;

    // 召喚按鈕狀態
    const summonLevel = gameState.currentSummonLevel;
    const baseCost = 50 * Math.pow(2, summonLevel - 1);
    const discount = rogueState.factions.greed.level * 0.12;
    const summonCost = Math.max(0, Math.round(baseCost * (1 - discount)));
    const upgradeSummonCost = gameState.upgradeSummonCost;

    let summonBtn = document.getElementById('btn-summon');
    let summonTitleEl = document.getElementById('summon-title-label');
    let summonCostEl = document.getElementById('summon-cost-label');
    if (summonBtn) {
        summonBtn.disabled = (gameState.gold < summonCost);
        if (summonTitleEl) summonTitleEl.innerText = `召喚 Lv.${summonLevel} 塔`;
        if (summonCostEl) summonCostEl.innerText = `🪙 ${summonCost}`;
    }

    let upgradeBtn = document.getElementById('btn-upgrade-summon-lvl');
    let upgradeTitleEl = document.getElementById('up-summon-title-label');
    let upgradeCostEl = document.getElementById('up-summon-cost-label');
    if (upgradeBtn) {
        upgradeBtn.disabled = (gameState.gold < upgradeSummonCost);
        if (upgradeTitleEl) upgradeTitleEl.innerText = `提升召喚等級 → Lv.${summonLevel + 1}`;
        if (upgradeCostEl) upgradeCostEl.innerText = `🪙 ${upgradeSummonCost}`;
    }

    // 解鎖格子按鈕狀態
    let unlockBtn = document.getElementById('btn-unlock-slot');
    if (gameState.activeSlots >= 12) {
        unlockBtn.disabled = true;
        document.getElementById('unlock-cost-label').innerText = '已達上限';
    } else {
        let cost = UNLOCK_COSTS[gameState.activeSlots];
        document.getElementById('unlock-cost-label').innerText = `🪙 ${cost}`;
        unlockBtn.disabled = (gameState.gold < cost);
    }

    // 升級按鈕狀態
    // 已移除舊版全域升級介面
}

// 渲染備備區的 DOM 格子
function renderBenchDOM() {
    for (let i = 0; i < benchSlots.length; i++) {
        let slotEl = document.querySelector(`.bench-slot[data-index="${i}"]`);
        if (!slotEl) continue;

        slotEl.innerHTML = '';
        let tower = benchSlots[i];

        if (tower) {
            // 格子發光邊框，匹配塔屬性色
            slotEl.style.borderColor = tower.color;
            slotEl.style.boxShadow = `inset 0 0 10px rgba(${
                tower.type === 'archer' ? '16,185,129' : tower.type === 'magic' ? '59,130,246' : '251,146,60'
            }, 0.25)`;

            // 塔頭像元素
            let img = document.createElement('div');
            img.className = 'bench-tower-avatar';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.display = 'flex';
            img.style.justifyContent = 'center';
            img.style.alignItems = 'center';
            img.style.position = 'relative';

            let icon = TOWER_DATA[tower.type] ? TOWER_DATA[tower.type].emoji : '❓';
            img.innerHTML = `<span style="font-size:28px;">${icon}</span>
                             <span style="position:absolute;bottom:2px;right:4px;color:#facc15;font-weight:800;font-size:11px;">★${tower.level}</span>`;
            slotEl.appendChild(img);
        } else {
            slotEl.style.borderColor = '';
            slotEl.style.boxShadow = '';
        }
    }
}

// ==========================================
// 9. Canvas 渲染邏輯 (Main Loop)
// ==========================================

function drawPath() {
    // 繪製發光的霓虹軌道
    ctx.save();
    
    // 底層寬發光
    ctx.beginPath();
    ctx.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i++) {
        ctx.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    }
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.lineWidth = 32;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 內層細發光
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)';
    ctx.lineWidth = 12;
    ctx.stroke();

    // 最內層軌道線
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 6;
    ctx.stroke();

    // 繪製 Portal 出口傳送門
    let exit = PATH_POINTS[PATH_POINTS.length - 1];
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 12, 20, 0.9)';
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.stroke();

    // 畫螺旋紋
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
}

// 圓角矩形相容性輔助繪製函式（避免舊版瀏覽器或 IDE 語法驗證報錯）
function drawRoundRect(ctx, x, y, width, height, radius) {
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, width, height, radius);
    } else {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
    }
}

function drawGrid() {
    // 繪製 3x4 格子
    ctx.save();

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
            let index = row * 4 + col;
            let cx = GRID_START.x + col * (GRID_WIDTH + GRID_SPACING);
            let cy = GRID_START.y + row * (GRID_HEIGHT + GRID_SPACING);

            let isUnlocked = unlockedSlots[index];

            if (isUnlocked) {
                // 已解鎖格子
                ctx.beginPath();
                drawRoundRect(ctx, cx, cy, GRID_WIDTH, GRID_HEIGHT, 10);
                ctx.fillStyle = 'rgba(26, 26, 42, 0.6)';
                ctx.fill();

                // 格子框線樣式
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // 畫虛線十字定位線，增強設計感
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.beginPath();
                ctx.moveTo(cx + GRID_WIDTH / 2, cy);
                ctx.lineTo(cx + GRID_WIDTH / 2, cy + GRID_HEIGHT);
                ctx.moveTo(cx, cy + GRID_HEIGHT / 2);
                ctx.lineTo(cx + GRID_WIDTH, cy + GRID_HEIGHT / 2);
                ctx.stroke();
            } else {
                // 鎖定格子
                ctx.beginPath();
                drawRoundRect(ctx, cx, cy, GRID_WIDTH, GRID_HEIGHT, 10);
                ctx.fillStyle = 'rgba(15, 15, 25, 0.8)';
                ctx.fill();
                
                ctx.strokeStyle = 'rgba(248, 113, 113, 0.15)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // 畫鎖鏈斜條紋
                ctx.strokeStyle = 'rgba(248, 113, 113, 0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let offset = -GRID_WIDTH; offset < GRID_WIDTH; offset += 15) {
                    ctx.moveTo(cx + offset, cy);
                    ctx.lineTo(cx + offset + GRID_HEIGHT, cy + GRID_HEIGHT);
                }
                ctx.stroke();

                // 繪製小鎖頭圖案
                ctx.fillStyle = 'rgba(248, 113, 113, 0.4)';
                ctx.font = '16px serif';
                ctx.textAlign = 'center';
                ctx.fillText('🔒', cx + GRID_WIDTH / 2, cy + GRID_HEIGHT / 2 + 6);
            }
        }
    }

    ctx.restore();
}

function updateGame(timeStep) {
    if (gameState.isPaused || gameState.lives <= 0) return;

    // 點石成金 Fusion 效果：每秒根據場上最高星級塔的數量產生金幣
    if (rogueState.fusions.midas.active) {
        rogueState.passiveGoldTimer += (16.6 * gameState.speed);
        if (rogueState.passiveGoldTimer >= 1000) {
            rogueState.passiveGoldTimer -= 1000;
            let maxLvl = 0;
            for (let t of fieldSlots) {
                if (t && t.level > maxLvl) maxLvl = t.level;
            }
            if (maxLvl > 0) {
                let count = 0;
                for (let t of fieldSlots) {
                    if (t && t.level === maxLvl) count++;
                }
                if (count > 0) {
                    let goldEarned = count * 2;
                    addGold(goldEarned);
                }
            }
        }
    }

    // 1. 更新上陣防禦塔
    for (let i = 0; i < fieldSlots.length; i++) {
        let tower = fieldSlots[i];
        if (tower) {
            let col = i % 4;
            let row = Math.floor(i / 4);
            let cx = GRID_START.x + col * (GRID_WIDTH + GRID_SPACING);
            let cy = GRID_START.y + row * (GRID_HEIGHT + GRID_SPACING);
            
            tower.update(cx + GRID_WIDTH / 2, cy + GRID_HEIGHT / 2, timeStep);
        }
    }

    // 2. 更新怪物
    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        enemy.update(timeStep);
        if (enemy.hp <= 0) {
            enemies.splice(i, 1);
        }
    }

    // 3. 更新子彈
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let active = projectiles[i].update();
        if (!active) {
            projectiles.splice(i, 1);
        }
    }

    // 4. 更新特效粒子
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        
        if (p.type === 'laser' || p.type === 'ring') {
            p.life -= gameState.speed;
        } else {
            p.x += p.vx * gameState.speed;
            p.y += p.vy * gameState.speed;
            p.alpha -= 0.02 * gameState.speed;
            p.life -= gameState.speed;
        }

        if (p.life <= 0 || p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    // 5. 更新飄字
    for (let i = damageTexts.length - 1; i >= 0; i--) {
        let text = damageTexts[i];
        text.y -= 0.5 * gameState.speed;
        text.alpha -= 0.02 * gameState.speed;
        text.life -= gameState.speed;
        if (text.life <= 0 || text.alpha <= 0) {
            damageTexts.splice(i, 1);
        }
    }

    // 6. 偵測波次是否全滅以推進到下一波
    checkWaveCompletion();
}

// ========== 隨機肉鴿天賦系統核心邏輯 ==========
let currentTalentChoices = [];

function triggerTalentSelection() {
    generateTalentChoices();

    if (currentTalentChoices.length === 0) {
        gameState.wave++;
        
        if (gameState.wave % 10 === 0 && gameState.autoWave) {
            let autoWaveBtn = document.getElementById('btn-auto-wave');
            if (autoWaveBtn) autoWaveBtn.click();
        }
        
        if (gameState.autoWave) {
            gameState.waveCountdown = 0;
            updateUI();
            startWave(true);
        } else {
            gameState.waveCountdown = 5;
            updateUI();
            startWaveCountdown();
        }
        return;
    }

    if (gameState.waveTimer) clearInterval(gameState.waveTimer);
    
    // ==========================================
    // CRITICAL FIX: FORCE PAUSE DURING SELECTION
    // ==========================================
    gameState.isPaused = true;
    let pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.classList.add('active');
    
    renderTalentModal();
    document.getElementById('talent-overlay').classList.remove('hidden');
}

function generateTalentChoices() {
    let pool = [];

    // 1. 基礎派系天賦 (等級小於 5 等)
    for (let key in rogueState.factions) {
        // [新增] 只有在背包中擁有該派系，才能在遊戲中抽到它
        if (!playerProfile.ownedFactions.includes(key)) continue;

        let f = rogueState.factions[key];
        if (f.level < f.maxLevel) {
            pool.push({
                type: 'basic',
                key: key,
                name: f.name + '派系',
                color: f.color,
                icon: f.icon,
                currentLevel: f.level,
                maxLevel: f.maxLevel,
                desc: f.level === 4 ? `👑 5等終極強化：${f.ultName}<br><span style="color:var(--text-secondary); font-size:11px;">${f.ultDesc}</span>` : `${f.baseDesc}`
            });
        }
    }

    // 2. 雙滿等融合天賦 (兩個條件派系皆滿等且尚未啟用)
    for (let key in rogueState.fusions) {
        let fusion = rogueState.fusions[key];
        if (!fusion.active) {
            let req1 = fusion.req[0];
            let req2 = fusion.req[1];
            if (rogueState.factions[req1].level === 5 && rogueState.factions[req2].level === 5) {
                pool.push({
                    type: 'fusion',
                    key: key,
                    name: fusion.name,
                    color: fusion.color,
                    icon: fusion.icon,
                    desc: fusion.desc
                });
            }
        }
    }

    // 隨機打亂並選取前 3 個
    pool.sort(() => Math.random() - 0.5);
    currentTalentChoices = pool.slice(0, 3);
}

function renderTalentModal() {
    let container = document.getElementById('talent-cards-container');
    container.innerHTML = '';

    currentTalentChoices.forEach(choice => {
        let card = document.createElement('div');
        card.className = `talent-card ${choice.type === 'fusion' ? 'fusion' : choice.key}`;
        
        let levelText = '';
        if (choice.type === 'basic') {
            levelText = `Lv.${choice.currentLevel} ➔ Lv.${choice.currentLevel + 1}`;
        } else {
            levelText = `💥 FUSION 雙重融合`;
        }

        card.innerHTML = `
            <div class="card-icon">${choice.icon}</div>
            <div class="card-name">${choice.name}</div>
            <div class="card-level">${levelText}</div>
            <div class="card-desc">${choice.desc}</div>
        `;
        
        card.addEventListener('click', () => selectTalent(choice));
        container.appendChild(card);
    });

    document.getElementById('talent-reroll-count').innerText = `剩餘 ${rogueState.rerollsLeft} 次`;
    document.getElementById('btn-talent-reroll').disabled = (rogueState.rerollsLeft <= 0);
}

function selectTalent(choice) {
    if (choice.type === 'basic') {
        let f = rogueState.factions[choice.key];
        f.level++;
        if (choice.key === 'fate') {
            rogueState.rerollsLeft += 2; // 命運天賦額外提供 2 次重滾次數
        }
    } else if (choice.type === 'fusion') {
        rogueState.fusions[choice.key].active = true;
    }

        document.getElementById('talent-overlay').classList.add('hidden');
    updateTalentHUD();

    gameState.isPaused = false;
    let pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.classList.remove('active');

    gameState.wave++;
    
    if (gameState.wave % 10 === 0 && gameState.autoWave) {
        let autoWaveBtn = document.getElementById('btn-auto-wave');
        if (autoWaveBtn) autoWaveBtn.click();
    }
    
    if (gameState.autoWave) {
        gameState.waveCountdown = 0;
        updateUI();
        startWave(true);
    } else {
        gameState.waveCountdown = 5;
        updateUI();
        startWaveCountdown();
    }
}

function rerollTalents() {
    if (rogueState.rerollsLeft <= 0) return;
    rogueState.rerollsLeft--;
    
    generateTalentChoices();
    renderTalentModal();
}

function updateTalentHUD() {
    let hud = document.getElementById('talent-hud');
    if (!hud) return;
    hud.innerHTML = '';

    let hasTalents = false;
    for (let key in rogueState.factions) {
        if (rogueState.factions[key].level > 0) hasTalents = true;
    }
    for (let key in rogueState.fusions) {
        if (rogueState.fusions[key].active) hasTalents = true;
    }

    if (!hasTalents) return;

    let btn = document.createElement('div');
    btn.className = 'talent-list-btn';
    btn.innerHTML = '<span>🔮</span> 天賦列表';
    btn.onclick = toggleTalentListWindow;
    hud.appendChild(btn);
}


function toggleTalentListWindow() {
    let win = document.getElementById('talent-list-window');
    if (!win) {
        win = document.createElement('div');
        win.id = 'talent-list-window';
        win.className = 'talent-list-window';
        document.getElementById('header-right').appendChild(win);
    }

    if (win.classList.contains('show')) {
        win.classList.remove('show');
        return;
    }

    let html = '';
    
    // Factions
    for (let key in rogueState.factions) {
        let f = rogueState.factions[key];
        if (f.level > 0) {
            let isUlt = f.level >= 5;
            html += `<div class='talent-item'>
                        <div class='talent-item-header' style='color: ${f.color}'>
                            <span>${f.icon} ${f.name}</span>
                            <span>Lv.${f.level}</span>
                        </div>
                        <div class='talent-item-desc'>${f.baseDesc}</div>`;
            
            if (isUlt && f.ultName) {
                html += `<div class='talent-item-ult' style='color: #f472b6;'>
                            ★ 終極技：${f.ultName}<br>
                            <span style='font-size:10px; color:#e2e8f0;'>${f.ultDesc}</span>
                         </div>`;
            }
            html += `</div>`;
        }
    }

    // Fusions
    for (let key in rogueState.fusions) {
        let f = rogueState.fusions[key];
        if (f.active) {
            html += `<div class='talent-item'>
                        <div class='talent-item-header' style='color: #f472b6;'>
                            <span>${f.icon} ${f.name}</span>
                            <span style='font-size:10px; border:1px solid #f472b6; padding:0 4px; border-radius:4px;'>融合</span>
                        </div>
                        <div class='talent-item-desc'>${f.desc}</div>
                     </div>`;
        }
    }

    win.innerHTML = html;
    win.classList.add('show');
}
function renderGame() {
    // 清除畫布
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. 繪製防守路徑
    drawPath();

    // 2. 繪製戰場格子
    drawGrid();

    // 3. 繪製場上的防禦塔
    for (let i = 0; i < fieldSlots.length; i++) {
        let tower = fieldSlots[i];
        if (tower) {
            let col = i % 4;
            let row = Math.floor(i / 4);
            let cx = GRID_START.x + col * (GRID_WIDTH + GRID_SPACING);
            let cy = GRID_START.y + row * (GRID_HEIGHT + GRID_SPACING);

            // 判斷是否滑鼠懸停在格子上方（這部分可以在滑鼠事件中精確判定，此處簡化）
            tower.draw(ctx, cx, cy, false);
        }
    }

    // 4. 繪製怪物
    for (let enemy of enemies) {
        enemy.draw(ctx);
    }

    // 5. 繪製子彈
    for (let proj of projectiles) {
        proj.draw(ctx);
    }

    // 6. 繪製特效粒子
    for (let p of particles) {
        ctx.save();
        if (p.type === 'laser') {
            ctx.beginPath();
            ctx.moveTo(p.sx, p.sy);
            ctx.lineTo(p.tx, p.ty);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.globalAlpha = Math.max(0, p.life / 8);
            ctx.stroke();
        } else if (p.type === 'ring') {
            // 合併波環
            ctx.beginPath();
            let currentRadius = p.radius + (p.maxRadius - p.radius) * (1 - p.life / 15);
            ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 12;
            ctx.globalAlpha = Math.max(0, p.life / 15);
            ctx.stroke();
        } else {
            // 普通爆炸微粒
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fill();
        }
        ctx.restore();
    }

    // 7. 繪製傷害文字
    ctx.save();
    for (let text of damageTexts) {
        ctx.globalAlpha = Math.max(0, text.alpha);
        ctx.fillStyle = text.color;
        let fontSize = text.scale ? Math.round(13 * text.scale) : 13;
        ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(text.text, text.x, text.y);
    }
    ctx.restore();
}

function gameLoop() {
    updateGame(16.6); // 模擬 60fps 單幀更新
    renderGame();
    requestAnimationFrame(gameLoop);
}

// ==========================================
// 10. 遊戲生命週期 (Start, Over, Reset)
// ==========================================

function initGame() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    // 綁定按鈕監聽器
    document.getElementById('btn-summon').addEventListener('click', () => summonTower());
    document.getElementById('btn-upgrade-summon-lvl').addEventListener('click', () => upgradeSummonLevel());
    document.getElementById('btn-unlock-slot').addEventListener('click', unlockNextSlot);
    document.getElementById('btn-merge-all').addEventListener('click', mergeAllBench);
    document.getElementById('btn-deploy-all').addEventListener('click', deployAllBench);
    document.getElementById('btn-talent-reroll').addEventListener('click', rerollTalents);
    document.getElementById('btn-next-wave').addEventListener('click', skipToNextWave);
    document.getElementById('btn-auto-wave').addEventListener('click', function() {
        gameState.autoWave = !gameState.autoWave;
        if (gameState.autoWave) {
            this.classList.add('active');
            this.style.borderColor = 'var(--color-neon-purple)';
            this.style.boxShadow = 'var(--glow-purple)';
            
            if (gameState.waveActive) {
                gameState.waveCountdown = 5;
                updateUI();
                startWaveCountdown();
            } else if (gameState.waveCountdown > 0) {
                // 保留當前倒計時
            } else {
                gameState.waveCountdown = 5;
                updateUI();
                startWaveCountdown();
            }
        } else {
            this.classList.remove('active');
            this.style.borderColor = 'rgba(255,255,255,0.08)';
            this.style.boxShadow = 'none';
            
            if (gameState.waveActive) {
                if (gameState.waveTimer) {
                    clearInterval(gameState.waveTimer);
                    gameState.waveTimer = null;
                }
                gameState.waveCountdown = 0;
                updateUI();
            }
        }
    });

    // 動態插入天賦 HUD 到統計面板後方
    let stats = document.getElementById('stats-panel');
    let hud = document.createElement('div');
    hud.id = 'talent-hud';
    stats.parentNode.insertBefore(hud, stats.nextSibling);

    updateTalentHUD();

    // 升級頁面 overlay
    // 已移除舊版升級選單按鈕綁定

    // 速度調整按鈕
    const speedButtons = [
        { id: 'btn-speed-1', value: 1 },
        { id: 'btn-speed-2', value: 2 },
        { id: 'btn-speed-3', value: 3 }
    ];

    speedButtons.forEach(sb => {
        document.getElementById(sb.id).addEventListener('click', function () {
            // 如果天賦視窗正開著，不允許更改倍速以免解除暫停
            if (!document.getElementById('talent-overlay').classList.contains('hidden')) return;

            speedButtons.forEach(b => document.getElementById(b.id).classList.remove('active'));
            document.getElementById(sb.id).classList.add('active');
            gameState.speed = sb.value;
            gameState.isPaused = false;
            document.getElementById('btn-pause').classList.remove('active');
        });
    });

    document.getElementById('btn-pause').addEventListener('click', function () {
        // 如果天賦視窗正開著，不允許解除暫停
        if (!document.getElementById('talent-overlay').classList.contains('hidden')) return;

        gameState.isPaused = !gameState.isPaused;
        if (gameState.isPaused) {
            this.classList.add('active');
        } else {
            this.classList.remove('active');
        }
    });

    // 重新綁定事件：結束後返回主選單
    const btnRestart = document.getElementById('btn-restart');
    btnRestart.replaceWith(btnRestart.cloneNode(true));
    document.getElementById('btn-restart').addEventListener('click', quitBattle);
    document.getElementById('btn-restart').innerText = "返回主選單";

    // 拖曳初始化
    initDragAndDrop();

    // 初始介面更新
    updateUI();
    renderBenchDOM();

    // 啟動波次計時器
    startWaveCountdown();

    // 啟動主循環
    requestAnimationFrame(gameLoop);
}

function endGame() {
    // 計算遊戲幣收益
    let earnedCoins = gameState.enemiesKilled * 2;
    playerProfile.gameCoins += earnedCoins;
    saveProfile();
    
    // 顯示遊戲結束遮罩
    let overlay = document.getElementById('game-overlay');
    document.getElementById('overlay-title').innerText = '戰鬥結算';
    document.getElementById('overlay-subtitle').innerText = `您成功防守了 ${gameState.wave - 1} 波攻勢！\n獲得了 🪙 ${earnedCoins} 遊戲幣！`;
    overlay.classList.remove('hidden');
}

function restartGame() {
    // 重置所有遊戲變數
    gameState = {
        gold: 300,
        lives: 20,
        wave: 1,
        waveActive: false,
        activeSlots: 4,
        speed: 1,
        isPaused: false,
        enemiesKilled: 0,
        waveCountdown: 5,
        spawnFinished: false,
        waveTimer: null,
        currentSummonLevel: 1,
        upgradeSummonCost: 200,
        autoWave: false
    };
    // 重置天賦狀態
    rogueState = {
        factions: {
            fury:  { level: 0, maxLevel: 5, name: '狂暴', color: '#ef4444', icon: '🔥', baseDesc: '每等提升全場攻擊力 +15% 與暴擊率 +5%', ultName: '核爆連鎖', ultDesc: '暴擊時引發 200% 範圍物理傷害爆炸' },
            swift: { level: 0, maxLevel: 5, name: '迅捷', color: '#22c55e', icon: '⚡', baseDesc: '每等提升全場防禦塔攻擊速度 +20%', ultName: '幻影過載', ultDesc: '連續攻擊同一個目標時攻速持續疊加最高 +150%' },
            frost: { level: 0, maxLevel: 5, name: '霜凍', color: '#3b82f6', icon: '❄️', baseDesc: '攻擊附帶減速 +8% 並擴大砲台濺射半徑 +15px', ultName: '絕對零度', ultDesc: '減速達 60% 時凍結目標 2 秒，對凍結目標傷害 +100%' },
            greed: { level: 0, maxLevel: 5, name: '貪婪', color: '#eab308', icon: '💰', baseDesc: '每等提升擊殺金幣 +30% 且召喚成本降低 12%', ultName: '財團利息', ultDesc: '波次結束時結算剩餘金幣並發放 30% 利息(上限 100)' },
            fate:  { level: 0, maxLevel: 5, name: '命運', color: '#a78bfa', icon: '🎲', baseDesc: '直接召喚高一級塔機率 +10% 且每次增幅獲得重滾次數 +2', ultName: '奇蹟突變', ultDesc: '合併時有 20% 機率直接連升 2 級' }
        },
        fusions: {
            gatling: { active: false, name: '加特林風暴', req: ['fury', 'swift'], color: 'linear-gradient(135deg, #ef4444, #22c55e)', icon: '🏹', desc: '【狂暴+迅捷】所有防禦塔發射分裂箭，每次射擊同時朝三個方向開火，均可暴擊' },
            shatter: { active: false, name: '碎冰核爆', req: ['fury', 'frost'], color: 'linear-gradient(135deg, #ef4444, #3b82f6)', icon: '💥', desc: '【狂暴+霜凍】攻擊減速/凍結怪傷害 +30%，且有 5% 機率秒殺普通與精英怪物' },
            midas:   { active: false, name: '點石成金', req: ['greed', 'fate'], color: 'linear-gradient(135deg, #eab308, #a78bfa)', icon: '🪙', desc: '【貪婪+命運】場上每個最高星級塔每秒產生 2 金幣，召喚塔時 5% 機率直接召喚出當前場上最高等級的塔' },
            bounty:  { active: false, name: '賞金獵手', req: ['swift', 'greed'], color: 'linear-gradient(135deg, #22c55e, #eab308)', icon: '🎯', desc: '【迅捷+貪婪】防禦塔累計發射 50 發子彈後標記懸賞目標，擊殺獲得 5 倍金幣' }
        },
        rerollsLeft: 2,
        totalShots: 0,
        bountyTargetId: null,
        passiveGoldTimer: 0
    };
    updateTalentHUD();

    benchSlots = Array(6).fill(null);
    fieldSlots = Array(12).fill(null);
    unlockedSlots = Array(12).fill(false);

    for (let i = 0; i < 4; i++) {
        unlockedSlots[UNLOCK_ORDER[i]] = true;
    }

    enemies = [];
    projectiles = [];
    particles = [];
    damageTexts = [];

    // 重設速度與自動下波按鈕
    document.getElementById('btn-speed-1').click();
    document.getElementById('btn-pause').classList.remove('active');
    let autoWaveBtn = document.getElementById('btn-auto-wave');
    if (autoWaveBtn) {
        autoWaveBtn.classList.remove('active');
        autoWaveBtn.style.borderColor = 'rgba(255,255,255,0.08)';
        autoWaveBtn.style.boxShadow = 'none';
    }

    // 隱藏天賦選擇和遊戲結束遮罩
    document.getElementById('talent-overlay').classList.add('hidden');
    document.getElementById('game-overlay').className = 'hidden';

    updateUI();
    renderBenchDOM();

    startWaveCountdown();
}

// ==========================================
// 4. 局外系統 (商店、背包、圖鑑)
// ==========================================


const FACTION_DATA = {
    fury:  { name: '狂怒', color: '#ef4444', icon: '🔥', desc: '強調爆發傷害與爆擊的戰鬥派系。' },
    swift: { name: '迅捷', color: '#22c55e', icon: '⚡', desc: '追求極致攻速與連續打擊的派系。' },
    frost: { name: '冰霜', color: '#3b82f6', icon: '❄️', desc: '擅長場控與絕對凍結的戰略派系。' },
    greed: { name: '貪婪', color: '#eab308', icon: '💰', desc: '以經濟壓制與資本運作為主的派系。' },
    fate:  { name: '命運', color: '#a78bfa', icon: '🎲', desc: '充滿隨機性與奇蹟升級的神秘派系。' }
};

const TOWER_DATA = {
    archer: { name: "弓箭塔", rarity: "N", emoji: "🏹", desc: "穩定的單體物理傷害" },
    magic: { name: "魔法塔", rarity: "N", emoji: "⚡", desc: "較高魔法傷害，基礎減速" },
    cannon: { name: "砲台", rarity: "N", emoji: "💣", desc: "大範圍物理濺射傷害" },
    sniper: { name: "狙擊塔", rarity: "R", emoji: "🎯", desc: "極慢攻速，超高單體傷害與超遠射程" },
    poison: { name: "毒液塔", rarity: "R", emoji: "🧪", desc: "攻擊附帶中毒持續傷害 (DoT)" },
    tesla: { name: "電磁塔", rarity: "SR", emoji: "🌩️", desc: "產生閃電鏈，在多名敵人之間彈跳" },
    frost: { name: "冰霜塔", rarity: "SR", emoji: "🧿", desc: "造成大範圍緩速，機率性完全凍結" },
    blackhole: { name: "黑洞塔", rarity: "UR", emoji: "🌌", desc: "創造黑洞牽引敵人並造成毀滅性範圍傷害" }
};

const RARITY_COLORS = {
    "N": "#a3a3a3",
    "R": "#60a5fa",
    "SR": "#c084fc",
    "UR": "#facc15"
};

function renderShop() {
    document.getElementById('shop-coins').innerText = playerProfile.gameCoins;
    const shopList = document.getElementById('shop-list');
    shopList.innerHTML = '';

    const allTowers = Object.keys(TOWER_DATA);
    allTowers.forEach(type => {
        if (!playerProfile.ownedTowers.includes(type)) {
            const data = TOWER_DATA[type];
            let price = data.rarity === 'R' ? 2000 : (data.rarity === 'SR' ? 5000 : 15000);
            
            const btn = document.createElement('div');
            btn.className = 'shop-item';
            btn.style.background = 'rgba(255,255,255,0.05)';
            btn.style.padding = '15px';
            btn.style.borderRadius = '10px';
            btn.style.textAlign = 'center';
            btn.style.border = `1px solid ${RARITY_COLORS[data.rarity]}50`;

            btn.innerHTML = `
                <div style="font-size: 32px;">${data.emoji}</div>
                <div style="font-weight: bold; color: ${RARITY_COLORS[data.rarity]}">${data.name} [${data.rarity}]</div>
                <button class="action-btn" style="margin-top: 10px; width: 100%;" onclick="buyTower('${type}', ${price})">🪙 ${price}</button>
            `;
            shopList.appendChild(btn);
        }
    });
}

function buyTower(type, price) {
    if (playerProfile.gameCoins >= price) {
        playerProfile.gameCoins -= price;
        playerProfile.ownedTowers.push(type);
        saveProfile();
        renderShop();
    } else {
        alert("遊戲幣不足！");
    }
}

function drawGacha() {
    if (playerProfile.gameCoins < 500) {
        alert("遊戲幣不足！");
        return;
    }
    
    playerProfile.gameCoins -= 500;
    document.getElementById('shop-coins').innerText = playerProfile.gameCoins;
    
    const r = Math.random() * 100;
    let pulledRarity = 'N';
    if (r < 5) pulledRarity = 'UR';
    else if (r < 20) pulledRarity = 'SR';
    else if (r < 50) pulledRarity = 'R';
    
    const pool = Object.keys(TOWER_DATA).filter(k => TOWER_DATA[k].rarity === pulledRarity);
    const pulledType = pool[Math.floor(Math.random() * pool.length)];
    const data = TOWER_DATA[pulledType];
    
    const resultDiv = document.getElementById('gacha-result');
    resultDiv.style.color = RARITY_COLORS[pulledRarity];
    
    if (playerProfile.ownedTowers.includes(pulledType)) {
        playerProfile.gameCoins += 250; // Refund half
        resultDiv.innerHTML = `抽到了 ${data.emoji} ${data.name} [${pulledRarity}] <br><span style="font-size: 14px; color: var(--text-secondary);">已擁有，退還 250 🪙</span>`;
    } else {
        playerProfile.ownedTowers.push(pulledType);
        resultDiv.innerHTML = `恭喜獲得新塔！<br>${data.emoji} ${data.name} [${pulledRarity}]`;
    }
    
    saveProfile();
    document.getElementById('shop-coins').innerText = playerProfile.gameCoins;
    renderShop();
}

function renderBackpack() {
    document.getElementById('backpack-coins').innerText = playerProfile.gameCoins;
    const grid = document.getElementById('backpack-grid');
    grid.innerHTML = '';
    
    playerProfile.ownedTowers.forEach(type => {
        const data = TOWER_DATA[type];
        if (!data) return;
        const cost = getUpgradeCost(type);
        const level = playerProfile.globalUpgrades[type] || 1;
        
        const item = document.createElement('div');
        item.className = 'backpack-item';
        item.style.background = 'rgba(255,255,255,0.05)';
        item.style.padding = '15px';
        item.style.borderRadius = '10px';
        item.style.textAlign = 'center';
        item.style.border = `1px solid ${RARITY_COLORS[data.rarity]}50`;
        
        item.innerHTML = `
            <div style="font-size: 36px; margin-bottom: 5px;">${data.emoji}</div>
            <div style="font-weight: bold; color: ${RARITY_COLORS[data.rarity]}">${data.name}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">目前等級: Lv.${level} <br>攻擊力加成: +${(level-1)*20}%</div>
            <button class="action-btn glow-btn" onclick="upgradeTowerProfile('${type}')" ${playerProfile.gameCoins < cost ? 'disabled' : ''} style="width: 100%;">
                升級 (🪙 ${cost})
            </button>
        `;
        grid.appendChild(item);
    });

    // ====== 渲染天賦派系 ======
    const facGrid = document.getElementById('backpack-factions-grid');
    if (facGrid) {
        facGrid.innerHTML = '';
        if (!playerProfile.ownedFactions) {
            playerProfile.ownedFactions = ['fury', 'swift', 'frost', 'greed', 'fate'];
        }
        Object.keys(FACTION_DATA).forEach(key => {
            const isOwned = playerProfile.ownedFactions.includes(key);
            const data = FACTION_DATA[key];
            const card = document.createElement('div');
            card.style.background = 'rgba(255,255,255,0.05)';
            card.style.padding = '15px';
            card.style.borderRadius = '10px';
            card.style.border = isOwned ? '1px solid ' + data.color : '1px solid rgba(255,255,255,0.1)';
            card.style.filter = isOwned ? 'none' : 'grayscale(100%) opacity(0.5)';
            
            card.innerHTML = `
                <div style="font-size: 32px; margin-bottom: 10px; text-align: center;">${isOwned ? data.icon : '❓'}</div>
                <div style="font-weight: bold; color: ${isOwned ? data.color : '#fff'}; font-size: 18px; text-align: center;">${isOwned ? data.name : '未知派系'}</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 5px; text-align: center;">${isOwned ? data.desc : '尚在封印中，等待解鎖'}</div>
            `;
            facGrid.appendChild(card);
        });
    }
}

function upgradeTowerProfile(type) {
    const cost = getUpgradeCost(type);
    if (playerProfile.gameCoins >= cost) {
        playerProfile.gameCoins -= cost;
        playerProfile.globalUpgrades[type] = (playerProfile.globalUpgrades[type] || 1) + 1;
        saveProfile();
        renderBackpack();
    }
}

function renderEncyclopedia() {
    // 1. 渲染塔圖鑑
    const tList = document.getElementById('ency-towers');
    tList.innerHTML = '';
    Object.keys(TOWER_DATA).forEach(type => {
        const data = TOWER_DATA[type];
        const isOwned = playerProfile.ownedTowers.includes(type);
        const card = document.createElement('div');
        card.style.background = 'rgba(255,255,255,0.05)';
        card.style.padding = '15px';
        card.style.borderRadius = '10px';
        card.style.filter = isOwned ? 'none' : 'grayscale(100%) opacity(0.5)';
        card.innerHTML = `
            <div style="font-size: 32px;">${isOwned ? data.emoji : '❓'}</div>
            <div style="font-weight: bold; color: ${isOwned ? RARITY_COLORS[data.rarity] : '#fff'};">${isOwned ? data.name : '未知'} [${data.rarity}]</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">${isOwned ? data.desc : '未解鎖的防禦塔'}</div>
        `;
        tList.appendChild(card);
    });

    // 2. 渲染敵人圖鑑
    const eList = document.getElementById('ency-enemies');
    if (eList) {
        eList.innerHTML = '';
        const enemiesData = [
            { name: '普通怪', color: '#a78bfa', desc: '最常見的敵人，各項屬性均衡。' },
            { name: '疾風怪', color: '#10b981', desc: '跑速極快 (1.65倍)，但血量較少 (55%)。' },
            { name: '裝甲怪', color: '#94a3b8', desc: '移動緩慢 (0.5倍)，但防禦極高血量厚實 (230%)。' },
            { name: '治癒怪', color: '#ec4899', desc: '血量偏高 (135%) 且會隨時間持續恢復生命。' },
            { name: 'Boss 首領', color: '#ef4444', desc: '每 10 波出現，血量極為誇張，擊殺可獲得大量獎勵。' }
        ];
        
        enemiesData.forEach(e => {
            const card = document.createElement('div');
            card.style.background = 'rgba(255,255,255,0.05)';
            card.style.padding = '15px';
            card.style.borderRadius = '10px';
            card.innerHTML = `
                <div style="font-weight: bold; color: ${e.color}; font-size: 18px; margin-bottom: 5px;">⏹ ${e.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${e.desc}</div>
            `;
            eList.appendChild(card);
        });
    }

    // 3. 渲染派系天賦圖鑑
    const facList = document.getElementById('ency-factions');
    if (facList) {
        facList.innerHTML = '';
        const factions = {
            fury:  { name: '狂怒', color: '#ef4444', icon: '🔥', baseDesc: '每級傷害 +15% 爆擊率 +5%', ultName: '火山爆發', ultDesc: '爆擊引發 200% 範圍物理傷害' },
            swift: { name: '迅捷', color: '#22c55e', icon: '⚡', baseDesc: '每級攻速 +20%', ultName: '幻影連擊', ultDesc: '同目標連續攻擊傷害疊加 +150%' },
            frost: { name: '冰霜', color: '#3b82f6', icon: '❄️', baseDesc: '減速 +8% 且緩速範圍變大', ultName: '絕對零度', ultDesc: '減速達 60% 時凍結目標 2 秒，凍結時傷害 +100%' },
            greed: { name: '貪婪', color: '#eab308', icon: '💰', baseDesc: '金幣 +30% 升級成本降 12%', ultName: '利息效應', ultDesc: '每波結束發放餘額 30% 利息(上限 100)' },
            fate:  { name: '命運', color: '#a78bfa', icon: '🎲', baseDesc: '升星機率 +10% 且抽塔格數 +2', ultName: '神之眷顧', ultDesc: '合成時有 20% 機率直接跳階 +2 星' }
        };
        
        Object.keys(factions).forEach(key => {
            const f = factions[key];
            const card = document.createElement('div');
            card.style.background = 'rgba(255,255,255,0.05)';
            card.style.padding = '15px';
            card.style.borderRadius = '10px';
            card.innerHTML = `
                <div style="font-weight: bold; color: ${f.color}; font-size: 16px; margin-bottom: 5px;">${f.icon} ${f.name}系</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">${f.baseDesc}</div>
                <div style="font-size: 12px; color: #f472b6; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px;">
                    <strong>★ 終極技：${f.ultName}</strong><br>
                    <span style="color:#e2e8f0;">${f.ultDesc}</span>
                </div>
            `;
            facList.appendChild(card);
        });
    }

    // 4. 渲染融合天賦圖鑑
    const fusList = document.getElementById('ency-fusions');
    if (fusList) {
        fusList.innerHTML = '';
        const fusions = {
            gatling: { name: '加特林機槍', reqs: ['狂怒', '迅捷'], color: 'linear-gradient(135deg, #ef4444, #22c55e)', icon: '🔫', desc: '狂怒+迅捷最高星防禦塔機率發射三連發範圍子彈' },
            shatter: { name: '碎冰擊', reqs: ['狂怒', '冰霜'], color: 'linear-gradient(135deg, #ef4444, #3b82f6)', icon: '🔨', desc: '狂怒+冰霜對凍結目標傷害 +30%，且 5% 機率秒殺非 Boss' },
            midas:   { name: '點石成金', reqs: ['貪婪', '命運'], color: 'linear-gradient(135deg, #eab308, #a78bfa)', icon: '✨', desc: '貪婪+命運場上每隻最高星塔每波+2元，且塔 5% 機率升級不花錢' },
            bounty:  { name: '賞金標記', reqs: ['迅捷', '貪婪'], color: 'linear-gradient(135deg, #22c55e, #eab308)', icon: '🎯', desc: '迅捷+貪婪攻速最快的塔每秒 50 殺標記目標，獲得 5 元' }
        };
        
        Object.keys(fusions).forEach(key => {
            const f = fusions[key];
            const card = document.createElement('div');
            card.style.background = 'rgba(255,255,255,0.05)';
            card.style.padding = '15px';
            card.style.borderRadius = '10px';
            card.innerHTML = `
                <div style="font-weight: bold; background: ${f.color}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 16px; margin-bottom: 5px;">
                    ${f.icon} ${f.name}
                </div>
                <div style="font-size: 11px; display: inline-block; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; margin-bottom: 8px;">
                    條件：${f.reqs[0]} Lv.5 + ${f.reqs[1]} Lv.5
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">${f.desc}</div>
            `;
            fusList.appendChild(card);
        });
    }
}

// 當網頁載入時啟動
window.onload = () => {
    initGame();
    
    // 預設進入主選單
    switchView('home-view');
};
