// ============================================
// Gears Application - Gear CRUD Operations
// ============================================

// ============================================
// Gear Functions
// ============================================
function createGear(x, y, teethCount, color) {
    const gear = {
        id: 'gear_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        x: x,
        y: y,
        teethCount: teethCount,
        radius: calculateRadius(teethCount),
        color: color || GEAR_COLORS[Math.floor(Math.random() * GEAR_COLORS.length)],
        rotation: 0,
        rotationSpeed: 0,
        meshingWith: [],
        // Phase offset relative to parent gear in the chain (for proper tooth interlocking)
        phaseOffset: 0,
        // Co-axial shaft: gears sharing a shaftId rotate together at the same speed
        shaftId: null,
        // Attached image (optional) - rotates with gear
        attachedImage: null // { url, offsetX, offsetY, scale, imageObj }
    };

    state.gears.push(gear);
    window.isDirty = true;
    updateAllConnections();
    return gear;
}

// Create a compound gear on the same shaft as an existing gear
function createCompoundGear(existingGearId, teethCount, color) {
    const existing = state.gears.find(g => g.id === existingGearId);
    if (!existing) return null;

    // Generate a shared shaft ID if the existing gear doesn't have one
    if (!existing.shaftId) {
        existing.shaftId = 'shaft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    const gear = createGear(existing.x, existing.y, teethCount, color);
    gear.shaftId = existing.shaftId;
    gear.rotation = existing.rotation; // same angular position

    return gear;
}

function calculateRadius(teethCount) {
    const moduleSize = 5;
    return teethCount * moduleSize / 2;
}

function deleteGear(gearId) {
    const index = state.gears.findIndex(g => g.id === gearId);
    if (index !== -1) {
        const gear = state.gears[index];

        // If this gear was on a shaft, clean up the shaft
        if (gear.shaftId) {
            const shaftMates = state.gears.filter(g => g.shaftId === gear.shaftId && g.id !== gearId);
            if (shaftMates.length === 1) {
                // Only one gear left on shaft, clear its shaftId
                shaftMates[0].shaftId = null;
            }
        }

        state.gears.splice(index, 1);

        // Remove any outputs attached to this gear
        state.outputs = state.outputs.filter(o => o.attachedToGear !== gearId);

        // Clear driver if this was the driver
        if (state.driverGearId === gearId) {
            state.driverGearId = null;
        }

        // Clear selection
        if (state.selectedGearId === gearId) {
            state.selectedGearId = null;
        }

        updateAllConnections();
        window.isDirty = true;
    }
}

function updateGearTeeth(gearId, newTeethCount) {
    const gear = state.gears.find(g => g.id === gearId);
    if (gear) {
        gear.teethCount = newTeethCount;
        gear.radius = calculateRadius(newTeethCount);
        updateAllConnections();
        window.isDirty = true;
    }
}

function updateGearColor(gearId, color) {
    const gear = state.gears.find(g => g.id === gearId);
    if (gear) {
        gear.color = color;
        window.isDirty = true;
    }
}

// ============================================
// Attached Image Functions
// ============================================
function setAttachedImage(url) {
    if (!state.selectedGearId || !url) return;

    const gear = state.gears.find(g => g.id === state.selectedGearId);
    if (!gear) return;

    // Create image object and load it
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        gear.attachedImage = {
            url: url,
            offsetX: 0,
            offsetY: 0,
            scale: 1,
            imageObj: img
        };
        window.isDirty = true;
        updateUI();
        showToast('Image attached!', 'success');
    };
    img.onerror = function() {
        showToast('Failed to load image', 'error');
    };
    img.src = url;
}

function updateAttachedImageProperty(property, value) {
    if (!state.selectedGearId) return;

    const gear = state.gears.find(g => g.id === state.selectedGearId);
    if (gear && gear.attachedImage) {
        gear.attachedImage[property] = value;
        window.isDirty = true;
    }
}

function removeAttachedImage() {
    if (!state.selectedGearId) return;

    const gear = state.gears.find(g => g.id === state.selectedGearId);
    if (gear) {
        gear.attachedImage = null;
        window.isDirty = true;
        updateUI();
        showToast('Image removed', 'info');
    }
}

function setDriverGear(gearId) {
    state.driverGearId = gearId;

    // Reset all rotation speeds
    state.gears.forEach(g => g.rotationSpeed = 0);

    // Set driver gear speed (use same formula as update() and propagateRotation())
    const driver = state.gears.find(g => g.id === gearId);
    if (driver) {
        driver.rotationSpeed = state.settings.spinSpeed * state.settings.spinDirection * BASE_ROTATION_SPEED;
        propagateRotation();
    }

    window.isDirty = true;
}
