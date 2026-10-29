// Command Palette Modal (Ctrl/Cmd+K)
import { store, PRESETS } from "../state.js";

export function initCommandPalette(onNavigate) {
  const backdrop = document.getElementById("cmd-backdrop");
  const input = document.getElementById("cmd-input");
  const list = document.getElementById("cmd-list");
  const trigger = document.getElementById("cmd-trigger");

  if (!backdrop || !input || !list) return;

  const commands = [
    { title: "Go to Risk Lab", category: "Navigation", action: () => onNavigate("risk-lab") },
    { title: "Go to Compare & Counterfactuals", category: "Navigation", action: () => onNavigate("compare") },
    { title: "Go to Cohort Studio & Simulator", category: "Navigation", action: () => onNavigate("cohorts") },
    { title: "Go to Patient Map (2D UMAP / t-SNE)", category: "Navigation", action: () => onNavigate("patient-map") },
    { title: "Go to Global Insights (SHAP Beeswarm)", category: "Navigation", action: () => onNavigate("global-insights") },
    { title: "Go to Model Arena (ROC, PR & Thresholds)", category: "Navigation", action: () => onNavigate("model-arena") },
    { title: "Go to Fairness Audit", category: "Navigation", action: () => onNavigate("fairness") },
    { title: "Go to Data Explorer (Correlations & Heatmaps)", category: "Navigation", action: () => onNavigate("explorer") },
    { title: "Go to Batch Scoring", category: "Navigation", action: () => onNavigate("batch") },
    { title: "Go to Methodology & Model Card", category: "Navigation", action: () => onNavigate("methodology") },
    { title: "Load Preset: Healthy Young Adult", category: "Presets", action: () => store.setProfile(PRESETS.healthy_young.profile) },
    { title: "Load Preset: Older with Hypertension", category: "Presets", action: () => store.setProfile(PRESETS.older_hypertensive.profile) },
    { title: "Load Preset: High-Risk Multi-Factor", category: "Presets", action: () => store.setProfile(PRESETS.high_risk_multifactor.profile) },
    { title: "Toggle Color Theme (Paper / Ink)", category: "Settings", action: () => store.toggleTheme() },
    { title: "Toggle Audience Mode (Plain / Technical)", category: "Settings", action: () => store.toggleAudienceMode() },
    { title: "Export Client-Side Report (PDF / Print)", category: "Export", action: () => window.print() }
  ];

  function openModal() {
    backdrop.classList.add("open");
    input.value = "";
    renderList(commands);
    setTimeout(() => input.focus(), 50);
  }

  function closeModal() {
    backdrop.classList.remove("open");
  }

  function renderList(filtered) {
    list.innerHTML = "";
    if (filtered.length === 0) {
      list.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-muted);">No matching commands found.</div>`;
      return;
    }

    filtered.forEach((cmd, idx) => {
      const el = document.createElement("div");
      el.className = `cmd-item ${idx === 0 ? "selected" : ""}`;
      el.innerHTML = `
        <span>${cmd.title}</span>
        <span class="mono" style="font-size: 11px; color: var(--text-faint);">${cmd.category}</span>
      `;
      el.addEventListener("click", () => {
        cmd.action();
        closeModal();
      });
      list.appendChild(el);
    });
  }

  input.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = commands.filter(c => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    renderList(filtered);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "Enter") {
      const first = list.querySelector(".cmd-item");
      if (first) first.click();
    }
  });

  if (trigger) trigger.addEventListener("click", openModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        store.redo();
      } else {
        store.undo();
      }
    }
  });
}
