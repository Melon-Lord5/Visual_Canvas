const API_BASE = "http://127.0.0.1:5000/api";

const state = {
    nodes: [],
    edges: [],
    dimensions: { nodeWidth: 140, nodeHeight: 60 },
    interaction: {
        draggedNodeId: null,
        offsetX: 0,
        offsetY: 0,
        edgeModeActive: false,
        edgeSourceNodeId: null
    }
};

const canvas = document.getElementById("canvas-board");
const ctx = canvas.getContext("2d");

// Debounce state mapping storage for pending node writes
const debounceTimers = {};

function debounceNodeUpdate(nodeId, x, y) {
    if (debounceTimers[nodeId]) {
        clearTimeout(debounceTimers[nodeId]);
    }
    debounceTimers[nodeId] = setTimeout(async () => {
        try {
            await fetch(`${API_BASE}/nodes/${nodeId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ x, y })
            });
        } catch (err) {
            console.error("Failed to sync node transformations:", err);
        }
        delete debounceTimers[nodeId];
    }, 150); // 150ms trailing window
}

// --- Data Synchronization Layer ---
async function fetchBoard() {
    try {
        const response = await fetch(`${API_BASE}/board`);
        const data = await response.json();
        state.nodes = data.nodes;
        state.edges = data.edges;
    } catch (err) {
        console.error("Error connecting to data pipeline backend:", err);
    }
}

async function createNode() {
    // Generate semi-random workspace placements near the screen center
    const x = Math.random() * (window.innerWidth * 0.4) + (window.innerWidth * 0.2);
    const y = Math.random() * (window.innerHeight * 0.4) + (window.innerHeight * 0.2);
    
    try {
        const response = await fetch(`${API_BASE}/nodes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x, y })
        });
        const newNode = await response.json();
        state.nodes.push(newNode);
    } catch (err) {
        console.error("Failed to append node:", err);
    }
}

async function createEdge(fromNodeId, toNodeId) {
    if (fromNodeId === toNodeId) return;
    // Client-side validation checking for duplicated connection states
    const exists = state.edges.some(e => (e.from_node === fromNodeId && e.to_node === toNodeId));
    if (exists) return;

    try {
        const response = await fetch(`${API_BASE}/edges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from_node: fromNodeId, to_node: toNodeId })
        });
        const newEdge = await response.json();
        state.edges.push(newEdge);
    } catch (err) {
        console.error("Failed to append structural edge mapping:", err);
    }
}

// --- Structural Collision Check ---
function getNodeAtPosition(x, y) {
    // Traverse backwards to select topmost elements first
    for (let i = state.nodes.length - 1; i >= 0; i--) {
        const n = state.nodes[i];
        if (x >= n.x && x <= n.x + state.dimensions.nodeWidth &&
            y >= n.y && y <= n.y + state.dimensions.nodeHeight) {
            return n;
        }
    }
    return null;
}

// --- Canvas Architecture Render Loop ---
function renderLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Edges (Connecting Lines)
    ctx.lineWidth = 2;
    state.edges.forEach(edge => {
        const source = state.nodes.find(n => n.id === edge.from_node);
        const target = state.nodes.find(n => n.id === edge.to_node);
        
        if (source && target) {
            const startX = source.x + state.dimensions.nodeWidth / 2;
            const startY = source.y + state.dimensions.nodeHeight / 2;
            const endX = target.x + state.dimensions.nodeWidth / 2;
            const endY = target.y + state.dimensions.nodeHeight / 2;
            
            ctx.beginPath();
            ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    });

    // 2. Draw Nodes (Bounding Boxes)
    state.nodes.forEach(node => {
        const isSelectedSource = (node.id === state.interaction.edgeSourceNodeId);
        
        // Node container box background
        ctx.fillStyle = isSelectedSource ? "#312e81" : "#1e1e24";
        ctx.strokeStyle = isSelectedSource ? "#22c55e" : "#4f46e5";
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.roundRect(node.x, node.y, state.dimensions.nodeWidth, state.dimensions.nodeHeight, 6);
        ctx.fill();
        ctx.stroke();

        // Node title text typography styling
        ctx.fillStyle = "#e4e4e7";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            node.title, 
            node.x + state.dimensions.nodeWidth / 2, 
            node.y + state.dimensions.nodeHeight / 2
        );
    });

    requestAnimationFrame(renderLoop);
}

// --- Interaction Events Hook Architecture ---
canvas.addEventListener("mousedown", (e) => {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const clickedNode = getNodeAtPosition(mouseX, mouseY);

    if (state.interaction.edgeModeActive) {
        if (clickedNode) {
            if (!state.interaction.edgeSourceNodeId) {
                state.interaction.edgeSourceNodeId = clickedNode.id;
            } else {
                createEdge(state.interaction.edgeSourceNodeId, clickedNode.id);
                state.interaction.edgeSourceNodeId = null;
            }
        } else {
            state.interaction.edgeSourceNodeId = null;
        }
    } else {
        if (clickedNode) {
            state.interaction.draggedNodeId = clickedNode.id;
            state.interaction.offsetX = mouseX - clickedNode.x;
            state.interaction.offsetY = mouseY - clickedNode.y;
        }
    }
});

canvas.addEventListener("mousemove", (e) => {
    if (!state.interaction.draggedNodeId || state.interaction.edgeModeActive) return;

    const activeNode = state.nodes.find(n => n.id === state.interaction.draggedNodeId);
    if (activeNode) {
        activeNode.x = e.clientX - state.interaction.offsetX;
        activeNode.y = e.clientY - state.interaction.offsetY;
        
        // Fire UI state updates to the persistent storage debounced channel
        debounceNodeUpdate(activeNode.id, activeNode.x, activeNode.y);
    }
});

window.addEventListener("mouseup", () => {
    state.interaction.draggedNodeId = null;
});

// --- UI Controls Wireframing ---
document.getElementById("btn-add-node").addEventListener("click", createNode);

const edgeModeBtn = document.getElementById("btn-connect-mode");
edgeModeBtn.addEventListener("click", () => {
    state.interaction.edgeModeActive = !state.interaction.edgeModeActive;
    state.interaction.edgeSourceNodeId = null; // Flush partial selection memory pools
    
    if (state.interaction.edgeModeActive) {
        edgeModeBtn.textContent = "Edge Mode: ON";
        edgeModeBtn.classList.add("mode-active");
    } else {
        edgeModeBtn.textContent = "Edge Mode: OFF";
        edgeModeBtn.classList.remove("mode-active");
    }
});

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);

// Execution Entrypoint
resizeCanvas();
fetchBoard().then(() => {
    requestAnimationFrame(renderLoop);
});