// SHAP Force-Style Stacked Bar (Push-Up vs Push-Down Evidence)

export function renderForceBar(containerSelector, prediction) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  if (!prediction || !prediction.contributions) return;

  const rawW = container.node().getBoundingClientRect().width || 460;
  const width = Math.max(rawW, 360);
  const height = 44;
  const margin = { top: 6, right: 14, bottom: 6, left: 14 };

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  // CRITICAL: Define gradients FIRST before any element references them
  const defs = svg.append("defs");

  const gProt = defs.append("linearGradient")
    .attr("id", "grad-force-prot-v2")
    .attr("x1","0%").attr("y1","0%").attr("x2","100%").attr("y2","0%");
  gProt.append("stop").attr("offset","0%").attr("stop-color","#00C887");
  gProt.append("stop").attr("offset","100%").attr("stop-color","#00E5A0");

  const gRisk = defs.append("linearGradient")
    .attr("id", "grad-force-risk-v2")
    .attr("x1","0%").attr("y1","0%").attr("x2","100%").attr("y2","0%");
  gRisk.append("stop").attr("offset","0%").attr("stop-color","#FF2060");
  gRisk.append("stop").attr("offset","100%").attr("stop-color","#E60040");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const innerWidth = width - margin.left - margin.right;
  const posContr = prediction.contributions.filter(c => c.shap_logodds > 0);
  const negContr = prediction.contributions.filter(c => c.shap_logodds < 0);

  const sumPos = posContr.reduce((acc, c) => acc + c.shap_logodds, 0);
  const sumNeg = Math.abs(negContr.reduce((acc, c) => acc + c.shap_logodds, 0));
  const total = sumPos + sumNeg || 1.0;

  const posPct = Math.round((sumPos / total) * 100);
  const negPct = 100 - posPct;
  const posWidth = (sumPos / total) * innerWidth;
  const negWidth = innerWidth - posWidth;

  // Track background
  g.append("rect")
    .attr("x", 0).attr("y", 2)
    .attr("width", innerWidth).attr("height", 28)
    .attr("rx", 8)
    .attr("fill", "var(--bg-surface-elevated)")
    .attr("stroke", "var(--border-color)");

  // Push-down (Protective / Emerald) bar on left
  if (negWidth > 2) {
    g.append("rect")
      .attr("x", 0).attr("y", 2)
      .attr("width", 0).attr("height", 28)
      .attr("fill", "url(#grad-force-prot-v2)")
      .attr("rx", 8)
      .style("filter", "drop-shadow(0 2px 8px rgba(0, 229, 160, 0.5))")
      .transition().duration(600).ease(d3.easeCubicOut)
      .attr("width", Math.max(0, negWidth));
  }

  // Push-up (Risk / Crimson) bar on right
  if (posWidth > 2) {
    g.append("rect")
      .attr("x", negWidth).attr("y", 2)
      .attr("width", 0).attr("height", 28)
      .attr("fill", "url(#grad-force-risk-v2)")
      .attr("rx", 8)
      .style("filter", "drop-shadow(0 2px 8px rgba(255, 32, 96, 0.5))")
      .transition().duration(600).ease(d3.easeCubicOut)
      .attr("width", Math.max(0, posWidth));
  }

  // Divider between two bars
  if (posWidth > 2 && negWidth > 2) {
    g.append("line")
      .attr("x1", negWidth).attr("x2", negWidth)
      .attr("y1", 1).attr("y2", 31)
      .attr("stroke", "#FFFFFF")
      .attr("stroke-width", 2.5)
      .attr("opacity", 0.9);
  }

  // Labels inside bar
  if (negWidth > 80) {
    g.append("text")
      .attr("x", 12).attr("y", 21)
      .attr("fill", "#FFFFFF")
      .attr("font-size", "11px").attr("font-weight", "800")
      .text(`🛡️ Protective: ${negPct}%`);
  }

  if (posWidth > 80) {
    g.append("text")
      .attr("x", innerWidth - 12).attr("y", 21)
      .attr("text-anchor", "end")
      .attr("fill", "#FFFFFF")
      .attr("font-size", "11px").attr("font-weight", "800")
      .text(`⚠️ Risk-Elevating: ${posPct}%`);
  }

  // Rich Micro-Dashboard beneath bar
  const topProt = negContr.slice(0, 3);
  const topRisk = posContr.slice(0, 3);

  const dashDiv = container.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1fr")
    .style("gap", "12px")
    .style("margin-top", "12px")
    .style("padding", "0 4px");

  // Left: Protective Chips
  const leftCol = dashDiv.append("div")
    .style("display", "flex").style("flex-direction", "column").style("gap", "5px");

  leftCol.append("div")
    .style("font-size", "10px").style("font-weight", "800").style("color", "var(--text-muted)")
    .style("text-transform", "uppercase").style("letter-spacing", "0.06em")
    .text("Primary Protective Drivers");

  if (topProt.length === 0) {
    leftCol.append("div")
      .style("font-size", "11px").style("color", "var(--text-muted)").style("padding", "6px 8px")
      .text("None identified in this profile.");
  } else {
    topProt.forEach(p => {
      leftCol.append("div")
        .style("display", "flex").style("justify-content", "space-between").style("align-items", "center")
        .style("font-size", "11px").style("padding", "5px 8px").style("border-radius", "7px")
        .style("background", "rgba(0, 229, 160, 0.10)").style("border", "1px solid rgba(0, 229, 160, 0.25)")
        .style("color", "var(--text-main)")
        .html(`<span>${p.label}</span> <strong style="color:var(--risk-low); font-family: var(--font-mono);">${p.pct_points} pts</strong>`);
    });
  }

  // Right: Risk Chips
  const rightCol = dashDiv.append("div")
    .style("display", "flex").style("flex-direction", "column").style("gap", "5px");

  rightCol.append("div")
    .style("font-size", "10px").style("font-weight", "800").style("color", "var(--text-muted)")
    .style("text-transform", "uppercase").style("letter-spacing", "0.06em")
    .text("Primary Risk-Elevating Drivers");

  if (topRisk.length === 0) {
    rightCol.append("div")
      .style("font-size", "11px").style("color", "var(--text-muted)").style("padding", "6px 8px")
      .text("None identified (optimal profile).");
  } else {
    topRisk.forEach(p => {
      rightCol.append("div")
        .style("display", "flex").style("justify-content", "space-between").style("align-items", "center")
        .style("font-size", "11px").style("padding", "5px 8px").style("border-radius", "7px")
        .style("background", "rgba(255, 32, 96, 0.10)").style("border", "1px solid rgba(255, 32, 96, 0.25)")
        .style("color", "var(--text-main)")
        .html(`<span>${p.label}</span> <strong style="color:var(--risk-high); font-family: var(--font-mono);">${p.pct_points} pts</strong>`);
    });
  }
}
