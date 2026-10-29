from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, field_validator

class ProfileInput(BaseModel):
    HighBP: float = Field(default=0.0, ge=0.0, le=1.0)
    HighChol: float = Field(default=0.0, ge=0.0, le=1.0)
    CholCheck: float = Field(default=1.0, ge=0.0, le=1.0)
    BMI: float = Field(default=28.0, ge=10.0, le=70.0)
    Smoker: float = Field(default=0.0, ge=0.0, le=1.0)
    Stroke: float = Field(default=0.0, ge=0.0, le=1.0)
    Diabetes: float = Field(default=0.0, ge=0.0, le=2.0)
    PhysActivity: float = Field(default=1.0, ge=0.0, le=1.0)
    Fruits: float = Field(default=1.0, ge=0.0, le=1.0)
    Veggies: float = Field(default=1.0, ge=0.0, le=1.0)
    HvyAlcoholConsump: float = Field(default=0.0, ge=0.0, le=1.0)
    AnyHealthcare: float = Field(default=1.0, ge=0.0, le=1.0)
    NoDocbcCost: float = Field(default=0.0, ge=0.0, le=1.0)
    GenHlth: float = Field(default=2.0, ge=1.0, le=5.0)
    MentHlth: float = Field(default=0.0, ge=0.0, le=30.0)
    PhysHlth: float = Field(default=0.0, ge=0.0, le=30.0)
    DiffWalk: float = Field(default=0.0, ge=0.0, le=1.0)
    Sex: float = Field(default=0.0, ge=0.0, le=1.0)
    Age: float = Field(default=8.0, ge=1.0, le=13.0)
    Education: float = Field(default=5.0, ge=1.0, le=6.0)
    Income: float = Field(default=7.0, ge=1.0, le=8.0)

    def to_array(self, feature_order: List[str]) -> List[float]:
        data = self.model_dump()
        return [float(data[f]) for f in feature_order]

class PredictRequest(BaseModel):
    profile: ProfileInput
    model_name: Optional[str] = "LightGBM"

class WhatIfRequest(BaseModel):
    profile: ProfileInput
    feature: str
    model_name: Optional[str] = "LightGBM"

class WhatIf2DRequest(BaseModel):
    profile: ProfileInput
    feature1: str
    feature2: str
    model_name: Optional[str] = "LightGBM"

class CounterfactualRequest(BaseModel):
    profile: ProfileInput
    target_risk: Optional[float] = None
    target_mode: Optional[str] = "below_threshold" # "below_threshold" or "custom"
    allowed_features: Optional[List[str]] = None
    model_name: Optional[str] = "LightGBM"

class FilterCriterion(BaseModel):
    feature: str
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    exact_val: Optional[Union[float, List[float]]] = None

class CohortRequest(BaseModel):
    filters: List[FilterCriterion]

class SimulateRequest(BaseModel):
    smoking_reduction_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    phys_activity_increase_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    bmi_reduction_points: float = Field(default=0.0, ge=0.0, le=10.0)
    high_bp_control_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    high_chol_control_pct: float = Field(default=0.0, ge=0.0, le=100.0)
