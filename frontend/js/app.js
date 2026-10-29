// PulseIQ: Application Core Orchestrator
import { store, DEFAULT_PROFILE, PRESETS } from "./state.js";
import { api } from "./api.js";
import { initControls } from "./ui/controls.js";
import { initCommandPalette } from "./ui/command_palette.js";
import { initGuidedStory } from "./ui/guided_story.js";

import { renderRiskGauge } from "./charts/gauge.js";
import { renderWaterfall } from "./charts/waterfall.js";
import { renderForceBar } from "./charts/force_bar.js";
import { renderRadar } from "./charts/radar.js";
import { renderSensitivity } from "./charts/sensitivity.js";
import { renderWhatIf2D } from "./charts/whatif2d.js";
import { PatientMapCanvas } from "./charts/patient_map.js";
import { renderBeeswarm } from "./charts/beeswarm.js";
import { renderRocPr } from "./charts/roc_pr.js";
import { renderDendrogram } from "./charts/dendrogram.js";
import {
  renderRiskDistribution,
  renderAgeStratification,
  renderComorbidityDonut,
  renderCohortTornado
} from "./charts/dashboard_charts.js";
import { renderCorrelationHeatmap } from "./charts/correlation_heatmap.js";

class PulseIQApp {
  constructor() {
    this.artifacts = {};
    this.patientMapInstance = null;
    this.currentSensitivityFeat = "Age";
    this.currentWhatIf2DFeats = ["Age", "BMI"];
    this.dashboardCohortData = null;
  }

  async init() {
    console.log("Initializing PulseIQ Studio...");
    this.setupTheme();
    this.setupToastContainer();
    this.setupNavigation();
    this.setupEcgAnimation();

    try {
      // 1. Fetch initial metadata & metrics in parallel
      const [meta, metrics, globalShap, patientMap, pdp, riskTables, fairness, correlations] = await Promise.all([
        api.get("/api/meta"),
        api.get("/api/metrics"),
        api.get("/api/global"),
        api.get("/api/patientmap"),
        api.get("/api/pdp"),
        api.get("/api/risk-tables"),
        api.get("/api/fairness"),
        api.get("/api/correlations")
      ]);

      this.artifacts = {
        meta, metrics, globalShap, patientMap, pdp, riskTables, fairness, correlations
      };

      // 2. Initialize UI controls & palette
      initControls("#controls-container", meta);
      initCommandPalette((sec) => this.switchSection(sec));

      // 3. Setup Model Selector & Audience Toggle
      this.setupModelSelector();
      this.setupAudienceToggle();

      // 4. Initialize Core Views
      this.initDashboardView();
      this.initRiskLabAuxControls();
      this.initPatientMapView();
      this.initGlobalInsightsView();
      this.initModelArenaView();
      this.initFairnessView();
      this.initDataExplorerView();
      this.initBatchScoringView();
      this.initCohortStudioView();
      this.initSimulatorView();
      this.initCompareView();

      // 5. Setup Guided Story
      initGuidedStory("#guided-story-container", { shap_global: globalShap }, (p) => {
        store.setProfile(p);
        this.switchSection("risk-lab");
      });

      // 6. Reactive Profile Subscriptions for Risk Lab
      store.subscribe("profile", () => this.handleProfileChange());
      store.subscribe("selectedModel", () => this.handleProfileChange());
      store.subscribe("audienceMode", (mode) => {
        if (store.state.currentPrediction) {
          renderWaterfall("#waterfall-chart", store.state.currentPrediction, mode);
        }
      });

      // 7. Initial Predictions & Counters
      await this.handleProfileChange();
      this.animateHeroCounters();

      // Default to Dashboard view
      this.switchSection("dashboard");

      // Scroll Reveal Animations
      this.initScrollReveal();

      console.log("PulseIQ Studio ready.");
    } catch (err) {
      console.error("Initialization error:", err);
      this.showToast(`Error initializing studio: ${err.message}`, "error");
    }
  }

  setupTheme() {
    const currentTheme = store.state.theme || "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        store.toggleTheme();
        const newTheme = store.state.theme;
        document.documentElement.setAttribute("data-theme", newTheme);

        // Update all sliders with proper track color for theme
        document.querySelectorAll(".clinical-range-slider").forEach(sl => {
          const min = parseFloat(sl.min) || 0;
          const max = parseFloat(sl.max) || 100;
          const v = parseFloat(sl.value) || 0;
          const pct = ((v - min) / (max - min)) * 100;
          const isLight = newTheme === "light";
          const emptyTrack = isLight ? "rgba(0, 85, 204, 0.12)" : "rgba(0, 212, 255, 0.15)";
          const fillColor = isLight ? "#0055CC, #0077EE" : "#00D4FF, #0080FF";
          sl.style.background = `linear-gradient(to right, ${fillColor} ${pct}%, ${emptyTrack} ${pct}%, ${emptyTrack} 100%)`;
        });

        // Re-render risk gauge and waterfall to adopt new theme palette
        if (store.state.currentPrediction) {
          renderRiskGauge("#gauge-chart", store.state.currentPrediction);
          renderWaterfall("#waterfall-chart", store.state.currentPrediction, store.state.audienceMode);
          renderForceBar("#force-bar-chart", store.state.currentPrediction);
          renderRadar("#radar-chart", store.state.profile);
        }
      });
    }
  }

  setupToastContainer() {
    let el = document.getElementById("toast-container");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast-container";
      document.body.appendChild(el);
    }
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span>${type === "error" ? "⚠️" : "✓"}</span> <span>${message}</span>`;
    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 250);
    }, 3500);
  }

  setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn[data-section]");
    navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const sec = btn.getAttribute("data-section");
        this.switchSection(sec);
      });
    });

    const heroDashBtn = document.getElementById("hero-cta-dash");
    if (heroDashBtn) heroDashBtn.addEventListener("click", () => this.switchSection("dashboard"));

    const heroLabBtn = document.getElementById("hero-cta-lab");
    if (heroLabBtn) heroLabBtn.addEventListener("click", () => this.switchSection("risk-lab"));

    const heroStoryBtn = document.getElementById("hero-cta-story");
    if (heroStoryBtn) heroStoryBtn.addEventListener("click", () => this.switchSection("guided-story"));

    const logoBtn = document.getElementById("nav-logo-btn");
    if (logoBtn) logoBtn.addEventListener("click", () => this.switchSection("dashboard"));
  }

  switchSection(sectionId) {
    document.querySelectorAll(".nav-btn[data-section]").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-section") === sectionId);
    });

    // Control hero banner: only visible on the executive dashboard!
    const heroBanner = document.getElementById("hero-banner");
    if (heroBanner) {
      heroBanner.style.display = (sectionId === "dashboard") ? "block" : "none";
    }

    document.querySelectorAll(".studio-section").forEach(sec => {
      sec.style.display = sec.id === `section-${sectionId}` ? "block" : "none";
    });

    // Section-specific resize & activation triggers
    if (sectionId === "patient-map" && this.patientMapInstance) {
      setTimeout(() => this.patientMapInstance.resize(), 60);
    } else if (sectionId === "risk-lab") {
      setTimeout(() => this.handleProfileChange(), 60);
    } else if (sectionId === "compare") {
      setTimeout(() => this._runCounterfactuals(), 60);
    } else if (sectionId === "cohorts") {
      setTimeout(() => {
        this._runCohortQuery();
        this._runSimulation();
      }, 60);
    } else if (sectionId === "global-insights") {
      setTimeout(() => this.initGlobalInsightsView(), 60);
    } else if (sectionId === "model-arena") {
      setTimeout(() => this.initModelArenaView(), 60);
    } else if (sectionId === "fairness") {
      setTimeout(() => this.initFairnessView(), 60);
    } else if (sectionId === "explorer") {
      setTimeout(() => this.initDataExplorerView(), 60);
    }

    store.set("currentSection", sectionId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  setupModelSelector() {
    const select = document.getElementById("model-select");
    if (!select) return;
    select.innerHTML = `
      <option value="LightGBM">LightGBM (Primary Calibrated)</option>
      <option value="XGBoost">XGBoost (Calibrated)</option>
      <option value="Random Forest">Random Forest (Balanced)</option>
      <option value="Logistic Regression">Logistic Regression (Standardized)</option>
    `;
    select.addEventListener("change", (e) => {
      store.set("selectedModel", e.target.value);
    });
  }

  setupAudienceToggle() {
    const btns = document.querySelectorAll(".seg-btn[data-audience]");
    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-audience");
        btns.forEach(b => b.classList.toggle("active", b === btn));
        store.set("audienceMode", mode);
      });
    });
  }

  setupEcgAnimation() {
    const canvas = document.getElementById("ecg-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    let w = 400;
    let h = 55;
    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      w = rect.width || 400;
      h = 55;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let sweepX = 0;
    // Standard P-Q-R-S-T physiologic cardiac waveform template
    const cardiacWaveform = (normPhase) => {
      // normPhase is 0.0 to 1.0 (one full cardiac cycle, ~800ms)
      if (normPhase >= 0.12 && normPhase < 0.22) {
        // P-wave (atrial depolarization)
        return Math.sin((normPhase - 0.12) / 0.10 * Math.PI) * 4;
      } else if (normPhase >= 0.32 && normPhase < 0.35) {
        // Q-wave (septal depolarization)
        return -Math.sin((normPhase - 0.32) / 0.03 * Math.PI) * 5;
      } else if (normPhase >= 0.35 && normPhase < 0.40) {
        // R-peak (ventricular depolarization)
        return Math.sin((normPhase - 0.35) / 0.05 * Math.PI) * 26;
      } else if (normPhase >= 0.40 && normPhase < 0.44) {
        // S-wave (late ventricular depolarization)
        return -Math.sin((normPhase - 0.40) / 0.04 * Math.PI) * 9;
      } else if (normPhase >= 0.54 && normPhase < 0.70) {
        // T-wave (ventricular repolarization)
        return Math.sin((normPhase - 0.54) / 0.16 * Math.PI) * 7.5;
      } else if (normPhase >= 0.74 && normPhase < 0.80) {
        // U-wave (subtle)
        return Math.sin((normPhase - 0.74) / 0.06 * Math.PI) * 1.5;
      }
      return 0;
    };

    const cycleLengthPx = 180; // width of 1 cardiac heartbeat cycle
    let trail = [];

    function draw() {
      // 1. Draw subtle clinical medical grid
      ctx.fillStyle = store.state.theme === "light" ? "rgba(240, 246, 255, 0.9)" : "rgba(4, 12, 24, 0.9)";
      ctx.fillRect(0, 0, w, h);

      ctx.lineWidth = 0.5;
      ctx.strokeStyle = store.state.theme === "light" ? "rgba(0, 85, 204, 0.08)" : "rgba(0, 212, 255, 0.08)";
      ctx.beginPath();
      for (let x = 0; x < w; x += 15) {
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += 15) {
        ctx.moveTo(0, y); ctx.lineTo(w, y);
      }
      ctx.stroke();

      // 2. Compute current point
      const phase = (sweepX % cycleLengthPx) / cycleLengthPx;
      const waveY = (h / 2) - cardiacWaveform(phase);

      trail.push({ x: sweepX % w, y: waveY, time: Date.now() });
      if (trail.length > w) trail.shift();

      // Clear around the sweep head to create classic hospital CRT monitor beam sweep
      const headX = sweepX % w;
      const sweepGap = 28;

      // 3. Render waveform trail
      const isLight = store.state.theme === "light";
      const beamColor = isLight ? "#0066EE" : "#00D4FF";
      const glowColor = isLight ? "rgba(0, 102, 238, 0.6)" : "rgba(0, 212, 255, 0.75)";

      ctx.beginPath();
      let first = true;
      for (let i = 0; i < trail.length; i++) {
        const pt = trail[i];
        // skip points in the eraser gap right in front of the sweep head
        const distFromHead = (pt.x - headX + w) % w;
        if (distFromHead > 0 && distFromHead < sweepGap) continue;

        if (first || Math.abs(pt.x - (trail[i-1]?.x || 0)) > 15) {
          ctx.moveTo(pt.x, pt.y);
          first = false;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = beamColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 4. High-brightness Leading CRT beam head
      ctx.beginPath();
      ctx.arc(headX, waveY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = beamColor;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      sweepX += 2.2;
      requestAnimationFrame(draw);
    }
    draw();

    // Live Heart Rate BPM oscillation ticker (72 - 76 BPM)
    const bpmEl = document.getElementById("vital-bpm-val");
    if (bpmEl) {
      setInterval(() => {
        const bpm = 72 + Math.floor(Math.sin(Date.now() / 3000) * 3 + Math.random() * 2);
        bpmEl.textContent = bpm;
      }, 1600);
    }
  }

  animateHeroCounters() {
    const animateNum = (elId, target, duration = 1200, isPct = false) => {
      const el = document.getElementById(elId);
      if (!el) return;
      let start = 0;
      const stepTime = 20;
      const steps = duration / stepTime;
      const increment = target / steps;
      const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
          start = target;
          clearInterval(timer);
        }
        el.textContent = isPct ? start.toFixed(3) : Math.floor(start).toLocaleString();
      }, stepTime);
    };

    animateNum("counter-records", 253680);
    animateNum("counter-features", 21);
    animateNum("counter-auc", 0.852, 1200, true);
  }

  // =========================================================================
  // INTERACTIVE EXECUTIVE & EPIDEMIOLOGICAL DASHBOARD
  // =========================================================================
  initDashboardView() {
    const slicerAge = document.getElementById("slicer-age");
    const slicerSex = document.getElementById("slicer-sex");
    const slicerHbp = document.getElementById("slicer-hbp");
    const slicerChol = document.getElementById("slicer-chol");
    const slicerSmoke = document.getElementById("slicer-smoke");
    const slicerDiab = document.getElementById("slicer-diab");
    const slicerAct = document.getElementById("slicer-act");
    const slicerGenhlth = document.getElementById("slicer-genhlth");
    const slicerStroke = document.getElementById("slicer-stroke");
    const resetBtn = document.getElementById("btn-reset-slicers");

    const updateDashboard = async () => {
      try {
        const filters = [];

        // Age filter
        if (slicerAge && slicerAge.value !== "all") {
          if (slicerAge.value === "young") filters.push({ feature: "Age", min_val: 1, max_val: 4 });
          else if (slicerAge.value === "mid") filters.push({ feature: "Age", min_val: 5, max_val: 7 });
          else if (slicerAge.value === "older") filters.push({ feature: "Age", min_val: 8, max_val: 10 });
          else if (slicerAge.value === "senior") filters.push({ feature: "Age", min_val: 11, max_val: 13 });
        }

        // Sex
        if (slicerSex && slicerSex.value !== "all") {
          filters.push({ feature: "Sex", exact_val: parseFloat(slicerSex.value) });
        }

        // HighBP
        if (slicerHbp && slicerHbp.value !== "all") {
          filters.push({ feature: "HighBP", exact_val: parseFloat(slicerHbp.value) });
        }

        // HighChol
        if (slicerChol && slicerChol.value !== "all") {
          filters.push({ feature: "HighChol", exact_val: parseFloat(slicerChol.value) });
        }

        // Smoker
        if (slicerSmoke && slicerSmoke.value !== "all") {
          filters.push({ feature: "Smoker", exact_val: parseFloat(slicerSmoke.value) });
        }

        // Diabetes
        if (slicerDiab && slicerDiab.value !== "all") {
          if (slicerDiab.value === "diabetic") filters.push({ feature: "Diabetes", min_val: 1 });
          else filters.push({ feature: "Diabetes", exact_val: 0 });
        }

        // PhysActivity
        if (slicerAct && slicerAct.value !== "all") {
          filters.push({ feature: "PhysActivity", exact_val: parseFloat(slicerAct.value) });
        }

        // GenHlth
        if (slicerGenhlth && slicerGenhlth.value !== "all") {
          if (slicerGenhlth.value === "good") filters.push({ feature: "GenHlth", min_val: 1, max_val: 2 });
          else filters.push({ feature: "GenHlth", min_val: 4, max_val: 5 });
        }

        // Stroke
        if (slicerStroke && slicerStroke.value !== "all") {
          filters.push({ feature: "Stroke", exact_val: parseFloat(slicerStroke.value) });
        }

        const data = await api.getCohort(filters);
        this.dashboardCohortData = data;

        // Helper for animated smooth number transitions
        const tweenValue = (el, startVal, endVal, suffix = "", decimals = 0) => {
          if (!el) return;
          const duration = 400;
          const startTime = performance.now();
          const tick = (now) => {
            const progress = Math.min((now - startTime) / duration, 1.0);
            const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out
            const curr = startVal + (endVal - startVal) * ease;
            el.textContent = `${decimals > 0 ? curr.toFixed(decimals) : Math.round(curr).toLocaleString()}${suffix}`;
            if (progress < 1.0) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        };

        // 1. Update 6 KPI Cards with Smooth Tweening
        const kpiSize = document.getElementById("kpi-dash-size");
        const kpiFraction = document.getElementById("kpi-dash-fraction");
        if (kpiSize) {
          const oldSize = parseInt(kpiSize.textContent.replace(/,/g, "")) || 0;
          tweenValue(kpiSize, oldSize, data.cohort_size);
        }
        if (kpiFraction) kpiFraction.textContent = `${data.population_fraction}% of National Sample`;

        const kpiObs = document.getElementById("kpi-dash-obs");
        const kpiCi = document.getElementById("kpi-dash-ci");
        if (kpiObs) {
          const oldObs = parseFloat(kpiObs.textContent) || 0;
          tweenValue(kpiObs, oldObs, data.observed_rate_pct, "%", 1);
        }
        if (kpiCi) kpiCi.textContent = `95% CI: [${data.ci_lower_pct}% - ${data.ci_upper_pct}%]`;

        const kpiModel = document.getElementById("kpi-dash-model");
        const kpiTier = document.getElementById("kpi-dash-tier");
        if (kpiModel) {
          const oldModel = parseFloat(kpiModel.textContent) || 0;
          tweenValue(kpiModel, oldModel, data.mean_model_risk_pct, "%", 1);
        }
        if (kpiTier) {
          const r = data.mean_model_risk_pct;
          if (r < 10) { kpiTier.className = "kpi-badge badge-green"; kpiTier.textContent = "Optimal Risk"; }
          else if (r < 20) { kpiTier.className = "kpi-badge badge-cyan"; kpiTier.textContent = "Moderate Risk"; }
          else if (r < 35) { kpiTier.className = "kpi-badge badge-amber"; kpiTier.textContent = "Elevated Risk"; }
          else { kpiTier.className = "kpi-badge badge-red"; kpiTier.textContent = "Critical Risk"; }
        }

        const kpiRel = document.getElementById("kpi-dash-rel");
        const kpiBase = document.getElementById("kpi-dash-baseline");
        if (kpiRel) {
          const oldRel = parseFloat(kpiRel.textContent) || 1.0;
          tweenValue(kpiRel, oldRel, data.relative_risk, "×", 2);
        }
        if (kpiBase) kpiBase.textContent = `vs Baseline ${data.population_observed_pct}%`;

        const kpiHighCount = document.getElementById("kpi-dash-highcount");
        if (kpiHighCount) {
          const highCount = Math.round(data.cohort_size * (data.mean_model_risk_pct / 100));
          const oldHigh = parseInt(kpiHighCount.textContent.replace(/,/g, "")) || 0;
          tweenValue(kpiHighCount, oldHigh, highCount);
        }

        const kpiDriver = document.getElementById("kpi-dash-driver");
        const kpiDriverShap = document.getElementById("kpi-dash-drivershap");
        if (data.shap_comparison && data.shap_comparison.length > 0) {
          const topDriver = data.shap_comparison[0];
          if (kpiDriver) kpiDriver.textContent = topDriver.label;
          if (kpiDriverShap) kpiDriverShap.textContent = `${topDriver.cohort_shap > 0 ? "+" : ""}${topDriver.cohort_shap} SHAP`;
        }

        // 2. Render 4 D3 Charts
        renderRiskDistribution(
          "#dash-chart-distribution",
          data.histogram,
          data.mean_model_risk_pct,
          data.population_observed_pct
        );

        renderAgeStratification(
          "#dash-chart-age",
          data.age_breakdown || []
        );

        renderComorbidityDonut(
          "#dash-chart-donut",
          data.comorbidity_breakdown || []
        );

        renderCohortTornado(
          "#dash-chart-tornado",
          data.shap_comparison || []
        );

        // 3. Render Matching Real Patients Data Table
        const tableContainer = document.getElementById("dash-patients-table-container");
        if (tableContainer && data.sample_patients) {
          if (data.sample_patients.length === 0) {
            tableContainer.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">No patients match the chosen combination.</div>`;
          } else {
            tableContainer.innerHTML = `
              <table class="interactive-table mono">
                <thead>
                  <tr>
                    <th>Record ID</th>
                    <th>Calibrated Risk</th>
                    <th>True Diagnosis</th>
                    <th>Age</th>
                    <th>Sex</th>
                    <th>Blood Pressure</th>
                    <th>Cholesterol</th>
                    <th>BMI</th>
                    <th>General Health</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.sample_patients.map(p => `
                    <tr>
                      <td style="font-weight:700;">#${p.patient_id}</td>
                      <td>
                        <span class="kpi-badge ${p.calibrated_risk_pct >= 20 ? 'badge-red' : (p.calibrated_risk_pct >= 10 ? 'badge-amber' : 'badge-green')}">
                          ${p.calibrated_risk_pct}%
                        </span>
                      </td>
                      <td>
                        ${p.diagnosed === 1 ? '<span style="color:#F43F5E; font-weight:700;">● Positive</span>' : '<span style="color:#10B981;">○ Negative</span>'}
                      </td>
                      <td>${p.Age}</td>
                      <td>${p.Sex}</td>
                      <td>${p.HighBP ? '<span style="color:#F43F5E;">High</span>' : 'Normal'}</td>
                      <td>${p.HighChol ? '<span style="color:#F59E0B;">High</span>' : 'Normal'}</td>
                      <td>${p.BMI}</td>
                      <td>${p.GenHlth}/5</td>
                      <td>
                        <button class="chip-btn btn-drill-patient" data-pt-id="${p.patient_id}" style="padding:4px 10px; font-size:11px; background:var(--primary-light); color:var(--primary-deep); font-weight:700;">
                          Inspect in Risk Lab →
                        </button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            `;

            // Wire drill-down buttons
            tableContainer.querySelectorAll(".btn-drill-patient").forEach(btn => {
              btn.addEventListener("click", () => {
                const ptId = parseInt(btn.getAttribute("data-pt-id"));
                const pt = data.sample_patients.find(x => x.patient_id === ptId);
                if (pt && pt.raw_features) {
                  store.setProfile(pt.raw_features);
                  this.switchSection("risk-lab");
                  this.showToast(`Loaded Patient #${ptId} (${pt.calibrated_risk_pct}% Risk) into Risk Lab.`);
                }
              });
            });
          }
        }
      } catch (err) {
        console.error("Dashboard update error:", err);
      }
    };

    // Attach slicer change listeners
    [slicerAge, slicerSex, slicerHbp, slicerChol, slicerSmoke, slicerDiab, slicerAct, slicerGenhlth, slicerStroke].forEach(sel => {
      if (sel) sel.addEventListener("change", updateDashboard);
    });

    // Reset button
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (slicerAge) slicerAge.value = "all";
        if (slicerSex) slicerSex.value = "all";
        if (slicerHbp) slicerHbp.value = "all";
        if (slicerChol) slicerChol.value = "all";
        if (slicerSmoke) slicerSmoke.value = "all";
        if (slicerDiab) slicerDiab.value = "all";
        if (slicerAct) slicerAct.value = "all";
        if (slicerGenhlth) slicerGenhlth.value = "all";
        if (slicerStroke) slicerStroke.value = "all";
        updateDashboard();
        this.showToast("Reset all slicers to national sample.");
      });
    }

    // Quick Preset Chips
    document.querySelectorAll(".preset-chip[data-preset-filter]").forEach(chip => {
      chip.addEventListener("click", () => {
        const pType = chip.getAttribute("data-preset-filter");
        // Clear all first
        if (slicerAge) slicerAge.value = "all";
        if (slicerSex) slicerSex.value = "all";
        if (slicerHbp) slicerHbp.value = "all";
        if (slicerChol) slicerChol.value = "all";
        if (slicerSmoke) slicerSmoke.value = "all";
        if (slicerDiab) slicerDiab.value = "all";
        if (slicerAct) slicerAct.value = "all";
        if (slicerGenhlth) slicerGenhlth.value = "all";
        if (slicerStroke) slicerStroke.value = "all";

        if (pType === "hypertensive-seniors") {
          if (slicerAge) slicerAge.value = "senior";
          if (slicerHbp) slicerHbp.value = "1";
        } else if (pType === "metabolic") {
          if (slicerHbp) slicerHbp.value = "1";
          if (slicerChol) slicerChol.value = "1";
          if (slicerDiab) slicerDiab.value = "diabetic";
        } else if (pType === "young-active") {
          if (slicerAge) slicerAge.value = "young";
          if (slicerAct) slicerAct.value = "1";
          if (slicerSmoke) slicerSmoke.value = "0";
        } else if (pType === "smokers-hbp") {
          if (slicerSmoke) slicerSmoke.value = "1";
          if (slicerHbp) slicerHbp.value = "1";
          if (slicerAct) slicerAct.value = "0";
        } else if (pType === "low-income") {
          if (slicerGenhlth) slicerGenhlth.value = "poor";
        }

        updateDashboard();
        this.showToast(`Applied preset: ${chip.textContent.trim()}`);
      });
    });

    // CSV Export Button
    const exportBtn = document.getElementById("btn-export-cohort-csv");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        if (!this.dashboardCohortData || !this.dashboardCohortData.sample_patients) return;
        const pts = this.dashboardCohortData.sample_patients;
        let csv = "patient_id,calibrated_risk_pct,diagnosed,Age,Sex,BMI,HighBP,HighChol,Smoker,Diabetes,GenHlth\n";
        pts.forEach(p => {
          csv += `${p.patient_id},${p.calibrated_risk_pct},${p.diagnosed},${p.Age},${p.Sex},${p.BMI},${p.HighBP ? 1 : 0},${p.HighChol ? 1 : 0},${p.Smoker ? 1 : 0},${p.Diabetes},${p.GenHlth}\n`;
        });
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cohort_patients_slice_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast("Exported cohort slice CSV.");
      });
    }

    // Dashboard Sub-Tabs
    document.querySelectorAll(".dash-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".dash-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.getAttribute("data-dash-tab");
        if (tab === "overview") {
          if (slicerAge) slicerAge.value = "all";
          if (slicerHbp) slicerHbp.value = "all";
        } else if (tab === "comorbidities") {
          if (slicerHbp) slicerHbp.value = "1";
          if (slicerChol) slicerChol.value = "1";
        } else if (tab === "disparities") {
          if (slicerGenhlth) slicerGenhlth.value = "poor";
        }
        updateDashboard();
      });
    });

    // Run initial dashboard load
    updateDashboard();
  }

  // Risk Lab Aux Controls (Sensitivity Feature Selector, WhatIf 2D Selectors, Profile Presets)
  initRiskLabAuxControls() {
    const meta = this.artifacts.meta || {};
    const featKeys = Object.keys(meta);

    // 1. Sensitivity ICE Curve Dropdown
    const sensSelect = document.getElementById("sensitivity-feat-select");
    if (sensSelect) {
      sensSelect.innerHTML = featKeys.map(k => {
        const lbl = meta[k]?.label || k;
        return `<option value="${k}" ${k === "Age" ? "selected" : ""}>${lbl}</option>`;
      }).join("");

      sensSelect.addEventListener("change", (e) => {
        this.currentSensitivityFeat = e.target.value;
        this.updateSensitivityCurve();
      });
    }

    // 2. What-If 2D Heatmap Dropdowns
    const f1Select = document.getElementById("whatif2d-f1-select");
    const f2Select = document.getElementById("whatif2d-f2-select");

    if (f1Select && f2Select) {
      f1Select.innerHTML = featKeys.map(k => {
        const lbl = meta[k]?.label || k;
        return `<option value="${k}" ${k === "Age" ? "selected" : ""}>${lbl}</option>`;
      }).join("");

      f2Select.innerHTML = featKeys.map(k => {
        const lbl = meta[k]?.label || k;
        return `<option value="${k}" ${k === "BMI" ? "selected" : ""}>${lbl}</option>`;
      }).join("");

      const update2D = () => {
        this.currentWhatIf2DFeats = [f1Select.value, f2Select.value];
        this.updateWhatIf2DGrid();
      };

      f1Select.addEventListener("change", update2D);
      f2Select.addEventListener("change", update2D);
    }

    // 3. Quick Patient Presets in Risk Lab
    document.querySelectorAll(".preset-btn[data-lab-preset]").forEach(btn => {
      btn.addEventListener("click", () => {
        const pType = btn.getAttribute("data-lab-preset");
        let p = { ...DEFAULT_PROFILE };

        if (pType === "healthy") {
          p.Age = 3; p.BMI = 22.0; p.GenHlth = 1; p.HighBP = 0; p.HighChol = 0;
          p.Smoker = 0; p.Diabetes = 0; p.PhysActivity = 1; p.Fruits = 1; p.Veggies = 1;
        } else if (pType === "typical") {
          p.Age = 6; p.BMI = 27.5; p.GenHlth = 2; p.HighBP = 0; p.HighChol = 1;
          p.Smoker = 0; p.Diabetes = 0; p.PhysActivity = 1;
        } else if (pType === "hypertensive") {
          p.Age = 9; p.BMI = 31.0; p.GenHlth = 3; p.HighBP = 1; p.HighChol = 1;
          p.Smoker = 1; p.Diabetes = 0; p.PhysActivity = 0;
        } else if (pType === "critical") {
          p.Age = 11; p.BMI = 34.0; p.GenHlth = 4; p.HighBP = 1; p.HighChol = 1;
          p.Smoker = 1; p.Diabetes = 2; p.Stroke = 1; p.PhysActivity = 0;
        }

        store.setProfile(p);
        this.showToast(`Loaded preset profile: ${btn.textContent.trim()}`);
      });
    });

    // 4. Explain with LIME
    const limeBtn = document.getElementById("btn-explain-lime");
    const limeBox = document.getElementById("lime-result-box");
    if (limeBtn && limeBox) {
      limeBtn.addEventListener("click", async () => {
        limeBtn.disabled = true;
        limeBtn.innerHTML = `<span class="spinner" style="width:12px;height:12px;border-width:2px;margin-right:6px;"></span> Generating Perturbations…`;
        limeBox.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-surface-elevated);border-radius:10px;border:1px solid var(--border-color);color:var(--text-muted);">
            <div class="spinner"></div>
            <span>Generating 1,000 synthetic patient permutations to compute local linear surrogate…</span>
          </div>
        `;

        try {
          const limeData = await api.getLime(store.state.profile);
          const contribs = (limeData.lime_contributions || []).slice(0, 6);
          const maxWeight = Math.max(...contribs.map(c => Math.abs(c.weight))) || 0.1;
          const r2Pct = (limeData.score * 100).toFixed(1);

          limeBox.innerHTML = `
            <div class="lime-breakdown-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border-subtle);">
                <div>
                  <strong style="color:var(--text-main);font-size:12px;">LIME Local Linear Explanation</strong>
                  <div style="font-size:10px;color:var(--text-muted);">Local Surrogate Model Fit: <strong style="color:var(--primary-deep);">${r2Pct}% R²</strong></div>
                </div>
                <span class="kpi-badge badge-green" style="font-size:9px;">1,000 SAMPLES</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${contribs.map((c, i) => {
                  const isInc = c.weight > 0;
                  const barColor = isInc ? 'var(--risk-high)' : 'var(--risk-low)';
                  const barW = Math.max(8, Math.round((Math.abs(c.weight) / maxWeight) * 100));
                  const sign = isInc ? '+' : '';
                  return `
                    <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;background:var(--bg-surface-subtle);padding:6px 10px;border-radius:8px;border:1px solid var(--border-subtle);animation:fadeSlideIn 0.3s ease ${i * 0.05}s both;">
                      <div style="display:flex;align-items:center;gap:6px;max-width:55%;">
                        <span style="font-weight:700;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.label}</span>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px;width:42%;justify-content:flex-end;">
                        <div style="flex-grow:1;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;display:flex;justify-content:${isInc ? 'flex-start' : 'flex-end'};">
                          <div style="height:100%;width:${barW}%;background:${barColor};border-radius:3px;"></div>
                        </div>
                        <span class="mono" style="color:${barColor};font-weight:800;font-size:11px;min-width:44px;text-align:right;">${sign}${(c.weight * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:10px;line-height:1.4;">
                💡 <strong>Surrogate Insight:</strong> LIME creates random samples around this exact patient to measure how small lifestyle shifts affect prediction margins independently from global tree splits.
              </div>
            </div>
          `;
          this.showToast("LIME local explanation computed successfully.");
        } catch (err) {
          limeBox.innerHTML = `<div style="padding:10px;color:var(--risk-high);font-size:11px;">Error computing LIME: ${err.message}</div>`;
        } finally {
          limeBtn.disabled = false;
          limeBtn.innerHTML = `Explain with LIME (Re-run)`;
        }
      });
    }
  }

  async handleProfileChange() {
    try {
      const pred = await api.predict(store.state.profile, store.state.selectedModel);
      store.state.currentPrediction = pred;

      // Update Risk Lab Visualizations
      renderRiskGauge("#gauge-chart", pred);
      renderWaterfall("#waterfall-chart", pred, store.state.audienceMode);
      renderForceBar("#force-bar-chart", pred);
      renderRadar("#radar-chart", store.state.profile);

      // Update Stat Numbers & Narrative
      const statPercentile = document.getElementById("stat-percentile");
      if (statPercentile) statPercentile.textContent = `${pred.percentile.toFixed(0)}th`;

      const statDecision = document.getElementById("stat-decision");
      if (statDecision) {
        statDecision.textContent = pred.is_positive ? "Positive (Above Thresh)" : "Negative (Below Thresh)";
        statDecision.style.color = pred.is_positive ? "var(--risk-high)" : "var(--risk-low)";
      }

      const statLatency = document.getElementById("stat-latency");
      if (statLatency) statLatency.textContent = `${pred.latency_ms} ms`;

      const narrativeEl = document.getElementById("risk-narrative-text");
      if (narrativeEl) narrativeEl.textContent = pred.narrative;

      // Update Sensitivity ICE curve & 2D Grid
      this.updateSensitivityCurve();
      this.updateWhatIf2DGrid();

      // Accessibility Announcement
      const liveRegion = document.getElementById("aria-risk-announcer");
      if (liveRegion) {
        liveRegion.textContent = `Calculated heart disease risk: ${pred.risk_percentage} percent.`;
      }
    } catch (err) {
      console.error("Prediction error:", err);
    }
  }

  async updateSensitivityCurve() {
    try {
      const data = await api.getWhatIf(store.state.profile, this.currentSensitivityFeat, store.state.selectedModel);
      renderSensitivity("#sensitivity-chart", data, (feat, val) => {
        store.updateProfileFeature(feat, val, false);
      });
    } catch (e) {}
  }

  async updateWhatIf2DGrid() {
    try {
      const data = await api.getWhatIf2D(
        store.state.profile,
        this.currentWhatIf2DFeats[0],
        this.currentWhatIf2DFeats[1],
        store.state.selectedModel
      );
      renderWhatIf2D("#whatif2d-chart", data, (f1, v1, f2, v2) => {
        store.updateProfileFeature(f1, v1, false);
        store.updateProfileFeature(f2, v2, true);
      });
    } catch (e) {}
  }

  initPatientMapView() {
    const canvas = document.getElementById("patient-map-canvas");
    this.patientMapInstance = new PatientMapCanvas(canvas, this.artifacts.patientMap, (pt) => {
      if (pt && pt.features) {
        store.setProfile(pt.features);
        this.switchSection("risk-lab");
        this.showToast(`Loaded Patient #${pt.idx ?? ''} profile into Risk Lab (${(pt.risk * 100).toFixed(1)}% risk).`);
      }
    });

    // Color mode selectors
    document.querySelectorAll(".map-color-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        document.querySelectorAll(".map-color-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.patientMapInstance.setColorMode(mode);
      });
    });

    // Place my profile button
    const placeBtn = document.getElementById("btn-place-profile");
    if (placeBtn) {
      placeBtn.addEventListener("click", () => {
        const risk = store.state.currentPrediction ? store.state.currentPrediction.calibrated_risk : 0.1;
        const age = store.state.profile.Age;
        const x = (risk - 0.1) * 350;
        const y = (age - 7) * 12;
        this.patientMapInstance.placeUserProfile(x, y);
        this.showToast("Plotted current profile on 2D SHAP manifold.");
      });
    }

    // Reset zoom and pan button
    const resetMapBtn = document.getElementById("btn-reset-map-view");
    if (resetMapBtn) {
      resetMapBtn.addEventListener("click", () => {
        this.patientMapInstance.scale = 1.0;
        this.patientMapInstance.offsetX = 0;
        this.patientMapInstance.offsetY = 0;
        this.patientMapInstance.render();
        this.showToast("Reset map view to default coordinates.");
      });
    }

    // Phenotype clusters list
    const clustersList = document.getElementById("phenotypes-list");
    if (clustersList && this.artifacts.patientMap.phenotypes) {
      clustersList.innerHTML = this.artifacts.patientMap.phenotypes.map((pt, idx) => `
        <div class="phenotype-item" data-cluster-idx="${idx}">
          <div style="display:flex; justify-content:space-between; font-weight:800;">
            <span style="color:var(--text-main);">C${idx}: ${pt.name}</span>
            <span class="mono" style="color:var(--primary-deep); font-weight:800;">${(pt.observed_rate * 100).toFixed(1)}% event rate</span>
          </div>
          <div style="color:var(--text-muted); font-size:11px; margin-top:4px; line-height:1.4;">
            Cohort Size: <strong>${pt.size}</strong> • Key Drivers: <span style="color:var(--text-main); font-weight:600;">${pt.top_drivers.join(", ")}</span>
          </div>
        </div>
      `).join("");

      // Clicking a phenotype highlights cluster mode
      clustersList.querySelectorAll(".phenotype-item").forEach(item => {
        item.addEventListener("click", () => {
          const cIdx = parseInt(item.getAttribute("data-cluster-idx"));
          this.patientMapInstance.setColorMode("cluster");
          document.querySelectorAll(".map-color-btn").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-mode") === "cluster");
          });
          this.showToast(`Switched map color to Cluster view. Highlighting Cluster ${cIdx}.`);
        });
      });
    }
  }

  initGlobalInsightsView() {
    if (!this.artifacts.globalShap) return;
    renderBeeswarm("#global-beeswarm-chart", this.artifacts.globalShap);
    renderDendrogram("#dendrogram-chart", this.artifacts.globalShap.dendrogram);
  }

  initModelArenaView() {
    if (!this.artifacts.metrics) return;
    const metrics = this.artifacts.metrics;

    const threshSlider = document.getElementById("arena-thresh-slider");
    const threshVal = document.getElementById("arena-thresh-val");

    const updateArenaMetrics = (thresh) => {
      const m = metrics["LightGBM"];
      const table = m.threshold_table;
      const closest = table.reduce((prev, curr) => Math.abs(curr.threshold - thresh) < Math.abs(prev.threshold - thresh) ? curr : prev, table[0]);

      if (threshVal) threshVal.textContent = parseFloat(thresh).toFixed(2);

      const precEl = document.getElementById("arena-precision");
      if (precEl) precEl.textContent = `${(closest.precision * 100).toFixed(1)}%`;

      const recEl = document.getElementById("arena-recall");
      if (recEl) recEl.textContent = `${(closest.recall * 100).toFixed(1)}%`;

      const f1El = document.getElementById("arena-f1");
      if (f1El) f1El.textContent = closest.f1.toFixed(3);

      const sentenceEl = document.getElementById("arena-sentence");
      if (sentenceEl) {
        const caught = Math.round(closest.recall * 100);
        const falseAlarms = Math.round((closest.fp / (closest.fp + closest.tn)) * 1000);
        sentenceEl.textContent = `At operating threshold ${thresh.toFixed(2)}, the calibrated model catches ${caught} of 100 real positive cases, with ${falseAlarms} false positives per 1,000 screened individuals.`;
      }

      renderRocPr("#roc-pr-container", metrics, "LightGBM", thresh);
    };

    const updateSliderTrack = (v) => {
      if (!threshSlider) return;
      const pct = ((v - 0.05) / (0.60 - 0.05)) * 100;
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      const emptyTrack = isLight ? "rgba(0, 85, 204, 0.12)" : "rgba(0, 212, 255, 0.15)";
      const fillColor = isLight ? "#0055CC, #0077EE" : "#00D4FF, #0080FF";
      threshSlider.style.background = `linear-gradient(to right, ${fillColor} ${pct}%, ${emptyTrack} ${pct}%, ${emptyTrack} 100%)`;
    };

    if (threshSlider) {
      threshSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        updateArenaMetrics(val);
        updateSliderTrack(val);
      });
      updateArenaMetrics(0.20);
      updateSliderTrack(0.20);
    }
  }

  initFairnessView() {
    if (!this.artifacts.fairness) return;
    const fData = this.artifacts.fairness;
    const container = document.getElementById("fairness-cards-container");
    if (!container) return;

    container.innerHTML = Object.keys(fData).map(dim => {
      const item = fData[dim];
      return `
        <div class="bento-card col-6">
          <div class="card-header">
            <div>
              <div class="card-title">Subgroup Dimension: ${dim}</div>
              <div class="how-to-read">Equalized odds disparity: ${(item.equalized_odds_diff * 100).toFixed(1)}% | Demographic parity diff: ${(item.demographic_parity_diff * 100).toFixed(1)}%</div>
            </div>
            ${item.flags.length > 0 ? `<span class="kpi-badge badge-red">Flagged Disparity</span>` : `<span class="kpi-badge badge-green">Balanced</span>`}
          </div>
          <div class="card-body">
            <table class="interactive-table mono">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Count</th>
                  <th>Recall (TPR)</th>
                  <th>FPR</th>
                  <th>ROC-AUC</th>
                </tr>
              </thead>
              <tbody>
                ${item.subgroups.map(sg => `
                  <tr>
                    <td style="font-weight:700;">${sg.group}</td>
                    <td>${sg.count}</td>
                    <td style="color:${sg.recall_tpr < 0.60 ? '#F43F5E' : 'var(--text-main)'}; font-weight:700;">${(sg.recall_tpr * 100).toFixed(1)}%</td>
                    <td>${(sg.fpr * 100).toFixed(1)}%</td>
                    <td style="color:#06B6D4;">${sg.roc_auc.toFixed(3)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join("");
  }

  initDataExplorerView() {
    if (!this.artifacts.riskTables) return;
    const tables1d = this.artifacts.riskTables.tables_1d;
    const select = document.getElementById("explorer-feat-select");
    const container = document.getElementById("explorer-table-container");

    if (select && container) {
      select.innerHTML = Object.keys(tables1d).map(f => `<option value="${f}">${f}</option>`).join("");

      const renderTable = (fName) => {
        const data = tables1d[fName] || [];
        container.innerHTML = `
          <table class="interactive-table mono">
            <thead>
              <tr>
                <th>Category</th>
                <th>Total Sample</th>
                <th>Positive Cases</th>
                <th>Observed Prevalence</th>
                <th>95% Wilson Score Interval</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  <td style="font-weight:700;">${row.category}</td>
                  <td>${row.total.toLocaleString()}</td>
                  <td>${row.positive.toLocaleString()}</td>
                  <td style="color:#06B6D4; font-weight:700;">${(row.rate * 100).toFixed(1)}%</td>
                  <td>[${(row.ci_lower * 100).toFixed(1)}% - ${(row.ci_upper * 100).toFixed(1)}%]</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      };

      select.addEventListener("change", (e) => renderTable(e.target.value));
      renderTable("Age");
    }

    // Render Spearman Correlation Matrix
    if (this.artifacts.correlations) {
      renderCorrelationHeatmap("#explorer-corr-container", this.artifacts.correlations, (f1, f2) => {
        this.currentWhatIf2DFeats = [f1, f2];
        const f1Sel = document.getElementById("whatif2d-f1-select");
        const f2Sel = document.getElementById("whatif2d-f2-select");
        if (f1Sel) f1Sel.value = f1;
        if (f2Sel) f2Sel.value = f2;
        this.updateWhatIf2DGrid();
        this.switchSection("risk-lab");
        this.showToast(`Loaded interaction ${f1} × ${f2} into What-If Heatmap.`);
      });
    }
  }

  async _showBatchDemoData(resultsContainer) {
    // Show a pre-computed demo registry (fetched from backend with representative profiles)
    const demoProfiles = [
      {Age:9,BMI:31.2,HighBP:1,HighChol:1,Smoker:1,Diabetes:0,PhysActivity:0,GenHlth:4,MentHlth:10,PhysHlth:15,DiffWalk:1,Sex:1,Education:4,Income:3,Fruits:0,Veggies:0,HvyAlcoholConsump:0,AnyHealthcare:1,NoDocbcCost:0,Stroke:0,HeartDiseaseorAttack:1},
      {Age:6,BMI:24.5,HighBP:0,HighChol:0,Smoker:0,Diabetes:0,PhysActivity:1,GenHlth:1,MentHlth:0,PhysHlth:2,DiffWalk:0,Sex:0,Education:5,Income:6,Fruits:1,Veggies:1,HvyAlcoholConsump:0,AnyHealthcare:1,NoDocbcCost:0,Stroke:0,HeartDiseaseorAttack:0},
      {Age:11,BMI:34.0,HighBP:1,HighChol:1,Smoker:1,Diabetes:2,PhysActivity:0,GenHlth:5,MentHlth:20,PhysHlth:25,DiffWalk:1,Sex:1,Education:3,Income:2,Fruits:0,Veggies:0,HvyAlcoholConsump:0,AnyHealthcare:1,NoDocbcCost:1,Stroke:1,HeartDiseaseorAttack:1},
      {Age:4,BMI:22.0,HighBP:0,HighChol:0,Smoker:0,Diabetes:0,PhysActivity:1,GenHlth:1,MentHlth:0,PhysHlth:0,DiffWalk:0,Sex:0,Education:6,Income:7,Fruits:1,Veggies:1,HvyAlcoholConsump:0,AnyHealthcare:1,NoDocbcCost:0,Stroke:0,HeartDiseaseorAttack:0},
      {Age:8,BMI:28.8,HighBP:1,HighChol:0,Smoker:0,Diabetes:0,PhysActivity:1,GenHlth:2,MentHlth:5,PhysHlth:3,DiffWalk:0,Sex:1,Education:5,Income:5,Fruits:1,Veggies:1,HvyAlcoholConsump:0,AnyHealthcare:1,NoDocbcCost:0,Stroke:0,HeartDiseaseorAttack:0},
      {Age:10,BMI:32.5,HighBP:1,HighChol:1,Smoker:1,Diabetes:1,PhysActivity:0,GenHlth:4,MentHlth:15,PhysHlth:20,DiffWalk:1,Sex:0,Education:3,Income:2,Fruits:0,Veggies:0,HvyAlcoholConsump:0,AnyHealthcare:1,NoDocbcCost:1,Stroke:0,HeartDiseaseorAttack:1},
      {Age:5,BMI:26.1,HighBP:0,HighChol:1,Smoker:0,Diabetes:0,PhysActivity:1,GenHlth:2,MentHlth:2,PhysHlth:2,DiffWalk:0,Sex:0,Education:5,Income:5,Fruits:1,Veggies:0,HvyAlcoholConsump:0,AnyHealthcare:1,NoDocbcCost:0,Stroke:0,HeartDiseaseorAttack:0},
      {Age:12,BMI:29.5,HighBP:1,HighChol:1,Smoker:0,Diabetes:2,PhysActivity:0,GenHlth:3,MentHlth:8,PhysHlth:12,DiffWalk:1,Sex:1,Education:4,Income:3,Fruits:0,Veggies:1,HvyAlcoholConsump:0,AnyHealthcare:1,NoDocbcCost:0,Stroke:0,HeartDiseaseorAttack:0},
      {Age:7,BMI:27.3,HighBP:0,HighChol:0,Smoker:1,Diabetes:0,PhysActivity:0,GenHlth:3,MentHlth:5,PhysHlth:4,DiffWalk:0,Sex:1,Education:4,Income:4,Fruits:0,Veggies:0,HvyAlcoholConsump:1,AnyHealthcare:1,NoDocbcCost:0,Stroke:0,HeartDiseaseorAttack:0},
      {Age:13,BMI:36.0,HighBP:1,HighChol:1,Smoker:1,Diabetes:2,PhysActivity:0,GenHlth:5,MentHlth:25,PhysHlth:30,DiffWalk:1,Sex:0,Education:2,Income:1,Fruits:0,Veggies:0,HvyAlcoholConsump:0,AnyHealthcare:0,NoDocbcCost:1,Stroke:1,HeartDiseaseorAttack:1},
    ];

    if (!resultsContainer) return;
    resultsContainer.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:20px;color:var(--text-muted);"><div class="spinner"></div><span>Scoring 10 clinical demo profiles…</span></div>`;

    try {
      // Create a CSV blob and upload it (matching FEATURES list exactly)
      let csv = "HighBP,HighChol,CholCheck,BMI,Smoker,Stroke,Diabetes,PhysActivity,Fruits,Veggies,HvyAlcoholConsump,AnyHealthcare,NoDocbcCost,GenHlth,MentHlth,PhysHlth,DiffWalk,Sex,Age,Education,Income\n";
      demoProfiles.forEach(p => {
        csv += `${p.HighBP},${p.HighChol},1,${p.BMI},${p.Smoker},${p.Stroke},${p.Diabetes},${p.PhysActivity},${p.Fruits},${p.Veggies},${p.HvyAlcoholConsump},${p.AnyHealthcare},${p.NoDocbcCost},${p.GenHlth},${p.MentHlth},${p.PhysHlth},${p.DiffWalk},${p.Sex},${p.Age},${p.Education},${p.Income}\n`;
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const file = new File([blob], "demo_registry.csv", { type: "text/csv" });
      const res = await api.uploadBatch(file);

      resultsContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:18px;">
          <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-top:3px solid var(--primary-deep); padding:14px 16px; border-radius:12px;">
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800; letter-spacing:0.06em;">Patients Scored</div>
            <div style="font-family:var(--font-display); font-size:24px; font-weight:800; color:var(--primary-deep);">${res.total_rows}</div>
          </div>
          <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-top:3px solid var(--risk-mod); padding:14px 16px; border-radius:12px;">
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800; letter-spacing:0.06em;">Batch Mean Risk</div>
            <div style="font-family:var(--font-display); font-size:24px; font-weight:800; color:var(--risk-mod);">${res.mean_risk_pct}%</div>
          </div>
          <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-top:3px solid var(--risk-high); padding:14px 16px; border-radius:12px;">
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800; letter-spacing:0.06em;">Positive Detection</div>
            <div style="font-family:var(--font-display); font-size:24px; font-weight:800; color:var(--risk-high);">${res.positive_rate_pct}%</div>
          </div>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; font-weight:800; letter-spacing:0.06em;">Clinical Demo Registry — 10 Patients</div>
        <div style="max-height:360px; overflow-y:auto; border:1px solid var(--border-color); border-radius:12px;">
          <table class="interactive-table mono">
            <thead><tr>
              <th>#</th><th>Predicted Risk</th><th>Band</th><th>Decision</th><th>Top Drivers</th><th>Action</th>
            </tr></thead>
            <tbody>
              ${res.rows.map((r, i) => {
                const riskColor = r.risk_pct >= 40 ? 'var(--risk-high)' : r.risk_pct >= 20 ? 'var(--risk-mod)' : 'var(--risk-low)';
                return `
                  <tr style="animation:fadeSlideIn 0.3s ease ${i*0.05}s both;">
                    <td style="font-weight:800; color:var(--text-muted);">${r.id}</td>
                    <td style="font-weight:800; color:${riskColor}; font-size:13px;">${r.risk_pct}%</td>
                    <td><span style="background:${r.risk_pct>=40?'rgba(255,18,69,0.15)':r.risk_pct>=20?'rgba(255,179,0,0.15)':'rgba(0,245,160,0.12)'}; color:${riskColor}; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:800;">${r.risk_band}</span></td>
                    <td style="font-weight:600; color:var(--text-main);">${r.decision}</td>
                    <td style="color:var(--text-muted); font-size:10px;">${r.top_drivers.join(", ")}</td>
                    <td><button class="chip-btn" data-batch-id="${r.id}" style="padding:3px 10px; font-size:11px; background:var(--primary-light); color:var(--primary-deep); font-weight:800; border-color:transparent;">Open in Lab</button></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;

      resultsContainer.querySelectorAll("button[data-batch-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = parseInt(btn.getAttribute("data-batch-id")) - 1;
          const rowData = res.rows[id]?.raw_features;
          if (rowData) { store.setProfile(rowData); this.switchSection("risk-lab"); this.showToast(`Loaded Patient #${id+1} into Risk Lab.`); }
        });
      });
    } catch (err) {
      if (resultsContainer) resultsContainer.innerHTML = `<div class="empty-state-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg><span>Upload a CSV to begin batch scoring</span></div>`;
    }
  }

  initBatchScoringView() {
    const fileInput = document.getElementById("batch-file-input");
    const dropZone = document.getElementById("batch-drop-zone");
    const resultsContainer = document.getElementById("batch-results-container");

    if (!fileInput || !dropZone) return;

    const handleUpload = async (file) => {
      try {
        this.showToast(`Uploading and validating ${file.name}...`);
        const res = await api.uploadBatch(file);
        this.showToast(`Successfully scored ${res.total_rows} records!`);

        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:18px;">
              <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-top:3px solid var(--primary-deep); padding:14px; border-radius:12px;">
                <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Rows Scored</div>
                <div style="font-family:var(--font-display); font-size:24px; font-weight:800; color:var(--primary-deep);">${res.total_rows}</div>
              </div>
              <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-top:3px solid var(--risk-mod); padding:14px; border-radius:12px;">
                <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Batch Mean Risk</div>
                <div style="font-family:var(--font-display); font-size:24px; font-weight:800; color:var(--risk-mod);">${res.mean_risk_pct}%</div>
              </div>
              <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-top:3px solid var(--risk-high); padding:14px; border-radius:12px;">
                <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Positive Rate</div>
                <div style="font-family:var(--font-display); font-size:24px; font-weight:800; color:var(--risk-high);">${res.positive_rate_pct}%</div>
              </div>
            </div>
            <div style="max-height:360px; overflow-y:auto; border:1px solid var(--border-color); border-radius:12px;">
              <table class="interactive-table mono">
                <thead><tr><th>#</th><th>Risk</th><th>Band</th><th>Decision</th><th>Top Drivers</th><th>Action</th></tr></thead>
                <tbody>
                  ${res.rows.slice(0, 100).map(r => {
                    const rc = r.risk_pct >= 40 ? 'var(--risk-high)' : r.risk_pct >= 20 ? 'var(--risk-mod)' : 'var(--risk-low)';
                    return `<tr>
                      <td style="font-weight:800; color:var(--text-muted);">${r.id}</td>
                      <td style="font-weight:800; color:${rc};">${r.risk_pct}%</td>
                      <td>${r.risk_band}</td><td>${r.decision}</td>
                      <td style="font-size:10px;">${r.top_drivers.join(", ")}</td>
                      <td><button class="chip-btn" data-batch-id="${r.id}" style="padding:3px 10px; font-size:11px; background:var(--primary-light); color:var(--primary-deep); font-weight:800;">Open in Lab</button></td>
                    </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
          `;

          resultsContainer.querySelectorAll("button[data-batch-id]").forEach(btn => {
            btn.addEventListener("click", () => {
              const id = parseInt(btn.getAttribute("data-batch-id")) - 1;
              const rowData = res.rows[id]?.raw_features;
              if (rowData) { store.setProfile(rowData); this.switchSection("risk-lab"); this.showToast(`Loaded row #${id+1} into Risk Lab.`); }
            });
          });
        }
      } catch (err) {
        this.showToast(err.message, "error");
      }
    };

    fileInput.addEventListener("change", (e) => { if (e.target.files.length > 0) handleUpload(e.target.files[0]); });
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.borderColor = "var(--primary-deep)"; });
    dropZone.addEventListener("dragleave", () => { dropZone.style.borderColor = "var(--border-color)"; });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault(); dropZone.style.borderColor = "var(--border-color)";
      if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files[0]);
    });

    // Auto-load demo data on init
    this._showBatchDemoData(resultsContainer);
  }

  async _runCohortQuery() {
    const resultsBox = document.getElementById("cohort-results-box");
    if (!resultsBox) return;
    try {
      const ageMinEl = document.getElementById("cohort-age-min");
      const hbpEl    = document.getElementById("cohort-hbp-select");
      const ageMin = parseFloat(ageMinEl ? ageMinEl.value : 1);
      const hbpVal = hbpEl ? hbpEl.value : "all";

      const filters = [{ feature: "Age", min_val: ageMin }];
      if (hbpVal !== "all") filters.push({ feature: "HighBP", exact_val: parseFloat(hbpVal) });

      resultsBox.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:24px;color:var(--text-muted);"><div class="spinner"></div><span>Querying cohort…</span></div>`;

      const data = await api.getCohort(filters);
      resultsBox.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
          <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); padding:12px 16px; border-radius:12px;">
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800; letter-spacing:0.06em;">Cohort Size</div>
            <div style="font-family:var(--font-display); font-weight:800; font-size:22px; color:var(--primary-deep);">${data.cohort_size.toLocaleString()}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${data.population_fraction}% of national sample</div>
          </div>
          <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); padding:12px 16px; border-radius:12px;">
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800; letter-spacing:0.06em;">Observed Event Rate</div>
            <div style="font-family:var(--font-display); font-weight:800; font-size:22px; color:var(--risk-high);">${data.observed_rate_pct}%</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Heart disease / heart attack</div>
          </div>
        </div>
        <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">Top Distinctive SHAP Drivers in this Cohort</div>
        <div style="display:flex; flex-direction:column; gap:5px; font-size:11px;" class="mono">
          ${data.shap_comparison.slice(0, 6).map((sc, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface-elevated); padding:8px 12px; border-radius:8px; border:1px solid var(--border-subtle); animation:fadeSlideIn 0.3s ease ${i*0.07}s both;">
              <span style="font-weight:700; color:var(--text-main);">${sc.label}</span>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="color:var(--primary-deep); font-weight:700;">Cohort: ${sc.cohort_shap > 0 ? '+' : ''}${sc.cohort_shap}</span>
                <span style="color:var(--text-muted);">vs Overall: ${sc.overall_shap}</span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } catch (e) {
      const resultsBox = document.getElementById("cohort-results-box");
      if (resultsBox) resultsBox.innerHTML = `<div style="padding:16px; color:var(--risk-high);">Error: ${e.message}</div>`;
    }
  }

  initCohortStudioView() {
    const runBtn = document.getElementById("btn-run-cohort");
    if (runBtn) runBtn.addEventListener("click", () => this._runCohortQuery());
    // Auto-populate on init
    this._runCohortQuery();
  }

  async _runSimulation() {
    const simResult = document.getElementById("sim-result-box");
    if (!simResult) return;
    try {
      const smokePct = parseFloat(document.getElementById("sim-smoke-pct")?.value || 15);
      const actPct   = parseFloat(document.getElementById("sim-act-pct")?.value || 20);
      const bmiPts   = parseFloat(document.getElementById("sim-bmi-pts")?.value || 1.5);
      const hbpPct   = parseFloat(document.getElementById("sim-hbp-pct")?.value || 25);

      simResult.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:24px;color:var(--text-muted);"><div class="spinner"></div><span>Running population simulation…</span></div>`;

      const res = await api.runSimulation({
        smoking_reduction_pct: smokePct,
        phys_activity_increase_pct: actPct,
        bmi_reduction_points: bmiPts,
        high_bp_control_pct: hbpPct,
        high_chol_control_pct: 25.0
      });

      simResult.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div style="background:var(--bg-surface-elevated); border:1px solid rgba(0,245,160,0.3); padding:14px 18px; border-radius:14px; border-left:4px solid var(--risk-low);">
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Cases Prevented / 1,000</div>
            <div style="font-family:var(--font-display); font-size:28px; font-weight:800; color:var(--risk-low);">-${res.cases_saved_per_1000}</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:3px;">95% CI [${res.saved_interval_95[0]} – ${res.saved_interval_95[1]}]</div>
          </div>
          <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); padding:14px 18px; border-radius:14px;">
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Projected vs Baseline</div>
            <div style="font-family:var(--font-display); font-size:22px; font-weight:800;">${res.projected_cases_per_1000} <span style="font-size:13px; color:var(--text-muted);">vs ${res.base_cases_per_1000}</span></div>
            <div style="font-size:11px; color:var(--risk-low); font-weight:700; margin-top:3px;">↓ ${res.relative_reduction_pct}% relative drop</div>
          </div>
        </div>
        <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">Factor Attribution Breakdown</div>
        <div style="display:flex; flex-direction:column; gap:6px;" class="mono">
          ${res.factor_breakdown.map((fb, i) => {
            const barPct = Math.min(100, (fb.cases_saved_per_1000 / res.cases_saved_per_1000) * 100);
            return `
              <div style="background:var(--bg-surface-elevated); padding:8px 12px; border-radius:10px; animation:fadeSlideIn 0.3s ease ${i*0.08}s both;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <span style="font-size:11px; font-weight:700; color:var(--text-main);">${fb.factor}</span>
                  <span style="color:var(--risk-low); font-weight:800; font-size:11px;">-${fb.cases_saved_per_1000}/1k</span>
                </div>
                <div style="height:4px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden;">
                  <div style="height:100%; width:${barPct}%; background:linear-gradient(90deg,#00F5A0,#00D4FF); border-radius:4px;"></div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
        <div style="font-size:10px; color:var(--text-faint); margin-top:10px; line-height:1.5;">${res.disclaimer}</div>
      `;
    } catch (e) {
      const simResult = document.getElementById("sim-result-box");
      if (simResult) simResult.innerHTML = `<div style="padding:16px; color:var(--risk-high);">Error: ${e.message}</div>`;
    }
  }

  initSimulatorView() {
    const simBtn = document.getElementById("btn-run-sim");
    if (simBtn) simBtn.addEventListener("click", () => this._runSimulation());

    // Connect slider readout labels if present
    const sliders = [
      { id: "sim-smoke-pct", valId: "sim-smoke-val", suffix: "%" },
      { id: "sim-act-pct", valId: "sim-act-val", suffix: "%" },
      { id: "sim-bmi-pts", valId: "sim-bmi-val", suffix: " pts" },
      { id: "sim-hbp-pct", valId: "sim-hbp-val", suffix: "%" }
    ];
    const updateSimTrack = (el) => {
      const min = parseFloat(el.min || 0);
      const max = parseFloat(el.max || 100);
      const val = parseFloat(el.value);
      const pct = ((val - min) / (max - min)) * 100;
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      const emptyTrack = isLight ? "rgba(0, 85, 204, 0.12)" : "rgba(0, 212, 255, 0.15)";
      const fillColor = isLight ? "#0055CC, #0077EE" : "#00D4FF, #0080FF";
      el.style.background = `linear-gradient(to right, ${fillColor} ${pct}%, ${emptyTrack} ${pct}%, ${emptyTrack} 100%)`;
    };

    sliders.forEach(s => {
      const el = document.getElementById(s.id);
      const valEl = document.getElementById(s.valId);
      if (el && valEl) {
        valEl.textContent = `${el.value}${s.suffix}`;
        updateSimTrack(el);
        el.addEventListener("input", (e) => {
          valEl.textContent = `${e.target.value}${s.suffix}`;
          updateSimTrack(e.target);
        });
      }
    });

    // Auto-populate on init
    this._runSimulation();
  }

  async _runCounterfactuals() {
    const cfResults = document.getElementById("cf-plans-container");
    if (!cfResults) return;
    try {
      cfResults.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:32px;color:var(--text-muted);"><div class="spinner"></div><span>Computing minimal-change intervention plans…</span></div>`;

      const modeSel = document.getElementById("cf-target-mode");
      const targetMode = modeSel ? modeSel.value : "below_threshold";
      const targetRisk = targetMode === "custom" ? 0.10 : null;

      const res = await api.getCounterfactuals(store.state.profile, targetRisk, targetMode, null, store.state.selectedModel);

      if (!res.plans || res.plans.length === 0) {
        const curRisk = store.state.currentPrediction ? (store.state.currentPrediction.risk_percentage).toFixed(1) : "low";
        cfResults.innerHTML = `
          <div class="empty-state-placeholder" style="padding:28px 20px; text-align:center;">
            <div style="font-size:32px; margin-bottom:10px;">🌟</div>
            <div style="font-size:16px; font-weight:800; color:var(--text-main); margin-bottom:6px;">Current Patient Risk is Already Low (${curRisk}%)</div>
            <div style="font-size:13px; color:var(--text-muted); max-width:500px; margin:0 auto 18px; line-height:1.5;">
              This individual is already below the 20% risk threshold, so no urgent intervention is required.
              To simulate realistic lifestyle changes and medical action plans, load a higher-risk patient profile below:
            </div>
            <button class="btn-primary" id="btn-load-highrisk-cf" style="margin:0 auto;">
              <span>⚡ Load Patient with Elevated Risk (62yo Hypertensive)</span>
            </button>
          </div>
        `;
        document.getElementById("btn-load-highrisk-cf")?.addEventListener("click", () => {
          store.setProfile(PRESETS.older_hypertensive.profile);
          this._runCounterfactuals();
          this.showToast("Loaded high-risk patient profile into Intervention Planner.");
        });
        return;
      }

      const borderColors = ["#00F5A0", "#00D4FF", "#A855F7"];
      cfResults.innerHTML = res.plans.map((plan, pIdx) => `
        <div class="cf-plan-card" style="--plan-color:${borderColors[pIdx] || '#64748B'}; border-left-color:${borderColors[pIdx] || '#64748B'};">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; gap:12px;">
            <div>
              <div style="font-size:15px; font-weight:800; color:var(--text-main);">${plan.name}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">
                Risk after: <strong style="color:var(--primary-deep);">${plan.resulting_risk_pct}%</strong>
                <span style="margin:0 6px;">•</span>
                Reduction: <strong style="color:var(--risk-low);">-${plan.risk_reduction_pct}% pts</strong>
              </div>
            </div>
            <button class="chip-btn btn-apply-plan" data-plan-idx="${pIdx}" style="background:linear-gradient(135deg, var(--primary-deep), var(--primary-teal)); color:#FFF; font-weight:800; flex-shrink:0; border:none; box-shadow:0 4px 12px rgba(0,212,255,0.3);">Apply to Lab ↗</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:5px; font-size:12px;">
            ${plan.actions.map(a => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface-subtle); padding:8px 12px; border-radius:8px; border:1px solid var(--border-subtle);">
                <span style="font-weight:600; color:var(--text-main);">${a.description}</span>
                <span class="mono" style="color:var(--primary-deep); font-weight:800;">${a.unit_change}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("");

      cfResults.querySelectorAll(".btn-apply-plan").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-plan-idx"));
          const chosen = res.plans[idx].modified_profile;
          store.setProfile(chosen);
          this.switchSection("risk-lab");
          this.showToast(`Applied "${res.plans[idx].name}" to Risk Lab.`);
        });
      });
    } catch (e) {
      const cfResults = document.getElementById("cf-plans-container");
      if (cfResults) cfResults.innerHTML = `<div style="padding:16px; color:var(--risk-high);">Error: ${e.message}</div>`;
    }
  }

  initCompareView() {
    const cfBtn = document.getElementById("btn-generate-cf");
    if (cfBtn) cfBtn.addEventListener("click", () => this._runCounterfactuals());
    const cfMode = document.getElementById("cf-target-mode");
    if (cfMode) cfMode.addEventListener("change", () => this._runCounterfactuals());
    // Auto-populate on init
    this._runCounterfactuals();
  }

  initScrollReveal() {
    // Add reveal class to all bento cards, KPI cards, section headers
    document.querySelectorAll(".bento-card, .kpi-card, .section-header, .slicers-panel, .story-step").forEach((el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = `${(i % 6) * 0.05}s`;
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

    // Re-run reveal when switching sections
    const originalSwitch = this.switchSection.bind(this);
    this.switchSection = (id) => {
      originalSwitch(id);
      setTimeout(() => {
        document.querySelectorAll(".studio-section:not([style*='display: none']) .reveal:not(.visible)").forEach((el, i) => {
          setTimeout(() => el.classList.add("visible"), i * 50);
        });
      }, 80);
    };
  }
}

// Start PulseIQ Studio on DOM load
document.addEventListener("DOMContentLoaded", () => {
  const app = new PulseIQApp();
  app.init();
});
