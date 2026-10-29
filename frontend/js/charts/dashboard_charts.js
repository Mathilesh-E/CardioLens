// PulseIQ: Ultra-Colorful High-Detail D3 Visualizations
// Rich Aesthetics, Glowing Gradients, and Smooth Micro-Animations

export function renderRiskDistribution(containerSelector, histogramData, cohortMean, popMean) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.innerHTML = "";

  const margin = { top: 35, right: 30, bottom: 45, left: 50 };
  const width = Math.max(container.clientWidth || 0, 480);
  const height = 260;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height)
    .style("overflow", "visible");

  // Defs: Glowing Gradients & Filters
  const defs = svg.append("defs");
  
  // Cohort Gradient: Cyan to Electric Indigo
  const gradCohort = defs.append("linearGradient")
    .attr("id", "grad-cohort-vibrant")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");
  gradCohort.append("stop").attr("offset", "0%").attr("stop-color", "#00D4FF");
  gradCohort.append("stop").attr("offset", "100%").attr("stop-color", "#0080FF");

  // National Baseline Gradient: Violet Slate
  const gradPop = defs.append("linearGradient")
    .attr("id", "grad-pop-vibrant")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");
  gradPop.append("stop").attr("offset", "0%").attr("stop-color", "rgba(139, 92, 246, 0.45)");
  gradPop.append("stop").attr("offset", "100%").attr("stop-color", "rgba(99, 102, 241, 0.2)");

  // Glow Filter
  const filter = defs.append("filter")
    .attr("id", "glow-cyan")
    .attr("x", "-20%").attr("y", "-20%")
    .attr("width", "140%").attr("height", "140%");
  filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
  filter.append("feComposite").attr("in", "SourceGraphic").attr("in2", "blur").attr("operator", "over");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand()
    .domain(histogramData.map(d => d.bin))
    .range([0, innerW])
    .padding(0.24);

  const xSub = d3.scaleBand()
    .domain(["cohort_pct", "pop_pct"])
    .range([0, x0.bandwidth()])
    .padding(0.06);

  const maxPct = Math.max(
    d3.max(histogramData, d => Math.max(d.cohort_pct, d.pop_pct)) || 50,
    10
  );

  const y = d3.scaleLinear()
    .domain([0, maxPct * 1.2])
    .range([innerH, 0]);

  // Horizontal Glowing Gridlines
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line")
      .attr("stroke", "var(--border-subtle)")
      .attr("stroke-dasharray", "4,4"));

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x0))
    .call(g => g.select(".domain").attr("stroke", "var(--border-color)"))
    .call(g => g.selectAll(".tick text")
      .attr("fill", "var(--text-muted)")
      .attr("font-size", "11px")
      .attr("font-weight", "600"));

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick text")
      .attr("fill", "var(--text-muted)")
      .attr("font-size", "11px"));

  // Bin Groups
  const binGroups = g.selectAll(".bin-group")
    .data(histogramData)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x0(d.bin)},0)`);

  // Cohort Bars
  binGroups.append("rect")
    .attr("x", xSub("cohort_pct"))
    .attr("y", d => y(d.cohort_pct))
    .attr("width", xSub.bandwidth())
    .attr("height", d => innerH - y(d.cohort_pct))
    .attr("rx", 5)
    .attr("fill", "url(#grad-cohort-vibrant)")
    .attr("stroke", "#00D4FF")
    .attr("stroke-width", 1.2)
    .style("filter", "url(#glow-cyan)")
    .style("cursor", "pointer");

  // National Population Bars
  binGroups.append("rect")
    .attr("x", xSub("pop_pct"))
    .attr("y", d => y(d.pop_pct))
    .attr("width", xSub.bandwidth())
    .attr("height", d => innerH - y(d.pop_pct))
    .attr("rx", 5)
    .attr("fill", "url(#grad-pop-vibrant)")
    .attr("stroke", "rgba(139, 92, 246, 0.5)")
    .attr("stroke-width", 1)
    .style("cursor", "pointer");

  // Cohort Value Badges
  binGroups.append("text")
    .attr("x", xSub("cohort_pct") + xSub.bandwidth() / 2)
    .attr("y", d => y(d.cohort_pct) - 6)
    .attr("text-anchor", "middle")
    .attr("fill", "#00D4FF")
    .attr("font-size", "10px")
    .attr("font-weight", "800")
    .text(d => d.cohort_pct > 1 ? `${d.cohort_pct}%` : "");

  // Density Curve Spline Overlay (Catmull-Rom)
  const lineGenerator = d3.line()
    .x(d => x0(d.bin) + xSub("cohort_pct") + xSub.bandwidth() / 2)
    .y(d => y(d.cohort_pct))
    .curve(d3.curveCatmullRom.alpha(0.5));

  g.append("path")
    .datum(histogramData)
    .attr("fill", "none")
    .attr("stroke", "#FF2060")
    .attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "4,3")
    .attr("d", lineGenerator);

  // Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${margin.left}, 12)`);

  legend.append("rect")
    .attr("width", 12).attr("height", 12).attr("rx", 3)
    .attr("fill", "url(#grad-cohort-vibrant)")
    .attr("stroke", "#00D4FF");
  legend.append("text")
    .attr("x", 18).attr("y", 10)
    .attr("fill", "var(--text-main)").attr("font-size", "11px").attr("font-weight", "700")
    .text(`Filtered Cohort (Mean: ${cohortMean}%)`);

  legend.append("rect")
    .attr("x", 195).attr("width", 12).attr("height", 12).attr("rx", 3)
    .attr("fill", "url(#grad-pop-vibrant)")
    .attr("stroke", "rgba(139, 92, 246, 0.6)");
  legend.append("text")
    .attr("x", 213).attr("y", 10)
    .attr("fill", "var(--text-muted)").attr("font-size", "11px")
    .text(`National Baseline (Mean: ${popMean}%)`);

  legend.append("line")
    .attr("x1", 380).attr("x2", 400)
    .attr("y1", 6).attr("y2", 6)
    .attr("stroke", "#FF2060").attr("stroke-width", 2.5).attr("stroke-dasharray", "3,2");
  legend.append("text")
    .attr("x", 406).attr("y", 10)
    .attr("fill", "#FF2060").attr("font-size", "11px").attr("font-weight", "600")
    .text("Density Spline");
}

export function renderAgeStratification(containerSelector, ageData) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.innerHTML = "";

  if (!ageData || ageData.length === 0) {
    container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">No records in selected cohort for age breakdown.</div>`;
    return;
  }

  const margin = { top: 35, right: 25, bottom: 45, left: 50 };
  const width = Math.max(container.clientWidth || 0, 480);
  const height = 260;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const defs = svg.append("defs");

  // Flame Red/Rose Gradient for Observed Rate
  const gradObs = defs.append("linearGradient")
    .attr("id", "grad-obs-flame")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");
  gradObs.append("stop").attr("offset", "0%").attr("stop-color", "#FF416C");
  gradObs.append("stop").attr("offset", "100%").attr("stop-color", "#FF4B2B");

  // Glowing Emerald Gradient for Model Risk
  const gradModel = defs.append("linearGradient")
    .attr("id", "grad-model-emerald")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");
  gradModel.append("stop").attr("offset", "0%").attr("stop-color", "#00D4FF");
  gradModel.append("stop").attr("offset", "100%").attr("stop-color", "#00E5A0");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand()
    .domain(ageData.map(d => d.bracket))
    .range([0, innerW])
    .padding(0.26);

  const xSub = d3.scaleBand()
    .domain(["observed_rate_pct", "model_risk_pct"])
    .range([0, x0.bandwidth()])
    .padding(0.06);

  const maxVal = Math.max(
    d3.max(ageData, d => Math.max(d.observed_rate_pct, d.model_risk_pct)) || 40,
    15
  );

  const y = d3.scaleLinear()
    .domain([0, maxVal * 1.25])
    .range([innerH, 0]);

  // Grid
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line")
      .attr("stroke", "var(--border-subtle)")
      .attr("stroke-dasharray", "4,4"));

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x0))
    .call(g => g.select(".domain").attr("stroke", "var(--border-color)"))
    .call(g => g.selectAll(".tick text")
      .attr("fill", "var(--text-muted)")
      .attr("font-size", "11px")
      .attr("font-weight", "600"));

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick text").attr("fill", "var(--text-muted)").attr("font-size", "11px"));

  const groups = g.selectAll(".age-group")
    .data(ageData)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x0(d.bracket)},0)`);

  // Observed Bar
  groups.append("rect")
    .attr("x", xSub("observed_rate_pct"))
    .attr("y", d => y(d.observed_rate_pct))
    .attr("width", xSub.bandwidth())
    .attr("height", d => innerH - y(d.observed_rate_pct))
    .attr("rx", 5)
    .attr("fill", "url(#grad-obs-flame)")
    .attr("stroke", "#FF416C")
    .attr("stroke-width", 1)
    .style("filter", "drop-shadow(0 2px 8px rgba(255, 65, 108, 0.4))");

  // Model Risk Bar
  groups.append("rect")
    .attr("x", xSub("model_risk_pct"))
    .attr("y", d => y(d.model_risk_pct))
    .attr("width", xSub.bandwidth())
    .attr("height", d => innerH - y(d.model_risk_pct))
    .attr("rx", 5)
    .attr("fill", "url(#grad-model-emerald)")
    .attr("stroke", "#00E5A0")
    .attr("stroke-width", 1)
    .style("filter", "drop-shadow(0 2px 8px rgba(16, 185, 129, 0.4))");

  // Labels
  groups.append("text")
    .attr("x", xSub("observed_rate_pct") + xSub.bandwidth() / 2)
    .attr("y", d => y(d.observed_rate_pct) - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#FF4B2B")
    .attr("font-size", "10px")
    .attr("font-weight", "800")
    .text(d => `${d.observed_rate_pct}%`);

  groups.append("text")
    .attr("x", xSub("model_risk_pct") + xSub.bandwidth() / 2)
    .attr("y", d => y(d.model_risk_pct) - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#00E5A0")
    .attr("font-size", "10px")
    .attr("font-weight", "800")
    .text(d => `${d.model_risk_pct}%`);

  // Legend
  const legend = svg.append("g").attr("transform", `translate(${margin.left}, 12)`);
  legend.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", "url(#grad-obs-flame)");
  legend.append("text").attr("x", 18).attr("y", 10).attr("fill", "var(--text-main)").attr("font-size", "11px").attr("font-weight", "700").text("Observed Event Rate (CDC)");
  legend.append("rect").attr("x", 195).attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", "url(#grad-model-emerald)");
  legend.append("text").attr("x", 213).attr("y", 10).attr("fill", "var(--text-main)").attr("font-size", "11px").attr("font-weight", "700").text("Calibrated AI Model Risk");
}

export function renderComorbidityDonut(containerSelector, comorbidityData) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.innerHTML = "";

  const width = Math.max(container.clientWidth || 0, 360);
  const height = 260;
  const radius = Math.min(width, height) / 2 - 25;

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${width / 2 - 35},${height / 2})`);

  const colors = [
    "#00E5A0", // 0 factors: Emerald Green
    "#00D4FF", // 1 factor: Vivid Cyan
    "#8B5CF6", // 2 factors: Electric Violet
    "#FFBA08", // 3 factors: Amber Gold
    "#FF3050"  // 4+ factors: Radiant Red
  ];

  const pie = d3.pie()
    .value(d => d.count)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(radius * 0.55)
    .outerRadius(radius * 0.95)
    .cornerRadius(5)
    .padAngle(0.04);

  const arcs = g.selectAll(".arc")
    .data(pie(comorbidityData))
    .enter()
    .append("g")
    .attr("class", "arc");

  arcs.append("path")
    .attr("d", arc)
    .attr("fill", (d, i) => colors[i % colors.length])
    .attr("stroke", "rgba(10, 16, 30, 0.9)")
    .attr("stroke-width", 2.5)
    .style("filter", (d, i) => `drop-shadow(0 2px 6px ${colors[i % colors.length]}55)`)
    .style("transition", "all 0.25s ease")
    .on("mouseenter", function() {
      d3.select(this)
        .transition().duration(200)
        .attr("transform", "scale(1.06)")
        .style("filter", "brightness(1.3)");
    })
    .on("mouseleave", function() {
      d3.select(this)
        .transition().duration(200)
        .attr("transform", "scale(1)")
        .style("filter", "none");
    });

  // Center Animated Badge
  g.append("circle")
    .attr("r", radius * 0.48)
    .attr("fill", "rgba(14, 22, 38, 0.95)")
    .attr("stroke", "rgba(255, 255, 255, 0.1)")
    .attr("stroke-width", 1.5);

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("y", -6)
    .attr("fill", "var(--text-main)")
    .attr("font-size", "14px")
    .attr("font-weight", "800")
    .text("Cardio Load");

  const totalPts = d3.sum(comorbidityData, d => d.count);
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("y", 15)
    .attr("fill", "#00D4FF")
    .attr("font-size", "12px")
    .attr("font-weight", "700")
    .text(`${totalPts.toLocaleString()} pts`);

  // Side Legend
  const legendG = svg.append("g")
    .attr("transform", `translate(${width - 110}, 45)`);

  comorbidityData.forEach((d, i) => {
    const row = legendG.append("g").attr("transform", `translate(0, ${i * 28})`);
    row.append("rect")
      .attr("width", 10).attr("height", 10).attr("rx", 3)
      .attr("fill", colors[i % colors.length]);
    row.append("text")
      .attr("x", 16).attr("y", 9)
      .attr("fill", "var(--text-main)")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .text(`${d.factors}: ${d.pct}%`);
  });
}

export function renderCohortTornado(containerSelector, shapList) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.innerHTML = "";

  if (!shapList || shapList.length === 0) return;

  const top6 = shapList.slice(0, 6).map(d => ({
    ...d,
    cleanLabel: (d.label || d.feature || "")
      .replace(" Bracket", "")
      .replace(" / Climbing Stairs", "")
      .replace(" Rating", "")
      .replace(" Diagnosis", "")
  }));
  const margin = { top: 32, right: 50, bottom: 20, left: 190 };
  const width = Math.max(container.clientWidth || 0, 580);
  const height = 260;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const defs = svg.append("defs");

  // Positive Risk Gradient: Coral to Crimson
  const gradPos = defs.append("linearGradient")
    .attr("id", "grad-shap-pos")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "100%").attr("y2", "0%");
  gradPos.append("stop").attr("offset", "0%").attr("stop-color", "#FF2060");
  gradPos.append("stop").attr("offset", "100%").attr("stop-color", "#E11D48");

  // Negative Protective Gradient: Mint to Cyan
  const gradNeg = defs.append("linearGradient")
    .attr("id", "grad-shap-neg")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "100%").attr("y2", "0%");
  gradNeg.append("stop").attr("offset", "0%").attr("stop-color", "#00E5A0");
  gradNeg.append("stop").attr("offset", "100%").attr("stop-color", "#00D4FF");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const maxVal = d3.max(top6, d => Math.max(Math.abs(d.cohort_shap), Math.abs(d.overall_shap))) || 0.05;

  const x = d3.scaleLinear()
    .domain([-maxVal * 1.15, maxVal * 1.15])
    .range([0, innerW]);

  const y = d3.scaleBand()
    .domain(top6.map(d => d.cleanLabel))
    .range([0, innerH])
    .padding(0.32);

  // Baseline line at 0
  g.append("line")
    .attr("x1", x(0)).attr("x2", x(0))
    .attr("y1", 0).attr("y2", innerH)
    .attr("stroke", "var(--border-color)")
    .attr("stroke-width", 1.5);

  const rows = g.selectAll(".tornado-row")
    .data(top6)
    .enter()
    .append("g")
    .attr("transform", d => `translate(0,${y(d.cleanLabel)})`);

  // Cohort SHAP Bar
  rows.append("rect")
    .attr("x", d => x(Math.min(0, d.cohort_shap)))
    .attr("y", 0)
    .attr("width", d => Math.abs(x(d.cohort_shap) - x(0)))
    .attr("height", y.bandwidth())
    .attr("rx", 4)
    .attr("fill", d => d.cohort_shap > 0 ? "url(#grad-shap-pos)" : "url(#grad-shap-neg)")
    .style("filter", d => d.cohort_shap > 0 ? "drop-shadow(0 2px 6px rgba(244, 63, 94, 0.4))" : "drop-shadow(0 2px 6px rgba(16, 185, 129, 0.4))");

  // National Overall Tick Marker
  rows.append("line")
    .attr("x1", d => x(d.overall_shap))
    .attr("x2", d => x(d.overall_shap))
    .attr("y1", -3)
    .attr("y2", y.bandwidth() + 3)
    .attr("stroke", "#FFBA08")
    .attr("stroke-width", 3);

  // Numerical Value Badge
  rows.append("text")
    .attr("x", d => x(d.cohort_shap) + (d.cohort_shap >= 0 ? 8 : -8))
    .attr("y", y.bandwidth() / 2 + 4)
    .attr("text-anchor", d => d.cohort_shap >= 0 ? "start" : "end")
    .attr("fill", "var(--text-main)")
    .attr("font-size", "11px")
    .attr("font-weight", "800")
    .text(d => `${d.cohort_shap > 0 ? "+" : ""}${d.cohort_shap}`);

  // Labels on Y Axis
  g.append("g")
    .call(d3.axisLeft(y).tickSize(0))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick text")
      .attr("fill", "var(--text-main)")
      .attr("font-size", "12px")
      .attr("font-weight", "600"));

  // Legend
  const legend = svg.append("g").attr("transform", `translate(${margin.left}, 8)`);
  legend.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", "#FF2060");
  legend.append("text").attr("x", 15).attr("y", 9).attr("fill", "var(--text-main)").attr("font-size", "11px").text("Risk Increasing Factor");
  legend.append("rect").attr("x", 160).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", "#00E5A0");
  legend.append("text").attr("x", 175).attr("y", 9).attr("fill", "var(--text-main)").attr("font-size", "11px").text("Protective Factor");
  legend.append("line").attr("x1", 305).attr("x2", 318).attr("y1", 5).attr("y2", 5).attr("stroke", "#FFBA08").attr("stroke-width", 3);
  legend.append("text").attr("x", 325).attr("y", 9).attr("fill", "#FFBA08").attr("font-size", "11px").text("National Mean");
}

