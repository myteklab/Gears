// ============================================
// Gears Application - Main Application
// ============================================

// ============================================
// Initialization
// ============================================
function init() {
    canvas = document.getElementById('gearCanvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Setup event listeners
    setupCanvasEvents();
    setupPaletteEvents();
    setupControlEvents();
    setupKeyboardShortcuts();

    // Start render loop
    requestAnimationFrame(gameLoop);

    updateUI();
}

function resizeCanvas() {
    const container = canvas.parentElement;
    canvasWidth = container.clientWidth;
    canvasHeight = container.clientHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
}

// Sync UI controls with current settings (called after loading project)
function syncSettingsUI() {
    // Speed slider
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    if (speedSlider && speedValue) {
        speedSlider.value = state.settings.spinSpeed;
        const val = state.settings.spinSpeed;
        speedValue.textContent = (val % 1 ? val.toFixed(1) : val) + 'x';
    }

    // Settings modal sliders
    const thicknessSlider = document.getElementById('thicknessSlider');
    const thicknessValue = document.getElementById('thicknessValue');
    if (thicknessSlider && thicknessValue) {
        thicknessSlider.value = state.settings.toothThickness * 100;
        thicknessValue.textContent = Math.round(state.settings.toothThickness * 100) + '%';
    }

    const depthSlider = document.getElementById('depthSlider');
    const depthValue = document.getElementById('depthValue');
    if (depthSlider && depthValue) {
        depthSlider.value = state.settings.toothDepth;
        depthValue.textContent = state.settings.toothDepth + 'px';
    }
}

// ============================================
// Game Loop
// ============================================
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (isPlaying) {
        update(deltaTime);
    }

    render();
    animationId = requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    // Update driver gear rotation
    const driver = state.gears.find(g => g.id === state.driverGearId);
    if (driver) {
        // Calculate load from connected gears
        const { multiplier, percentage, locked } = calculateSystemLoad();

        // Update load display in status bar
        const loadDisplay = document.getElementById('loadStatus');
        if (loadDisplay) {
            if (locked) {
                // System is locked - show LOCKED indicator
                loadDisplay.textContent = 'LOCKED';
                loadDisplay.style.color = '#ff0000';
                loadDisplay.style.fontWeight = 'bold';
                loadDisplay.style.animation = 'pulse 0.5s infinite';
            } else {
                loadDisplay.textContent = percentage.toFixed(0) + '%';
                loadDisplay.style.fontWeight = 'normal';
                loadDisplay.style.animation = 'none';
                // Color code: green (low) -> yellow -> red (high)
                if (percentage < 30) {
                    loadDisplay.style.color = '#2ecc71';
                } else if (percentage < 60) {
                    loadDisplay.style.color = '#f39c12';
                } else {
                    loadDisplay.style.color = '#e74c3c';
                }
            }
        }

        // Only rotate if not locked
        if (!locked) {
            // Apply load to speed - more gears = slower rotation
            const baseSpeed = state.settings.spinSpeed * state.settings.spinDirection * BASE_ROTATION_SPEED;
            const currentSpeed = baseSpeed * multiplier;

            driver.rotationSpeed = currentSpeed;
            driver.rotation += currentSpeed * deltaTime * Math.PI * 2;

            // Propagate rotation through gear train with proper synchronization
            synchronizeGearRotations(driver);
        }
    }

    // Update output rotations based on attached gear
    state.outputs.forEach(output => {
        if (output.attachedToGear) {
            const gear = state.gears.find(g => g.id === output.attachedToGear);
            if (gear) {
                output.rotation = gear.rotation;
                output.x = gear.x;
                output.y = gear.y;
            }
        }
    });
}

// ============================================
// Initialize on Window Load
// ============================================
window.addEventListener('load', init);
