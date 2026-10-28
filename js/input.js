// ============================================
// Gears Application - Input Handling
// ============================================

// ============================================
// Event Setup
// ============================================
function setupCanvasEvents() {
    // Pointer events, so a finger on an iPad drives the same handlers as the
    // mouse. Safari sends no mouse events for a finger drag.
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
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
        const data = { type: 'gear', teeth: parseInt(el.dataset.teeth) };
        el.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
            e.dataTransfer.effectAllowed = 'copy';
        });
        touchDragFromPalette(el, data);
    });

    // Output palette
    document.querySelectorAll('.palette-output').forEach(el => {
        const data = { type: 'output', outputType: el.dataset.output };
        el.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
            e.dataTransfer.effectAllowed = 'copy';
        });
        touchDragFromPalette(el, data);
    });
}

// HTML drag and drop does not reliably start from a finger inside the platform
// iframe, so a touch drags a copy of the tile by hand and drops it the same way.
// The tiles are touch-action: pan-y, so an up or down swipe still scrolls the
// panel and only a sideways drag toward the board reaches this.
function touchDragFromPalette(el, data) {
    let start = null, ghost = null;
    const clear = () => { if (ghost) ghost.remove(); ghost = null; start = null; };
    el.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'touch') return;
        start = { x: e.clientX, y: e.clientY };
        el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
        if (!start) return;
        if (!ghost) {
            if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
            ghost = el.cloneNode(true);
            ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:1000;opacity:.85;margin:0;width:' + el.offsetWidth + 'px';
            document.body.appendChild(ghost);
        }
        ghost.style.left = (e.clientX - ghost.offsetWidth / 2) + 'px';
        ghost.style.top = (e.clientY - ghost.offsetHeight / 2) + 'px';
    });
    el.addEventListener('pointerup', e => {
        const dropped = ghost !== null;
        clear();
        if (!dropped) return;
        const r = canvas.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            placeFromPalette(data, e.clientX, e.clientY);
        }
    });
    el.addEventListener('pointercancel', clear);
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

        // Space: hold for pan mode, tap for play toggle
        if (e.key === ' ' && document.activeElement === document.body) {
            e.preventDefault();
            if (!spaceHeld) {
                spaceHeld = true;
                spaceDragged = false;
                canvas.style.cursor = 'grab';
            }
        }

        // Escape to deselect
        if (e.key === 'Escape') {
            state.selectedGearId = null;
            state.selectedOutputId = null;
            updateUI();
        }
    });

    document.addEventListener('keyup', e => {
        if (e.key === ' ' && document.activeElement === document.body) {
            e.preventDefault();
            if (!spaceDragged) {
                // Space was tapped without dragging: toggle play
                togglePlay();
            }
            spaceHeld = false;
            spaceDragged = false;
            if (!isDragging) canvas.style.cursor = 'default';
        }
    });
}

// ============================================
// Pointer Event Handlers
// ============================================
// One finger works like the left mouse button. Two fingers pinch to zoom and
// drag to pan, since a touch screen has no wheel, middle button or space bar.
const touches = new Map();
let pinchLast = null;
let pinchUsed = false;   // set until every finger of a pinch is lifted

function readPinch() {
    const rect = canvas.getBoundingClientRect();
    const [a, b] = [...touches.values()];
    return {
        x: (a.x + b.x) / 2 - rect.left,
        y: (a.y + b.y) / 2 - rect.top,
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1
    };
}

function onPointerDown(e) {
    canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 1) pinchUsed = false;
        if (touches.size >= 2) {
            // The first finger may already be carrying a gear; set it down where it is.
            if (touches.size === 2) { onMouseUp(e); pinchLast = readPinch(); pinchUsed = true; }
            return;
        }
    }
    onMouseDown(e);
}

function onPointerMove(e) {
    if (e.pointerType === 'touch') {
        if (!touches.has(e.pointerId)) return;
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinchUsed) {
            if (touches.size !== 2 || !pinchLast) return;
            const p = readPinch();
            zoomAt(p.x, p.y, p.d / pinchLast.d);
            panX += p.x - pinchLast.x;
            panY += p.y - pinchLast.y;
            pinchLast = p;
            return;
        }
    }
    onMouseMove(e);
}

function onPointerUp(e) {
    if (e.pointerType === 'touch') {
        touches.delete(e.pointerId);
        if (pinchUsed) { if (touches.size !== 2) pinchLast = null; return; }
    }
    onMouseUp(e);
}

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
        // Space+click = pan (for trackpad users)
        if (spaceHeld) {
            isDragging = true;
            dragTarget = { type: 'pan' };
            canvas.style.cursor = 'grabbing';
            return;
        }
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
            // Click-cycle through compound gears on the same shaft
            var selectedGear = hitGear;
            if (hitGear.shaftId && state.selectedGearId) {
                var currentSelected = state.gears.find(g => g.id === state.selectedGearId);
                if (currentSelected && currentSelected.shaftId === hitGear.shaftId) {
                    // Currently selected gear is on the same shaft; cycle to next
                    var shaftGears = state.gears.filter(g => g.shaftId === hitGear.shaftId);
                    var currentIdx = shaftGears.findIndex(g => g.id === state.selectedGearId);
                    selectedGear = shaftGears[(currentIdx + 1) % shaftGears.length];
                }
            }
            state.selectedGearId = selectedGear.id;
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

            // Move shaft-mates together
            if (dragTarget.item.shaftId) {
                state.gears.forEach(g => {
                    if (g.shaftId === dragTarget.item.shaftId && g.id !== dragTarget.item.id) {
                        g.x = newX;
                        g.y = newY;
                    }
                });
            }

            // Check for snap-to-mesh (skip shaft-mates)
            for (const other of state.gears) {
                if (other.id !== dragTarget.item.id &&
                    !(other.shaftId && other.shaftId === dragTarget.item.shaftId) &&
                    canMesh(dragTarget.item, other)) {
                    snapToMesh(dragTarget.item, other);
                    // Also update shaft-mates to the snapped position
                    if (dragTarget.item.shaftId) {
                        state.gears.forEach(g => {
                            if (g.shaftId === dragTarget.item.shaftId && g.id !== dragTarget.item.id) {
                                g.x = dragTarget.item.x;
                                g.y = dragTarget.item.y;
                            }
                        });
                    }
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
            if (spaceHeld) spaceDragged = true;
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

    zoomAt(mouseX, mouseY, e.deltaY > 0 ? 0.9 : 1.1);
}

// sx, sy are canvas pixels; that point stays put while the zoom changes.
function zoomAt(sx, sy, factor) {
    const newZoom = Math.max(0.25, Math.min(4, zoom * factor));
    panX = sx - (sx - panX) * (newZoom / zoom);
    panY = sy - (sy - panY) * (newZoom / zoom);
    zoom = newZoom;

    document.getElementById('zoomLevel').textContent = Math.round(zoom * 100) + '%';
}

function onCanvasDrop(e) {
    e.preventDefault();

    try {
        placeFromPalette(JSON.parse(e.dataTransfer.getData('text/plain')), e.clientX, e.clientY);
    } catch (err) {
        console.error('Drop error:', err);
    }
}

function placeFromPalette(data, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    let x = (clientX - rect.left - panX) / zoom;
    let y = (clientY - rect.top - panY) / zoom;

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
}
