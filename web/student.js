/* ============================================================================
   StudyBuddy Student Portal - Web Dashboard Logic
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Initial Lucide Icons setup
  lucide.createIcons();

  // DOM Elements
  const apiUrlInput = document.getElementById('apiUrl');
  const userIdInput = document.getElementById('userId');
  const btnSync = document.getElementById('btnSync');
  
  const queueTableBody = document.getElementById('queueTableBody');
  const canvas = document.getElementById('graphCanvas');
  const ctx = canvas.getContext('2d');
  const tooltip = document.getElementById('nodeTooltip');

  const reviseModal = document.getElementById('reviseModal');
  const modalConceptName = document.getElementById('modalConceptName');
  const btnDismissModal = document.getElementById('btnDismissModal');

  // Shared state
  let graphData = { nodes: [], edges: [] };
  let nodePositions = [];
  let hoveredNode = null;
  let isDragging = false;
  let draggedNode = null;

  // Event Listeners
  btnSync.addEventListener('click', syncDashboard);
  btnDismissModal.addEventListener('click', () => reviseModal.style.display = 'none');
  
  // Set canvas bounds on resize
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function resizeCanvas() {
    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    drawGraph();
  }

  async function syncDashboard() {
    const apiUrl = apiUrlInput.value.trim().replace(/\/$/, "");
    const userId = userIdInput.value.trim();

    if (!apiUrl || !userId) {
      alert("Please fill in both the Server API Target URL and the Student User ID.");
      return;
    }

    btnSync.disabled = true;
    btnSync.innerHTML = '<i data-lucide="loader-2" class="btn-icon spinner"></i> Syncing...';
    lucide.createIcons();

    try {
      console.log(`Syncing data for Student: ${userId} from ${apiUrl}`);
      
      // 1. Fetch Student Graph
      const graphResponse = await fetch(`${apiUrl}/users/${userId}/graph`);
      if (!graphResponse.ok) {
        throw new Error(`Failed to fetch student graph (status: ${graphResponse.status})`);
      }
      graphData = await graphResponse.json();

      // 2. Fetch Review Queue
      const queueResponse = await fetch(`${apiUrl}/users/${userId}/review-queue`);
      if (!queueResponse.ok) {
        throw new Error(`Failed to fetch review queue (status: ${queueResponse.status})`);
      }
      const queueData = await queueResponse.json();

      // Update UI components
      initGraphPositions();
      runSimulation();
      renderQueueTable(queueData);

    } catch (err) {
      console.error(err);
      alert(`Synchronisation Failed: ${err.message}\n\nLoading local offline mock data stubs...`);
      loadOfflineStudentStubs();
    } finally {
      btnSync.disabled = false;
      btnSync.innerHTML = '<i data-lucide="refresh-cw" class="btn-icon"></i> Sync Portal';
      lucide.createIcons();
    }
  }

  // A. Render Active Recall Review Queue Table
  function renderQueueTable(queue) {
    queueTableBody.innerHTML = '';
    
    if (!queue || queue.length === 0) {
      queueTableBody.innerHTML = `
        <tr>
          <td colspan="3" class="table-empty">
            <i data-lucide="check-circle" style="color: var(--green); margin-bottom: 6px; width: 24px; height: 24px;"></i>
            <p>Your queue is clear! All concepts are currently up-to-date.</p>
          </td>
        </tr>
      `;
      lucide.createIcons();
      return;
    }

    queue.forEach(item => {
      const tr = document.createElement('tr');
      const score = item.score !== undefined ? item.score : 0.0;
      const pct = Math.round(score * 100);
      
      let statusColorClass = 'text-red';
      let warningIcon = '';
      if (pct >= 70) {
        statusColorClass = 'text-green';
      } else if (pct >= 40) {
        statusColorClass = 'text-orange';
      } else {
        warningIcon = '<i data-lucide="alert-triangle" class="warn-icon-inline" style="color: var(--red); display: inline-block; width: 12px; height: 12px; margin-right: 4px; vertical-align: middle;"></i>';
      }

      tr.innerHTML = `
        <td>
          <div style="font-weight: 600; color: #fff;">${item.name}</div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Reviewed: ${formatRelativeTime(item.lastReviewed)}</div>
        </td>
        <td>
          <span style="font-weight: 700;" class="${statusColorClass}">
            ${warningIcon}${pct}%
          </span>
        </td>
        <td style="text-align: right;">
          <button class="revise-btn" style="background-color: var(--purple-glow); border: 1px solid var(--purple); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer;">
            Revise
          </button>
        </td>
      `;

      tr.querySelector('.revise-btn').addEventListener('click', () => {
        modalConceptName.textContent = item.name;
        reviseModal.style.display = 'flex';
      });

      queueTableBody.appendChild(tr);
    });

    lucide.createIcons();
  }

  // Helper Relative Time
  function formatRelativeTime(isoString) {
    if (!isoString) return 'Never';
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      return `${diffDay}d ago`;
    } catch {
      return 'Some time ago';
    }
  }

  // B. 2D Force-Directed Graph Layout in HTML Canvas
  function initGraphPositions() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    nodePositions = graphData.nodes.map((node, index) => {
      // Find matching item in existing coordinates to keep visual continuity
      const existing = nodePositions.find(p => p.id === node.id);
      if (existing) {
        return {
          ...node,
          x: existing.x,
          y: existing.y,
          vx: 0,
          vy: 0
        };
      }
      return {
        ...node,
        x: width / 2 + (Math.random() - 0.5) * 150,
        y: height / 2 + (Math.random() - 0.5) * 150,
        vx: 0,
        vy: 0
      };
    });
  }

  function runSimulation() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const center = { x: width / 2, y: height / 2 };
    
    const k = 70; // Optimal distance
    const damping = 0.85;

    // Run simple force layout iterations synchronously
    for (let iter = 0; iter < 120; iter++) {
      // Repulsion between node pairs
      for (let i = 0; i < nodePositions.length; i++) {
        const n1 = nodePositions[i];
        for (let j = i + 1; j < nodePositions.length; j++) {
          const n2 = nodePositions[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
          
          if (dist < 180) {
            const force = (k * k) / dist;
            const fx = (dx / dist) * force * 0.5;
            const fy = (dy / dist) * force * 0.5;
            n1.vx += fx;
            n1.vy += fy;
            n2.vx -= fx;
            n2.vy -= fy;
          }
        }
      }

      // Attraction along links/edges
      graphData.edges.forEach(edge => {
        const n1 = nodePositions.find(p => p.id === edge.source);
        const n2 = nodePositions.find(p => p.id === edge.target);
        if (!n1 || !n2) return;

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
        
        const force = (dist * dist) / k;
        const fx = (dx / dist) * force * 0.12;
        const fy = (dy / dist) * force * 0.12;
        n1.vx += fx;
        n1.vy += fy;
        n2.vx -= fx;
        n2.vy -= fy;
      });

      // Update positions with center gravity
      nodePositions.forEach(n => {
        if (n === draggedNode) return; // Ignore forces on dragged node
        
        const dx = center.x - n.x;
        const dy = center.y - n.y;
        n.vx += dx * 0.04;
        n.vy += dy * 0.04;

        n.x += n.vx * 0.08;
        n.y += n.vy * 0.08;
        n.vx *= damping;
        n.vy *= damping;

        // Keep inside bounds
        n.x = Math.max(25, Math.min(width - 25, n.x));
        n.y = Math.max(25, Math.min(height - 25, n.y));
      });
    }

    drawGraph();
  }

  function drawGraph() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 1. Draw Links/Edges
    graphData.edges.forEach(edge => {
      const n1 = nodePositions.find(p => p.id === edge.source);
      const n2 = nodePositions.find(p => p.id === edge.target);
      if (!n1 || !n2) return;

      const isPrereq = edge.type === 'PREREQUISITE_OF';
      const weight = edge.weight || 1;
      
      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      
      ctx.lineWidth = isPrereq ? 2.0 + Math.min(2.0, (weight - 1) * 0.5) : 1.2 + Math.min(1.5, (weight - 1) * 0.4);
      ctx.strokeStyle = isPrereq ? '#7c4dff' : '#00e5ff';
      ctx.globalAlpha = Math.min(1.0, (isPrereq ? 0.6 : 0.4) + (weight - 1) * 0.15);
      
      if (isPrereq) {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    });

    ctx.setLineDash([]);

    // 2. Draw Nodes
    nodePositions.forEach(n => {
      const score = n.score !== undefined ? n.score : 0.0;
      let color = '#f44336'; // Red
      if (score >= 0.7) color = '#4caf50'; // Green
      else if (score >= 0.4) color = '#ffb74d'; // Orange

      const isHovered = hoveredNode?.id === n.id;
      const size = isHovered ? 14 : 10;

      // Glow outer circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, size + 6, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = isHovered ? 0.4 : 0.15;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Outer border circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, size + 2, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(n.x, n.y, size - 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.font = isHovered ? 'bold 11px Inter' : '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.x, n.y - size - 10);
    });
  }

  // Tooltip details / Canvas Mouse events
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let found = null;
    nodePositions.forEach(n => {
      const dx = n.x - mouseX;
      const dy = n.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 18) {
        found = n;
      }
    });

    if (found !== hoveredNode) {
      hoveredNode = found;
      drawGraph();
      
      if (hoveredNode) {
        // Show tooltip
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
        tooltip.style.top = (e.clientY - rect.top + 15) + 'px';
        
        const score = hoveredNode.score !== undefined ? hoveredNode.score : 0.0;
        tooltip.innerHTML = `
          <strong style="color: var(--cyan); text-transform: uppercase;">${hoveredNode.label}</strong>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Score: ${Math.round(score * 100)}%</div>
          <div style="font-size: 11px; margin-top: 6px; border-top: 1px solid var(--border-color); padding-top: 4px; color: #d1d5db; line-height: 16px;">
            ${hoveredNode.description || "A key concept representing a building block of knowledge."}
          </div>
        `;
      } else {
        tooltip.style.display = 'none';
      }
    } else if (hoveredNode) {
      // Reposition tooltip
      tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
      tooltip.style.top = (e.clientY - rect.top + 15) + 'px';
    }
  });

  canvas.addEventListener('mousedown', e => {
    if (hoveredNode) {
      isDragging = true;
      draggedNode = hoveredNode;
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      draggedNode = null;
    }
  });

  canvas.addEventListener('mousemove', e => {
    if (isDragging && draggedNode) {
      const rect = canvas.getBoundingClientRect();
      draggedNode.x = Math.max(25, Math.min(rect.width - 25, e.clientX - rect.left));
      draggedNode.y = Math.max(25, Math.min(rect.height - 25, e.clientY - rect.top));
      drawGraph();
    }
  });

  // Offline mock stubs for development/fallback
  function loadOfflineStudentStubs() {
    graphData = {
      nodes: [
        { id: "photosynthesis", label: "Photosynthesis", score: 0.8, description: "Process by which green plants synthesize nutrients using sunlight, water, and carbon dioxide." },
        { id: "chlorophyll", label: "Chlorophyll", score: 0.5, description: "The green pigment in chloroplasts that absorbs light energy for photosynthesis." },
        { id: "gravity", label: "Gravity", score: 0.95, description: "The universal attraction force between physical bodies proportional to their masses." },
        { id: "orbits", label: "Orbits", score: 0.0, description: "The curved path of a celestial object or spacecraft around a star, planet, or moon." }
      ],
      edges: [
        { source: "chlorophyll", target: "photosynthesis", type: "RELATES_TO", weight: 2 },
        { source: "gravity", target: "orbits", type: "PREREQUISITE_OF", weight: 3 }
      ]
    };

    const mockQueue = [
      { name: "Chlorophyll", score: 0.5, lastReviewed: new Date(Date.now() - 3600000 * 25).toISOString() }, // 25 hours ago (overdue)
      { name: "Orbits", score: 0.0, lastReviewed: null } // Never reviewed (due)
    ];

    initGraphPositions();
    runSimulation();
    renderQueueTable(mockQueue);
  }

  // Pre-load offline stubs at startup so dashboard has content instantly
  loadOfflineStudentStubs();
});
