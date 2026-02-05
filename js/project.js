// ============================================
// Gears Application - Project Management
// ============================================

// ============================================
// Project Serialization
// ============================================
function serializeProject() {
    return {
        version: '1.0',
        settings: state.settings,
        gears: state.gears.map(g => ({
            id: g.id,
            x: g.x,
            y: g.y,
            teethCount: g.teethCount,
            color: g.color,
            rotation: g.rotation,
            phaseOffset: g.phaseOffset,
            // Save attached image data (without imageObj - that gets reloaded)
            attachedImage: g.attachedImage ? {
                url: g.attachedImage.url,
                offsetX: g.attachedImage.offsetX,
                offsetY: g.attachedImage.offsetY,
                scale: g.attachedImage.scale
            } : null
        })),
        outputs: state.outputs.map(o => ({
            id: o.id,
            type: o.type,
            x: o.x,
            y: o.y,
            attachedToGear: o.attachedToGear,
            color: o.color
        })),
        driverGearId: state.driverGearId
    };
}

// ============================================
// Project Loading
// ============================================
function loadProjectData(data) {
    if (!data) return;

    if (data.settings) {
        Object.assign(state.settings, data.settings);
    }
    if (data.gears) {
        // Restore gears and recalculate derived properties
        state.gears = data.gears.map(g => ({
            ...g,
            radius: calculateRadius(g.teethCount),
            rotationSpeed: 0,
            meshingWith: [],
            phaseOffset: g.phaseOffset || 0,
            attachedImage: g.attachedImage || null
        }));

        // Reload attached images
        state.gears.forEach(gear => {
            if (gear.attachedImage && gear.attachedImage.url) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    gear.attachedImage.imageObj = img;
                };
                img.src = gear.attachedImage.url;
            }
        });
    }
    if (data.outputs) {
        state.outputs = data.outputs;
    }
    if (data.driverGearId) {
        state.driverGearId = data.driverGearId;
    }

    // Update all gear connections and recalculate phase offsets
    updateAllConnections();

    // Sync UI controls with loaded settings
    syncSettingsUI();
}

// ============================================
// Save Functions (Platform-managed)
// ============================================
function saveProject() {
    // Platform handles actual save - just trigger the event
    if (typeof Platform !== 'undefined' && Platform.requestSave) {
        Platform.requestSave();
    } else {
        // Fallback for standalone testing
        showToast('Save handled by platform', 'info');
    }
}

// ============================================
// Screenshot Generation
// ============================================
function saveScreenshot() {
    if (!canvas) return null;

    // Create a temporary canvas for the screenshot
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    // Set screenshot size (smaller for preview)
    const screenshotWidth = 400;
    const screenshotHeight = 300;
    tempCanvas.width = screenshotWidth;
    tempCanvas.height = screenshotHeight;

    // Fill background
    tempCtx.fillStyle = state.settings.backgroundColor;
    tempCtx.fillRect(0, 0, screenshotWidth, screenshotHeight);

    // Calculate bounds of all gears to center them
    if (state.gears.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    const toothDepth = state.settings.toothDepth;

    state.gears.forEach(gear => {
        const r = gear.radius + toothDepth + 5;
        minX = Math.min(minX, gear.x - r);
        maxX = Math.max(maxX, gear.x + r);
        minY = Math.min(minY, gear.y - r);
        maxY = Math.max(maxY, gear.y + r);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate scale to fit with padding
    const padding = 20;
    const scaleX = (screenshotWidth - padding * 2) / contentWidth;
    const scaleY = (screenshotHeight - padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 2);

    // Draw gears centered
    tempCtx.save();
    tempCtx.translate(screenshotWidth / 2, screenshotHeight / 2);
    tempCtx.scale(scale, scale);
    tempCtx.translate(-centerX, -centerY);

    // Draw each gear (simplified version)
    state.gears.forEach(gear => {
        drawGearToContext(tempCtx, gear);
    });

    tempCtx.restore();

    // Return the data URL
    return tempCanvas.toDataURL('image/png');
}

// ============================================
// Export Functions
// ============================================
function exportImage() {
    const link = document.createElement('a');
    link.download = 'gears-project.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Image exported!', 'success');
}

// ============================================
// Project Actions
// ============================================
function newProject() {
    if (window.isDirty) {
        if (!confirm('You have unsaved changes. Start a new project anyway?')) {
            return;
        }
    }
    window.location.href = '?';
}

function clearAll() {
    if (state.gears.length === 0) return;

    if (confirm('Clear all gears? This cannot be undone.')) {
        state.gears = [];
        state.outputs = [];
        state.driverGearId = null;
        state.selectedGearId = null;
        updateUI();
        window.isDirty = true;
        showToast('All gears cleared', 'info');
    }
}

function resetRotations() {
    state.gears.forEach(g => g.rotation = 0);
    state.outputs.forEach(o => o.rotation = 0);
    showToast('Rotations reset', 'info');
}

// ============================================
// Platform Integration Exports
// ============================================
window.serializeProjectData = serializeProject;
window.loadProjectData = loadProjectData;
window.markDirty = function() { window.isDirty = true; };
window.markClean = function() { window.isDirty = false; };
window.hasUnsavedChanges = function() { return window.isDirty; };
