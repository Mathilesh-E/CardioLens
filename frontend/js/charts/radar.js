// Risk Fingerprint Radar Chart (Profile vs Population vs High-Risk Cluster)

export function renderRadar(containerSelector, profile) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  if (!profile) return;

  const width = 380;
  const height = 300;
  const radius = 105;

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .style("overflow", "visible");

  const g = svg.append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2 - 10})`);

  // 6 Aggregate dimensions normalized 0.0 - 1.0
  const axes = [
    {
      name: "Cardiometabolic",
      getValue: p => (p.HighBP * 0.35 + p.HighChol * 0.35 + (p.Diabetes / 2.0) * 0.3)
    },
    {
      name: "Age Factor",
      getValue: p => (p.Age - 1.0) / 12.0
    },
    {
      name: "Lifestyle / Diet",
      getValue: p => (1.0 - (p.PhysActivity * 0.4 + p.Fruits * 0.3 + p.Veggies * 0.3)) // Higher = worse
    },
    {
      name: "Tobacco / Alcohol",
      getValue: p => (p.Smoker * 0.7 + p.HvyAlcoholConsump * 0.3)
    },
    {
      name: "Functional Health",
      getValue: p => ((p.GenHlth - 1.0) / 4.0 * 0.5 + p.DiffWalk * 0.3 + (p.PhysHlth / 30.0) * 0.2)
    },
    {
      name: "Body Mass (BMI)",
      getValue: p => Math.min(1.0, Math.max(0.0, (p.BMI - 18.0) / 22.0))
    }
  ];

  const totalAxes = axes.length;
  const angleSlice = (Math.PI * 2) / totalAxes;

  // Background concentric polygonal web
  const levels = 4;
  for (let l = 1; l <= levels; l++) {
    const r = (radius / levels) * l;
    const levelCoords = [];
    for (let i = 0; i < totalAxes; i++) {
      const angle = angleSlice * i - Math.PI / 2;
      levelCoords.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }
    const polygonLine = d3.line().curve(d3.curveLinearClosed);
    g.append("path")
      .datum(levelCoords)
      .attr("d", polygonLine)
      .attr("fill", l % 2 === 0 ? "rgba(0, 212, 255, 0.03)" : "none")
      .attr("stroke", "var(--border-color)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", l === levels ? "none" : "2,2");
  }

  // Axis spokes & labels
  axes.forEach((axis, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    g.append("line")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", x).attr("y2", y)
      .attr("stroke", "var(--border-color)")
      .attr("stroke-width", 1);

    const labelDist = radius + 22;
    const labelX = labelDist * Math.cos(angle);
    const labelY = labelDist * Math.sin(angle);

    const anchor = Math.cos(angle) > 0.3 ? "start" : Math.cos(angle) < -0.3 ? "end" : "middle";

    g.append("text")
      .attr("x", labelX)
      .attr("y", labelY + (Math.sin(angle) > 0.5 ? 6 : -2))
      .attr("text-anchor", anchor)
      .attr("font-size", "11px")
      .attr("font-weight", "700")
      .attr("fill", "var(--text-main)")
      .text(axis.name);
  });

  // Calculate coordinates for a profile
  function getCoordinates(p) {
    return axes.map((axis, i) => {
      const val = Math.min(1.0, Math.max(0.0, axis.getValue(p)));
      const angle = angleSlice * i - Math.PI / 2;
      return [radius * val * Math.cos(angle), radius * val * Math.sin(angle)];
    });
  }

  const radarLine = d3.line().curve(d3.curveLinearClosed);

  // 1. Population Average Benchmark (subtle grey-slate)
  const popCoords = getCoordinates({
    HighBP: 0.43, HighChol: 0.42, Diabetes: 0.25, Age: 8.0,
    PhysActivity: 0.75, Fruits: 0.63, Veggies: 0.81, Smoker: 0.44,
    HvyAlcoholConsump: 0.05, GenHlth: 2.5, DiffWalk: 0.16, PhysHlth: 4.2, BMI: 28.3
  });

  g.append("path")
    .datum(popCoords)
    .attr("d", radarLine)
    .attr("fill", "var(--chart-neutral)")
    .attr("fill-opacity", 0.14)
    .attr("stroke", "var(--text-muted)")
    .attr("stroke-dasharray", "4,3")
    .attr("stroke-width", 1.8);

  // 2. Current User Profile (Vivid Neon Cyan)
  const userCoords = getCoordinates(profile);
  g.append("path")
    .datum(userCoords)
    .attr("d", radarLine)
    .attr("fill", "rgba(0, 212, 255, 0.28)")
    .attr("stroke", "var(--primary-deep)")
    .attr("stroke-width", 2.5)
    .style("filter", "drop-shadow(0 0 10px rgba(0, 212, 255, 0.4))");

  // Data points with glowing hubs
  userCoords.forEach(([x, y]) => {
    g.append("circle")
      .attr("cx", x).attr("cy", y)
      .attr("r", 4.5)
      .attr("fill", "var(--primary-deep)")
      .attr("stroke", "#FFFFFF")
      .attr("stroke-width", 1.5)
      .style("filter", "drop-shadow(0 0 5px var(--primary-deep))");
  });

  // Legend at bottom
  const leg = svg.append("g")
    .attr("transform", `translate(${width / 2}, ${height - 10})`);

  // Current Patient
  leg.append("line")
    .attr("x1", -120).attr("x2", -96).attr("y1", 0).attr("y2", 0)
    .attr("stroke", "var(--primary-deep)").attr("stroke-width", 2.5);
  leg.append("circle")
    .attr("cx", -108).attr("cy", 0).attr("r", 3.5).attr("fill", "var(--primary-deep)");
  leg.append("text")
    .attr("x", -90).attr("y", 3.5)
    .attr("font-size", "10px").attr("font-weight", "700").attr("fill", "var(--text-main)")
    .text("This Patient Profile");

  // Population Mean
  leg.append("line")
    .attr("x1", 30).attr("x2", 54).attr("y1", 0).attr("y2", 0)
    .attr("stroke", "var(--text-muted)").attr("stroke-width", 1.8).attr("stroke-dasharray", "3,3");
  leg.append("text")
    .attr("x", 60).attr("y", 3.5)
    .attr("font-size", "10px").attr("font-weight", "700").attr("fill", "var(--text-muted)")
    .text("National Average Benchmark");
}

