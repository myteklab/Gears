// ============================================
// Gears Application - UI Functions
// ============================================

// ============================================
// Control Event Setup
// ============================================
function setupControlEvents() {
    // Speed slider - minimal work during drag
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');

    speedSlider.addEventListener('input', e => {
        const val = +e.target.value;
        state.settings.spinSpeed = val;
        speedValue.textContent = (val % 1 ? val.toFixed(1) : val) + 'x';
    });

    speedSlider.addEventListener('change', () => {
        window.isDirty = true;
    });

    // Teeth slider
    document.getElementById('teethSlider').addEventListener('input', e => {
        const teeth = parseInt(e.target.value);
        document.getElementById('teethValue').textContent = teeth;
        if (state.selectedGearId) {
            updateGearTeeth(state.selectedGearId, teeth);
        }
    });

    // Color picker
    document.getElementById('colorPicker').addEventListener('input', e => {
        if (state.selectedGearId) {
            updateGearColor(state.selectedGearId, e.target.value);
        }
    });

    // Image URL input - load image on Enter or blur
    const imageUrlInput = document.getElementById('imageUrlInput');
    imageUrlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setAttachedImage(imageUrlInput.value.trim());
        }
    });
    imageUrlInput.addEventListener('blur', () => {
        const url = imageUrlInput.value.trim();
        if (url && state.selectedGearId) {
            const gear = state.gears.find(g => g.id === state.selectedGearId);
            if (gear && (!gear.attachedImage || gear.attachedImage.url !== url)) {
                setAttachedImage(url);
            }
        }
    });

    // Image offset and scale sliders
    document.getElementById('imageOffsetX').addEventListener('input', e => {
        updateAttachedImageProperty('offsetX', parseInt(e.target.value));
    });
    document.getElementById('imageOffsetY').addEventListener('input', e => {
        updateAttachedImageProperty('offsetY', parseInt(e.target.value));
    });
    document.getElementById('imageScale').addEventListener('input', e => {
        const scale = parseFloat(e.target.value);
        document.getElementById('imageScaleValue').textContent = scale.toFixed(1);
        updateAttachedImageProperty('scale', scale);
    });
}

// ============================================
// UI Update Functions
// ============================================
function updateUI() {
    // Update gear count
    document.getElementById('gearCount').textContent = state.gears.length;

    // Update selected gear panel
    const selectedPanel = document.getElementById('selectedGearPanel');
    const noSelectionPanel = document.getElementById('noSelectionPanel');

    if (state.selectedGearId) {
        const gear = state.gears.find(g => g.id === state.selectedGearId);
        if (gear) {
            selectedPanel.style.display = 'block';
            noSelectionPanel.style.display = 'none';

            document.getElementById('teethSlider').value = gear.teethCount;
            document.getElementById('teethValue').textContent = gear.teethCount;
            document.getElementById('colorPicker').value = gear.color;

            // Calculate and display RPM
            const rpm = Math.abs(gear.rotationSpeed * 60).toFixed(1);
            document.getElementById('rpmValue').textContent = rpm;

            // Update driver button
            const driverBtn = document.getElementById('driverBtn');
            if (gear.id === state.driverGearId) {
                driverBtn.textContent = 'Driver Gear';
                driverBtn.classList.add('active');
            } else {
                driverBtn.textContent = 'Make Driver Gear';
                driverBtn.classList.remove('active');
            }

            // Update gear ratio
            if (state.driverGearId && gear.id !== state.driverGearId) {
                const driver = state.gears.find(g => g.id === state.driverGearId);
                if (driver) {
                    const ratio = (driver.teethCount / gear.teethCount).toFixed(2);
                    document.getElementById('gearRatio').textContent = '1:' + ratio;
                }
            } else {
                document.getElementById('gearRatio').textContent = '-';
            }

            // Update attached image controls
            const imageControls = document.getElementById('imageControls');
            const imageUrlInput = document.getElementById('imageUrlInput');
            if (gear.attachedImage) {
                imageUrlInput.value = gear.attachedImage.url || '';
                imageControls.style.display = 'block';
                document.getElementById('imageOffsetX').value = gear.attachedImage.offsetX || 0;
                document.getElementById('imageOffsetY').value = gear.attachedImage.offsetY || 0;
                document.getElementById('imageScale').value = gear.attachedImage.scale || 1;
                document.getElementById('imageScaleValue').textContent = (gear.attachedImage.scale || 1).toFixed(1);
            } else {
                imageUrlInput.value = '';
                imageControls.style.display = 'none';
            }
        }
    } else {
        selectedPanel.style.display = 'none';
        noSelectionPanel.style.display = 'block';
        document.getElementById('gearRatio').textContent = '-';
    }

    // Update grid status
    document.getElementById('gridStatus').textContent = state.settings.gridSnap ? 'ON' : 'OFF';
    document.getElementById('gridToggleText').textContent = state.settings.gridSnap ? 'Hide Grid' : 'Show Grid';
}

// ============================================
// Playback Controls
// ============================================
function togglePlay() {
    isPlaying = !isPlaying;

    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const playText = document.getElementById('playText');

    if (isPlaying) {
        playBtn.classList.add('playing');
        playIcon.innerHTML = '&#9632;';
        playText.textContent = 'Stop';

        if (!state.driverGearId && state.gears.length > 0) {
            // Auto-select first gear as driver if none selected
            setDriverGear(state.gears[0].id);
            showToast('First gear set as driver', 'info');
        }
    } else {
        playBtn.classList.remove('playing');
        playIcon.innerHTML = '&#9654;';
        playText.textContent = 'Play';
    }
}

function toggleDirection() {
    state.settings.spinDirection *= -1;

    const directionBtn = document.getElementById('directionBtn');
    if (state.settings.spinDirection === 1) {
        directionBtn.textContent = '↻';
        directionBtn.classList.remove('counterclockwise');
        directionBtn.title = 'Clockwise (click to change)';
    } else {
        directionBtn.textContent = '↺';
        directionBtn.classList.add('counterclockwise');
        directionBtn.title = 'Counter-clockwise (click to change)';
    }

    propagateRotation();
    window.isDirty = true;
    showToast(state.settings.spinDirection === 1 ? 'Clockwise' : 'Counter-clockwise', 'info');
}

function toggleDriver() {
    if (state.selectedGearId) {
        if (state.driverGearId === state.selectedGearId) {
            state.driverGearId = null;
            state.gears.forEach(g => g.rotationSpeed = 0);
        } else {
            setDriverGear(state.selectedGearId);
        }
        updateUI();
        window.isDirty = true;
    }
}

// ============================================
// Gear/Output Actions
// ============================================
function deleteSelectedGear() {
    if (state.selectedGearId) {
        deleteGear(state.selectedGearId);
        updateUI();
        showToast('Gear deleted', 'info');
    }
}

function deleteSelectedOutput() {
    if (state.selectedOutputId) {
        const index = state.outputs.findIndex(o => o.id === state.selectedOutputId);
        if (index !== -1) {
            state.outputs.splice(index, 1);
            state.selectedOutputId = null;
            window.isDirty = true;
            showToast('Output deleted', 'info');
        }
    }
}

// ============================================
// View Controls
// ============================================
function toggleGrid() {
    state.settings.gridSnap = !state.settings.gridSnap;
    updateUI();
    window.isDirty = true;
}

function resetZoom() {
    zoom = 1;
    panX = 0;
    panY = 0;
    document.getElementById('zoomLevel').textContent = '100%';
}

// ============================================
// Settings Modal
// ============================================
function showSettingsModal() {
    // Update slider values to match current settings
    document.getElementById('thicknessSlider').value = state.settings.toothThickness * 100;
    document.getElementById('thicknessValue').textContent = Math.round(state.settings.toothThickness * 100) + '%';
    document.getElementById('depthSlider').value = state.settings.toothDepth;
    document.getElementById('depthValue').textContent = state.settings.toothDepth + 'px';

    document.getElementById('settingsModal').classList.add('visible');
}

function hideSettingsModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('settingsModal').classList.remove('visible');
}

function updateThicknessSetting(value) {
    state.settings.toothThickness = value / 100;
    document.getElementById('thicknessValue').textContent = value + '%';
    window.isDirty = true;
}

function updateDepthSetting(value) {
    state.settings.toothDepth = parseInt(value);
    document.getElementById('depthValue').textContent = value + 'px';
    window.isDirty = true;
}

// ============================================
// Help Modal
// ============================================
function showHelpModal(topic) {
    const content = helpContent[topic];
    if (!content) return;

    document.getElementById('helpModalTitle').textContent = content.title;
    document.getElementById('helpModalContent').innerHTML = content.content;
    document.getElementById('helpModal').classList.add('visible');
}

function hideHelpModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('helpModal').classList.remove('visible');
}
