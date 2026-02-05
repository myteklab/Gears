// ============================================
// Gears Application - Input Handling
// ============================================

// ============================================
// Event Setup
// ============================================
function setupCanvasEvents() {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('wheel', onWheel);

    // Prevent context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Drop zone for palette items
    canvas.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    canvas.addEventListener('drop', onCanvasDrop);
}

function setupPaletteEvents() {
    // Gear palette
    document.querySelectorAll('.palette-gear').forEach(el => {
        el.addEventListener('dragstart', e => {
            const teeth = parseInt(el.dataset.teeth);
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'gear', teeth: teeth }));
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    // Output palette
    document.querySelectorAll('.palette-output').forEach(el => {
        el.addEventListener('dragstart', e => {
            const outputType = el.dataset.output;
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'output', outputType: outputType }));
            e.dataTransfer.effectAllowed = 'copy';
        });
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        // Ctrl+S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveProject();
        }

        // Delete key to delete selected gear or output
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement === document.body) {
                if (state.selectedGearId) {
                    e.preventDefault();
                    deleteSelectedGear();
                } else if (state.selectedOutputId) {
                    e.preventDefault();
                    deleteSelectedOutput();
                }
            }
        }

        // Space to toggle play
        if (e.key === ' ' && document.activeElement === document.body) {
            e.preventDefault();
            togglePlay();
        }

        // Escape to deselect
        if (e.key === 'Escape') {
            state.selectedGearId = null;
            state.selectedOutputId = null;
            updateUI();
        }
    });
}

// ============================================
// Mouse Event Handlers
// ============================================
function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - panX) / zoom;
    const mouseY = (e.clientY - rect.top - panY) / zoom;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    // Check for output hit first (they render on top)
    const hitOutput = hitTestOutput(mouseX, mouseY);
    // Check for gear hit
    const hitGear = hitTestGear(mouseX, mouseY);

    if (e.button === 0) { // Left click
        if (hitOutput) {
            // Clicked on an output - select and start dragging
            state.selectedOutputId = hitOutput.id;
            state.selectedGearId = null;
            updateUI();

            isDragging = true;
            dragTarget = { type: 'output', item: hitOutput };
            dragOffsetX = mouseX - hitOutput.x;
            dragOffsetY = mouseY - hitOutput.y;
            canvas.style.cursor = 'grabbing';
        } else if (hitGear) {
            state.selectedGearId = hitGear.id;
            state.selectedOutputId = null;
            updateUI();

            // Check if clicking on driver gear for manual spin
            if (hitGear.id === state.driverGearId && !isPlaying) {
                isSpinning = true;
                spinStartAngle = Math.atan2(mouseY - hitGear.y, mouseX - hitGear.x);
                canvas.style.cursor = 'grabbing';
            } else {
                // Start dragging
                isDragging = true;
                dragTarget = { type: 'gear', item: hitGear };
                dragOffsetX = mouseX - hitGear.x;
                dragOffsetY = mouseY - hitGear.y;
                canvas.style.cursor = 'grabbing';
            }
        } else {
            state.selectedGearId = null;
            state.selectedOutputId = null;
            updateUI();
        }
    } else if (e.button === 1) { // Middle click - pan
        isDragging = true;
        dragTarget = { type: 'pan' };
        canvas.style.cursor = 'move';
    }
}

function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - panX) / zoom;
    const mouseY = (e.clientY - rect.top - panY) / zoom;

    if (isSpinning && state.driverGearId) {
        const driver = state.gears.find(g => g.id === state.driverGearId);
        if (driver) {
            const currentAngle = Math.atan2(mouseY - driver.y, mouseX - driver.x);
            let deltaAngle = currentAngle - spinStartAngle;

            // Apply rotation
            driver.rotation += deltaAngle;
            spinStartAngle = currentAngle;

            // Propagate to connected gears (manual mode)
            propagateManualRotation(driver);
        }
    } else if (isDragging && dragTarget) {
        if (dragTarget.type === 'gear') {
            let newX = mouseX - dragOffsetX;
            let newY = mouseY - dragOffsetY;

            // Grid snap
            if (state.settings.gridSnap) {
                newX = Math.round(newX / state.settings.gridSize) * state.settings.gridSize;
                newY = Math.round(newY / state.settings.gridSize) * state.settings.gridSize;
            }

            dragTarget.item.x = newX;
            dragTarget.item.y = newY;

            // Check for snap-to-mesh
            for (const other of state.gears) {
                if (other.id !== dragTarget.item.id && canMesh(dragTarget.item, other)) {
                    snapToMesh(dragTarget.item, other);
                    break;
                }
            }
        } else if (dragTarget.type === 'output') {
            // Drag output - temporarily detach from gear
            let newX = mouseX - dragOffsetX;
            let newY = mouseY - dragOffsetY;

            // Grid snap for outputs too
            if (state.settings.gridSnap) {
                newX = Math.round(newX / state.settings.gridSize) * state.settings.gridSize;
                newY = Math.round(newY / state.settings.gridSize) * state.settings.gridSize;
            }

            dragTarget.item.x = newX;
            dragTarget.item.y = newY;
            dragTarget.item.attachedToGear = null; // Detach while dragging
        } else if (dragTarget.type === 'pan') {
            panX += e.clientX - lastMouseX;
            panY += e.clientY - lastMouseY;
        }
    } else {
        // Update cursor based on what's under mouse
        const hitOutput = hitTestOutput(mouseX, mouseY);
        const hitGear = hitTestGear(mouseX, mouseY);
        if (hitOutput) {
            canvas.style.cursor = 'move';
        } else if (hitGear) {
            canvas.style.cursor = hitGear.id === state.driverGearId ? 'grab' : 'move';
        } else {
            canvas.style.cursor = 'default';
        }
    }

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
}

function onMouseUp(e) {
    if (isDragging && dragTarget) {
        if (dragTarget.type === 'gear') {
            updateAllConnections();
            window.isDirty = true;
        } else if (dragTarget.type === 'output') {
            // Try to attach output to nearest gear
            const output = dragTarget.item;
            let nearestGear = null;
            let nearestDist = Infinity;

            for (const gear of state.gears) {
                const dist = Math.hypot(output.x - gear.x, output.y - gear.y);
                if (dist < gear.radius + 30 && dist < nearestDist) {
                    nearestDist = dist;
                    nearestGear = gear;
                }
            }

            if (nearestGear) {
                output.attachedToGear = nearestGear.id;
                output.x = nearestGear.x;
                output.y = nearestGear.y;
                output.rotation = nearestGear.rotation;
                showToast('Output attached to gear', 'success');
            } else {
                showToast('Drop on a gear to attach', 'info');
            }
            window.isDirty = true;
        }
    }

    isDragging = false;
    isSpinning = false;
    dragTarget = null;
    canvas.style.cursor = 'default';
}

function onWheel(e) {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(4, zoom * zoomFactor));

    // Zoom toward mouse position
    panX = mouseX - (mouseX - panX) * (newZoom / zoom);
    panY = mouseY - (mouseY - panY) * (newZoom / zoom);
    zoom = newZoom;

    document.getElementById('zoomLevel').textContent = Math.round(zoom * 100) + '%';
}

function onCanvasDrop(e) {
    e.preventDefault();

    try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const rect = canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left - panX) / zoom;
        let y = (e.clientY - rect.top - panY) / zoom;

        // Grid snap
        if (state.settings.gridSnap) {
            x = Math.round(x / state.settings.gridSize) * state.settings.gridSize;
            y = Math.round(y / state.settings.gridSize) * state.settings.gridSize;
        }

        if (data.type === 'gear') {
            const gear = createGear(x, y, data.teeth);
            state.selectedGearId = gear.id;
            showToast('Gear added! Drag near another gear to connect.', 'info');
        } else if (data.type === 'output') {
            const output = createOutput(data.outputType, x, y);
            if (!output.attachedToGear) {
                showToast('Drop output on a gear to attach it.', 'info');
            } else {
                showToast('Output attached to gear!', 'success');
            }
        }

        updateUI();
    } catch (err) {
        console.error('Drop error:', err);
    }
}
