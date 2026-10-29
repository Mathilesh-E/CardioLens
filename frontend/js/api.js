// CardioLens API Client with Debouncing, Request Cancellation & Cache

class ApiClient {
  constructor() {
    this.baseUrl = "";
    this.cache = new Map();
    this.predictAbortController = null;
    this.predictDebounceTimer = null;
  }

  async get(endpoint) {
    if (this.cache.has(endpoint)) {
      return this.cache.get(endpoint);
    }
    const res = await fetch(`${this.baseUrl}${endpoint}`);
    if (!res.ok) {
      throw new Error(`GET ${endpoint} failed: ${res.statusText}`);
    }
    const data = await res.json();
    this.cache.set(endpoint, data);
    return data;
  }

  async post(endpoint, body, signal = null) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `POST ${endpoint} failed: ${res.statusText}`);
    }
    return await res.json();
  }

  // Debounced predict with request cancellation
  predict(profile, modelName = "LightGBM", debounceMs = 80) {
    return new Promise((resolve, reject) => {
      if (this.predictDebounceTimer) {
        clearTimeout(this.predictDebounceTimer);
      }
      if (this.predictAbortController) {
        this.predictAbortController.abort();
      }

      this.predictDebounceTimer = setTimeout(async () => {
        this.predictAbortController = new AbortController();
        try {
          const result = await this.post("/api/predict", {
            profile,
            model_name: modelName
          }, this.predictAbortController.signal);
          resolve(result);
        } catch (err) {
          if (err.name !== "AbortError") {
            reject(err);
          }
        }
      }, debounceMs);
    });
  }

  async getWhatIf(profile, feature, modelName = "LightGBM") {
    return this.post("/api/whatif", { profile, feature, model_name: modelName });
  }

  async getWhatIf2D(profile, feature1, feature2, modelName = "LightGBM") {
    return this.post("/api/whatif2d", { profile, feature1, feature2, model_name: modelName });
  }

  async getLime(profile) {
    return this.post("/api/lime", { profile });
  }

  async getCounterfactuals(profile, targetRisk = null, targetMode = "below_threshold", allowedFeatures = null, modelName = "LightGBM") {
    return this.post("/api/counterfactual", {
      profile,
      target_risk: targetRisk,
      target_mode: targetMode,
      allowed_features: allowedFeatures,
      model_name: modelName
    });
  }

  async getCohort(filters) {
    return this.post("/api/cohort", { filters });
  }

  async runSimulation(params) {
    return this.post("/api/simulate", params);
  }

  async uploadBatch(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${this.baseUrl}/api/batch`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Batch scoring upload failed.");
    }
    return await res.json();
  }
}

export const api = new ApiClient();
