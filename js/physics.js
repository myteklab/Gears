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

function updateAllConnections() {
    // Clear all connections
    state.gears.forEach(g => g.meshingWith = []);

    // Check all pairs
    for (let i = 0; i < state.gears.length; i++) {
        for (let j = i + 1; j < state.gears.length; j++) {
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

        for (const connectedId of current.meshingWith) {
            if (!visited.has(connectedId)) {
                const connected = state.gears.find(g => g.id === connectedId);
                if (connected) {
                    // Calculate phase offset for proper meshing
                    connected.phaseOffset = calculateMeshPhaseOffset(current, connected);
                    visited.add(connectedId);
                    queue.push(connected);
                }
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

    // Apply direction to spin speed with base speed multiplier
    driver.rotationSpeed = state.settings.spinSpeed * state.settings.spinDirection * BASE_ROTATION_SPEED;

    // BFS propagation with proper gear ratios AND conflict detection
    const visited = new Set([driver.id]);
    const gearSpeeds = new Map(); // Track expected speeds for conflict detection
    gearSpeeds.set(driver.id, driver.rotationSpeed);
    const queue = [driver];

    while (queue.length > 0) {
        const current = queue.shift();

        for (const connectedId of current.meshingWith) {
            const connected = state.gears.find(g => g.id === connectedId);
            if (!connected) continue;

            // Calculate what this gear's speed SHOULD be from this connection
            const ratio = current.teethCount / connected.teethCount;
            const expectedSpeed = -current.rotationSpeed * ratio;

            if (visited.has(connectedId)) {
                // Already visited - check for kinematic conflict
                const existingSpeed = gearSpeeds.get(connectedId);

                // Allow small tolerance for floating point errors
                const speedDiff = Math.abs(existingSpeed - expectedSpeed);
                const tolerance = Math.abs(existingSpeed) * 0.01 + 0.0001;

                if (speedDiff > tolerance) {
                    // CONFLICT DETECTED - gears would need to spin in incompatible ways
                    systemLocked = true;
                    lockedGears.add(current.id);
                    lockedGears.add(connectedId);
                }
            } else {
                // Not visited yet - set speed and continue propagation
                connected.rotationSpeed = expectedSpeed;
                gearSpeeds.set(connectedId, expectedSpeed);
                visited.add(connectedId);
                queue.push(connected);
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

    // Find all gears connected to driver
    const connectedGears = [];
    const visited = new Set([driver.id]);
    const queue = [driver];

    while (queue.length > 0) {
        const current = queue.shift();
        connectedGears.push(current);

        for (const connectedId of current.meshingWith) {
            if (!visited.has(connectedId)) {
                const connected = state.gears.find(g => g.id === connectedId);
                if (connected) {
                    visited.add(connectedId);
                    queue.push(connected);
                }
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
            totalLoad += 20; // Each output adds fixed load
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

        for (const connectedId of current.meshingWith) {
            if (!visited.has(connectedId)) {
                const connected = state.gears.find(g => g.id === connectedId);
                if (connected) {
                    // Gear ratio: how much faster/slower connected spins relative to current
                    const ratio = current.teethCount / connected.teethCount;

                    // Calculate connected gear's rotation:
                    // - Opposite direction (negative)
                    // - Scaled by ratio
                    // - Plus phase offset to align teeth with gaps
                    connected.rotation = -(current.rotation * ratio) + connected.phaseOffset;

                    // Calculate rotation speed for RPM display
                    // Speed multiplier tracks cumulative ratio from driver
                    const newSpeedMultiplier = -speedMultiplier * ratio;
                    connected.rotationSpeed = driver.rotationSpeed * newSpeedMultiplier;

                    visited.add(connectedId);
                    queue.push({
                        gear: connected,
                        speedMultiplier: newSpeedMultiplier
                    });
                }
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
