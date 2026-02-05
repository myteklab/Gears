// ============================================
// Gears Application - Output Mechanisms
// ============================================

// ============================================
// Output Functions
// ============================================
function createOutput(type, x, y) {
    const output = {
        id: 'output_' + Date.now(),
        type: type,
        x: x,
        y: y,
        attachedToGear: null,
        rotation: 0,
        color: type === 'fan' ? '#3498db' : type === 'clock' ? '#2c3e50' : '#95a5a6'
    };

    // Try to attach to nearest gear
    let nearestGear = null;
    let nearestDist = Infinity;

    for (const gear of state.gears) {
        const dist = Math.hypot(x - gear.x, y - gear.y);
        if (dist < gear.radius + 30 && dist < nearestDist) {
            nearestDist = dist;
            nearestGear = gear;
        }
    }

    if (nearestGear) {
        output.attachedToGear = nearestGear.id;
        output.x = nearestGear.x;
        output.y = nearestGear.y;
    }

    state.outputs.push(output);
    window.isDirty = true;
    return output;
}

// ============================================
// Output Drawing Functions
// ============================================
function drawFan(output) {
    const bladeCount = 4;
    const bladeLength = 50;
    const bladeWidth = 15;

    ctx.fillStyle = output.color;

    for (let i = 0; i < bladeCount; i++) {
        ctx.save();
        ctx.rotate((i / bladeCount) * Math.PI * 2);

        ctx.beginPath();
        ctx.ellipse(bladeLength / 2, 0, bladeLength / 2, bladeWidth / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Center hub
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#34495e';
    ctx.fill();
}

function drawClock(output) {
    // Clock face
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#ecf0f1';
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Hour markers
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const x1 = Math.cos(angle) * 32;
        const y1 = Math.sin(angle) * 32;
        const x2 = Math.cos(angle) * 38;
        const y2 = Math.sin(angle) * 38;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Clock hand (rotates with gear)
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(0, -30);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
}

function drawPlatform(output) {
    // Platform base
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.fillStyle = '#7f8c8d';
    ctx.fill();
    ctx.strokeStyle = '#5d6d7e';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Rotation indicator lines
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
        ctx.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
        ctx.strokeStyle = '#5d6d7e';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Center marker
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#34495e';
    ctx.fill();
}
