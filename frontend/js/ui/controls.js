// PulseIQ: High-Grade Clinical Input Controls & Instrument Panel
// Features Category Tabs, Segmented Dual Switches, Gradient Sliders, and Dynamic Clinical Readouts
import { store, PRESETS, DEFAULT_PROFILE } from "../state.js";

export function initControls(containerSelector, featureMeta) {
  const container = document.querySelector(containerSelector);
  if (!container || !featureMeta) return;

  container.innerHTML = "";

  // 1. Category Filter Tabs Header
  const tabsBar = document.createElement("div");
  tabsBar.className = "control-category-tabs";
  tabsBar.innerHTML = `
    <button class="ctrl-tab-btn active" data-group="all">All (21)</button>
    <button class="ctrl-tab-btn" data-group="Clinical">🫀 Cardio (6)</button>
    <button class="ctrl-tab-btn" data-group="Lifestyle">🏃 Lifestyle (5)</button>
    <button class="ctrl-tab-btn" data-group="Wellbeing">🩺 Health (4)</button>
    <button class="ctrl-tab-btn" data-group="Demographics">📋 Demographics (6)</button>
  `;
  container.appendChild(tabsBar);

  // Container for cards
  const cardsGrid = document.createElement("div");
  cardsGrid.className = "clinical-cards-container";
  container.appendChild(cardsGrid);

  const featureKeys = Object.keys(featureMeta);
  const inputsMap = {};

  featureKeys.forEach(featKey => {
    const meta = featureMeta[featKey];
    const grp = meta.group || "Clinical";

    const card = document.createElement("div");
    card.className = `clinical-feature-card group-${grp}`;
    card.setAttribute("data-feat-group", grp);

    // Card Header
    const cardTop = document.createElement("div");
    cardTop.className = "feat-card-top";

    const labelGroup = document.createElement("div");
    labelGroup.className = "feat-label-group";

    const featTitle = document.createElement("div");
    featTitle.className = "feat-title";
    featTitle.textContent = meta.label;
    labelGroup.appendChild(featTitle);

    cardTop.appendChild(labelGroup);

    // Badge
    const badge = document.createElement("span");
    if (meta.modifiable) {
      badge.className = "feat-badge badge-modifiable";
      badge.textContent = "MODIFIABLE";
      badge.title = "Targetable via clinical lifestyle recourse";
    } else {
      badge.className = "feat-badge badge-fixed";
      badge.textContent = "FIXED";
    }
    cardTop.appendChild(badge);
    card.appendChild(cardTop);

    // Dynamic Clinical Readout Badge
    const readoutBar = document.createElement("div");
    readoutBar.className = "feat-readout-bar";

    const descText = document.createElement("div");
    descText.className = "feat-desc-snippet";
    descText.textContent = meta.description || "";
    readoutBar.appendChild(descText);

    const valBadge = document.createElement("div");
    valBadge.className = "feat-val-badge mono";
    readoutBar.appendChild(valBadge);

    card.appendChild(readoutBar);

    function getFormattedText(v) {
      if (featKey === "BMI") {
        if (v < 18.5) return `${v} kg/m² • Underweight`;
        if (v < 25.0) return `${v} kg/m² • Normal`;
        if (v < 30.0) return `${v} kg/m² • Overweight`;
        if (v < 35.0) return `${v} kg/m² • Obese I`;
        return `${v} kg/m² • Severe Obese`;
      }
      if (featKey === "Age") {
        const ageLabels = ["18-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80+"];
        return `${ageLabels[Math.round(v) - 1] || v} yrs (Tier ${Math.round(v)}/13)`;
      }
      if (featKey === "GenHlth") {
        const gh = ["Excellent", "Very Good", "Good", "Fair", "Poor"];
        return `${gh[Math.round(v) - 1] || v} (${Math.round(v)}/5)`;
      }
      if (meta.value_labels && meta.value_labels[String(Math.round(v))]) {
        return meta.value_labels[String(Math.round(v))];
      }
      return `${v}`;
    }

    function updateValueStyling(v) {
      valBadge.textContent = getFormattedText(v);
      if (meta.type === "binary") {
        valBadge.className = `feat-val-badge mono ${v === 1 ? 'badge-elevated' : 'badge-optimal'}`;
      } else if (featKey === "BMI") {
        valBadge.className = `feat-val-badge mono ${v >= 30 ? 'badge-elevated' : (v >= 25 ? 'badge-warning' : 'badge-optimal')}`;
      } else if (featKey === "GenHlth") {
        valBadge.className = `feat-val-badge mono ${v >= 4 ? 'badge-elevated' : (v >= 3 ? 'badge-warning' : 'badge-optimal')}`;
      } else {
        valBadge.className = "feat-val-badge mono";
      }
    }

    // Input Mechanism
    if (meta.type === "binary") {
      // High-End Dual Segmented Switch
      const switchContainer = document.createElement("div");
      switchContainer.className = "dual-switch-container";

      const optNo = document.createElement("button");
      optNo.className = "dual-opt-btn";
      optNo.innerHTML = `<span>○</span> <span>No / Normal</span>`;

      const optYes = document.createElement("button");
      optYes.className = "dual-opt-btn";
      optYes.innerHTML = `<span>●</span> <span>Yes / Diagnosed</span>`;

      function renderSwitchState(curVal) {
        if (curVal === 1.0) {
          optYes.className = "dual-opt-btn active-yes";
          optNo.className = "dual-opt-btn";
        } else {
          optNo.className = "dual-opt-btn active-no";
          optYes.className = "dual-opt-btn";
        }
        updateValueStyling(curVal);
      }

      optNo.addEventListener("click", () => {
        store.updateProfileFeature(featKey, 0.0);
        renderSwitchState(0.0);
      });

      optYes.addEventListener("click", () => {
        store.updateProfileFeature(featKey, 1.0);
        renderSwitchState(1.0);
      });

      switchContainer.appendChild(optNo);
      switchContainer.appendChild(optYes);
      card.appendChild(switchContainer);

      renderSwitchState(store.state.profile[featKey] || 0.0);

      inputsMap[featKey] = {
        setVal: (v) => renderSwitchState(v)
      };

    } else {
      // High-End Gradient Range Slider with Stepper
      const sliderWrapper = document.createElement("div");
      sliderWrapper.className = "clinical-slider-wrapper";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.className = "clinical-range-slider";
      slider.min = meta.min;
      slider.max = meta.max;
      slider.step = meta.step || 1.0;
      slider.value = store.state.profile[featKey];

      function updateSliderTrack(v) {
        const pct = ((v - meta.min) / (meta.max - meta.min)) * 100;
        const isLight = document.documentElement.getAttribute("data-theme") === "light";
        const emptyTrack = isLight ? "rgba(0, 85, 204, 0.12)" : "rgba(0, 212, 255, 0.15)";
        const fillColor = isLight ? "#0055CC, #0077EE" : "#00D4FF, #0080FF";
        slider.style.background = `linear-gradient(to right, ${fillColor} ${pct}%, ${emptyTrack} ${pct}%, ${emptyTrack} 100%)`;
      }

      slider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        updateValueStyling(val);
        updateSliderTrack(val);
        store.updateProfileFeature(featKey, val);
      });

      sliderWrapper.appendChild(slider);

      // Min / Max Ticks
      const tickRow = document.createElement("div");
      tickRow.className = "slider-ticks-row mono";
      tickRow.innerHTML = `<span>${meta.min}</span><span>${meta.max}</span>`;
      sliderWrapper.appendChild(tickRow);

      card.appendChild(sliderWrapper);

      updateValueStyling(store.state.profile[featKey]);
      updateSliderTrack(store.state.profile[featKey]);

      inputsMap[featKey] = {
        setVal: (v) => {
          slider.value = v;
          updateValueStyling(v);
          updateSliderTrack(v);
        }
      };
    }

    cardsGrid.appendChild(card);
  });

  // Category Tab Switching
  tabsBar.querySelectorAll(".ctrl-tab-btn").forEach(tab => {
    tab.addEventListener("click", () => {
      tabsBar.querySelectorAll(".ctrl-tab-btn").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const chosenGrp = tab.getAttribute("data-group");

      cardsGrid.querySelectorAll(".clinical-feature-card").forEach(c => {
        if (chosenGrp === "all" || c.getAttribute("data-feat-group") === chosenGrp) {
          c.style.display = "flex";
        } else {
          c.style.display = "none";
        }
      });
    });
  });

  // Subscribe to external store profile changes
  store.subscribe("profile", (prof) => {
    Object.keys(prof).forEach(k => {
      if (inputsMap[k]) {
        inputsMap[k].setVal(prof[k]);
      }
    });
  });
}
