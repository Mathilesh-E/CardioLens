// Sensitivity & ICE Curve with Interactive Draggable Marker

export function renderSensitivity(containerSelector, whatIfData, onMarkerDrag) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  if (!whatIfData || !whatIfData.curve) return;

  const margin = { top: 12, right: 24, bottom: 44, left: 46 };
  const rawW = container.node() ? container.node().getBoundingClientRect().width : 0;
  const width = Math.max(rawW - margin.left - margin.right, 340);
  const height = 230 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const curve = whatIfData.curve;
  const xDomain = d3.extent(curve, d => d.val);
  const maxRisk = Math.max(40, d3.max(curve, d => d.risk_pct) * 1.25);

  const xScale = d3.scaleLinear().domain(xDomain).range([0, width]);
  const yScale = d3.scaleLinear().domain([0, maxRisk]).range([height, 0]);

  // Grid
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).ticks(5).tickSize(-height).tickFormat(""))
    .attr("stroke", "var(--border-color)")
    .attr("stroke-opacity", 0.4)
    .select(".domain").remove();

  // Bottom Axis
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .attr("class", "mono")
    .attr("color", "var(--text-muted)");

  // Left Axis
  svg.append("g")
    .call(d3.axisLeft(yScale).ticks(4).tickFormat(d => `${d}%`))
    .attr("class", "mono")
    .attr("color", "var(--text-muted)");

  const lineGen = d3.line()
    .x(d => xScale(d.val))
    .y(d => yScale(d.risk_pct))
    .curve(d3.curveMonotoneX);

  // Background ICE curves of real sampled people
  if (whatIfData.ice_background) {
    whatIfData.ice_background.forEach(pts => {
      svg.append("path")
        .datum(pts)
        .attr("d", lineGen)
        .attr("fill", "none")
        .attr("stroke", "var(--text-muted)")
        .attr("stroke-opacity", 0.12)
        .attr("stroke-width", 1.2);
    });
  }

  // Defs for gradient area
  const defs = svg.append("defs");
  const areaGrad = defs.append("linearGradient")
    .attr("id", "sens-area-grad")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");
  areaGrad.append("stop").attr("offset", "0%").attr("stop-color", "var(--primary-deep)").attr("stop-opacity", 0.28);
  areaGrad.append("stop").attr("offset", "100%").attr("stop-color", "var(--primary-deep)").attr("stop-opacity", 0.0);

  const areaGen = d3.area()
    .x(d => xScale(d.val))
    .y0(height)
    .y1(d => yScale(d.risk_pct))
    .curve(d3.curveMonotoneX);

  svg.append("path")
    .datum(curve)
    .attr("d", areaGen)
    .attr("fill", "url(#sens-area-grad)");

  // Active Individual's Sensitivity Curve
  svg.append("path")
    .datum(curve)
    .attr("d", lineGen)
    .attr("fill", "none")
    .attr("stroke", "var(--primary-deep)")
    .attr("stroke-width", 3.2)
    .style("filter", "drop-shadow(0 0 8px rgba(0, 212, 255, 0.5))");

  // Current value marker
  const currVal = parseFloat(whatIfData.current_val);
  const closestPt = curve.reduce((prev, curr) => 
    Math.abs(curr.val - currVal) < Math.abs(prev.val - currVal) ? curr : prev, curve[0]);

  const marker = svg.append("circle")
    .attr("cx", xScale(closestPt.val))
    .attr("cy", yScale(closestPt.risk_pct))
    .attr("r", 6)
    .attr("fill", "var(--risk-high)")
    .attr("stroke", "#FFF")
    .attr("stroke-width", 2)
    .style("cursor", "ew-resize");

  // 20% Clinical Risk Alert Threshold benchmark line
  svg.append("line")
    .attr("x1", 0).attr("x2", width)
    .attr("y1", yScale(20)).attr("y2", yScale(20))
    .attr("stroke", "var(--risk-crit)")
    .attr("stroke-dasharray", "4,4")
    .attr("stroke-opacity", 0.65)
    .attr("stroke-width", 1.2);

  svg.append("text")
    .attr("x", width - 4)
    .attr("y", yScale(20) - 4)
    .attr("text-anchor", "end")
    .attr("font-size", "9px")
    .attr("font-weight", "800")
    .attr("fill", "var(--risk-crit)")
    .text("20% High-Risk Threshold");

  // Bottom Axis Label (Feature Value)
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 36)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("font-weight", "700")
    .attr("fill", "var(--text-muted)")
    .text(`${whatIfData.feature} Value →`);

  // Left Axis Label (Predicted 10-Yr Cardiovascular Risk %)
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -32)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("font-weight", "700")
    .attr("fill", "var(--text-muted)")
    .text("↑ Predicted Risk (%)");

  // Drag interaction
  const drag = d3.drag()
    .on("drag", function(event) {
      const draggedX = Math.max(0, Math.min(width, event.x));
      const val = xScale.invert(draggedX);
      const nearest = curve.reduce((prev, curr) => 
        Math.abs(curr.val - val) < Math.abs(prev.val - val) ? curr : prev, curve[0]);
      
      marker
        .attr("cx", xScale(nearest.val))
        .attr("cy", yScale(nearest.risk_pct));
      
      if (onMarkerDrag) {
        onMarkerDrag(whatIfData.feature, nearest.val);
      }
    });

  marker.call(drag);
}
