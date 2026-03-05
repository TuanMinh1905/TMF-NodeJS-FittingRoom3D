# ===== SMPL Python Microservice =====
# Service FastAPI tách biệt, chuyên xử lý mô hình SMPL
# - Load SMPL model (pre-trained trên 4000 body scans)
# - Nhận 10 tham số β → sinh mesh 3D (6890 vertices, 13776 faces)
# - Trả về OBJ text hoặc JSON (vertices + faces)
#
# Port: 8001
# Endpoints:
#   POST /mesh        → β[10] → OBJ mesh string
#   POST /mesh/json   → β[10] → { vertices: [], faces: [] }
#   GET  /info        → thông tin model (vertex count, face count, ...)

import os
import json
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pickle
import chumpy  # type: ignore

# ==================== SMPL Model Loader ====================
# SMPL paper: Loper et al. 2015
# Model đã train sẵn trên ~4000 body scans → PCA shape space 10 chiều
# Mỗi khi thay đổi β[0..9], mesh body thay đổi tương ứng

class SMPLModel:
    """
    Loader cho SMPL .pkl model file.
    
    SMPL Forward Kinematics (simplified, T-pose only):
        v_shaped = v_template + shapedirs @ β     (blend shapes)
        v_posed  = v_shaped  (T-pose, θ = 0)
    
    Với:
        v_template: (6890, 3) — mean shape vertices
        shapedirs:  (6890, 3, 10) — PCA shape basis vectors
        β:          (10,) — shape coefficients
        faces:      (13776, 3) — triangle indices
    """
    
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.ready = False
        
        # Loaded data
        self.v_template: Optional[np.ndarray] = None  # (6890, 3)
        self.shapedirs: Optional[np.ndarray] = None    # (6890, 3, 10)
        self.faces: Optional[np.ndarray] = None        # (13776, 3)
        self.n_betas = 10
        
        # Metadata
        self.n_vertices = 0
        self.n_faces = 0
    
    def load(self):
        """Load SMPL model từ .pkl file"""
        if not os.path.exists(self.model_path):
            print(f"[SMPL] Model file not found: {self.model_path}")
            print("[SMPL] Falling back to procedural body generator")
            self._init_procedural()
            return
        
        try:
            with open(self.model_path, 'rb') as f:
                model_data = pickle.load(f, encoding='latin1')
            
            # Extract cần thiết cho shape blending
            # v_template: mean body shape
            v_template = model_data['v_template']
            if hasattr(v_template, 'r'):  # chumpy array
                self.v_template = np.array(v_template.r)
            else:
                self.v_template = np.array(v_template)
            
            # shapedirs: PCA shape basis 
            shapedirs = model_data['shapedirs']
            if hasattr(shapedirs, 'r'):
                self.shapedirs = np.array(shapedirs.r)
            else:
                self.shapedirs = np.array(shapedirs)
            
            # Chỉ lấy 10 components đầu
            if self.shapedirs.shape[2] > self.n_betas:
                self.shapedirs = self.shapedirs[:, :, :self.n_betas]
            
            # faces: triangle indices
            self.faces = np.array(model_data['f']).astype(np.int32)
            
            self.n_vertices = self.v_template.shape[0]
            self.n_faces = self.faces.shape[0]
            self.ready = True
            
            print(f"[SMPL] Loaded model: {self.n_vertices} vertices, {self.n_faces} faces")
            print(f"[SMPL] Shape basis: {self.shapedirs.shape} → {self.n_betas} β parameters")
            
        except Exception as e:
            print(f"[SMPL] Error loading model: {e}")
            print("[SMPL] Falling back to procedural body generator")
            self._init_procedural()
    
    def _init_procedural(self):
        """
        Fallback: tạo mesh procedural khi chưa có file SMPL .pkl
        Sinh một body mesh parametric đơn giản (torso + arms + legs + head)
        sử dụng ống trụ + cầu, parametrized bởi β[0..9].
        """
        self.v_template, self.faces = _generate_procedural_body()
        self.n_vertices = self.v_template.shape[0]
        self.n_faces = self.faces.shape[0]
        # Tạo shapedirs giả lập PCA
        self.shapedirs = _generate_procedural_shapedirs(self.v_template, self.n_betas)
        self.ready = True
        print(f"[SMPL] Procedural body: {self.n_vertices} vertices, {self.n_faces} faces")
    
    def forward(self, betas: np.ndarray) -> np.ndarray:
        """
        SMPL forward pass (shape only, T-pose).
        
        v = v_template + Σ(βᵢ × shapedirs[:,:,i])
        
        Args:
            betas: (10,) shape coefficients
        Returns:
            vertices: (N, 3) positioned vertices
        """
        if not self.ready:
            raise RuntimeError("Model not loaded")
        
        # Clamp betas to reasonable range
        betas = np.clip(betas, -3.0, 3.0)
        
        # Shape blend: v = v_template + shapedirs @ β
        # shapedirs: (6890, 3, 10), betas: (10,) → (6890, 3)
        v_shaped = self.v_template + np.einsum('ijk,k->ij', self.shapedirs, betas)
        
        return v_shaped
    
    def get_mesh(self, betas: List[float]) -> dict:
        """
        Sinh mesh từ β parameters.
        Returns dict có vertices (list of [x,y,z]) và faces (list of [i,j,k]).
        """
        beta_arr = np.array(betas[:self.n_betas], dtype=np.float64)
        # Pad nếu thiếu
        if len(beta_arr) < self.n_betas:
            beta_arr = np.pad(beta_arr, (0, self.n_betas - len(beta_arr)))
        
        vertices = self.forward(beta_arr)
        
        return {
            'vertices': vertices.tolist(),
            'faces': self.faces.tolist(),
            'n_vertices': int(self.n_vertices),
            'n_faces': int(self.n_faces),
        }
    
    def get_obj(self, betas: List[float]) -> str:
        """
        Sinh mesh dưới dạng OBJ text string.
        Format: v x y z (vertices) + f i j k (faces, 1-indexed)
        """
        mesh = self.get_mesh(betas)
        
        lines = [
            "# SMPL Body Mesh",
            f"# Vertices: {mesh['n_vertices']}",
            f"# Faces: {mesh['n_faces']}",
            f"# Beta: {betas}",
            "",
        ]
        
        # Vertices
        for v in mesh['vertices']:
            lines.append(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}")
        
        lines.append("")
        
        # Faces (OBJ is 1-indexed)
        for f in mesh['faces']:
            lines.append(f"f {f[0]+1} {f[1]+1} {f[2]+1}")
        
        return "\n".join(lines)


# ==================== Procedural Body Generator ====================
# Khi chưa có file SMPL .pkl, sinh body mesh parametric

def _cylinder_mesh(radius: float, height: float, segments: int, 
                   center: np.ndarray, rings: int = 8) -> tuple:
    """Tạo cylinder mesh (ống trụ) cho body parts"""
    vertices = []
    faces = []
    
    for ring in range(rings + 1):
        t = ring / rings
        y = center[1] - height/2 + t * height
        r = radius * (1.0 - 0.1 * abs(t - 0.5))  # Slight taper
        
        for seg in range(segments):
            angle = 2.0 * np.pi * seg / segments
            x = center[0] + r * np.cos(angle)
            z = center[2] + r * np.sin(angle)
            vertices.append([x, y, z])
    
    # Faces
    for ring in range(rings):
        for seg in range(segments):
            v0 = ring * segments + seg
            v1 = ring * segments + (seg + 1) % segments
            v2 = (ring + 1) * segments + (seg + 1) % segments
            v3 = (ring + 1) * segments + seg
            faces.append([v0, v1, v2])
            faces.append([v0, v2, v3])
    
    return np.array(vertices), np.array(faces, dtype=np.int32)


def _sphere_mesh(radius: float, center: np.ndarray, 
                 lat_segments: int = 12, lon_segments: int = 16) -> tuple:
    """Tạo sphere mesh (hình cầu) cho head"""
    vertices = []
    faces = []
    
    for lat in range(lat_segments + 1):
        theta = np.pi * lat / lat_segments
        for lon in range(lon_segments):
            phi = 2.0 * np.pi * lon / lon_segments
            x = center[0] + radius * np.sin(theta) * np.cos(phi)
            y = center[1] + radius * np.cos(theta)
            z = center[2] + radius * np.sin(theta) * np.sin(phi)
            vertices.append([x, y, z])
    
    for lat in range(lat_segments):
        for lon in range(lon_segments):
            v0 = lat * lon_segments + lon
            v1 = lat * lon_segments + (lon + 1) % lon_segments
            v2 = (lat + 1) * lon_segments + (lon + 1) % lon_segments
            v3 = (lat + 1) * lon_segments + lon
            faces.append([v0, v1, v2])
            faces.append([v0, v2, v3])
    
    return np.array(vertices), np.array(faces, dtype=np.int32)


def _tapered_cylinder(r_top: float, r_bottom: float, height: float, 
                      segments: int, center: np.ndarray, rings: int = 10) -> tuple:
    """Cylinder với bán kính thay đổi (torso, legs)"""
    vertices = []
    faces = []
    
    for ring in range(rings + 1):
        t = ring / rings
        y = center[1] - height/2 + t * height
        r = r_bottom + t * (r_top - r_bottom)
        
        for seg in range(segments):
            angle = 2.0 * np.pi * seg / segments
            x = center[0] + r * np.cos(angle)
            z = center[2] + r * np.sin(angle)
            vertices.append([x, y, z])
    
    for ring in range(rings):
        for seg in range(segments):
            v0 = ring * segments + seg
            v1 = ring * segments + (seg + 1) % segments
            v2 = (ring + 1) * segments + (seg + 1) % segments
            v3 = (ring + 1) * segments + seg
            faces.append([v0, v1, v2])
            faces.append([v0, v2, v3])
    
    return np.array(vertices), np.array(faces, dtype=np.int32)


def _elliptical_cylinder(rx: float, rz: float, height: float,
                         segments: int, center: np.ndarray, rings: int = 10) -> tuple:
    """Cylinder với tiết diện elip (torso realistic hơn)"""
    vertices = []
    faces = []
    
    for ring in range(rings + 1):
        t = ring / rings
        y = center[1] - height/2 + t * height
        
        for seg in range(segments):
            angle = 2.0 * np.pi * seg / segments
            x = center[0] + rx * np.cos(angle)
            z = center[2] + rz * np.sin(angle)
            vertices.append([x, y, z])
    
    for ring in range(rings):
        for seg in range(segments):
            v0 = ring * segments + seg
            v1 = ring * segments + (seg + 1) % segments
            v2 = (ring + 1) * segments + (seg + 1) % segments
            v3 = (ring + 1) * segments + seg
            faces.append([v0, v1, v2])
            faces.append([v0, v2, v3])
    
    return np.array(vertices), np.array(faces, dtype=np.int32)


def _generate_procedural_body() -> tuple:
    """
    Sinh mesh body parametric T-pose, đơn vị mét.
    Gốc tọa độ tại giữa hông.
    Body parts: head, neck, chest, waist, hip, upper arms, lower arms, 
                hands, thighs, calves, feet
    """
    all_verts = []
    all_faces = []
    seg = 16  # segments per ring
    vertex_offset = 0
    
    def add_part(verts, faces):
        nonlocal vertex_offset
        all_verts.append(verts)
        all_faces.append(faces + vertex_offset)
        vertex_offset += len(verts)
    
    # Head (sphere)
    v, f = _sphere_mesh(0.10, np.array([0, 0.67, 0]), 10, seg)
    add_part(v, f)
    
    # Neck (cylinder)
    v, f = _cylinder_mesh(0.04, 0.06, seg, np.array([0, 0.54, 0]), 4)
    add_part(v, f)
    
    # Chest (elliptical cylinder — wider than deep)
    v, f = _elliptical_cylinder(0.17, 0.11, 0.22, seg, np.array([0, 0.40, 0]), 8)
    add_part(v, f)
    
    # Waist (elliptical, narrower)
    v, f = _elliptical_cylinder(0.14, 0.09, 0.12, seg, np.array([0, 0.23, 0]), 6)
    add_part(v, f)
    
    # Hip (elliptical, wider)
    v, f = _elliptical_cylinder(0.16, 0.11, 0.14, seg, np.array([0, 0.10, 0]), 6)
    add_part(v, f)
    
    # Left upper arm
    v, f = _tapered_cylinder(0.04, 0.035, 0.28, seg, np.array([0.23, 0.38, 0]), 8)
    add_part(v, f)
    
    # Left lower arm
    v, f = _tapered_cylinder(0.035, 0.025, 0.26, seg, np.array([0.23, 0.07, 0]), 8)
    add_part(v, f)
    
    # Left hand (sphere)
    v, f = _sphere_mesh(0.035, np.array([0.23, -0.10, 0]), 6, 8)
    add_part(v, f)
    
    # Right upper arm
    v, f = _tapered_cylinder(0.04, 0.035, 0.28, seg, np.array([-0.23, 0.38, 0]), 8)
    add_part(v, f)
    
    # Right lower arm
    v, f = _tapered_cylinder(0.035, 0.025, 0.26, seg, np.array([-0.23, 0.07, 0]), 8)
    add_part(v, f)
    
    # Right hand
    v, f = _sphere_mesh(0.035, np.array([-0.23, -0.10, 0]), 6, 8)
    add_part(v, f)
    
    # Left thigh
    v, f = _tapered_cylinder(0.065, 0.05, 0.40, seg, np.array([0.09, -0.17, 0]), 10)
    add_part(v, f)
    
    # Left calf
    v, f = _tapered_cylinder(0.045, 0.035, 0.40, seg, np.array([0.09, -0.59, 0]), 10)
    add_part(v, f)
    
    # Left foot (box-like)
    v, f = _elliptical_cylinder(0.04, 0.07, 0.04, seg, np.array([0.09, -0.81, 0.02]), 4)
    add_part(v, f)
    
    # Right thigh
    v, f = _tapered_cylinder(0.065, 0.05, 0.40, seg, np.array([-0.09, -0.17, 0]), 10)
    add_part(v, f)
    
    # Right calf
    v, f = _tapered_cylinder(0.045, 0.035, 0.40, seg, np.array([-0.09, -0.59, 0]), 10)
    add_part(v, f)
    
    # Right foot
    v, f = _elliptical_cylinder(0.04, 0.07, 0.04, seg, np.array([-0.09, -0.81, 0.02]), 4)
    add_part(v, f)
    
    vertices = np.vstack(all_verts)
    faces = np.vstack(all_faces).astype(np.int32)
    
    return vertices, faces


def _generate_procedural_shapedirs(v_template: np.ndarray, n_betas: int) -> np.ndarray:
    """
    Tạo shape basis giả lập, map β[0..9] → biến dạng mesh.
    
    β₀ = height: scale Y toàn bộ
    β₁ = weight/volume: scale XZ toàn bộ
    β₂ = chest: scale XZ quanh vùng chest (y ∈ [0.29, 0.51])
    β₃ = waist: scale XZ quanh vùng waist (y ∈ [0.17, 0.29])
    β₄ = hip: scale XZ quanh vùng hip (y ∈ [0.03, 0.17])
    β₅ = BMI/fatness: scale XZ tăng mạnh hơn
    β₆ = chest-waist diff: chest XZ tăng, waist XZ giảm
    β₇ = hip-waist diff: hip XZ tăng, waist XZ giảm
    β₈ = torso length: scale Y vùng torso
    β₉ = limb thickness: scale XZ vùng cánh tay + chân 
    """
    N = v_template.shape[0]
    shapedirs = np.zeros((N, 3, n_betas), dtype=np.float64)
    
    # Y ranges for body regions
    y = v_template[:, 1]
    
    # Region masks
    chest_mask = (y > 0.29) & (y < 0.51)
    waist_mask = (y > 0.17) & (y <= 0.29)
    hip_mask = (y > 0.03) & (y <= 0.17)
    torso_mask = chest_mask | waist_mask | hip_mask
    arm_mask = ((np.abs(v_template[:, 0]) > 0.18) & (y > -0.15))
    leg_mask = (y < 0.03) & (np.abs(v_template[:, 0]) < 0.15)
    
    scale = 0.03  # base deformation amplitude
    
    # β₀: height → scale Y globally
    shapedirs[:, 1, 0] = y * scale * 1.5
    
    # β₁: weight → scale XZ globally (fatter/thinner)
    shapedirs[:, 0, 1] = v_template[:, 0] * scale * 2.0
    shapedirs[:, 2, 1] = v_template[:, 2] * scale * 2.0
    
    # β₂: chest size
    shapedirs[chest_mask, 0, 2] = v_template[chest_mask, 0] * scale * 3.0
    shapedirs[chest_mask, 2, 2] = v_template[chest_mask, 2] * scale * 3.0
    
    # β₃: waist size
    shapedirs[waist_mask, 0, 3] = v_template[waist_mask, 0] * scale * 3.0
    shapedirs[waist_mask, 2, 3] = v_template[waist_mask, 2] * scale * 3.0
    
    # β₄: hip size
    shapedirs[hip_mask, 0, 4] = v_template[hip_mask, 0] * scale * 3.0
    shapedirs[hip_mask, 2, 4] = v_template[hip_mask, 2] * scale * 3.0
    
    # β₅: BMI/fatness → stronger XZ everywhere
    shapedirs[:, 0, 5] = v_template[:, 0] * scale * 2.5
    shapedirs[:, 2, 5] = v_template[:, 2] * scale * 2.5
    
    # β₆: chest-waist diff → chest expands, waist contracts
    shapedirs[chest_mask, 0, 6] = v_template[chest_mask, 0] * scale * 2.0
    shapedirs[chest_mask, 2, 6] = v_template[chest_mask, 2] * scale * 2.0
    shapedirs[waist_mask, 0, 6] = -v_template[waist_mask, 0] * scale * 1.5
    shapedirs[waist_mask, 2, 6] = -v_template[waist_mask, 2] * scale * 1.5
    
    # β₇: hip-waist diff → hip expands, waist contracts
    shapedirs[hip_mask, 0, 7] = v_template[hip_mask, 0] * scale * 2.0
    shapedirs[hip_mask, 2, 7] = v_template[hip_mask, 2] * scale * 2.0
    shapedirs[waist_mask, 0, 7] = -v_template[waist_mask, 0] * scale * 1.5
    shapedirs[waist_mask, 2, 7] = -v_template[waist_mask, 2] * scale * 1.5
    
    # β₈: torso length → Y scale in torso region
    shapedirs[torso_mask, 1, 8] = (y[torso_mask] - 0.25) * scale * 2.0
    
    # β₉: limb thickness → XZ scale arms + legs
    shapedirs[arm_mask, 0, 9] = v_template[arm_mask, 0] * scale * 2.0
    shapedirs[arm_mask, 2, 9] = v_template[arm_mask, 2] * scale * 2.0
    shapedirs[leg_mask, 0, 9] = v_template[leg_mask, 0] * scale * 2.0
    shapedirs[leg_mask, 2, 9] = v_template[leg_mask, 2] * scale * 2.0
    
    return shapedirs


# ==================== FastAPI App ====================

app = FastAPI(
    title="TMFashion SMPL Service",
    description="Microservice sinh mesh cơ thể 3D từ SMPL β parameters",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3005", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Load Model ----
# Tìm SMPL model file, hỗ trợ nhiều vị trí
MODEL_PATHS = [
    os.path.join(os.path.dirname(__file__), 'models', 'SMPL_NEUTRAL.pkl'),
    os.path.join(os.path.dirname(__file__), 'models', 'SMPL_FEMALE.pkl'),
    os.path.join(os.path.dirname(__file__), 'models', 'SMPL_MALE.pkl'),
    os.path.join(os.path.dirname(__file__), 'models', 'basicModel_neutral_lbs_10_207_0_v1.0.0.pkl'),
]

model: Optional[SMPLModel] = None

@app.on_event("startup")
async def load_model():
    global model
    # Tìm file model .pkl
    model_path = None
    for p in MODEL_PATHS:
        if os.path.exists(p):
            model_path = p
            break
    
    if model_path:
        print(f"[SMPL] Found model: {model_path}")
        model = SMPLModel(model_path)
    else:
        print("[SMPL] No .pkl model file found — using procedural generator")
        print("[SMPL] Để dùng SMPL thật, tải model từ https://smpl.is.tue.mpg.de/")
        print(f"[SMPL] Đặt file .pkl vào: {os.path.join(os.path.dirname(__file__), 'models')}/")
        model = SMPLModel("__procedural__")
    
    model.load()
    print(f"[SMPL] Service ready! Vertices: {model.n_vertices}, Faces: {model.n_faces}")


# ---- Request/Response Models ----

class BetaRequest(BaseModel):
    """10 tham số β shape"""
    betas: List[float]
    
    class Config:
        json_schema_extra = {
            "example": {
                "betas": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            }
        }

class MeasurementsRequest(BaseModel):
    """Nhập số đo → tự tính β"""
    height: float  # cm
    weight: float  # kg
    chest: float = 88.0  # cm
    waist: float = 72.0  # cm
    hip: float = 92.0    # cm

class MeshInfoResponse(BaseModel):
    n_vertices: int
    n_faces: int
    n_betas: int
    model_type: str  # 'smpl_pkl' hoặc 'procedural'


# ---- Endpoints ----

@app.get("/info", response_model=MeshInfoResponse)
async def get_info():
    """Thông tin model (số vertex, face, loại model)"""
    if not model or not model.ready:
        raise HTTPException(500, "Model not loaded")
    
    model_type = "smpl_pkl" if os.path.exists(model.model_path) else "procedural"
    return MeshInfoResponse(
        n_vertices=model.n_vertices,
        n_faces=model.n_faces,
        n_betas=model.n_betas,
        model_type=model_type,
    )

@app.post("/mesh/json")
async def get_mesh_json(req: BetaRequest):
    """
    β[10] → JSON { vertices: [[x,y,z],...], faces: [[i,j,k],...] }
    Dùng cho Three.js BufferGeometry.
    """
    if not model or not model.ready:
        raise HTTPException(500, "Model not loaded")
    
    mesh = model.get_mesh(req.betas)
    return mesh

@app.post("/mesh/obj")
async def get_mesh_obj(req: BetaRequest):
    """
    β[10] → OBJ text string.
    Dùng để download hoặc import vào phần mềm 3D.
    """
    if not model or not model.ready:
        raise HTTPException(500, "Model not loaded")
    
    obj_str = model.get_obj(req.betas)
    return {"obj": obj_str}

@app.post("/mesh/from-measurements")
async def mesh_from_measurements(req: MeasurementsRequest):
    """
    Nhập số đo (cm/kg) → tự tính β → trả mesh JSON.
    Mapping: height, weight, chest, waist, hip → β[0..9]
    """
    if not model or not model.ready:
        raise HTTPException(500, "Model not loaded")
    
    # Tham chiếu trung bình (Vietnamese adult)
    ref_h, ref_w, ref_c, ref_wa, ref_hi = 165, 60, 88, 72, 92
    bmi = req.weight / (req.height / 100) ** 2
    
    betas = [
        (req.height - ref_h) / 15,        # β₀ height
        (req.weight - ref_w) / 20,         # β₁ weight
        (req.chest - ref_c) / 15,          # β₂ chest
        (req.waist - ref_wa) / 12,         # β₃ waist
        (req.hip - ref_hi) / 15,           # β₄ hip
        (bmi - 22) / 8,                    # β₅ BMI
        (req.chest - req.waist) / 20,      # β₆ chest-waist ratio
        (req.hip - req.waist) / 20,        # β₇ hip-waist ratio
        ((req.height/100)*0.53 - req.waist/100) * 5,  # β₈ torso proportion
        (req.weight/req.height - 0.36) * 10,           # β₉ w/h ratio
    ]
    
    mesh = model.get_mesh(betas)
    mesh['betas'] = betas
    mesh['bmi'] = round(bmi, 1)
    return mesh

@app.post("/mesh/compressed")
async def get_mesh_compressed(req: BetaRequest):
    """
    β[10] → Compressed format: Float32 flat arrays.
    Tối ưu bandwidth cho realtime updates.
    Trả vertices dạng flat [x0,y0,z0, x1,y1,z1, ...] và faces [i0,j0,k0, ...]
    """
    if not model or not model.ready:
        raise HTTPException(500, "Model not loaded")
    
    mesh = model.get_mesh(req.betas)
    
    # Flatten arrays
    verts_flat = []
    for v in mesh['vertices']:
        verts_flat.extend(v)
    
    faces_flat = []
    for f in mesh['faces']:
        faces_flat.extend(f)
    
    return {
        'vertices': verts_flat,
        'faces': faces_flat,
        'n_vertices': mesh['n_vertices'],
        'n_faces': mesh['n_faces'],
    }


# ==================== Main ====================

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("  TMFashion SMPL Service")
    print("  Nhận 10 β parameters → sinh mesh cơ thể 3D")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8001)
