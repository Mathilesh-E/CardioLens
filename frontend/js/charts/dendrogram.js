// SHAP Feature Clustering Dendrogram Component

export function renderDendrogram(containerSelector, treeData) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  if (!treeData) return;

  const margin = { top: 20, right: 120, bottom: 20, left: 20 };
  const rawW = container.node() ? container.node().getBoundingClientRect().width : 0;
  const width = Math.max(rawW - margin.left - margin.right, 380);
  const height = 320 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const root = d3.hierarchy(treeData);
  const cluster = d3.cluster().size([height, width]);
  cluster(root);

  // Link paths with entrance stroke animation
  const linkPaths = svg.selectAll(".dendro-link")
    .data(root.links())
    .enter()
    .append("path")
    .attr("class", "dendro-link")
    .attr("d", d3.linkHorizontal()
      .x(d => d.y)
      .y(d => d.x))
    .attr("fill", "none")
    .attr("stroke", "var(--border-color)")
    .attr("stroke-width", 1.8)
    .attr("stroke-opacity", 0.7);

  // Leaf Nodes & Feature Labels
  const nodes = svg.selectAll(".dendro-node")
    .data(root.descendants())
    .enter()
    .append("g")
    .attr("class", "dendro-node")
    .attr("transform", d => `translate(${d.y}, ${d.x})`)
    .style("cursor", "pointer")
    .on("mouseenter", function(event, d) {
      d3.select(this).select("circle")
        .transition().duration(150)
        .attr("r", 6)
        .attr("fill", "var(--primary-deep)")
        .style("filter", "drop-shadow(0 0 8px #00D4FF)");
      d3.select(this).select("text")
        .attr("font-weight", "800")
        .attr("fill", "var(--primary-deep)");
    })
    .on("mouseleave", function(event, d) {
      d3.select(this).select("circle")
        .transition().duration(200)
        .attr("r", d.children ? 2.5 : 4)
        .attr("fill", d.children ? "var(--border-color)" : "var(--primary-deep)")
        .style("filter", "none");
      d3.select(this).select("text")
        .attr("font-weight", "500")
        .attr("fill", "var(--text-main)");
    });

  nodes.append("circle")
    .attr("r", d => d.children ? 2.5 : 4)
    .attr("fill", d => d.children ? "var(--border-color)" : "var(--primary-deep)");

  nodes.filter(d => !d.children)
    .append("text")
    .attr("dx", 10)
    .attr("dy", 3.5)
    .attr("font-size", "11px")
    .attr("fill", "var(--text-main)")
    .attr("font-weight", "600")
    .text(d => d.data.name);
}
