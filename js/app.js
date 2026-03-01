// ============================================
// Gears Application - Main Application
// ============================================

var isEmbedded = (window.parent !== window);

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

    // Embedded mode adjustments (when inside Robotics app)
    if (isEmbedded) {
        // Hide menu bar and status bar for cleaner embedded experience
        var menuBar = document.querySelector('.menu-bar');
        if (menuBar) menuBar.style.display = 'none';
        var statusBar = document.querySelector('.status-bar');
        if (statusBar) statusBar.style.display = 'none';

        // Auto-enable motor mode
        state.settings.motor.enabled = true;
        updateMotorModeUI();

        // Hide output palette (wheel is pre-attached in default train)
        var outputSection = document.getElementById('outputPaletteSection');
        if (outputSection) outputSection.style.display = 'none';

        // Hide help icons for cleaner embedded UI
        var helpIcons = document.querySelectorAll('.help-icon');
        helpIcons.forEach(function(el) { el.style.display = 'none'; });

        // Listen for messages from parent
        window.addEventListener('message', function(event) {
            var data = event.data;
            if (!data || !data.type) return;

            if (data.type === 'robotics:loadGears') {
                if (data.gearsData && typeof loadProjectData === 'function') {
                    loadProjectData(data.gearsData);
                }
                // If loading resulted in no gears (empty save), create default
                if (state.gears.length === 0) {
                    createDefaultGearTrain();
                } else {
                    // Auto-play loaded gear train
                    if (!isPlaying && typeof togglePlay === 'function') {
                        togglePlay();
                    }
                }
            } else if (data.type === 'robotics:requestGearsState') {
                sendGearsState();
            }
        });

        // Notify parent that gears tool is ready
        window.parent.postMessage({
            type: 'robotics:childReady',
            tool: 'gears'
        }, '*');

        // If no saved data arrives, create a default gear train after a short delay
        setTimeout(function() {
            if (state.gears.length === 0) {
                createDefaultGearTrain();
            }
        }, 500);
    }
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
            // Apply load to speed
            var baseSpeed;
            if (state.settings.motor && state.settings.motor.enabled) {
                // Motor mode: derive speed from motor RPM
                // Convert RPM to rotations/sec, then scale by direction
                baseSpeed = (state.settings.motor.rpmInput / 60) * state.settings.spinDirection;
            } else {
                baseSpeed = state.settings.spinSpeed * state.settings.spinDirection * BASE_ROTATION_SPEED;
            }
            var currentSpeed = baseSpeed * multiplier;

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

    // Update motor output metrics display (if motor mode)
    if (state.settings.motor && state.settings.motor.enabled && typeof calculateMotorOutput === 'function') {
        var motorOutput = calculateMotorOutput();
        if (motorOutput) {
            updateMotorMetrics(motorOutput);
        }
    }
}

function updateMotorMetrics(output) {
    var el = document.getElementById('motorMetrics');
    if (!el) return;

    var ratioStr = output.gearRatio >= 1
        ? output.gearRatio.toFixed(1) + ':1'
        : '1:' + (1 / output.gearRatio).toFixed(1);

    el.innerHTML =
        '<div class="motor-metric"><span>Input</span><strong>' + output.inputRpm.toFixed(0) + ' RPM</strong></div>' +
        '<div class="motor-metric"><span>Output</span><strong>' + output.outputRpm.toFixed(0) + ' RPM</strong></div>' +
        '<div class="motor-metric"><span>Ratio</span><strong>' + ratioStr + '</strong></div>' +
        '<div class="motor-metric"><span>Torque x</span><strong>' + output.gearRatio.toFixed(1) + 'x</strong></div>' +
        '<div class="motor-metric"><span>Power</span><strong>' + output.power.toFixed(2) + ' W</strong></div>';
}

// Create a default 3-gear reduction train for embedded (Robotics) mode
// 8-tooth driver -> 24-tooth intermediate -> 48-tooth output with wheel
// Produces a 6:1 reduction: 150 RPM in, ~25 RPM out, 3.0 Nm torque out
function createDefaultGearTrain() {
    // Calculate gear radii: radius = teethCount * moduleSize / 2 (moduleSize=5)
    // r(8)=20, r(24)=60, r(48)=120
    var r1 = calculateRadius(8);   // 20
    var r2 = calculateRadius(24);  // 60
    var r3 = calculateRadius(48);  // 120

    // Total span: (r1+r2) + (r2+r3) = 80 + 180 = 260px
    // Center the train on the canvas
    var cx = canvasWidth / 2;
    var cy = canvasHeight / 2;
    var totalSpan = (r1 + r2) + (r2 + r3);
    var startX = cx - totalSpan / 2;

    // Create gears with specific colors
    var driver = createGear(startX, cy, 8, '#f39c12');         // orange driver
    var intermediate = createGear(startX + r1 + r2, cy, 24, '#3498db');  // blue
    var outputGear = createGear(startX + r1 + r2 + r2 + r3, cy, 48, '#2ecc71'); // green

    // Set driver gear
    state.driverGearId = driver.id;

    // Set output shaft
    state.outputShaftGearId = outputGear.id;

    // Set motor preset to medium (150 RPM, 0.5 Nm)
    state.settings.motor.enabled = true;
    state.settings.motor.rpmInput = 150;
    state.settings.motor.torqueNm = 0.5;
    var presetSelect = document.getElementById('motorPreset');
    if (presetSelect) presetSelect.value = 'medium';
    var rpmSlider = document.getElementById('motorRpmSlider');
    var rpmValue = document.getElementById('motorRpmValue');
    if (rpmSlider) rpmSlider.value = 150;
    if (rpmValue) rpmValue.textContent = '150';
    var torqueSlider = document.getElementById('motorTorqueSlider');
    var torqueValue = document.getElementById('motorTorqueValue');
    if (torqueSlider) torqueSlider.value = 50;
    if (torqueValue) torqueValue.textContent = '0.50';

    updateMotorModeUI();

    // Attach a wheel to the output gear
    var wheel = createOutput('wheel', outputGear.x, outputGear.y);
    wheel.attachedToGear = outputGear.id;

    // Recalculate connections and phase offsets
    updateAllConnections();

    // Auto-play
    if (!isPlaying && typeof togglePlay === 'function') {
        togglePlay();
    }
}

function sendGearsState() {
    if (!isEmbedded) return;
    var stateData = typeof serializeProject === 'function' ? serializeProject() : {};
    var motorOutput = typeof calculateMotorOutput === 'function' ? calculateMotorOutput() : null;
    window.parent.postMessage({
        type: 'robotics:gearsState',
        state: {
            gearsData: stateData,
            motorOutput: motorOutput
        }
    }, '*');
}

function updateMotorModeUI() {
    // Toggle visibility of motor controls vs speed slider
    var motorControls = document.getElementById('motorControls');
    var speedControl = document.querySelector('.speed-control');
    var toggleBtn = document.getElementById('motorToggleBtn');
    if (state.settings.motor && state.settings.motor.enabled) {
        if (motorControls) motorControls.style.display = 'block';
        if (speedControl) speedControl.style.display = 'none';
        if (toggleBtn) toggleBtn.textContent = 'Disable Motor Mode';
    } else {
        if (motorControls) motorControls.style.display = 'none';
        if (speedControl) speedControl.style.display = '';
        if (toggleBtn) toggleBtn.textContent = 'Enable Motor Mode';
    }
}

// ============================================
// Initialize on Window Load
// ============================================
window.addEventListener('load', init);
