// Interactive ROC & Precision-Recall Curves with Axis Labels and Proper Declarations

export function renderRocPr(containerSelector, modelMetrics, selectedModel = "LightGBM", initialThreshold = 0.20, onThresholdChange = null) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  const modelData = modelMetrics[selectedModel];
  if (!modelData || !modelData.curves) return;

  const width = container.node().getBoundingClientRect().width || 680;
  const chartW = (width - 60) / 2;
  const height = 290;
  const margin = { top: 32, right: 16, bottom: 52, left: 52 };

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("overflow", "visible");

  // ===== DECLARE rocPts & prPts FIRST =====
  const rocPts = modelData.curves.roc_curve;
  const prPts  = modelData.curves.pr_curve;

  const innerW = chartW - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Area gradients
  const defs = svg.append("defs");
  const rocGrad = defs.append("linearGradient").attr("id", "roc-area-grad").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
  rocGrad.append("stop").attr("offset", "0%").attr("stop-color", "#00D4FF").attr("stop-opacity", 0.28);
  rocGrad.append("stop").attr("offset", "100%").attr("stop-color", "#00D4FF").attr("stop-opacity", 0.0);

  const prGrad = defs.append("linearGradient").attr("id", "pr-area-grad").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
  prGrad.append("stop").attr("offset", "0%").attr("stop-color", "#0080FF").attr("stop-opacity", 0.28);
  prGrad.append("stop").attr("offset", "100%").attr("stop-color", "#0080FF").attr("stop-opacity", 0.0);

  // ===== 1. ROC CURVE GROUP =====
  const gRoc = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

  const xRoc = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
  const yRoc = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

  // Line & area generators (declared AFTER scales)
  const rocLine = d3.line().x(d => xRoc(d.fpr)).y(d => yRoc(d.tpr)).curve(d3.curveCatmullRom.alpha(0.5));
  const rocArea = d3.area().x(d => xRoc(d.fpr)).y0(innerH).y1(d => yRoc(d.tpr)).curve(d3.curveCatmullRom.alpha(0.5));

  // Background
  gRoc.append("rect").attr("width", innerW).attr("height", innerH)
    .attr("fill", "var(--bg-surface-elevated)").attr("rx", 4).attr("opacity", 0.5);

  // Grid lines
  gRoc.append("g")
    .call(d3.axisLeft(yRoc).ticks(4).tickSize(-innerW).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line")
      .attr("stroke", "var(--border-subtle)").attr("stroke-dasharray", "3,3"));

  // Diagonal chance line
  gRoc.append("line")
    .attr("x1", 0).attr("y1", innerH).attr("x2", innerW).attr("y2", 0)
    .attr("stroke", "var(--border-color)").attr("stroke-dasharray", "4,4").attr("opacity", 0.6);

  // Area fill
  gRoc.append("path").datum(rocPts).attr("d", rocArea).attr("fill", "url(#roc-area-grad)");

  // Animated ROC curve
  const rocPath = gRoc.append("path")
    .datum(rocPts).attr("d", rocLine).attr("fill", "none")
    .attr("stroke", "#00D4FF").attr("stroke-width", 2.5)
    .style("filter", "drop-shadow(0 0 4px rgba(0,212,255,0.5))");

  const rocLen = rocPath.node().getTotalLength();
  rocPath.attr("stroke-dasharray", `${rocLen} ${rocLen}`)
    .attr("stroke-dashoffset", rocLen)
    .transition().duration(900).ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);

  // ROC Axes
  gRoc.append("g").attr("transform", `translate(0, ${innerH})`)
    .call(d3.axisBottom(xRoc).ticks(4).tickFormat(d3.format(".1f")))
    .call(g => g.select(".domain").attr("stroke", "var(--border-color)"))
    .call(g => g.selectAll(".tick text").attr("fill", "var(--text-muted)").attr("font-size", "10px"));

  gRoc.append("g").call(d3.axisLeft(yRoc).ticks(4).tickFormat(d3.format(".1f")))
    .call(g => g.select(".domain").attr("stroke", "var(--border-color)"))
    .call(g => g.selectAll(".tick text").attr("fill", "var(--text-muted)").attr("font-size", "10px"));

  // ROC Axis Labels
  gRoc.append("text").attr("x", innerW / 2).attr("y", innerH + 44)
    .attr("text-anchor", "middle").attr("font-size", "11px")
    .attr("fill", "var(--text-muted)").attr("font-weight", "600")
    .text("False Positive Rate (1 – Specificity)");

  gRoc.append("text").attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2).attr("y", -44)
    .attr("text-anchor", "middle").attr("font-size", "11px")
    .attr("fill", "var(--text-muted)").attr("font-weight", "600")
    .text("True Positive Rate (Sensitivity)");

  gRoc.append("text").attr("x", innerW / 2).attr("y", -14)
    .attr("text-anchor", "middle").attr("font-size", "12px")
    .attr("font-weight", "800").attr("fill", "var(--text-main)")
    .text(`ROC Curve · AUC = ${modelData.metrics.roc_auc.toFixed(3)}`);

  // ===== 2. PR CURVE GROUP =====
  const gPr = svg.append("g").attr("transform", `translate(${chartW + margin.left + 28}, ${margin.top})`);

  const xPr = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
  const yPr = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

  const prLine = d3.line().x(d => xPr(d.recall)).y(d => yPr(d.precision)).curve(d3.curveCatmullRom.alpha(0.5));
  const prArea = d3.area().x(d => xPr(d.recall)).y0(innerH).y1(d => yPr(d.precision)).curve(d3.curveCatmullRom.alpha(0.5));

  // Background
  gPr.append("rect").attr("width", innerW).attr("height", innerH)
    .attr("fill", "var(--bg-surface-elevated)").attr("rx", 4).attr("opacity", 0.5);

  // Grid lines
  gPr.append("g")
    .call(d3.axisLeft(yPr).ticks(4).tickSize(-innerW).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line")
      .attr("stroke", "var(--border-subtle)").attr("stroke-dasharray", "3,3"));

  gPr.append("path").datum(prPts).attr("d", prArea).attr("fill", "url(#pr-area-grad)");

  // Baseline prevalence line (9.4% disease rate in BRFSS)
  gPr.append("line")
    .attr("x1", 0).attr("y1", yPr(0.094)).attr("x2", innerW).attr("y2", yPr(0.094))
    .attr("stroke", "var(--accent-amber)").attr("stroke-dasharray", "4,3").attr("opacity", 0.6);
  gPr.append("text").attr("x", innerW - 4).attr("y", yPr(0.094) - 5)
    .attr("text-anchor", "end").attr("font-size", "9px").attr("fill", "var(--accent-amber)")
    .text("Baseline 9.4%");

  const prPath = gPr.append("path")
    .datum(prPts).attr("d", prLine).attr("fill", "none")
    .attr("stroke", "#0080FF").attr("stroke-width", 2.5)
    .style("filter", "drop-shadow(0 0 4px rgba(0,128,255,0.5))");

  const prLen = prPath.node().getTotalLength();
  prPath.attr("stroke-dasharray", `${prLen} ${prLen}`)
    .attr("stroke-dashoffset", prLen)
    .transition().duration(900).ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);

  // PR Axes
  gPr.append("g").attr("transform", `translate(0, ${innerH})`)
    .call(d3.axisBottom(xPr).ticks(4).tickFormat(d3.format(".1f")))
    .call(g => g.select(".domain").attr("stroke", "var(--border-color)"))
    .call(g => g.selectAll(".tick text").attr("fill", "var(--text-muted)").attr("font-size", "10px"));

  gPr.append("g").call(d3.axisLeft(yPr).ticks(4).tickFormat(d3.format(".1f")))
    .call(g => g.select(".domain").attr("stroke", "var(--border-color)"))
    .call(g => g.selectAll(".tick text").attr("fill", "var(--text-muted)").attr("font-size", "10px"));

  // PR Axis Labels
  gPr.append("text").attr("x", innerW / 2).attr("y", innerH + 44)
    .attr("text-anchor", "middle").attr("font-size", "11px")
    .attr("fill", "var(--text-muted)").attr("font-weight", "600")
    .text("Recall (True Positive Rate)");

  gPr.append("text").attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2).attr("y", -44)
    .attr("text-anchor", "middle").attr("font-size", "11px")
    .attr("fill", "var(--text-muted)").attr("font-weight", "600")
    .text("Precision (Positive Predictive Value)");

  gPr.append("text").attr("x", innerW / 2).attr("y", -14)
    .attr("text-anchor", "middle").attr("font-size", "12px")
    .attr("font-weight", "800").attr("fill", "var(--text-main)")
    .text(`PR Curve · PR-AUC = ${modelData.metrics.pr_auc.toFixed(3)}`);

  // ===== Threshold Operating Point Markers =====
  const nearestRoc = rocPts.reduce((prev, curr) =>
    Math.abs(curr.threshold - initialThreshold) < Math.abs(prev.threshold - initialThreshold) ? curr : prev, rocPts[0]);

  gRoc.append("circle")
    .attr("cx", xRoc(nearestRoc.fpr)).attr("cy", yRoc(nearestRoc.tpr))
    .attr("r", 6).attr("fill", "var(--risk-crit)").attr("stroke", "#FFF").attr("stroke-width", 2)
    .style("filter", "drop-shadow(0 0 6px rgba(255,23,68,0.75))");

  const nearestPr = prPts.reduce((prev, curr) =>
    Math.abs(curr.recall - nearestRoc.tpr) < Math.abs(prev.recall - nearestRoc.tpr) ? curr : prev, prPts[0]);

  gPr.append("circle")
    .attr("cx", xPr(nearestPr.recall)).attr("cy", yPr(nearestPr.precision))
    .attr("r", 6).attr("fill", "var(--risk-crit)").attr("stroke", "#FFF").attr("stroke-width", 2)
    .style("filter", "drop-shadow(0 0 6px rgba(255,23,68,0.75))");
}
