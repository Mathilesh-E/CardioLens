// 2D What-If Heatmap with Crosshair & Interactive Cell Selection

export function renderWhatIf2D(containerSelector, heatmapData, onCellClick) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  if (!heatmapData || !heatmapData.matrix) return;

  const margin = { top: 12, right: 20, bottom: 44, left: 46 };
  const rawW = container.node() ? container.node().getBoundingClientRect().width : 0;
  const width = Math.max(rawW - margin.left - margin.right, 340);
  const height = 230 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const grid1 = heatmapData.grid1; // rows
  const grid2 = heatmapData.grid2; // cols
  const matrix = heatmapData.matrix;

  const xScale = d3.scaleBand().domain(grid2.map(String)).range([0, width]).padding(0.04);
  const yScale = d3.scaleBand().domain(grid1.map(String)).range([height, 0]).padding(0.04);

  // Flatten values for color scale with rich multi-stop vibrant gradient
  const allVals = matrix.flat();
  const minVal = d3.min(allVals) || 0;
  const maxVal = d3.max(allVals) || 100;

  // Custom high-contrast clinical gradient: Teal/Emerald -> Cyan -> Amber -> Crimson
  const colorScale = d3.scaleLinear()
    .domain([minVal, minVal + (maxVal - minVal) * 0.35, minVal + (maxVal - minVal) * 0.7, maxVal])
    .range(["#00C887", "#00A3FF", "#FFB800", "#FF2060"])
    .interpolate(d3.interpolateRgb);

  // Heatmap Cells
  grid1.forEach((v1, r) => {
    grid2.forEach((v2, c) => {
      const riskVal = matrix[r][c];
      const cellG = svg.append("g");

      cellG.append("rect")
        .attr("x", xScale(String(v2)))
        .attr("y", yScale(String(v1)))
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .attr("rx", 3)
        .attr("fill", colorScale(riskVal))
        .attr("cursor", "pointer")
        .on("click", () => {
          if (onCellClick) {
            onCellClick(heatmapData.feature1, v1, heatmapData.feature2, v2);
          }
        })
        .append("title")
        .text(`${heatmapData.feature1}: ${v1}\n${heatmapData.feature2}: ${v2}\nPredicted Risk: ${riskVal}%`);

      // Print numeric risk if bandwidth permits
      if (xScale.bandwidth() >= 26 && yScale.bandwidth() >= 16) {
        cellG.append("text")
          .attr("x", xScale(String(v2)) + xScale.bandwidth() / 2)
          .attr("y", yScale(String(v1)) + yScale.bandwidth() / 2 + 3.5)
          .attr("text-anchor", "middle")
          .attr("font-size", xScale.bandwidth() > 36 ? "10px" : "9px")
          .attr("font-weight", "800")
          .attr("fill", "#FFFFFF")
          .attr("pointer-events", "none")
          .style("text-shadow", "0 1px 3px rgba(0,0,0,0.85)")
          .text(`${riskVal.toFixed(0)}%`);
      }
    });
  });

  // Crosshair on nearest cell to current active patient values
  const curr1 = heatmapData.current_val1;
  const curr2 = heatmapData.current_val2;
  const near1 = grid1.reduce((prev, curr) => Math.abs(curr - curr1) < Math.abs(prev - curr1) ? curr : prev, grid1[0]);
  const near2 = grid2.reduce((prev, curr) => Math.abs(curr - curr2) < Math.abs(prev - curr2) ? curr : prev, grid2[0]);

  svg.append("rect")
    .attr("x", xScale(String(near2)))
    .attr("y", yScale(String(near1)))
    .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("fill", "none")
    .attr("stroke", "#FFFFFF")
    .attr("stroke-width", 3)
    .attr("rx", 4)
    .style("filter", "drop-shadow(0 0 8px rgba(0, 212, 255, 0.9))")
    .attr("pointer-events", "none");

  // Bottom Axis (Feature 2)
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).tickFormat(d => parseFloat(d).toFixed(0)))
    .attr("class", "mono")
    .attr("color", "var(--text-muted)");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 36)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("font-weight", "700")
    .attr("fill", "var(--text-muted)")
    .text(`${heatmapData.feature2} →`);

  // Left Axis (Feature 1)
  svg.append("g")
    .call(d3.axisLeft(yScale).tickFormat(d => parseFloat(d).toFixed(0)))
    .attr("class", "mono")
    .attr("color", "var(--text-muted)");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -32)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("font-weight", "700")
    .attr("fill", "var(--text-muted)")
    .text(`↑ ${heatmapData.feature1}`);
}
