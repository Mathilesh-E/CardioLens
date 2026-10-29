// PulseIQ: Ultra-Vibrant Calibrated Radial Risk Gauge
// Features Multi-Color Gradient Arc, Dynamic Needle, and Uncertainty Band

export function renderRiskGauge(containerSelector, prediction) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  const width = 280;
  const height = 195;
  const margin = 12;
  const radius = Math.min(width, height * 2) / 2 - margin;

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("class", "gauge-svg")
    .style("filter", "drop-shadow(0 6px 16px rgba(0,0,0,0.5))");

  const defs = svg.append("defs");

  // Rainbow Gauge Arc Gradient
  const gradArc = defs.append("linearGradient")
    .attr("id", "gauge-gradient-vibrant")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "100%").attr("y2", "0%");
  gradArc.append("stop").attr("offset", "0%").attr("stop-color", "#00E5A0");   // Optimal green
  gradArc.append("stop").attr("offset", "25%").attr("stop-color", "#00D4FF");  // Moderate cyan
  gradArc.append("stop").attr("offset", "55%").attr("stop-color", "#FFBA08");  // Elevated amber
  gradArc.append("stop").attr("offset", "100%").attr("stop-color", "#FF3050"); // Critical crimson

  const g = svg.append("g")
    .attr("transform", `translate(${width / 2}, ${height - 25})`);

  const startAngle = -Math.PI / 2;
  const endAngle = Math.PI / 2;

  // Background track
  const arcBg = d3.arc()
    .innerRadius(radius - 24)
    .outerRadius(radius)
    .startAngle(startAngle)
    .endAngle(endAngle)
    .cornerRadius(8);

  g.append("path")
    .attr("d", arcBg)
    .attr("fill", "var(--bg-surface-elevated)")
    .attr("stroke", "var(--border-subtle)")
    .attr("stroke-width", 1);

  // Uncertainty band (5th to 95th percentile)
  if (prediction && prediction.uncertainty_band) {
    const ciLow = prediction.uncertainty_band[0] / 100.0;
    const ciHigh = prediction.uncertainty_band[1] / 100.0;
    const bandStart = startAngle + ciLow * Math.PI;
    const bandEnd = startAngle + ciHigh * Math.PI;

    const arcBand = d3.arc()
      .innerRadius(radius - 30)
      .outerRadius(radius + 6)
      .startAngle(bandStart)
      .endAngle(bandEnd)
      .cornerRadius(5);

    g.append("path")
      .attr("d", arcBand)
      .attr("fill", "#00D4FF")
      .attr("opacity", 0.22)
      .style("filter", "drop-shadow(0 0 8px #00D4FF)");
  }

  // Active colorful risk arc
  const risk = prediction ? prediction.calibrated_risk : 0.094;
  const targetAngle = startAngle + Math.min(1.0, Math.max(0.0, risk)) * Math.PI;

  const arcValue = d3.arc()
    .innerRadius(radius - 24)
    .outerRadius(radius)
    .startAngle(startAngle)
    .cornerRadius(8);

  const valuePath = g.append("path")
    .datum({ endAngle: startAngle })
    .attr("fill", "url(#gauge-gradient-vibrant)")
    .attr("d", arcValue)
    .style("filter", "drop-shadow(0 0 10px rgba(6, 182, 212, 0.5))");

  valuePath.transition()
    .duration(500)
    .ease(d3.easeCubicOut)
    .attrTween("d", function(d) {
      const interpolate = d3.interpolate(d.endAngle, targetAngle);
      return function(t) {
        d.endAngle = interpolate(t);
        return arcValue(d);
      };
    });

  // Decision Threshold marker line (0.20)
  if (prediction && prediction.threshold) {
    const thAngle = startAngle + prediction.threshold * Math.PI;
    const x1 = (radius - 32) * Math.cos(thAngle - Math.PI / 2);
    const y1 = (radius - 32) * Math.sin(thAngle - Math.PI / 2);
    const x2 = (radius + 8) * Math.cos(thAngle - Math.PI / 2);
    const y2 = (radius + 8) * Math.sin(thAngle - Math.PI / 2);

    g.append("line")
      .attr("x1", x1).attr("y1", y1)
      .attr("x2", x2).attr("y2", y2)
      .attr("stroke", "#FF3050")
      .attr("stroke-width", 3)
      .attr("stroke-dasharray", "3,2")
      .style("filter", "drop-shadow(0 0 4px #FF3050)");

    g.append("text")
      .attr("x", x2 + (thAngle > 0 ? 8 : -8))
      .attr("y", y2 - 2)
      .attr("fill", "#FF3050")
      .attr("font-size", "10px")
      .attr("font-weight", "800")
      .attr("letter-spacing", "0.04em")
      .attr("text-anchor", "middle")
      .text("THRESHOLD");
  }

  // Animated Pointer Needle
  const needleGroup = g.append("g");
  const needleAngle = targetAngle * (180 / Math.PI) + 90;

  const needle = needleGroup.append("polygon")
    .attr("points", `-4,0 4,0 1,-${radius - 14} -1,-${radius - 14}`)
    .attr("fill", "var(--text-main)")
    .style("filter", "drop-shadow(0 0 6px #00D4FF)")
    .attr("transform", `rotate(${needleAngle})`);

  // Center Hub
  needleGroup.append("circle")
    .attr("r", 9)
    .attr("fill", "var(--bg-surface-elevated)")
    .attr("stroke", "#00D4FF")
    .attr("stroke-width", 3);

  needleGroup.append("circle")
    .attr("r", 4)
    .attr("fill", "#00D4FF");

  // Center Large Value Display
  const textGroup = g.append("g")
    .attr("transform", "translate(0, -22)");

  const pct = prediction ? (prediction.risk_percentage).toFixed(1) : "9.4";
  textGroup.append("text")
    .attr("text-anchor", "middle")
    .attr("class", "font-display mono")
    .attr("fill", "var(--text-main)")
    .attr("font-size", "38px")
    .attr("font-weight", "800")
    .text(`${pct}%`);

  const band = prediction ? prediction.risk_band.toUpperCase() : "POPULATION AVERAGE";
  const bColor = prediction ? prediction.band_color : "#00D4FF";

  textGroup.append("text")
    .attr("y", 22)
    .attr("text-anchor", "middle")
    .attr("fill", bColor)
    .attr("font-size", "12px")
    .attr("font-weight", "800")
    .attr("letter-spacing", "0.08em")
    .text(`${band} RISK`);
}

