// ============================================
// Gears Application - Physics & Meshing
// ============================================

// ============================================
// Gear Physics - Realistic Tooth Meshing
// ============================================

// Angular pitch: angle between adjacent teeth
function getAngularPitch(gear) {
    return (2 * Math.PI) / gear.teethCount;
}

// Get the angle of tooth N (center of tooth tip)
function getToothAngle(gear, toothIndex) {
    return toothIndex * getAngularPitch(gear) + gear.rotation;
}

// Get the angle of gap N (center of valley between teeth)
function getGapAngle(gear, gapIndex) {
    return (gapIndex + 0.5) * getAngularPitch(gear) + gear.rotation;
}

// Normalize angle to [-PI, PI]
function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

function checkMeshing(gear1, gear2) {
    const dist = Math.hypot(gear2.x - gear1.x, gear2.y - gear1.y);
    const meshDist = gear1.radius + gear2.radius;
    const tolerance = 15;
    return Math.abs(dist - meshDist) < tolerance;
}

function canMesh(gear1, gear2) {
    const dist = Math.hypot(gear2.x - gear1.x, gear2.y - gear1.y);
    const meshDist = gear1.radius + gear2.radius;
    const snapTolerance = 30;
    return Math.abs(dist - meshDist) < snapTolerance;
}

function snapToMesh(movingGear, targetGear) {
    const angle = Math.atan2(movingGear.y - targetGear.y, movingGear.x - targetGear.x);
    const meshDist = movingGear.radius + targetGear.radius;

    movingGear.x = targetGear.x + Math.cos(angle) * meshDist;
    movingGear.y = targetGear.y + Math.sin(angle) * meshDist;

    // Calculate proper phase alignment so teeth interlock
    alignTeethForMeshing(movingGear, targetGear);
}

// Calculate the rotation offset needed for gear2's teeth to properly mesh with gear1
function alignTeethForMeshing(gear2, gear1) {
    // Contact angle: direction from gear1 center to gear2 center
    const contactAngle = Math.atan2(gear2.y - gear1.y, gear2.x - gear1.x);

    // At the contact point, gear1 should have a tooth and gear2 should have a gap
    // Find the nearest tooth of gear1 to the contact angle
    const pitch1 = getAngularPitch(gear1);
    const tooth1Angle = gear1.rotation + Math.round((contactAngle - gear1.rotation) / pitch1) * pitch1;

    // The contact point from gear2's perspective is opposite
    const contactAngle2 = contactAngle + Math.PI;

    // Gear2 needs a gap at contactAngle2
    // Gap centers are at rotation + (i + 0.5) * pitch
    const pitch2 = getAngularPitch(gear2);

    // Calculate what rotation gear2 needs so that a gap aligns with contactAngle2
    // gap angle = rotation + (i + 0.5) * pitch = contactAngle2
    // We want to find the rotation that puts any gap at contactAngle2
    // rotation = contactAngle2 - (i + 0.5) * pitch
    // For i=0: rotation = contactAngle2 - 0.5 * pitch
    const targetRotation = contactAngle2 - 0.5 * pitch2;

    // Normalize to nearest valid position
    const currentGapOffset = normalizeAngle(gear2.rotation + 0.5 * pitch2 - contactAngle2);
    const adjustment = -currentGapOffset + Math.round(currentGapOffset / pitch2) * pitch2;

    gear2.rotation = normalizeAngle(gear2.rotation - currentGapOffset);
}

// Get all gears on the same shaft as the given gear (excluding itself)
function getShaftMates(gear) {
    if (!gear.shaftId) return [];
    return state.gears.filter(g => g.shaftId === gear.shaftId && g.id !== gear.id);
}

function updateAllConnections() {
    // Clear all connections
    state.gears.forEach(g => g.meshingWith = []);

    // Check all pairs (skip co-axial gears on same shaft)
    for (let i = 0; i < state.gears.length; i++) {
        for (let j = i + 1; j < state.gears.length; j++) {
            // Co-axial gears don't mesh via teeth
            if (state.gears[i].shaftId && state.gears[i].shaftId === state.gears[j].shaftId) {
                continue;
            }
            if (checkMeshing(state.gears[i], state.gears[j])) {
                state.gears[i].meshingWith.push(state.gears[j].id);
                state.gears[j].meshingWith.push(state.gears[i].id);
            }
        }
    }

    // Calculate phase relationships and propagate rotation
    if (state.driverGearId) {
        calculatePhaseOffsets();
        propagateRotation();
    }

    updateUI();
}

// Calculate phase offsets for all gears relative to the driver
// This establishes the tooth-gap alignment for proper meshing
function calculatePhaseOffsets() {
    const driver = state.gears.find(g => g.id === state.driverGearId);
    if (!driver) return;

    // Driver has no phase offset
    driver.phaseOffset = 0;

    // BFS to calculate phase offsets through the gear train
    const visited = new Set([driver.id]);
    const queue = [driver];

    while (queue.length > 0) {
        const current = queue.shift();

        // Traverse meshing connections (external teeth contact)
        for (const connectedId of current.meshingWith) {
            if (!visited.has(connectedId)) {
                const connected = state.gears.find(g => g.id === connectedId);
                if (connected) {
                    connected.phaseOffset = calculateMeshPhaseOffset(current, connected);
                    visited.add(connectedId);
                    queue.push(connected);
                }
            }
        }

        // Traverse shaft connections (co-axial, same rotation)
        for (const mate of getShaftMates(current)) {
            if (!visited.has(mate.id)) {
                mate.phaseOffset = current.phaseOffset;
                visited.add(mate.id);
                queue.push(mate);
            }
        }
    }
}

// Calculate the phase offset for gear2 to properly mesh with gear1
// This ensures teeth interlock: gear1's tooth meets gear2's gap at contact point
function calculateMeshPhaseOffset(gear1, gear2) {
    // Contact angle: direction from gear1 center to gear2 center
    const contactAngle = Math.atan2(gear2.y - gear1.y, gear2.x - gear1.x);

    // Angular pitch of each gear
    const pitch1 = getAngularPitch(gear1);
    const pitch2 = getAngularPitch(gear2);

    // Gear ratio
    const ratio = gear1.teethCount / gear2.teethCount;

    // For proper meshing:
    // - At the contact point, gear1 has a tooth pointing toward gear2
    // - Gear2 should have a gap (valley) at that same contact point
    //
    // Gear1's teeth are at angles: gear1.rotation + i * pitch1
    // Gear2's gaps (valleys) are at angles: gear2.rotation + (i + 0.5) * pitch2
    //
    // From gear2's perspective, the contact point is at angle (contactAngle + PI)
    // We need gear2's gap to be at this angle
    //
    // The phase offset accounts for:
    // 1. The contact angle from gear2's perspective
    // 2. The gear ratio relationship
    // 3. Half-pitch offset for gap alignment

    const contactAngle2 = contactAngle + Math.PI; // Contact from gear2's view

    // Phase offset so gear2's gap aligns with contact point
    // accounting for the inverse rotation relationship
    const offset = contactAngle2 - pitch2 / 2 + (contactAngle * ratio);

    return normalizeAngle(offset);
}

function propagateRotation() {
    // Reset lock state
    systemLocked = false;
    lockedGears.clear();

    // Reset all speeds except driver
    state.gears.forEach(g => {
        if (g.id !== state.driverGearId) {
            g.rotationSpeed = 0;
        }
    });

    const driver = state.gears.find(g => g.id === state.driverGearId);
    if (!driver) return;

    // Apply direction and speed multiplier
    if (state.settings.motor && state.settings.motor.enabled) {
        driver.rotationSpeed = (state.settings.motor.rpmInput / 60) * state.settings.spinDirection * state.settings.spinSpeed;
    } else {
        driver.rotationSpeed = state.settings.spinSpeed * state.settings.spinDirection * BASE_ROTATION_SPEED;
    }

    // BFS propagation with proper gear ratios AND conflict detection
    const visited = new Set([driver.id]);
    const gearSpeeds = new Map(); // Track expected speeds for conflict detection
    gearSpeeds.set(driver.id, driver.rotationSpeed);
    const queue = [driver];

    while (queue.length > 0) {
        const current = queue.shift();

        // Traverse meshing connections (external teeth, opposite direction, ratio applied)
        for (const connectedId of current.meshingWith) {
            const connected = state.gears.find(g => g.id === connectedId);
            if (!connected) continue;

            const ratio = current.teethCount / connected.teethCount;
            const expectedSpeed = -current.rotationSpeed * ratio;

            if (visited.has(connectedId)) {
                const existingSpeed = gearSpeeds.get(connectedId);
                const speedDiff = Math.abs(existingSpeed - expectedSpeed);
                const tolerance = Math.abs(existingSpeed) * 0.01 + 0.0001;

                if (speedDiff > tolerance) {
                    systemLocked = true;
                    lockedGears.add(current.id);
                    lockedGears.add(connectedId);
                }
            } else {
                connected.rotationSpeed = expectedSpeed;
                gearSpeeds.set(connectedId, expectedSpeed);
                visited.add(connectedId);
                queue.push(connected);
            }
        }

        // Traverse shaft connections (co-axial, same direction, same speed)
        for (const mate of getShaftMates(current)) {
            const expectedSpeed = current.rotationSpeed;

            if (visited.has(mate.id)) {
                const existingSpeed = gearSpeeds.get(mate.id);
                const speedDiff = Math.abs(existingSpeed - expectedSpeed);
                const tolerance = Math.abs(existingSpeed) * 0.01 + 0.0001;

                if (speedDiff > tolerance) {
                    systemLocked = true;
                    lockedGears.add(current.id);
                    lockedGears.add(mate.id);
                }
            } else {
                mate.rotationSpeed = expectedSpeed;
                gearSpeeds.set(mate.id, expectedSpeed);
                visited.add(mate.id);
                queue.push(mate);
            }
        }
    }

    // If system is locked, stop all rotation
    if (systemLocked) {
        state.gears.forEach(g => {
            g.rotationSpeed = 0;
        });
    }
}

// Calculate system load based on connected gears
// Returns a multiplier between 0 and 1 (1 = no load, lower = more load)
function calculateSystemLoad() {
    // If system is locked due to kinematic conflict, return max load
    if (systemLocked) {
        return { multiplier: 0, percentage: 100, locked: true };
    }

    const driver = state.gears.find(g => g.id === state.driverGearId);
    if (!driver) return { multiplier: 1, percentage: 0, locked: false };

    // Find all gears connected to driver (via meshing and shafts)
    const connectedGears = [];
    const visited = new Set([driver.id]);
    const queue = [driver];

    while (queue.length > 0) {
        const current = queue.shift();
        connectedGears.push(current);

        // Meshing connections
        for (const connectedId of current.meshingWith) {
            if (!visited.has(connectedId)) {
                const connected = state.gears.find(g => g.id === connectedId);
                if (connected) {
                    visited.add(connectedId);
                    queue.push(connected);
                }
            }
        }

        // Shaft connections
        for (const mate of getShaftMates(current)) {
            if (!visited.has(mate.id)) {
                visited.add(mate.id);
                queue.push(mate);
            }
        }
    }

    // Calculate total load from connected gears (excluding driver)
    // Load is based on gear radius (bigger gears = more resistance)
    let totalLoad = 0;
    for (const gear of connectedGears) {
        if (gear.id !== driver.id) {
            // Load contribution: larger gears add more load
            // Also factor in the gear ratio - gears spinning faster add more load
            totalLoad += gear.radius * 0.5;
        }
    }

    // Add load from outputs (they add extra resistance)
    state.outputs.forEach(output => {
        if (output.attachedToGear && visited.has(output.attachedToGear)) {
            if (output.type === 'crane' && output.payload) {
                totalLoad += output.payload.weightKg * 10;
            } else if (output.type === 'generator') {
                totalLoad += 15;
            } else {
                totalLoad += 20;
            }
        }
    });

    // Convert load to a speed multiplier
    // Formula: multiplier = driverPower / (driverPower + totalLoad)
    // This gives diminishing returns as load increases
    const driverPower = driver.radius * 2; // Driver's "power" based on its size
    const multiplier = driverPower / (driverPower + totalLoad);

    // Calculate load percentage for display (0% = no extra load, 100% = max load)
    const loadPercentage = Math.min(100, (totalLoad / driverPower) * 50);

    return { multiplier, percentage: loadPercentage, locked: false };
}

// Synchronize all gear rotations based on driver rotation
// This ensures teeth stay properly interlocked using gear ratios and phase offsets
function synchronizeGearRotations(driver) {
    const visited = new Set([driver.id]);
    const queue = [{ gear: driver, speedMultiplier: 1 }];

    while (queue.length > 0) {
        const { gear: current, speedMultiplier } = queue.shift();

        // Traverse meshing connections (external teeth contact)
        for (const connectedId of current.meshingWith) {
            if (!visited.has(connectedId)) {
                const connected = state.gears.find(g => g.id === connectedId);
                if (connected) {
                    const ratio = current.teethCount / connected.teethCount;
                    connected.rotation = -(current.rotation * ratio) + connected.phaseOffset;

                    const newSpeedMultiplier = -speedMultiplier * ratio;
                    connected.rotationSpeed = driver.rotationSpeed * newSpeedMultiplier;

                    visited.add(connectedId);
                    queue.push({ gear: connected, speedMultiplier: newSpeedMultiplier });
                }
            }
        }

        // Traverse shaft connections (co-axial, same rotation and speed)
        for (const mate of getShaftMates(current)) {
            if (!visited.has(mate.id)) {
                mate.rotation = current.rotation;
                mate.rotationSpeed = current.rotationSpeed;

                visited.add(mate.id);
                queue.push({ gear: mate, speedMultiplier: speedMultiplier });
            }
        }
    }
}

// Propagate rotation manually (when dragging driver gear)
function propagateManualRotation(driver) {
    // Use the same synchronized rotation logic as auto-play
    synchronizeGearRotations(driver);

    // Update outputs
    state.outputs.forEach(output => {
        if (output.attachedToGear) {
            const gear = state.gears.find(g => g.id === output.attachedToGear);
            if (gear) {
                output.rotation = gear.rotation;
            }
        }
    });
}

// Calculate total gear ratio from driver to a target gear via BFS
function calculateTotalRatio(driverGear, targetGear) {
    if (!driverGear || !targetGear) return 1;
    if (driverGear.id === targetGear.id) return 1;

    var visited = new Set([driverGear.id]);
    var queue = [{ gear: driverGear, ratio: 1 }];

    while (queue.length > 0) {
        var current = queue.shift();

        // Traverse meshing connections (ratio applied, direction reversal)
        for (var i = 0; i < current.gear.meshingWith.length; i++) {
            var connectedId = current.gear.meshingWith[i];
            if (visited.has(connectedId)) continue;

            var connected = state.gears.find(function(g) { return g.id === connectedId; });
            if (!connected) continue;

            var stepRatio = current.gear.teethCount / connected.teethCount;
            var totalRatio = current.ratio * stepRatio;

            if (connected.id === targetGear.id) {
                return Math.abs(totalRatio);
            }

            visited.add(connectedId);
            queue.push({ gear: connected, ratio: -totalRatio });
        }

        // Traverse shaft connections (ratio 1, no direction change)
        var mates = getShaftMates(current.gear);
        for (var j = 0; j < mates.length; j++) {
            if (visited.has(mates[j].id)) continue;

            if (mates[j].id === targetGear.id) {
                return Math.abs(current.ratio);
            }

            visited.add(mates[j].id);
            queue.push({ gear: mates[j], ratio: current.ratio });
        }
    }

    return 1; // Not connected
}

// Calculate motor output metrics using motor RPM/torque and gear ratio
function calculateMotorOutput() {
    var motor = state.settings.motor;
    if (!motor || !motor.enabled) return null;

    var driver = state.gears.find(function(g) { return g.id === state.driverGearId; });
    if (!driver) return null;

    var outputGear = state.outputShaftGearId
        ? state.gears.find(function(g) { return g.id === state.outputShaftGearId; })
        : null;

    var gearRatio = outputGear ? calculateTotalRatio(driver, outputGear) : 1;

    // gearRatio from calculateTotalRatio = driver_teeth / output_teeth
    // e.g. 8-tooth driver, 48-tooth output => gearRatio = 1/6
    // Output spins slower by that factor, torque increases by the inverse
    var inputRpm = motor.rpmInput;
    var inputTorque = motor.torqueNm;
    var outputRpm = inputRpm * gearRatio;
    var outputTorque = inputTorque / gearRatio;
    var power = inputTorque * (inputRpm * Math.PI * 2 / 60); // P = T * omega

    return {
        inputRpm: inputRpm,
        inputTorque: inputTorque,
        gearRatio: gearRatio,
        outputRpm: outputRpm,
        outputTorque: outputTorque,
        power: power
    };
}
