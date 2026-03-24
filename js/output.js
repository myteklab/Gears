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
        color: type === 'fan' ? '#3498db' : type === 'clock' ? '#2c3e50' : type === 'wheel' ? '#333333' : type === 'crane' ? '#e67e22' : type === 'generator' ? '#f1c40f' : '#95a5a6',
        payload: null
    };

    // Initialize payload data for special output types
    if (type === 'crane') {
        output.payload = { weightKg: 2.0, ropeLength: 100, liftedHeight: 0 };
    } else if (type === 'generator') {
        output.payload = { maxWatts: 10, brightness: 0 };
    }

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

function drawWheel(output) {
    var outerR = 60;
    var rimR = 48;
    var hubR = 14;
    var spokeCount = 5;

    // Outer tire (dark rubber)
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a2a';
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tire tread marks
    for (var i = 0; i < 20; i++) {
        var a = (i / 20) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (outerR - 1), Math.sin(a) * (outerR - 1));
        ctx.lineTo(Math.cos(a) * (outerR - 5), Math.sin(a) * (outerR - 5));
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Metallic rim
    ctx.beginPath();
    ctx.arc(0, 0, rimR, 0, Math.PI * 2);
    var rimGrad = ctx.createRadialGradient(0, 0, hubR, 0, 0, rimR);
    rimGrad.addColorStop(0, '#c0c0c0');
    rimGrad.addColorStop(0.5, '#a0a0a0');
    rimGrad.addColorStop(1, '#808080');
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Spokes
    for (var s = 0; s < spokeCount; s++) {
        var sa = (s / spokeCount) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * hubR, Math.sin(sa) * hubR);
        ctx.lineTo(Math.cos(sa) * (rimR - 2), Math.sin(sa) * (rimR - 2));
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Hub
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.fillStyle = '#b0b0b0';
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center axle hole
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#555';
    ctx.fill();
}

function drawCrane(output) {
    var p = output.payload || { weightKg: 2, ropeLength: 100, liftedHeight: 0 };
    var drumR = 14;
    var ropeLen = p.ropeLength || 100;
    var lifted = p.liftedHeight || 0;
    var weightY = ropeLen - lifted;

    // Winch drum (rotates with gear)
    ctx.beginPath();
    ctx.arc(0, 0, drumR, 0, Math.PI * 2);
    var drumGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, drumR);
    drumGrad.addColorStop(0, '#aaa');
    drumGrad.addColorStop(1, '#666');
    ctx.fillStyle = drumGrad;
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Axle
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#444';
    ctx.fill();

    // Rope and weight must NOT rotate - counter-rotate
    ctx.rotate(-output.rotation);

    // Support arm
    ctx.beginPath();
    ctx.moveTo(0, drumR);
    ctx.lineTo(0, drumR + 8);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Rope
    ctx.beginPath();
    ctx.moveTo(0, drumR + 8);
    ctx.lineTo(0, drumR + 8 + weightY);
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Weight block
    var blockW = 28;
    var blockH = 22;
    var blockY = drumR + 8 + weightY;
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.roundRect(-blockW / 2, blockY, blockW, blockH, 3);
    ctx.fill();
    ctx.strokeStyle = '#922b21';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Weight label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.weightKg.toFixed(1) + 'kg', 0, blockY + blockH / 2);

    // Height indicator (small text)
    if (lifted > 0) {
        var heightM = (lifted / 20).toFixed(1); // scale: 20px = 1m
        ctx.fillStyle = '#2ecc71';
        ctx.font = '9px sans-serif';
        ctx.fillText(heightM + 'm', 18, blockY + blockH / 2);
    }
}

function drawGenerator(output) {
    var p = output.payload || { maxWatts: 10, brightness: 0 };
    var brightness = p.brightness || 0;

    // Generator housing (does NOT rotate - counter-rotate)
    ctx.rotate(-output.rotation);

    // Housing body
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.roundRect(-22, -14, 44, 28, 4);
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Coil lines on housing
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 1;
    for (var i = -12; i <= 12; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, -8);
        ctx.lineTo(i, 8);
        ctx.stroke();
    }

    // Lightbulb
    var bulbY = -32;
    var bulbR = 12;

    // Glow effect (when generating power)
    if (brightness > 0.05) {
        ctx.save();
        ctx.shadowColor = 'rgba(255, 220, 50, ' + Math.min(brightness, 1) + ')';
        ctx.shadowBlur = 15 + brightness * 25;
        ctx.beginPath();
        ctx.arc(0, bulbY, bulbR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 220, 50, ' + Math.min(brightness * 0.9, 0.95) + ')';
        ctx.fill();
        ctx.restore();
    }

    // Bulb outline
    ctx.beginPath();
    ctx.arc(0, bulbY, bulbR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 220, 50, ' + (0.1 + brightness * 0.8) + ')';
    ctx.fill();
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bulb base
    ctx.fillStyle = '#888';
    ctx.fillRect(-5, bulbY + bulbR - 2, 10, 6);

    // Wire from bulb to housing
    ctx.beginPath();
    ctx.moveTo(0, bulbY + bulbR + 4);
    ctx.lineTo(0, -14);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Watts display
    var watts = brightness * (p.maxWatts || 10);
    ctx.fillStyle = brightness > 0.3 ? '#fff' : '#aaa';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(watts.toFixed(1) + 'W', 0, 2);
}
