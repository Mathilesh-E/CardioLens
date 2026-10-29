// PulseIQ Studio: Interactive Correlation Heatmap Matrix
// Visualizes 21x21 Spearman Feature Correlations with D3.js

export function renderCorrelationHeatmap(containerSelector, correlationsData, onCellClick) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.innerHTML = "";

  const features = correlationsData.columns || correlationsData.features || [];
  const matrix = correlationsData.spearman_matrix || correlationsData.matrix || [];
  if (!features.length || !matrix.length) return;
  const numFeats = features.length;

  const margin = { top: 85, right: 30, bottom: 30, left: 85 };
  const size = 620;
  const innerW = size - margin.left - margin.right;
  const innerH = size - margin.top - margin.bottom;

  const cellSize = innerW / numFeats;

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${size} ${size}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .style("max-width", "620px")
    .style("display", "block");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Color scale: Blue (-1) to Charcoal (0) to Vibrant Crimson (+1)
  const colorScale = d3.scaleDiverging()
    .domain([-0.5, 0, 0.5])
    .interpolator(d3.interpolateRdBu);

  // Tooltip
  let tooltip = d3.select("#corr-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("id", "corr-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(15, 23, 42, 0.95)")
      .style("color", "#fff")
      .style("padding", "8px 12px")
      .style("border-radius", "8px")
      .style("border", "1px solid rgba(255,255,255,0.15)")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 1000);
  }

  // Draw Heatmap Cells
  for (let i = 0; i < numFeats; i++) {
    for (let j = 0; j < numFeats; j++) {
      const val = matrix[i][j];
      const cell = g.append("rect")
        .attr("x", j * cellSize)
        .attr("y", i * cellSize)
        .attr("width", cellSize - 1)
        .attr("height", cellSize - 1)
        .attr("rx", 2)
        .attr("fill", colorScale(-val)) // flip so positive correlation is warm/red
        .attr("stroke", "rgba(0,0,0,0.2)")
        .attr("stroke-width", 0.5)
        .style("cursor", "pointer");

      cell.on("mouseenter", function(event) {
        d3.select(this).attr("stroke", "#00D4FF").attr("stroke-width", 2);
        tooltip.style("opacity", 1)
          .html(`<strong>${features[i]}</strong> &times; <strong>${features[j]}</strong><br>Spearman r: <span style="font-family:monospace; font-weight:bold; color:${val > 0 ? '#FF2060' : '#00D4FF'}">${val.toFixed(3)}</span>`);
      })
      .on("mousemove", function(event) {
        tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
      })
      .on("mouseleave", function() {
        d3.select(this).attr("stroke", "rgba(0,0,0,0.2)").attr("stroke-width", 0.5);
        tooltip.style("opacity", 0);
      })
      .on("click", function() {
        if (onCellClick) onCellClick(features[i], features[j]);
      });
    }
  }

  // Row Labels (Y-Axis)
  g.selectAll(".row-label")
    .data(features)
    .enter()
    .append("text")
    .attr("x", -8)
    .attr("y", (d, i) => i * cellSize + cellSize / 2 + 3.5)
    .attr("text-anchor", "end")
    .attr("fill", "var(--text-main)")
    .attr("font-size", "9px")
    .attr("font-family", "var(--font-mono)")
    .attr("font-weight", "600")
    .text(d => d);

  // Column Labels (X-Axis, Angled)
  g.selectAll(".col-label")
    .data(features)
    .enter()
    .append("text")
    .attr("transform", (d, i) => `translate(${i * cellSize + cellSize / 2}, -10) rotate(-45)`)
    .attr("text-anchor", "start")
    .attr("fill", "var(--text-main)")
    .attr("font-size", "9px")
    .attr("font-family", "var(--font-mono)")
    .attr("font-weight", "600")
    .text(d => d);

  // Axis Title Notes
  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 20)
    .attr("font-size", "11px")
    .attr("font-weight", "800")
    .attr("fill", "var(--text-muted)")
    .text("Spearman Rank Correlation Matrix (21 Features × 21 Features)");

  // Colorbar Legend
  const legendW = 140;
  const legendH = 8;
  const legG = svg.append("g")
    .attr("transform", `translate(${size - margin.right - legendW}, 12)`);

  const defs = svg.append("defs");
  const legGrad = defs.append("linearGradient")
    .attr("id", "corr-legend-grad")
    .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
  legGrad.append("stop").attr("offset", "0%").attr("stop-color", "#0080FF");
  legGrad.append("stop").attr("offset", "50%").attr("stop-color", "#4A6080");
  legGrad.append("stop").attr("offset", "100%").attr("stop-color", "#FF2060");

  legG.append("rect")
    .attr("width", legendW)
    .attr("height", legendH)
    .attr("rx", 3)
    .attr("fill", "url(#corr-legend-grad)");

  legG.append("text").attr("x", 0).attr("y", 18).attr("font-size", "9px").attr("fill", "var(--text-muted)").attr("font-family", "var(--font-mono)").text("-1.0 (Inverse)");
  legG.append("text").attr("x", legendW / 2).attr("y", 18).attr("text-anchor", "middle").attr("font-size", "9px").attr("fill", "var(--text-muted)").attr("font-family", "var(--font-mono)").text("0.0");
  legG.append("text").attr("x", legendW).attr("y", 18).attr("text-anchor", "end").attr("font-size", "9px").attr("fill", "var(--text-muted)").attr("font-family", "var(--font-mono)").text("+1.0 (Co-occurs)");
}

