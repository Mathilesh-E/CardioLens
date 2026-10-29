// Interactive SHAP Beeswarm & Importance Component

export function renderBeeswarm(containerSelector, globalShapData) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  if (!globalShapData || !globalShapData.beeswarm) return;

  const topFeatures = globalShapData.sorted_features.slice(0, 10);
  const beeswarm = globalShapData.beeswarm;

  const margin = { top: 20, right: 30, bottom: 40, left: 130 };
  const rawW = container.node() ? container.node().getBoundingClientRect().width : 0;
  const width = Math.max(rawW - margin.left - margin.right, 480);
  const height = topFeatures.length * 36;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // Compute SHAP value range
  let maxAbsShap = 0.5;
  topFeatures.forEach(feat => {
    (beeswarm[feat] || []).forEach(pt => {
      maxAbsShap = Math.max(maxAbsShap, Math.abs(pt.shap));
    });
  });

  const xScale = d3.scaleLinear()
    .domain([-maxAbsShap * 1.1, maxAbsShap * 1.1])
    .range([0, width]);

  const yScale = d3.scaleBand()
    .domain(topFeatures)
    .range([0, height])
    .padding(0.2);

  // Zero axis line
  svg.append("line")
    .attr("x1", xScale(0)).attr("x2", xScale(0))
    .attr("y1", 0).attr("y2", height)
    .attr("stroke", "var(--border-color)")
    .attr("stroke-dasharray", "3,3");

  // Bottom Axis
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .attr("class", "mono")
    .attr("color", "var(--text-muted)");

  // Feature Labels on Y-axis
  topFeatures.forEach((feat, i) => {
    svg.append("text")
      .attr("x", -10)
      .attr("y", yScale(feat) + yScale.bandwidth() / 2 + 4)
      .attr("text-anchor", "end")
      .attr("fill", "var(--text-main)")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .text(feat);
  });

  // Color scale for normalized feature value: Low = Teal, High = Red/Coral
  const colorScale = d3.scaleSequential()
    .domain([0, 1])
    .interpolator(d3.interpolateRdYlBu); // Inverted below for High=Red, Low=Teal

  // Universal Beeswarm Tooltip
  let tooltip = d3.select("#beeswarm-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("id", "beeswarm-tooltip")
      .attr("class", "clinical-chart-tooltip")
      .style("display", "none");
  }

  // Plot sampled dots with slight jitter and staggered entrance animation
  topFeatures.forEach((feat, featIdx) => {
    const pts = beeswarm[feat] || [];
    const yCenter = yScale(feat) + yScale.bandwidth() / 2;

    svg.selectAll(`.dot-${feat}`)
      .data(pts.slice(0, 300))
      .enter()
      .append("circle")
      .attr("class", `dot-${feat}`)
      .attr("cx", xScale(0)) // start at center
      .attr("cy", yCenter)
      .attr("r", 0)
      .attr("fill", d => d3.interpolateRdYlBu(1.0 - d.norm_val))
      .attr("fill-opacity", 0.72)
      .style("cursor", "pointer")
      .on("mouseenter", function(event, d) {
        d3.select(this)
          .transition().duration(150)
          .attr("r", 5.5)
          .attr("fill-opacity", 1.0)
          .attr("stroke", "#FFFFFF")
          .attr("stroke-width", 1.5);

        tooltip.style("display", "block")
          .html(`
            <div style="font-weight:800; color:var(--text-main); margin-bottom:4px;">${feat}</div>
            <div style="display:flex; justify-content:space-between; gap:16px;"><span>Feature Value:</span> <strong>${d.val}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:16px;"><span>SHAP Impact:</span> <strong style="color:${d.shap > 0 ? 'var(--risk-crit)' : 'var(--risk-low)'};">${d.shap > 0 ? "+" : ""}${d.shap.toFixed(4)}</strong></div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">${d.shap > 0 ? "Increases Heart Risk" : "Protective Factor"}</div>
          `);
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", `${event.pageX + 14}px`)
          .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseleave", function() {
        d3.select(this)
          .transition().duration(200)
          .attr("r", 2.6)
          .attr("fill-opacity", 0.72)
          .attr("stroke", "none");

        tooltip.style("display", "none");
      })
      .transition()
      .delay((d, idx) => featIdx * 40 + (idx % 25) * 12)
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr("cx", d => xScale(d.shap))
      .attr("cy", (d, idx) => {
        const jitter = ((idx % 7) - 3) * 2.2;
        return yCenter + jitter;
      })
      .attr("r", 2.6);
  });
}
