// ==================== CONFIGURATION ====================
const CONFIG = {
    // These sizes are now relative base values, not absolute pixels
    // UPDATED SIZES BASED ON IMPORTANCE:
    // MIN: 0.13 means the smallest planet (Imp 1) is 13% of screen width (approx size of old Imp 5)
    // MAX: 0.85 means the largest planet (Imp 10) is 85% of screen width (a true colossus)
    MIN_SIZE_BASE: 0.13,
    MAX_SIZE_BASE: 0.85,

    MIN_SPEED: 1,
    MAX_SPEED: 60,
    BACKGROUND_SCALE: 0.7,
    BACKGROUND_OPACITY: 0.6,
    BACKGROUND_SPEED_MULTIPLIER: 0.7,
    STAR_COUNT_DENSITY: 0.00015, // Stars per pixel area
    GLOW_RADIUS_PCT: 0.02 // Glow as % of screen
};

// ==================== STATE ====================
let canvas, ctx;
let planets = [];
let stars = [];
let selectedPlanetId = null;
let activePlanetInfo = null;
let editingPlanetId = null;
let confirmCallback = null;

// Responsive State
let screenMinDim = 0; // The smaller of width/height
let scaleFactor = 1;  // Logical scale factor
let pixelRatio = 1;   // Device pixel ratio
let logicalWidth = 0;
let logicalHeight = 0;

// ==================== CONFIRMATION DIALOG ====================
function showConfirmDialog(message, onConfirm) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmDialog').classList.add('show');
    confirmCallback = onConfirm;
}

function hideConfirmDialog() {
    document.getElementById('confirmDialog').classList.remove('show');
    confirmCallback = null;
}

function handleConfirmDelete() {
    if (confirmCallback) {
        confirmCallback();
    }
    hideConfirmDialog();
}

function handleCancelDelete() {
    hideConfirmDialog();
}

// ==================== INITIALIZATION ====================
function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    // Initial resize
    resizeCanvas();

    // Smart resize handling
    window.addEventListener('resize', () => {
        requestAnimationFrame(resizeCanvas);
    });

    // Orientation change specific handler for mobile
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeCanvas, 100); // Small delay to allow layout to settle
    });

    loadFromLocalStorage();

    // Event listeners
    document.getElementById('addButton').addEventListener('click', openAddModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Form submission
    const form = document.getElementById('planetForm');
    form.addEventListener('submit', handleFormSubmit);
    document.getElementById('submitBtn').addEventListener('click', (e) => {
        const form = document.getElementById('planetForm');
        if (form.checkValidity()) {
            handleFormSubmit(e);
        } else {
            form.reportValidity();
        }
    });

    document.getElementById('sidePanelToggle').addEventListener('click', toggleSidePanel);
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
    document.getElementById('loadProfileBtn').addEventListener('click', loadProfile);

    // Slider Event Listeners
    const minSlider = document.getElementById('minSizeInput');
    const maxSlider = document.getElementById('maxSizeInput');

    minSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        CONFIG.MIN_SIZE_BASE = val / 100;
        document.getElementById('minSizeVal').textContent = val + '%';
        saveSettings(); // Save preference immediately
    });

    maxSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        CONFIG.MAX_SIZE_BASE = val / 100;
        document.getElementById('maxSizeVal').textContent = val + '%';
        saveSettings(); // Save preference immediately
    });

    // Load settings (if they exist)
    loadSettings();

    // Global Adjustment Button Event Listeners
    document.getElementById('impUpBtn').addEventListener('click', () => adjustAllImportance(1));
    document.getElementById('impDownBtn').addEventListener('click', () => adjustAllImportance(-1));
    document.getElementById('urgUpBtn').addEventListener('click', () => adjustAllUrgency(1));
    document.getElementById('urgDownBtn').addEventListener('click', () => adjustAllUrgency(-1));
    document.getElementById('intUpBtn').addEventListener('click', () => adjustAllInterval(1));
    document.getElementById('intDownBtn').addEventListener('click', () => adjustAllInterval(-1));

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasHover);

    // Touch events for mobile interaction
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });

    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') closeModal();
    });

    document.getElementById('confirmDelete').addEventListener('click', handleConfirmDelete);
    document.getElementById('confirmCancel').addEventListener('click', handleCancelDelete);
    document.getElementById('confirmDialog').addEventListener('click', (e) => {
        if (e.target.id === 'confirmDialog') hideConfirmDialog();
    });

    // Start animation
    animate();

    console.log('%c=== Planet Ideas v2.2 Smart-Fit Initialized ===', 'color: #667eea; font-size: 16px; font-weight: bold;');
}

function resizeCanvas() {
    // High DPI Display Support
    pixelRatio = window.devicePixelRatio || 1;
    logicalWidth = window.innerWidth;
    logicalHeight = window.innerHeight;

    // Set physical canvas size
    canvas.width = logicalWidth * pixelRatio;
    canvas.height = logicalHeight * pixelRatio;

    // Ensure CSS matches logical size
    canvas.style.width = logicalWidth + 'px';
    canvas.style.height = logicalHeight + 'px';

    // Scale context for high DPI
    ctx.scale(pixelRatio, pixelRatio);

    // Calculate layout metrics
    screenMinDim = Math.min(logicalWidth, logicalHeight);

    // Regenerate stars to fit new screen area
    generateStars();
}

function generateStars() {
    stars = [];
    const area = logicalWidth * logicalHeight;
    const count = Math.floor(area * CONFIG.STAR_COUNT_DENSITY);

    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * logicalWidth,
            y: Math.random() * logicalHeight,
            size: (Math.random() * 1.5 + 0.5), // Star size doesn't need scaling usually
            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: Math.random() * 0.02 + 0.01
        });
    }
}

// ==================== PLANET MANAGEMENT ====================
function createPlanet(name, importance, urgency, customInterval = null, customColor = null) {
    const id = Date.now() + Math.random();
    const color = customColor || generatePlanetColor();
    // Store importance as abstract 1-10, calculate pixels during render
    const speed = mapUrgencyToSpeed(urgency);
    const interval = customInterval !== null ? customInterval : calculateDefaultInterval(urgency, speed);
    const orbitPath = generateOrbitPath();

    const planet = {
        id,
        name,
        importance: parseInt(importance),
        urgency: parseInt(urgency),
        interval: parseFloat(interval),
        color,
        speed,
        orbitPath,
        phase: 'foreground',
        direction: 1,
        progress: 0,
        waitTime: 0,
        hovering: false
    };

    planets.push(planet);
    saveToLocalStorage();
    updatePlanetList();
    return planet;
}

function calculateDefaultInterval(urgency, speed) {
    if (urgency >= 9) return 1;
    if (urgency >= 7) return 2;
    if (urgency >= 5) return 3;
    if (urgency >= 3) return 4;
    return 5;
}

function deletePlanet(id) {
    planets = planets.filter(p => p.id !== id);
    if (activePlanetInfo && activePlanetInfo.id === id) {
        activePlanetInfo = null;
    }
    if (selectedPlanetId === id) {
        selectedPlanetId = null;
    }
    saveToLocalStorage();
    updatePlanetList();
}

function updatePlanet(id, name, importance, urgency, customInterval = null, customColor = null) {
    const planet = planets.find(p => p.id === id);
    if (planet) {
        planet.name = name;
        planet.importance = parseInt(importance);
        planet.urgency = parseInt(urgency);
        planet.speed = mapUrgencyToSpeed(urgency);
        planet.interval = customInterval !== null ? parseFloat(customInterval) : calculateDefaultInterval(urgency, planet.speed);
        if (customColor) {
            planet.color = customColor;
        }

        saveToLocalStorage();
        updatePlanetList();
    }
}

function generatePlanetColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B195', '#C06C84',
        '#6C5B7B', '#355C7D', '#F67280', '#C9D787', '#3EDBF0'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Calculate size dynamically based on current screen dimensions
function getPlanetSize(importance) {
    // Map importance 1-10 to a percentage of screen size
    const minPx = screenMinDim * CONFIG.MIN_SIZE_BASE;
    const maxPx = screenMinDim * CONFIG.MAX_SIZE_BASE;
    return minPx + (importance - 1) * (maxPx - minPx) / 9;
}

function mapUrgencyToSpeed(urgency) {
    const minTime = 1;
    const maxTime = 60;
    const time = minTime + (urgency - 1) * (maxTime - minTime) / 9;
    return time;
}

function generateOrbitPath() {
    return {
        yCenter: Math.random() * 0.6 + 0.2, // 0.2 to 0.8 of canvas height
        curvature: Math.random() * 0.15 + 0.05,
        curveDirection: Math.random() > 0.5 ? 1 : -1
    };
}

function getTextColor(bgColor) {
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// ==================== PLANET PHYSICS ====================
function updatePlanetPhysics(planet, deltaTime) {
    if (planet.waitTime > 0) {
        planet.waitTime -= deltaTime;
        return;
    }

    const progressIncrement = (deltaTime / 1000) / planet.speed;
    planet.progress += progressIncrement;

    if (planet.progress >= 1) {
        if (planet.phase === 'foreground') {
            planet.phase = 'background';
            planet.direction *= -1;
            planet.waitTime = planet.interval * 1000;
        } else {
            planet.phase = 'foreground';
            planet.direction *= -1;
            planet.waitTime = planet.interval * 1000;
        }
        planet.progress = 0;
    }
}

function getPlanetPosition(planet) {
    // Calculate dynamic size for this frame
    const currentSize = getPlanetSize(planet.importance);

    let x, y, size, opacity;

    if (planet.phase === 'foreground') {
        size = currentSize;
        opacity = 1;

        if (planet.direction === 1) {
            x = -size + (logicalWidth + size * 2) * planet.progress;
        } else {
            x = logicalWidth + size - (logicalWidth + size * 2) * planet.progress;
        }

        const curveProgress = Math.sin(planet.progress * Math.PI);
        y = logicalHeight * planet.orbitPath.yCenter +
            (curveProgress * logicalHeight * planet.orbitPath.curvature * planet.orbitPath.curveDirection);

    } else {
        size = currentSize * CONFIG.BACKGROUND_SCALE;
        opacity = CONFIG.BACKGROUND_OPACITY;

        if (planet.direction === 1) {
            x = -size + (logicalWidth + size * 2) * planet.progress;
        } else {
            x = logicalWidth + size - (logicalWidth + size * 2) * planet.progress;
        }

        const curveProgress = Math.sin(planet.progress * Math.PI);
        y = logicalHeight * planet.orbitPath.yCenter +
            (curveProgress * logicalHeight * planet.orbitPath.curvature * -planet.orbitPath.curveDirection);
    }

    return { x, y, size, opacity };
}

// ==================== RENDERING ====================
function animate() {
    const deltaTime = 16.67;

    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    drawSpace();

    planets.forEach(planet => updatePlanetPhysics(planet, deltaTime));

    const backgroundPlanets = planets.filter(p => p.phase === 'background');
    const foregroundPlanets = planets.filter(p => p.phase === 'foreground');

    backgroundPlanets.forEach(planet => drawPlanet(planet));

    // Draw foreground planets (sorted by size dynamically)
    foregroundPlanets
        .sort((a, b) => getPlanetSize(a.importance) - getPlanetSize(b.importance))
        .forEach(planet => drawPlanet(planet));

    if (activePlanetInfo) {
        const planet = planets.find(p => p.id === activePlanetInfo.id);
        if (planet) {
            drawInfoPanel(planet);
        } else {
            activePlanetInfo = null; // Clean up if planet deleted
        }
    }

    requestAnimationFrame(animate);
}

function drawSpace() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    stars.forEach(star => {
        star.twinkle += star.twinkleSpeed;
        const brightness = (Math.sin(star.twinkle) + 1) / 2 * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawPlanet(planet) {
    const pos = getPlanetPosition(planet);

    ctx.globalAlpha = pos.opacity;

    // Shadows for background planets
    if (planet.phase === 'background') {
        const foregroundPlanets = planets.filter(p => p.phase === 'foreground');
        foregroundPlanets.forEach(fgPlanet => {
            const fgPos = getPlanetPosition(fgPlanet);
            const distance = Math.sqrt((fgPos.x - pos.x) ** 2 + (fgPos.y - pos.y) ** 2);

            if (distance < fgPos.size / 2 + pos.size / 2 + 40) {
                const angle = Math.atan2(pos.y - fgPos.y, pos.x - fgPos.x);
                const shadowDistance = 8;
                const shadowX = pos.x + Math.cos(angle) * shadowDistance;
                const shadowY = pos.y + Math.sin(angle) * shadowDistance;

                const shadowGradient = ctx.createRadialGradient(
                    shadowX, shadowY, 0,
                    shadowX, shadowY, pos.size / 2 + 10
                );
                shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
                shadowGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.2)');
                shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = shadowGradient;
                ctx.beginPath();
                ctx.arc(shadowX, shadowY, pos.size / 2 + 10, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    // Glow effect
    if (planet.hovering && planet.phase === 'foreground') {
        const glowSize = screenMinDim * CONFIG.GLOW_RADIUS_PCT;
        const gradient = ctx.createRadialGradient(pos.x, pos.y, pos.size / 2, pos.x, pos.y, pos.size / 2 + glowSize);
        gradient.addColorStop(0, planet.color + '00');
        gradient.addColorStop(0.5, planet.color + '40');
        gradient.addColorStop(1, planet.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pos.size / 2 + glowSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // Planet Body
    ctx.fillStyle = planet.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pos.size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Text rendering with scale-aware fonts
    ctx.fillStyle = getTextColor(planet.color);
    // Dynamic font size based on planet size
    const fontSize = Math.max(pos.size / 8, 12);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = pos.size * 0.8;
    const words = planet.name.split(' ');
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);

    const lineHeight = fontSize * 1.2;
    const startY = pos.y - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, i) => {
        ctx.fillText(line, pos.x, startY + i * lineHeight);
    });

    ctx.globalAlpha = 1;
}

function drawInfoPanel(planet) {
    const pos = getPlanetPosition(planet);

    // Adjust panel size for smaller screens
    const isSmallScreen = logicalWidth < 500;
    const panelWidth = isSmallScreen ? 200 : 220;
    const panelHeight = 150;

    let panelX = pos.x + pos.size / 2 + 20;
    let panelY = pos.y - panelHeight / 2;

    // Intelligent panel positioning
    if (panelX + panelWidth > logicalWidth) {
        // If off right side, move to left
        panelX = pos.x - pos.size / 2 - panelWidth - 20;
    }
    // Ensure on screen vertically
    if (panelY < 10) panelY = 10;
    if (panelY + panelHeight > logicalHeight - 10) panelY = logicalHeight - panelHeight - 10;
    // Ensure on screen horizontally
    if (panelX < 10) panelX = 10;

    activePlanetInfo.panelBounds = {
        x: panelX,
        y: panelY,
        width: panelWidth,
        height: panelHeight
    };

    // Background
    ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Truncate name if too long for panel
    let displayName = planet.name;
    if (ctx.measureText(displayName).width > panelWidth - 30) {
        // Simple truncation for now
        displayName = displayName.substring(0, 15) + '...';
    }

    ctx.fillText(displayName, panelX + 15, panelY + 15);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(`Importance: ${planet.importance}`, panelX + 15, panelY + 45);
    ctx.fillText(`Urgency: ${planet.urgency}`, panelX + 15, panelY + 65);
    ctx.fillText(`Interval: ${planet.interval ? planet.interval.toFixed(1) + 's' : 'Auto'}`, panelX + 125, panelY + 65);

    // Buttons
    const btnY = panelY + panelHeight - 40;
    const btnHeight = 28;
    const availableWidth = panelWidth - 30; // 15px padding each side
    const gap = 8;
    const btnWidth = (availableWidth - (gap * 2)) / 3;

    // Edit
    activePlanetInfo.editBtn = {
        x: panelX + 15,
        y: btnY,
        width: btnWidth,
        height: btnHeight
    };
    ctx.fillStyle = '#667eea';
    roundRect(ctx, activePlanetInfo.editBtn.x, activePlanetInfo.editBtn.y,
        activePlanetInfo.editBtn.width, activePlanetInfo.editBtn.height, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Edit', activePlanetInfo.editBtn.x + btnWidth / 2, activePlanetInfo.editBtn.y + btnHeight / 2);

    // Delete
    activePlanetInfo.deleteBtn = {
        x: panelX + 15 + btnWidth + gap,
        y: btnY,
        width: btnWidth,
        height: btnHeight
    };
    ctx.fillStyle = 'rgba(220, 38, 38, 0.8)';
    roundRect(ctx, activePlanetInfo.deleteBtn.x, activePlanetInfo.deleteBtn.y,
        activePlanetInfo.deleteBtn.width, activePlanetInfo.deleteBtn.height, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Del', activePlanetInfo.deleteBtn.x + btnWidth / 2, activePlanetInfo.deleteBtn.y + btnHeight / 2);

    // Cancel
    activePlanetInfo.cancelBtn = {
        x: panelX + 15 + (btnWidth + gap) * 2,
        y: btnY,
        width: btnWidth,
        height: btnHeight
    };
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    roundRect(ctx, activePlanetInfo.cancelBtn.x, activePlanetInfo.cancelBtn.y,
        activePlanetInfo.cancelBtn.width, activePlanetInfo.cancelBtn.height, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('X', activePlanetInfo.cancelBtn.x + btnWidth / 2, activePlanetInfo.cancelBtn.y + btnHeight / 2);
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// ==================== UI INTERACTIONS ====================

// Touch support wrapper
function handleTouchStart(e) {
    // Prevent default only if not hitting UI elements that need it
    // but we need to pass coordinates to standard handler
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        const fakeEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => e.preventDefault()
        };
        handleCanvasClick(fakeEvent);
    }
}

function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activePlanetInfo) {
        if (isPointInRect(x, y, activePlanetInfo.editBtn)) {
            openEditModal(activePlanetInfo.id);
            activePlanetInfo = null;
            return;
        }
        if (isPointInRect(x, y, activePlanetInfo.deleteBtn)) {
            const planetToDelete = planets.find(p => p.id === activePlanetInfo.id);
            if (planetToDelete) {
                showConfirmDialog(
                    `Delete "${planetToDelete.name}"?`,
                    () => {
                        deletePlanet(activePlanetInfo.id);
                        activePlanetInfo = null;
                    }
                );
            }
            return;
        }
        if (isPointInRect(x, y, activePlanetInfo.cancelBtn)) {
            activePlanetInfo = null;
            return;
        }
        if (isPointInRect(x, y, activePlanetInfo.panelBounds)) {
            return;
        }
    }

    const sidePanel = document.getElementById('sidePanel');
    if (sidePanel.classList.contains('open')) {
        const clickedPlanet = getPlanetAtPoint(x, y);
        if (!clickedPlanet) {
            toggleSidePanel();
        }
    }

    const clickedPlanet = getPlanetAtPoint(x, y);
    if (clickedPlanet) {
        activePlanetInfo = { id: clickedPlanet.id };
    } else {
        activePlanetInfo = null;
    }
}

function handleCanvasHover(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hoveredPlanet = getPlanetAtPoint(x, y);

    planets.forEach(planet => {
        planet.hovering = planet === hoveredPlanet;
    });

    canvas.style.cursor = hoveredPlanet ? 'pointer' : 'default';
}

function getPlanetAtPoint(x, y) {
    const foreground = planets.filter(p => p.phase === 'foreground')
        // Sort by current size for hit detection priority
        .sort((a, b) => getPlanetSize(b.importance) - getPlanetSize(a.importance));

    for (const planet of foreground) {
        const pos = getPlanetPosition(planet);
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (distance <= pos.size / 2) {
            return planet;
        }
    }

    return null;
}

function isPointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width &&
        y >= rect.y && y <= rect.y + rect.height;
}

function openAddModal() {
    editingPlanetId = null;
    document.getElementById('modalTitle').textContent = 'Add New Idea';
    document.getElementById('submitBtn').textContent = 'Create Planet';
    document.getElementById('planetForm').reset();
    document.getElementById('modal').classList.add('show');
}

function openEditModal(planetId) {
    const planet = planets.find(p => p.id === planetId);
    if (!planet) return;

    editingPlanetId = planetId;
    document.getElementById('modalTitle').textContent = 'Edit Idea';
    document.getElementById('submitBtn').textContent = 'Save Changes';
    document.getElementById('planetName').value = planet.name;
    document.getElementById('planetImportance').value = planet.importance;
    document.getElementById('planetUrgency').value = planet.urgency;
    document.getElementById('planetInterval').value = planet.interval || '';
    document.getElementById('planetColor').value = planet.color || '#FFFFFF';
    document.getElementById('modal').classList.add('show');

    selectedPlanetId = planetId;
    document.getElementById('sidePanel').classList.add('open');
    const toggle = document.getElementById('sidePanelToggle');
    toggle.classList.add('panel-open');
    toggle.textContent = '✕';
    updatePlanetList();
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
    editingPlanetId = null;
}

function handleFormSubmit(e) {
    if (e && e.preventDefault) {
        e.preventDefault();
        e.stopPropagation();
    }

    const name = document.getElementById('planetName').value.trim();
    const importance = document.getElementById('planetImportance').value;
    const urgency = document.getElementById('planetUrgency').value;
    const intervalInput = document.getElementById('planetInterval').value.trim();
    const customInterval = intervalInput ? parseFloat(intervalInput) : null;
    const colorInput = document.getElementById('planetColor').value.trim();
    // Treat #000000 (default color input value) as "no color selected"
    const customColor = (colorInput && colorInput.toLowerCase() !== '#000000') ? colorInput : null;

    if (!name || !importance || !urgency) {
        return false;
    }

    if (editingPlanetId) {
        updatePlanet(editingPlanetId, name, importance, urgency, customInterval, customColor);
    } else {
        createPlanet(name, importance, urgency, customInterval, customColor);
    }

    closeModal();
    return false;
}

function toggleSidePanel() {
    const panel = document.getElementById('sidePanel');
    const toggle = document.getElementById('sidePanelToggle');
    const isOpen = panel.classList.contains('open');

    if (isOpen) {
        panel.classList.remove('open');
        toggle.classList.remove('panel-open');
        toggle.textContent = '☰';
    } else {
        panel.classList.add('open');
        toggle.classList.add('panel-open');
        toggle.textContent = '✕';
    }
}

function updatePlanetList() {
    const listContainer = document.getElementById('planetList');
    listContainer.innerHTML = '';

    document.getElementById('planetCount').textContent =
        `${planets.length} planet${planets.length !== 1 ? 's' : ''} orbiting`;

    planets.forEach(planet => {
        const item = document.createElement('div');
        item.className = 'planet-item';
        if (planet.id === selectedPlanetId) {
            item.classList.add('selected');
        }

        item.innerHTML = `
            <div class="planet-item-header">
                <div class="planet-item-name">${planet.name}</div>
                <div class="planet-item-color" style="background: ${planet.color}"></div>
            </div>
            <div class="planet-item-stats">
                <div class="planet-item-stat">
                    <span class="planet-item-stat-label">Imp</span>
                    <span class="planet-item-stat-value">${planet.importance}</span>
                </div>
                <div class="planet-item-stat">
                    <span class="planet-item-stat-label">Urg</span>
                    <span class="planet-item-stat-value">${planet.urgency}</span>
                </div>
                <div class="planet-item-stat">
                    <span class="planet-item-stat-label">Int</span>
                    <span class="planet-item-stat-value">${planet.interval ? planet.interval.toFixed(1) + 's' : 'Auto'}</span>
                </div>
            </div>
            <button class="delete-btn" data-id="${planet.id}">Delete</button>
        `;

        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-btn')) {
                selectedPlanetId = planet.id;
                updatePlanetList();
                openEditModal(planet.id);
            }
        });

        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirmDialog(
                `Delete "${planet.name}"?`,
                () => {
                    deletePlanet(planet.id);
                }
            );
        });

        listContainer.appendChild(item);
    });
}

// ==================== STORAGE ====================
function saveToLocalStorage() {
    const data = {
        planets: planets.map(p => ({
            id: p.id,
            name: p.name,
            importance: p.importance,
            urgency: p.urgency,
            interval: p.interval,
            color: p.color,
            orbitPath: p.orbitPath
        }))
    };
    localStorage.setItem('planetIdeas', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const stored = localStorage.getItem('planetIdeas');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            planets = data.planets.map(p => {
                const speed = mapUrgencyToSpeed(p.urgency);
                const interval = p.interval !== undefined ? p.interval : calculateDefaultInterval(p.urgency, speed);
                return {
                    ...p,
                    speed: speed,
                    interval: interval,
                    phase: 'foreground',
                    direction: 1,
                    progress: Math.random(),
                    waitTime: 0,
                    hovering: false
                };
            });
            updatePlanetList();
        } catch (e) {
            console.error('Failed to load from localStorage', e);
        }
    }
}

// ==================== SETTINGS STORAGE ====================

function saveSettings() {
    const settings = {
        min: CONFIG.MIN_SIZE_BASE,
        max: CONFIG.MAX_SIZE_BASE
    };
    localStorage.setItem('planetSettings', JSON.stringify(settings));
}

function loadSettings() {
    const stored = localStorage.getItem('planetSettings');
    if (stored) {
        try {
            const settings = JSON.parse(stored);
            if (settings.min) CONFIG.MIN_SIZE_BASE = settings.min;
            if (settings.max) CONFIG.MAX_SIZE_BASE = settings.max;

            // Update UI to match loaded data
            document.getElementById('minSizeInput').value = Math.round(CONFIG.MIN_SIZE_BASE * 100);
            document.getElementById('minSizeVal').textContent = Math.round(CONFIG.MIN_SIZE_BASE * 100) + '%';

            document.getElementById('maxSizeInput').value = Math.round(CONFIG.MAX_SIZE_BASE * 100);
            document.getElementById('maxSizeVal').textContent = Math.round(CONFIG.MAX_SIZE_BASE * 100) + '%';
        } catch (e) {
            console.error("Error loading settings", e);
        }
    }
}

// ==================== GLOBAL ADJUSTMENTS ====================

function adjustAllImportance(delta) {
    if (planets.length === 0) return;
    planets.forEach(planet => {
        planet.importance = Math.max(1, Math.min(10, planet.importance + delta));
    });
    saveToLocalStorage();
    updatePlanetList();
}

function adjustAllUrgency(delta) {
    if (planets.length === 0) return;
    planets.forEach(planet => {
        planet.urgency = Math.max(1, Math.min(10, planet.urgency + delta));
        planet.speed = mapUrgencyToSpeed(planet.urgency);
    });
    saveToLocalStorage();
    updatePlanetList();
}

function adjustAllInterval(delta) {
    if (planets.length === 0) return;
    planets.forEach(planet => {
        planet.interval = Math.max(1, Math.min(60, planet.interval + delta));
    });
    saveToLocalStorage();
    updatePlanetList();
}

function saveProfile() {
    const data = {
        settings: {
            min: CONFIG.MIN_SIZE_BASE,
            max: CONFIG.MAX_SIZE_BASE
        },
        planets: planets.map(p => ({
            id: p.id,
            name: p.name,
            importance: p.importance,
            urgency: p.urgency,
            interval: p.interval,
            color: p.color,
            orbitPath: p.orbitPath
        })),
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planet-ideas-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function loadProfile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // Load Settings if they exist in file
                if (data.settings) {
                    CONFIG.MIN_SIZE_BASE = data.settings.min;
                    CONFIG.MAX_SIZE_BASE = data.settings.max;
                    saveSettings(); // Persist to local storage

                    // Update UI sliders
                    document.getElementById('minSizeInput').value = Math.round(CONFIG.MIN_SIZE_BASE * 100);
                    document.getElementById('minSizeVal').textContent = Math.round(CONFIG.MIN_SIZE_BASE * 100) + '%';
                    document.getElementById('maxSizeInput').value = Math.round(CONFIG.MAX_SIZE_BASE * 100);
                    document.getElementById('maxSizeVal').textContent = Math.round(CONFIG.MAX_SIZE_BASE * 100) + '%';
                }

                // Load Planets
                planets = data.planets.map(p => {
                    const speed = mapUrgencyToSpeed(p.urgency);
                    const interval = p.interval !== undefined ? p.interval : calculateDefaultInterval(p.urgency, speed);
                    return {
                        ...p,
                        speed: speed,
                        interval: interval,
                        phase: 'foreground',
                        direction: 1,
                        progress: Math.random(),
                        waitTime: 0,
                        hovering: false
                    };
                });
                saveToLocalStorage();
                updatePlanetList();
                alert('Profile loaded successfully!');
            } catch (err) {
                console.error(err);
                alert('Failed to load profile. Invalid file format.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}


// ==================== SUPABASE INTEGRATION (BLUEPRINT) ====================
/*
// Uncomment and configure when ready to use Supabase

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

async function saveToSupabase() {
    const data = {
        planets: planets.map(p => ({
            name: p.name,
            importance: p.importance,
            urgency: p.urgency,
            color: p.color,
            orbitPath: p.orbitPath
        })),
        user_id: 'USER_ID_HERE', // Implement authentication
        updated_at: new Date().toISOString()
    };
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/planet_profiles`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    
    if (response.ok) {
        alert('Saved to cloud!');
    }
}

async function loadFromSupabase(profileId) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/planet_profiles?id=eq.${profileId}`,
        {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        }
    );
    
    const data = await response.json();
    if (data.length > 0) {
        // Load planets from cloud data
        planets = data[0].planets.map(p => ({
            ...p,
            id: Date.now() + Math.random(),
            size: mapImportanceToSize(p.importance),
            speed: mapUrgencyToSpeed(p.urgency),
            phase: 'foreground',
            direction: 1,
            progress: Math.random(),
            waitTime: 0,
            hovering: false
        }));
        saveToLocalStorage();
        updatePlanetList();
    }
}
*/

// ==================== START ====================
init();
