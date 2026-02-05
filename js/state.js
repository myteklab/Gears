// ============================================
// Gears Application - State Management
// ============================================

// Help content for each section
const helpContent = {
    'getting-started': {
        title: 'Getting Started with Gears',
        content: `
            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#9881;</span> Welcome to Gears!</div>
                <div class="help-text">
                    Build and simulate mechanical gear systems! Watch how gears of different sizes interact,
                    learn about gear ratios, and see real physics in action.
                </div>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#128077;</span> Quick Start</div>
                <ul class="help-list">
                    <li><strong>Add gears:</strong> Drag gears from the palette on the right onto the canvas</li>
                    <li><strong>Connect gears:</strong> Position gears close together - they'll automatically mesh</li>
                    <li><strong>Set a driver:</strong> Click a gear and press "Make Driver Gear" - this is the power source</li>
                    <li><strong>Start animation:</strong> Press the Play button or hit Spacebar</li>
                </ul>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#9000;</span> Keyboard Shortcuts</div>
                <ul class="help-list">
                    <li><strong>Space:</strong> Play/Stop animation</li>
                    <li><strong>Delete:</strong> Remove selected gear or output</li>
                    <li><strong>Escape:</strong> Deselect all</li>
                    <li><strong>Ctrl+S:</strong> Save project</li>
                </ul>
            </div>

            <div class="help-tip">
                <strong>Tip:</strong> The gear with the orange ring is the driver gear - it powers all connected gears!
            </div>
        `
    },
    'gears': {
        title: 'Understanding Gears',
        content: `
            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#128218;</span> How to Add Gears</div>
                <div class="help-text">
                    <strong>Drag and drop</strong> any gear from this palette onto the canvas workspace.
                    Each gear has a different number of teeth, which determines its size and behavior.
                </div>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#9881;</span> Gear Sizes & Teeth</div>
                <div class="help-text">
                    The number of teeth on a gear determines two things:
                </div>
                <ul class="help-list">
                    <li><strong>Size:</strong> More teeth = bigger gear</li>
                    <li><strong>Speed:</strong> Smaller gears spin faster when driven by larger ones</li>
                </ul>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#128200;</span> Gear Ratios</div>
                <div class="help-text">
                    When two gears mesh together, they create a <em>gear ratio</em>. This ratio determines
                    how fast the second gear spins compared to the first.
                </div>
                <div class="help-example">
                    <div class="help-example-title">Example</div>
                    <div class="help-example-content">
                        A 24-tooth gear driving a 12-tooth gear creates a <span class="help-formula">2:1 ratio</span><br>
                        The smaller gear spins <strong>twice as fast</strong> but with half the torque!
                    </div>
                </div>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#128260;</span> Direction of Rotation</div>
                <div class="help-text">
                    Meshed gears always rotate in <strong>opposite directions</strong>. If the driver gear
                    spins clockwise, all directly connected gears spin counter-clockwise.
                </div>
            </div>

            <div class="help-tip">
                <strong>Real World:</strong> Bicycle gears use these same principles! Low gear (big front, small back)
                is easier to pedal but slower. High gear is the opposite.
            </div>
        `
    },
    'properties': {
        title: 'Gear Properties',
        content: `
            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#9881;</span> Teeth Count</div>
                <div class="help-text">
                    Adjust the number of teeth on the selected gear (8 to 48). This changes the gear's size
                    and affects its speed when connected to other gears.
                </div>
                <div class="help-tip">
                    <strong>Formula:</strong> <span class="help-formula">Output Speed = Input Speed × (Input Teeth ÷ Output Teeth)</span>
                </div>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#127912;</span> Color</div>
                <div class="help-text">
                    Customize the color of your gear. Great for color-coding different parts of your gear train!
                </div>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#128336;</span> RPM (Rotations Per Minute)</div>
                <div class="help-text">
                    Shows how fast this gear is spinning during animation. RPM changes based on:
                </div>
                <ul class="help-list">
                    <li>The speed slider setting</li>
                    <li>The gear ratio from the driver gear</li>
                    <li>System load (more gears = more resistance)</li>
                </ul>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#9733;</span> Driver Gear</div>
                <div class="help-text">
                    The driver gear is the power source - like a motor. Only one gear can be the driver.
                    All other gears will follow based on their connections and ratios.
                </div>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#128444;</span> Attached Image</div>
                <div class="help-text">
                    Attach an image from your assets that will rotate with the gear. Use offset and scale
                    controls to position it perfectly. Great for adding decorations or showing what the gear powers!
                </div>
            </div>
        `
    },
    'outputs': {
        title: 'Output Mechanisms',
        content: `
            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#127744;</span> What Are Outputs?</div>
                <div class="help-text">
                    Outputs are things that gears can power! Drag them onto a gear to attach them,
                    and they'll rotate along with that gear.
                </div>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#127744;</span> Fan Blade</div>
                <div class="help-text">
                    A spinning fan with multiple blades. Attach it to a fast-spinning gear to see it whirl!
                </div>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#128336;</span> Clock Hand</div>
                <div class="help-text">
                    A single pointer that rotates around the gear center. Perfect for showing rotation
                    speed or simulating a clock mechanism.
                </div>
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#9898;</span> Platform</div>
                <div class="help-text">
                    A circular platform that spins with the gear. Imagine it carrying objects around in a circle!
                </div>
            </div>

            <div class="help-tip">
                <strong>Try This:</strong> Create a gear train where a large driver gear powers a tiny gear,
                then attach a fan to the tiny gear. Watch how fast it spins compared to the driver!
            </div>

            <div class="help-section">
                <div class="help-section-title"><span class="icon">&#128161;</span> Real World Examples</div>
                <ul class="help-list">
                    <li><strong>Ceiling fans</strong> use gear motors to spin at controlled speeds</li>
                    <li><strong>Clocks</strong> use precise gear ratios to move hands at exact speeds</li>
                    <li><strong>Conveyor belts</strong> are powered by gear-driven platforms</li>
                </ul>
            </div>
        `
    }
};

// ============================================
// Configuration and State
// ============================================

// Platform-managed - no APPLICATION_ID needed
// Platform-managed - no PROJECT_ID needed
// Platform-managed - no LOGIN_ID needed
// Platform-managed - data comes via platform:load event

let currentProjectId = null; // Platform-managed
window.isDirty = false;

// Application state
const state = {
    gears: [],
    outputs: [],
    driverGearId: null,
    selectedGearId: null,
    selectedOutputId: null,
    settings: {
        gridSnap: true,
        gridSize: 20,
        autoSpinEnabled: false,
        spinSpeed: 1.0,
        spinDirection: 1, // 1 = clockwise, -1 = counterclockwise
        toothThickness: 0.60, // 0.3 to 0.7 (fraction of angular pitch)
        toothDepth: 4, // 4 to 14 pixels
        backgroundColor: '#1a1a2e'
    }
};

// Canvas state
let canvas, ctx;
let canvasWidth, canvasHeight;
let zoom = 1;
let panX = 0, panY = 0;

// Gear system lock state (kinematic conflict detection)
let systemLocked = false;
let lockedGears = new Set(); // IDs of gears involved in lock conflict

// Interaction state
let isDragging = false;
let isSpinning = false;
let dragTarget = null;
let dragOffsetX = 0, dragOffsetY = 0;
let spinStartAngle = 0;
let lastMouseX = 0, lastMouseY = 0;

// Animation state
let isPlaying = false;
let lastTime = 0;
let animationId = null;

// Base rotation speed: 0.15 rotations/sec at 1x = 9 RPM base
const BASE_ROTATION_SPEED = 0.15;

// Drag from palette
let paletteDropData = null;

// Gear colors for variety
const GEAR_COLORS = [
    '#6c5ce7', '#a855f7', '#3498db', '#1abc9c',
    '#e74c3c', '#f39c12', '#e91e63', '#00bcd4'
];
