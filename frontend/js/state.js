// CardioLens Reactive State Management & History Store

export const DEFAULT_PROFILE = {
  HighBP: 0.0,
  HighChol: 0.0,
  CholCheck: 1.0,
  BMI: 26.5,
  Smoker: 0.0,
  Stroke: 0.0,
  Diabetes: 0.0,
  PhysActivity: 1.0,
  Fruits: 1.0,
  Veggies: 1.0,
  HvyAlcoholConsump: 0.0,
  AnyHealthcare: 1.0,
  NoDocbcCost: 0.0,
  GenHlth: 2.0,
  MentHlth: 2.0,
  PhysHlth: 1.0,
  DiffWalk: 0.0,
  Sex: 0.0,
  Age: 7.0,      // 50-54
  Education: 5.0,// Some College
  Income: 6.0    // $35k-$50k
};

export const PRESETS = {
  healthy_young: {
    name: "Healthy Young Adult",
    profile: {
      HighBP: 0.0, HighChol: 0.0, CholCheck: 1.0, BMI: 22.0, Smoker: 0.0,
      Stroke: 0.0, Diabetes: 0.0, PhysActivity: 1.0, Fruits: 1.0, Veggies: 1.0,
      HvyAlcoholConsump: 0.0, AnyHealthcare: 1.0, NoDocbcCost: 0.0,
      GenHlth: 1.0, MentHlth: 0.0, PhysHlth: 0.0, DiffWalk: 0.0,
      Sex: 0.0, Age: 2.0, Education: 6.0, Income: 8.0
    }
  },
  older_hypertensive: {
    name: "Older with Hypertension",
    profile: {
      HighBP: 1.0, HighChol: 1.0, CholCheck: 1.0, BMI: 28.5, Smoker: 0.0,
      Stroke: 0.0, Diabetes: 0.0, PhysActivity: 0.0, Fruits: 1.0, Veggies: 1.0,
      HvyAlcoholConsump: 0.0, AnyHealthcare: 1.0, NoDocbcCost: 0.0,
      GenHlth: 3.0, MentHlth: 3.0, PhysHlth: 4.0, DiffWalk: 0.0,
      Sex: 1.0, Age: 10.0, Education: 4.0, Income: 5.0
    }
  },
  high_risk_multifactor: {
    name: "High-Risk Multi-Factor",
    profile: {
      HighBP: 1.0, HighChol: 1.0, CholCheck: 1.0, BMI: 34.0, Smoker: 1.0,
      Stroke: 0.0, Diabetes: 2.0, PhysActivity: 0.0, Fruits: 0.0, Veggies: 0.0,
      HvyAlcoholConsump: 1.0, AnyHealthcare: 1.0, NoDocbcCost: 1.0,
      GenHlth: 4.0, MentHlth: 10.0, PhysHlth: 15.0, DiffWalk: 1.0,
      Sex: 1.0, Age: 9.0, Education: 3.0, Income: 3.0
    }
  },
  population_average: {
    name: "Population Median",
    profile: { ...DEFAULT_PROFILE }
  }
};

class StateStore {
  constructor() {
    this.state = {
      profile: { ...DEFAULT_PROFILE },
      profileA: { ...DEFAULT_PROFILE },
      profileB: { ...PRESETS.high_risk_multifactor.profile },
      currentPrediction: null,
      selectedModel: "LightGBM",
      audienceMode: "plain", // "plain" | "technical"
      currentSection: "risk-lab",
      theme: localStorage.getItem("pulseiq_theme") || "dark",
      savedProfiles: JSON.parse(localStorage.getItem("pulseiq_saved") || localStorage.getItem("cardiolens_saved") || "[]")
    };
    
    this.listeners = new Map();
    this.undoStack = [];
    this.redoStack = [];
    
    // Parse URL hash if present
    this.loadFromHash();
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }

  notify(key, value) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(cb => cb(value, this.state));
    }
    if (this.listeners.has("*")) {
      this.listeners.get("*").forEach(cb => cb(key, value, this.state));
    }
  }

  set(key, value) {
    this.state[key] = value;
    this.notify(key, value);
  }

  updateProfileFeature(feature, value, recordHistory = true) {
    if (recordHistory) {
      this.undoStack.push({ ...this.state.profile });
      this.redoStack = [];
    }
    this.state.profile[feature] = parseFloat(value);
    this.syncToHash();
    this.notify("profile", this.state.profile);
  }

  setProfile(newProfile, recordHistory = true) {
    if (recordHistory) {
      this.undoStack.push({ ...this.state.profile });
      this.redoStack = [];
    }
    this.state.profile = { ...newProfile };
    this.syncToHash();
    this.notify("profile", this.state.profile);
  }

  undo() {
    if (this.undoStack.length > 0) {
      this.redoStack.push({ ...this.state.profile });
      const prev = this.undoStack.pop();
      this.state.profile = prev;
      this.syncToHash();
      this.notify("profile", this.state.profile);
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      this.undoStack.push({ ...this.state.profile });
      const nxt = this.redoStack.pop();
      this.state.profile = nxt;
      this.syncToHash();
      this.notify("profile", this.state.profile);
    }
  }

  toggleTheme() {
    const nextTheme = this.state.theme === "light" ? "dark" : "light";
    this.state.theme = nextTheme;
    localStorage.setItem("pulseiq_theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    this.notify("theme", nextTheme);
  }

  toggleAudienceMode() {
    const next = this.state.audienceMode === "plain" ? "technical" : "plain";
    this.state.audienceMode = next;
    this.notify("audienceMode", next);
  }

  syncToHash() {
    try {
      const encoded = encodeURIComponent(JSON.stringify(this.state.profile));
      window.location.hash = `p=${encoded}`;
    } catch (e) {}
  }

  loadFromHash() {
    try {
      const hash = window.location.hash;
      if (hash && hash.startsWith("#p=")) {
        const jsonStr = decodeURIComponent(hash.substring(3));
        const parsed = JSON.parse(jsonStr);
        this.state.profile = { ...DEFAULT_PROFILE, ...parsed };
      }
    } catch (e) {}
  }

  saveProfile(name) {
    const item = {
      id: Date.now(),
      name: name || `Profile ${new Date().toLocaleTimeString()}`,
      profile: { ...this.state.profile },
      created: new Date().toISOString()
    };
    this.state.savedProfiles.push(item);
    localStorage.setItem("cardiolens_saved", JSON.stringify(this.state.savedProfiles));
    this.notify("savedProfiles", this.state.savedProfiles);
    return item;
  }
}

export const store = new StateStore();
