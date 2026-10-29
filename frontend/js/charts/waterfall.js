// Interactive Live SHAP Waterfall Chart

export function renderWaterfall(containerSelector, prediction, audienceMode = "plain") {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  if (!prediction || !prediction.contributions) return;

  const topN = 9;
  const topContributions = prediction.contributions.slice(0, topN);
  
  // Calculate remaining "Other features"
  const otherShap = prediction.contributions.slice(topN).reduce((acc, c) => acc + c.shap_logodds, 0);
  const items = [...topContributions];
  if (Math.abs(otherShap) > 0.001) {
    items.push({
      feature: "Other",
      label: "Other Factors Combined",
      shap_logodds: otherShap,
      pct_points: (otherShap * (prediction.calibrated_risk * (1 - prediction.calibrated_risk)) * 100).toFixed(2),
      direction: otherShap > 0 ? "increase" : "decrease"
    });
  }

  const margin = { top: 20, right: 30, bottom: 40, left: 195 };
  const rawW = container.node() ? container.node().getBoundingClientRect().width : 0;
  const width = Math.max(rawW - margin.left - margin.right, 380);
  const height = (items.length + 2) * 28;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // Compute running totals for waterfall steps
  let running = prediction.base_value_logodds || -1.83;
  const steps = [
    {
      name: "Base Rate",
      label: "Baseline Risk (Population)",
      start: 0,
      end: running,
      val: running,
      isTotal: true
    }
  ];

  items.forEach(item => {
    const start = running;
    const end = running + item.shap_logodds;
    running = end;
    steps.push({
      name: item.feature,
      label: item.label,
      start: Math.min(start, end),
      end: Math.max(start, end),
      val: item.shap_logodds,
      pct: item.pct_points,
      direction: item.direction,
      isTotal: false
    });
  });

  steps.push({
    name: "Final",
    label: "Final Prediction",
    start: 0,
    end: running,
    val: running,
    isTotal: true
  });

  // Scales
  const minVal = d3.min(steps, d => Math.min(d.start, d.end, 0));
  const maxVal = d3.max(steps, d => Math.max(d.start, d.end));
  const padding = (maxVal - minVal) * 0.1 || 0.5;

  const xScale = d3.scaleLinear()
    .domain([minVal - padding, maxVal + padding])
    .range([0, width]);

  const yScale = d3.scaleBand()
    .domain(steps.map((_, i) => i))
    .range([0, height])
    .padding(0.25);

  // Zero axis line
  svg.append("line")
    .attr("x1", xScale(0))
    .attr("x2", xScale(0))
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "var(--border-color)")
    .attr("stroke-dasharray", "3,3");

  // Grid lines
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).ticks(5).tickSize(-height).tickFormat(""))
    .attr("stroke", "var(--border-color)")
    .attr("stroke-opacity", 0.3)
    .select(".domain").remove();

  // Bottom Axis
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .attr("class", "mono")
    .attr("color", "var(--text-muted)");

  // Bars
  const bars = svg.selectAll(".waterfall-bar")
    .data(steps)
    .enter()
    .append("g")
    .attr("class", "waterfall-bar");

  bars.append("rect")
    .attr("y", (_, i) => yScale(i))
    .attr("height", yScale.bandwidth())
    .attr("rx", 4)
    .attr("x", d => xScale(d.start))
    .attr("width", 0)
    .attr("fill", d => {
      if (d.isTotal) return "var(--primary-deep)";
      return d.direction === "increase" ? "var(--risk-high)" : "var(--risk-low)";
    })
    .style("filter", d => {
      if (d.isTotal) return "drop-shadow(0 2px 6px rgba(0, 242, 254, 0.4))";
      return d.direction === "increase" ? "drop-shadow(0 2px 6px rgba(255, 94, 54, 0.4))" : "drop-shadow(0 2px 6px rgba(0, 245, 160, 0.4))";
    })
    .transition()
    .duration(450)
    .attr("width", d => Math.max(3, xScale(d.end) - xScale(d.start)));

  // Labels on Y-axis
  bars.append("text")
    .attr("x", -10)
    .attr("y", (_, i) => yScale(i) + yScale.bandwidth() / 2 + 4)
    .attr("text-anchor", "end")
    .attr("fill", "var(--text-main)")
    .attr("font-size", "11px")
    .attr("font-weight", d => d.isTotal ? "800" : "600")
    .text(d => d.label.length > 30 ? d.label.substring(0, 28) + "…" : d.label);

  // Value text on bar
  bars.append("text")
    .attr("x", d => d.val >= 0 ? xScale(d.end) + 6 : xScale(d.start) - 6)
    .attr("y", (_, i) => yScale(i) + yScale.bandwidth() / 2 + 4)
    .attr("text-anchor", d => d.val >= 0 ? "start" : "end")
    .attr("class", "mono")
    .attr("font-size", "10px")
    .attr("fill", "var(--text-muted)")
    .text(d => {
      if (audienceMode === "technical") {
        return d.isTotal ? `${d.val.toFixed(2)} log-odds` : `${d.val > 0 ? "+" : ""}${d.val.toFixed(3)}`;
      } else {
        if (d.isTotal) return `${(prediction.risk_percentage).toFixed(1)}%`;
        return `${d.val > 0 ? "+" : ""}${d.pct}% pts`;
      }
    });
}
