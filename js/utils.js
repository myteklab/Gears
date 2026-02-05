// ============================================
// Gears Application - Utility Functions
// ============================================

// ============================================
// Color Utilities
// ============================================
function lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ============================================
// Hit Testing
// ============================================
function hitTestGear(x, y) {
    // Check in reverse order (top-most first)
    for (let i = state.gears.length - 1; i >= 0; i--) {
        const gear = state.gears[i];
        const dist = Math.hypot(x - gear.x, y - gear.y);
        if (dist <= gear.radius + 8) {
            return gear;
        }
    }
    return null;
}

function hitTestOutput(x, y) {
    // Check outputs - they have different hit areas based on type
    for (let i = state.outputs.length - 1; i >= 0; i--) {
        const output = state.outputs[i];
        const dist = Math.hypot(x - output.x, y - output.y);
        let hitRadius = 40; // Default hit radius

        switch (output.type) {
            case 'fan':
                hitRadius = 55; // Fan blades extend further
                break;
            case 'clock':
                hitRadius = 45;
                break;
            case 'platform':
                hitRadius = 40;
                break;
        }

        if (dist <= hitRadius) {
            return output;
        }
    }
    return null;
}

// ============================================
// Toast Notification
// ============================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Export for platform adapter
window.showToast = showToast;
