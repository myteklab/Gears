// ============================================
// Gears Application - Main Application
// ============================================

var isEmbedded = false;

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

    // Listen for Robotics app embed messages (only activates embedded mode
    // when the Robotics app explicitly signals, not just because we're in
    // an iframe, since the platform also loads apps in iframes)
    if (window.parent !== window) {
        window.addEventListener('message', function(event) {
            var data = event.data;
            if (!data || !data.type) return;

            if (data.type === 'robotics:loadGears') {
                if (!isEmbedded) activateEmbeddedMode();
                if (data.gearsData && typeof loadProjectData === 'function') {
                    loadProjectData(data.gearsData);
                }
                if (state.gears.length === 0) {
                    createDefaultGearTrain();
                } else {
                    if (!isPlaying && typeof togglePlay === 'function') {
                        togglePlay();
                    }
                }
            } else if (data.type === 'robotics:requestGearsState') {
                sendGearsState();
            }
        });
    }
}

// Activate embedded mode (called only when Robotics app signals)
function activateEmbeddedMode() {
    isEmbedded = true;

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
            // Calculate speed
            var baseSpeed;
            var currentSpeed;
            var visualSpeed;
            if (state.settings.motor && state.settings.motor.enabled) {
                // Motor mode: motor delivers its set RPM, scaled by the speed slider.
                // Visual rotation is capped to avoid stroboscopic aliasing at
                // high RPMs (teeth-per-frame aligns with refresh rate, making
                // gears appear frozen). RPM display shows real motor values.
                baseSpeed = (state.settings.motor.rpmInput / 60) * state.settings.spinDirection;
                currentSpeed = baseSpeed * state.settings.spinSpeed;
                var absSpeed = Math.abs(currentSpeed);
                var maxVisualRotPerSec = 8;
                var visualScale = absSpeed > maxVisualRotPerSec ? maxVisualRotPerSec / absSpeed : 1;
                visualSpeed = currentSpeed * visualScale;
            } else {
                // Free-spin mode: load reduces speed
                baseSpeed = state.settings.spinSpeed * state.settings.spinDirection * BASE_ROTATION_SPEED;
                currentSpeed = baseSpeed * multiplier;
                visualSpeed = currentSpeed;
            }

            // rotationSpeed stores the real physics value (for RPM display)
            driver.rotationSpeed = currentSpeed;
            // rotation advances at visual speed (may be slower than real)
            driver.rotation += visualSpeed * deltaTime * Math.PI * 2;

            // Propagate rotation through gear train with proper synchronization
            // (connected rotations derive from driver.rotation for visuals,
            //  connected rotationSpeed derives from driver.rotationSpeed for RPM)
            synchronizeGearRotations(driver);
        }
    }

    // Update output rotations and payloads based on attached gear
    state.outputs.forEach(output => {
        if (output.attachedToGear) {
            const gear = state.gears.find(g => g.id === output.attachedToGear);
            if (gear) {
                var prevRotation = output.rotation;
                output.rotation = gear.rotation;
                output.x = gear.x;
                output.y = gear.y;

                // Animate crane: rope winds around drum as gear rotates
                // Any rotation (regardless of direction) lifts the weight
                if (output.type === 'crane' && output.payload) {
                    // Ensure liftedHeight is a valid number
                    if (!output.payload.liftedHeight || isNaN(output.payload.liftedHeight)) {
                        output.payload.liftedHeight = 0;
                    }
                    var deltaRot = Math.abs(gear.rotation - prevRotation);
                    // Ignore large jumps (e.g. first frame after load or direction change)
                    if (deltaRot > 0.5) deltaRot = 0;
                    var drumRadius = 14; // pixels, matches drawCrane drum size
                    output.payload.liftedHeight += deltaRot * drumRadius;
                    var ropeLen = output.payload.ropeLength || 150;
                    var maxLift = ropeLen - 30;
                    output.payload.liftedHeight = Math.max(0, Math.min(maxLift, output.payload.liftedHeight));
                }

                // Animate generator: power output = torque * angular velocity
                // brightness scales with mechanical power delivered to the generator
                if (output.type === 'generator' && output.payload) {
                    var angularVel = Math.abs(gear.rotationSpeed) * 2 * Math.PI; // rad/s
                    // Estimate torque from motor output if available, otherwise use RPM-based approximation
                    var maxWatts = output.payload.maxWatts || 10;
                    // Power approximation: proportional to RPM (simplified generator model)
                    var rpm = Math.abs(gear.rotationSpeed * 60);
                    var powerFraction = rpm / (maxWatts * 6);
                    output.payload.brightness = Math.min(1, Math.max(0, powerFraction));
                }
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

    // gearRatio = driver_teeth/output_teeth (e.g. 1/6 for 8->48)
    // Reduction ratio for display: output_teeth/driver_teeth (e.g. 6:1)
    var reductionRatio = 1 / output.gearRatio;
    var ratioStr = reductionRatio >= 1
        ? reductionRatio.toFixed(1) + ':1'
        : '1:' + (1 / reductionRatio).toFixed(1);

    el.innerHTML =
        '<div class="motor-metric"><span>Input</span><strong>' + output.inputRpm.toFixed(0) + ' RPM</strong></div>' +
        '<div class="motor-metric"><span>Output</span><strong>' + output.outputRpm.toFixed(0) + ' RPM</strong></div>' +
        '<div class="motor-metric"><span>Ratio</span><strong>' + ratioStr + '</strong></div>' +
        '<div class="motor-metric"><span>Torque x</span><strong>' + reductionRatio.toFixed(1) + 'x</strong></div>' +
        '<div class="motor-metric"><span>Power</span><strong>' + output.power.toFixed(2) + ' W</strong></div>';
}

// Create a default gear motor reduction train for embedded (Robotics) mode.
// Simulates a DC motor (2000 RPM) driving through a 4-gear chain to a wheel.
// With simple external meshing the total ratio is always first/last =
// 8/48 = 6:1, so intermediates add visual progression showing gears getting
// larger from motor to wheel. Real gear motors use compound (co-axial)
// stages for higher ratios, but this demonstrates the principle.
// Output: ~333 RPM, 0.6 Nm (6x torque multiplication from 0.1 Nm input).
// Visual rotation is capped at 8 rot/sec to avoid stroboscopic aliasing.
function createDefaultGearTrain() {
    // Gear teeth: 8 -> 12 -> 24 -> 48  (small to large visual progression)
    // Radii: r = teeth * 5 / 2
    var teeth = [8, 12, 24, 48];
    var colors = ['#f39c12', '#e74c3c', '#3498db', '#2ecc71'];
    var radii = teeth.map(function(t) { return calculateRadius(t); });
    // radii: [20, 30, 60, 120]

    // Mesh distances between consecutive gears
    var meshDists = [];
    for (var i = 0; i < radii.length - 1; i++) {
        meshDists.push(radii[i] + radii[i + 1]);
    }
    // meshDists: [50, 90, 180] -> total span = 320px

    var totalSpan = 0;
    for (var i = 0; i < meshDists.length; i++) totalSpan += meshDists[i];

    var cx = canvasWidth / 2;
    var cy = canvasHeight / 2;
    var x = cx - totalSpan / 2;

    // Create all gears
    var gears = [];
    for (var i = 0; i < teeth.length; i++) {
        gears.push(createGear(x, cy, teeth[i], colors[i]));
        if (i < meshDists.length) x += meshDists[i];
    }

    // Set driver (first gear, attached to motor shaft)
    state.driverGearId = gears[0].id;

    // Set output shaft (last gear, drives the wheel)
    state.outputShaftGearId = gears[gears.length - 1].id;

    // Configure motor: 2000 RPM, 0.1 Nm
    // With 6:1 reduction: output = ~333 RPM, 0.6 Nm
    state.settings.motor.enabled = true;
    state.settings.motor.rpmInput = 2000;
    state.settings.motor.torqueNm = 0.1;
    var presetSelect = document.getElementById('motorPreset');
    if (presetSelect) presetSelect.value = '';
    var rpmSlider = document.getElementById('motorRpmSlider');
    var rpmValue = document.getElementById('motorRpmValue');
    if (rpmSlider) rpmSlider.value = 2000;
    if (rpmValue) rpmValue.textContent = '2000';
    var torqueSlider = document.getElementById('motorTorqueSlider');
    var torqueValue = document.getElementById('motorTorqueValue');
    if (torqueSlider) torqueSlider.value = 10;
    if (torqueValue) torqueValue.textContent = '0.10';

    updateMotorModeUI();

    // Attach a wheel to the output gear
    var outputGear = gears[gears.length - 1];
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
    // Toggle visibility of motor controls (speed slider stays visible in both modes)
    var motorControls = document.getElementById('motorControls');
    var toggleBtn = document.getElementById('motorToggleBtn');
    if (state.settings.motor && state.settings.motor.enabled) {
        if (motorControls) motorControls.style.display = 'block';
        if (toggleBtn) toggleBtn.textContent = 'Disable Motor Mode';
    } else {
        if (motorControls) motorControls.style.display = 'none';
        if (toggleBtn) toggleBtn.textContent = 'Enable Motor Mode';
    }
}

// ============================================
// Initialize on Window Load
// ============================================
window.addEventListener('load', init);
