// High-Performance HTML5 Canvas Scatter Plot for Patient Map (2,250 Test Patients)

export class PatientMapCanvas {
  constructor(canvasElement, patientData, onSelectCallback) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext("2d");
    this.points = patientData.points || [];
    this.phenotypes = patientData.phenotypes || [];
    this.onSelect = onSelectCallback;
    
    this.colorMode = "risk"; // "risk" | "actual" | "cluster"
    this.userMarker = null;  // [x, y] coordinates
    this.selectedIndices = new Set();
    
    // Zoom and Pan transform
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    
    this.hoveredPoint = null;
    this.tooltipEl = null;

    this.setupListeners();
    this.resize();
    this.startPulseLoop();
  }

  startPulseLoop() {
    const animate = () => {
      if (this.userMarker) {
        this.render();
      }
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 600;
    this.height = rect.height || 420;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  setupListeners() {
    // Tooltip element
    let tip = document.getElementById("patient-map-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "patient-map-tooltip";
      tip.className = "clinical-chart-tooltip";
      tip.style.display = "none";
      document.body.appendChild(tip);
    }
    this.tooltipEl = tip;

    this.canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.offsetX, y: e.clientY - this.offsetY };
    });

    window.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        this.offsetX = e.clientX - this.dragStart.x;
        this.offsetY = e.clientY - this.dragStart.y;
        this.render();
      }
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        if (this.tooltipEl) this.tooltipEl.style.display = "none";
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scaleCoord = (v) => v * (Math.min(this.width, this.height) / 240);
      const centerX = this.width / 2 + this.offsetX;
      const centerY = this.height / 2 + this.offsetY;

      // Find point within 10px
      let closest = null;
      let minD = 12;

      for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i];
        const screenX = centerX + scaleCoord(p.x) * this.scale;
        const screenY = centerY + scaleCoord(p.y) * this.scale;
        const d = Math.hypot(mouseX - screenX, mouseY - screenY);
        if (d < minD) {
          minD = d;
          closest = p;
        }
      }

      if (closest) {
        this.hoveredPoint = closest;
        this.canvas.style.cursor = "pointer";
        if (this.tooltipEl) {
          this.tooltipEl.style.display = "block";
          this.tooltipEl.style.left = `${e.pageX + 14}px`;
          this.tooltipEl.style.top = `${e.pageY - 28}px`;
          const actualText = closest.actual === 1 ? '<span style="color:#FF1744; font-weight:800;">Disease Reported</span>' : '<span style="color:#00E5A0; font-weight:800;">No Event</span>';
          this.tooltipEl.innerHTML = `
            <div style="font-weight:800; margin-bottom:4px; font-size:13px; color:var(--text-main);">Patient Profile #${closest.id ?? 'BRFSS'}</div>
            <div style="display:flex; justify-content:space-between; gap:16px;"><span>Model Risk:</span> <strong style="color:var(--primary-deep);">${(closest.risk * 100).toFixed(1)}%</strong></div>
            <div style="display:flex; justify-content:space-between; gap:16px;"><span>Outcome:</span> ${actualText}</div>
            <div style="display:flex; justify-content:space-between; gap:16px;"><span>Cluster:</span> <strong>Cluster ${closest.cluster ?? 0}</strong></div>
          `;
        }
        this.render();
      } else {
        if (this.hoveredPoint) {
          this.hoveredPoint = null;
          this.canvas.style.cursor = "default";
          if (this.tooltipEl) this.tooltipEl.style.display = "none";
          this.render();
        }
      }
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.hoveredPoint = null;
      if (this.tooltipEl) this.tooltipEl.style.display = "none";
      this.render();
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });

    // Click handler to load selected patient into Risk Lab
    this.canvas.addEventListener("click", (e) => {
      if (this.hoveredPoint && this.onSelect) {
        this.onSelect(this.hoveredPoint);
      }
    });
  }

  setColorMode(mode) {
    this.colorMode = mode;
    this.render();
  }

  placeUserProfile(x, y) {
    this.userMarker = { x, y };
    // Find 10 nearest neighbors in SHAP space
    const withDist = this.points.map((p, idx) => ({
      idx,
      dist: Math.hypot(p.x - x, p.y - y)
    }));
    withDist.sort((a, b) => a.dist - b.dist);
    this.nearest10 = new Set(withDist.slice(0, 10).map(d => d.idx));
    this.render();
  }

  getPointColor(p) {
    if (this.colorMode === "actual") {
      return p.actual === 1 ? "#FF1744" : "#00E676";
    }
    if (this.colorMode === "cluster") {
      const clusterColors = ["#00D4FF", "#818CF8", "#C084FC", "#FFBA08", "#FF2060"];
      return clusterColors[p.cluster % clusterColors.length];
    }
    // Risk colormap
    const r = p.risk;
    if (r < 0.10) return "#00E676";
    if (r < 0.20) return "#00D4FF";
    if (r < 0.35) return "#FFBA08";
    return "#FF1744";
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Transform setup
    ctx.save();
    ctx.translate(w / 2 + this.offsetX, h / 2 + this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Map domain [-100, 100] to canvas coordinates
    const scaleCoord = (v) => v * (Math.min(w, h) / 240);

    // 1. Draw Grid Lines & Axes in manifold space
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(100, 140, 180, 0.15)";
    ctx.beginPath();
    for (let g = -100; g <= 100; g += 25) {
      const pos = scaleCoord(g);
      // Vertical grid lines
      ctx.moveTo(pos, scaleCoord(-100));
      ctx.lineTo(pos, scaleCoord(100));
      // Horizontal grid lines
      ctx.moveTo(scaleCoord(-100), pos);
      ctx.lineTo(scaleCoord(100), pos);
    }
    ctx.stroke();

    // Prominent X & Y Zero Axes
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(0, 212, 255, 0.35)";
    ctx.beginPath();
    ctx.moveTo(scaleCoord(-100), 0);
    ctx.lineTo(scaleCoord(100), 0);
    ctx.moveTo(0, scaleCoord(-100));
    ctx.lineTo(0, scaleCoord(100));
    ctx.stroke();

    // Axis Tick Labels
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(125, 151, 184, 0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let t = -100; t <= 100; t += 50) {
      if (t !== 0) {
        ctx.fillText(t.toString(), scaleCoord(t), 4);
      }
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let t = -100; t <= 100; t += 50) {
      if (t !== 0) {
        ctx.fillText(t.toString(), -4, scaleCoord(t));
      }
    }

    // 2. Render Cluster Centroid Pills (Meaningful Clinical Labels)
    if (this.phenotypes && this.phenotypes.length > 0) {
      const clusterCenters = {};
      this.points.forEach(p => {
        const c = p.cluster;
        if (!clusterCenters[c]) clusterCenters[c] = { sumX: 0, sumY: 0, count: 0 };
        clusterCenters[c].sumX += p.x;
        clusterCenters[c].sumY += p.y;
        clusterCenters[c].count++;
      });

      this.phenotypes.forEach((pt, cIdx) => {
        const stats = clusterCenters[cIdx];
        if (stats && stats.count > 0) {
          const cx = scaleCoord(stats.sumX / stats.count);
          const cy = scaleCoord(stats.sumY / stats.count);

          // Draw cluster centroid aura
          ctx.beginPath();
          ctx.arc(cx, cy, 28, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0, 212, 255, 0.05)";
          ctx.fill();

          // Centroid badge label
          const labelText = `C${cIdx}: ${pt.name.split(' ')[0]}`;
          ctx.font = "bold 10px 'Plus Jakarta Sans', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const textW = ctx.measureText(labelText).width;

          ctx.fillStyle = "rgba(7, 15, 30, 0.85)";
          ctx.strokeStyle = "rgba(0, 212, 255, 0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(cx - textW / 2 - 6, cy - 8, textW + 12, 16, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#E0F2FE";
          ctx.fillText(labelText, cx, cy);
        }
      });
    }

    // 3. Render Patient Data Points
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const px = scaleCoord(p.x);
      const py = scaleCoord(p.y);

      const isNearest = this.nearest10 && this.nearest10.has(i);
      const isHovered = this.hoveredPoint === p;

      ctx.beginPath();
      ctx.arc(px, py, isHovered ? 7 : (isNearest ? 5.5 : 2.8), 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? "#FFFFFF" : (isNearest ? "#00E5A0" : this.getPointColor(p));
      ctx.globalAlpha = isHovered ? 1.0 : (isNearest ? 1.0 : 0.65);
      ctx.fill();

      if (isNearest || isHovered) {
        ctx.strokeStyle = isHovered ? "var(--primary-deep)" : "#FFFFFF";
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.stroke();
      }
    }

    // 4. Render Pulsing Beacon User Profile Marker
    if (this.userMarker) {
      const ux = scaleCoord(this.userMarker.x);
      const uy = scaleCoord(this.userMarker.y);
      const t = Date.now() / 600;

      // Outer expanding radar wave 1
      const r1 = 8 + (t % 2) * 16;
      const alpha1 = Math.max(0, 1 - (t % 2) / 2);
      ctx.beginPath();
      ctx.arc(ux, uy, r1, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 212, 255, ${alpha1 * 0.85})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Outer expanding radar wave 2
      const r2 = 8 + ((t + 1) % 2) * 16;
      const alpha2 = Math.max(0, 1 - ((t + 1) % 2) / 2);
      ctx.beginPath();
      ctx.arc(ux, uy, r2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 212, 255, ${alpha2 * 0.85})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Connecting lines to nearest 10 neighbors
      if (this.nearest10) {
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(0, 229, 160, 0.4)";
        this.points.forEach((p, idx) => {
          if (this.nearest10.has(idx)) {
            ctx.beginPath();
            ctx.moveTo(ux, uy);
            ctx.lineTo(scaleCoord(p.x), scaleCoord(p.y));
            ctx.stroke();
          }
        });
        ctx.setLineDash([]);
      }

      // Inner glowing core
      ctx.beginPath();
      ctx.arc(ux, uy, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#00D4FF";
      ctx.shadowColor = "#00D4FF";
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(ux, uy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
    }

    ctx.restore();

    // 5. Fixed Screen-Space Axis Dimension Labels & Legend
    ctx.save();
    ctx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "rgba(200, 220, 255, 0.85)";

    // Bottom Axis Title
    ctx.textAlign = "center";
    ctx.fillText("t-SNE / UMAP Dimension 1 (SHAP Latent Manifold)", w / 2, h - 10);

    // Left Axis Title (Rotated)
    ctx.translate(14, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("t-SNE / UMAP Dimension 2 (Risk Drivers)", 0, 0);
    ctx.restore();
  }
}


