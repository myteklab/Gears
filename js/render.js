// ============================================
// Gears Application - Rendering
// ============================================

// ============================================
// Main Render Function
// ============================================
function render() {
    // Clear canvas
    ctx.fillStyle = state.settings.backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Draw grid
    if (state.settings.gridSnap) {
        drawGrid();
    }

    // Draw meshing highlights
    drawMeshingHighlights();

    // Draw gears
    state.gears.forEach(gear => {
        drawGear(gear);
    });

    // Draw outputs
    state.outputs.forEach(output => {
        drawOutput(output);
    });

    // Draw potential snap indicator when dragging
    if (isDragging && dragTarget && dragTarget.type === 'gear') {
        drawSnapIndicators(dragTarget.item);
    }

    ctx.restore();
}

// ============================================
// Grid Drawing
// ============================================
function drawGrid() {
    const gridSize = state.settings.gridSize;
    ctx.strokeStyle = '#2d2d44';
    ctx.lineWidth = 0.5;

    const startX = Math.floor(-panX / zoom / gridSize) * gridSize;
    const startY = Math.floor(-panY / zoom / gridSize) * gridSize;
    const endX = startX + canvasWidth / zoom + gridSize;
    const endY = startY + canvasHeight / zoom + gridSize;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
    }
    ctx.stroke();
}

// ============================================
// Gear Drawing
// ============================================
function drawGear(gear) {
    const toothDepth = state.settings.toothDepth;
    const toothWidthFactor = state.settings.toothThickness; // Width of tooth base as fraction of angular pitch
    const taperRatio = 0.65; // Tip width as fraction of base width (smaller = more taper)

    ctx.save();
    ctx.translate(gear.x, gear.y);
    ctx.rotate(gear.rotation);

    // Draw selection ring
    if (gear.id === state.selectedGearId) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, gear.radius + toothDepth + 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw driver indicator
    if (gear.id === state.driverGearId) {
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, gear.radius + toothDepth + 10, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw locked gear indicator (red pulsing glow)
    if (lockedGears.has(gear.id)) {
        const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() / 200);
        ctx.save();
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20 + pulseIntensity * 10;
        ctx.strokeStyle = `rgba(255, 0, 0, ${0.6 + pulseIntensity * 0.4})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, gear.radius + toothDepth + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Draw gear body with tapered teeth (narrower at tip, wider at base)
    // For realistic meshing: dedendum (valley) must be deeper than addendum (tooth height)
    const angularPitch = (Math.PI * 2) / gear.teethCount;
    const outerRadius = gear.radius + toothDepth;  // Addendum (tooth tip)
    const innerRadius = gear.radius - toothDepth * 1.2;  // Dedendum (valley) - deeper for clearance
    const baseHalfWidth = angularPitch * toothWidthFactor / 2;
    const tipHalfWidth = baseHalfWidth * taperRatio;

    ctx.beginPath();

    for (let i = 0; i < gear.teethCount; i++) {
        const toothCenter = i * angularPitch;

        // Tooth tip (narrower) - at outer radius
        const tipStart = toothCenter - tipHalfWidth;
        const tipEnd = toothCenter + tipHalfWidth;

        // Tooth base (wider) - at inner radius
        const baseStart = toothCenter - baseHalfWidth;
        const baseEnd = toothCenter + baseHalfWidth;

        // Valley angles
        const valleyEnd = toothCenter + angularPitch - baseHalfWidth;
        const nextTipStart = toothCenter + angularPitch - tipHalfWidth;

        if (i === 0) {
            // Start at tip of first tooth
            ctx.moveTo(
                Math.cos(tipStart) * outerRadius,
                Math.sin(tipStart) * outerRadius
            );
        }

        // Top of tooth (narrow tip)
        ctx.lineTo(
            Math.cos(tipEnd) * outerRadius,
            Math.sin(tipEnd) * outerRadius
        );

        // Angled line down to base (creates taper)
        ctx.lineTo(
            Math.cos(baseEnd) * innerRadius,
            Math.sin(baseEnd) * innerRadius
        );

        // Valley floor
        ctx.lineTo(
            Math.cos(valleyEnd) * innerRadius,
            Math.sin(valleyEnd) * innerRadius
        );

        // Angled line up to next tooth tip (creates taper)
        ctx.lineTo(
            Math.cos(nextTipStart) * outerRadius,
            Math.sin(nextTipStart) * outerRadius
        );
    }

    ctx.closePath();

    // Fill gear body
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, gear.radius);
    gradient.addColorStop(0, lightenColor(gear.color, 30));
    gradient.addColorStop(1, gear.color);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke outline
    ctx.strokeStyle = darkenColor(gear.color, 30);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw center hole
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = darkenColor(gear.color, 40);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw center axle
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#555';
    ctx.fill();

    // Draw attached image (rotates with gear)
    if (gear.attachedImage && gear.attachedImage.imageObj) {
        const img = gear.attachedImage.imageObj;
        const scale = gear.attachedImage.scale || 1;
        const offsetX = gear.attachedImage.offsetX || 0;
        const offsetY = gear.attachedImage.offsetY || 0;

        // Calculate scaled dimensions
        const maxSize = gear.radius * 1.5;
        const aspectRatio = img.width / img.height;
        let drawWidth, drawHeight;

        if (aspectRatio > 1) {
            drawWidth = maxSize * scale;
            drawHeight = drawWidth / aspectRatio;
        } else {
            drawHeight = maxSize * scale;
            drawWidth = drawHeight * aspectRatio;
        }

        // Draw image centered with offset
        ctx.drawImage(
            img,
            offsetX - drawWidth / 2,
            offsetY - drawHeight / 2,
            drawWidth,
            drawHeight
        );
    }

    ctx.restore();

    // Draw RPM display when spinning (outside of rotation transform)
    if (isPlaying && gear.rotationSpeed !== 0) {
        const rpm = Math.abs(gear.rotationSpeed * 60).toFixed(0);
        const direction = gear.rotationSpeed > 0 ? '↻' : '↺';

        ctx.save();
        ctx.translate(gear.x, gear.y);

        // Background pill for RPM
        const text = direction + ' ' + rpm;
        ctx.font = 'bold 11px sans-serif';
        const textWidth = ctx.measureText(text).width;
        const pillWidth = textWidth + 12;
        const pillHeight = 18;
        const pillY = -gear.radius - toothDepth - 18;

        // Draw pill background
        ctx.beginPath();
        ctx.roundRect(-pillWidth/2, pillY - pillHeight/2, pillWidth, pillHeight, 9);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fill();

        // Draw text
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, pillY);

        // Draw "RPM" label below
        ctx.font = '9px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText('RPM', 0, pillY + 12);

        ctx.restore();
    }
}

// ============================================
// Meshing Highlights
// ============================================
function drawMeshingHighlights() {
    // Draw connection lines between meshed gears
    ctx.strokeStyle = 'rgba(108, 92, 231, 0.3)';
    ctx.lineWidth = 3;

    const drawnPairs = new Set();

    state.gears.forEach(gear => {
        gear.meshingWith.forEach(otherId => {
            const pairKey = [gear.id, otherId].sort().join('-');
            if (!drawnPairs.has(pairKey)) {
                drawnPairs.add(pairKey);
                const other = state.gears.find(g => g.id === otherId);
                if (other) {
                    // Draw glow at connection point
                    const midX = (gear.x + other.x) / 2;
                    const midY = (gear.y + other.y) / 2;

                    const gradient = ctx.createRadialGradient(midX, midY, 0, midX, midY, 20);
                    gradient.addColorStop(0, 'rgba(108, 92, 231, 0.5)');
                    gradient.addColorStop(1, 'rgba(108, 92, 231, 0)');

                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(midX, midY, 20, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
    });
}

// ============================================
// Snap Indicators
// ============================================
function drawSnapIndicators(gear) {
    // Show potential snap positions
    state.gears.forEach(other => {
        if (other.id !== gear.id && canMesh(gear, other) && !checkMeshing(gear, other)) {
            // Draw green indicator showing snap position
            const angle = Math.atan2(gear.y - other.y, gear.x - other.x);
            const meshDist = gear.radius + other.radius;
            const snapX = other.x + Math.cos(angle) * meshDist;
            const snapY = other.y + Math.sin(angle) * meshDist;

            ctx.strokeStyle = '#27ae60';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(snapX, snapY, gear.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });
}

// ============================================
// Output Drawing
// ============================================
function drawOutput(output) {
    ctx.save();
    ctx.translate(output.x, output.y);

    // Draw selection indicator (before rotation so it stays circular)
    if (output.id === state.selectedOutputId) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        let selectionRadius = 50;
        if (output.type === 'fan') selectionRadius = 60;
        else if (output.type === 'clock') selectionRadius = 50;
        else if (output.type === 'platform') selectionRadius = 45;
        ctx.arc(0, 0, selectionRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.rotate(output.rotation);

    switch (output.type) {
        case 'fan':
            drawFan(output);
            break;
        case 'clock':
            drawClock(output);
            break;
        case 'platform':
            drawPlatform(output);
            break;
    }

    ctx.restore();
}

// ============================================
// Screenshot Drawing (for project previews)
// ============================================
function drawGearToContext(targetCtx, gear) {
    const toothDepth = state.settings.toothDepth;
    const toothWidthFactor = state.settings.toothThickness;
    const taperRatio = 0.65;

    targetCtx.save();
    targetCtx.translate(gear.x, gear.y);
    targetCtx.rotate(gear.rotation);

    const angularPitch = (Math.PI * 2) / gear.teethCount;
    const outerRadius = gear.radius + toothDepth;
    const innerRadius = gear.radius - toothDepth * 1.2;
    const baseHalfWidth = angularPitch * toothWidthFactor / 2;
    const tipHalfWidth = baseHalfWidth * taperRatio;

    targetCtx.beginPath();
    for (let i = 0; i < gear.teethCount; i++) {
        const toothCenter = i * angularPitch;
        const tipStart = toothCenter - tipHalfWidth;
        const tipEnd = toothCenter + tipHalfWidth;
        const baseEnd = toothCenter + baseHalfWidth;
        const valleyEnd = toothCenter + angularPitch - baseHalfWidth;
        const nextTipStart = toothCenter + angularPitch - tipHalfWidth;

        if (i === 0) {
            targetCtx.moveTo(Math.cos(tipStart) * outerRadius, Math.sin(tipStart) * outerRadius);
        }
        targetCtx.lineTo(Math.cos(tipEnd) * outerRadius, Math.sin(tipEnd) * outerRadius);
        targetCtx.lineTo(Math.cos(baseEnd) * innerRadius, Math.sin(baseEnd) * innerRadius);
        targetCtx.lineTo(Math.cos(valleyEnd) * innerRadius, Math.sin(valleyEnd) * innerRadius);
        targetCtx.lineTo(Math.cos(nextTipStart) * outerRadius, Math.sin(nextTipStart) * outerRadius);
    }
    targetCtx.closePath();

    // Fill gear
    const gradient = targetCtx.createRadialGradient(0, 0, 0, 0, 0, gear.radius);
    gradient.addColorStop(0, lightenColor(gear.color, 30));
    gradient.addColorStop(1, gear.color);
    targetCtx.fillStyle = gradient;
    targetCtx.fill();
    targetCtx.strokeStyle = darkenColor(gear.color, 30);
    targetCtx.lineWidth = 2;
    targetCtx.stroke();

    // Center hole
    targetCtx.beginPath();
    targetCtx.arc(0, 0, 8, 0, Math.PI * 2);
    targetCtx.fillStyle = state.settings.backgroundColor;
    targetCtx.fill();

    // Center axle
    targetCtx.beginPath();
    targetCtx.arc(0, 0, 4, 0, Math.PI * 2);
    targetCtx.fillStyle = '#555';
    targetCtx.fill();

    // Draw attached image (for screenshot)
    if (gear.attachedImage && gear.attachedImage.imageObj) {
        const img = gear.attachedImage.imageObj;
        const scale = gear.attachedImage.scale || 1;
        const offsetX = gear.attachedImage.offsetX || 0;
        const offsetY = gear.attachedImage.offsetY || 0;

        const maxSize = gear.radius * 1.5;
        const aspectRatio = img.width / img.height;
        let drawWidth, drawHeight;

        if (aspectRatio > 1) {
            drawWidth = maxSize * scale;
            drawHeight = drawWidth / aspectRatio;
        } else {
            drawHeight = maxSize * scale;
            drawWidth = drawHeight * aspectRatio;
        }

        targetCtx.drawImage(
            img,
            offsetX - drawWidth / 2,
            offsetY - drawHeight / 2,
            drawWidth,
            drawHeight
        );
    }

    targetCtx.restore();
}
