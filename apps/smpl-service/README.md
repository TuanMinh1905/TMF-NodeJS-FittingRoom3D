# ===== TMFashion SMPL Service =====
# Python microservice sinh mesh 3D cơ thể người từ SMPL β parameters
#
# ## Nguyên lý SMPL
# - Model SMPL đã được train trên ~4000 bản scan 3D người thật (CAESAR dataset)
# - PCA decomposition → 10 tham số β (shape) điều khiển hình dạng cơ thể
# - Khi thay đổi β[0..9] → mesh 6890 vertices thay đổi tương ứng đời thật
# - β₀ ≈ chiều cao, β₁ ≈ cân nặng, β₂..β₄ ≈ ngực/eo/hông, v.v.
#
# ## Kiến trúc
# ```
# Python SMPL Service (FastAPI:8001)
#     ├── POST /mesh/json          β[10] → { vertices, faces }
#     ├── POST /mesh/obj           β[10] → OBJ text
#     ├── POST /mesh/compressed    β[10] → flat Float32 arrays
#     ├── POST /mesh/from-measurements  cm/kg → β → mesh
#     └── GET  /info               model metadata
# ```
#
# ## Cài đặt & Chạy
#
# 1. Tạo virtual environment:
#    ```
#    cd apps/smpl-service
#    python -m venv venv
#    venv\Scripts\activate  (Windows)
#    # hoặc: source venv/bin/activate (Linux/Mac)
#    ```
#
# 2. Cài dependencies:
#    ```
#    pip install -r requirements.txt
#    ```
#
# 3. (Optional) SMPL model file:
#    - Tải từ https://smpl.is.tue.mpg.de/ (đăng ký miễn phí)
#    - Đặt file .pkl vào `apps/smpl-service/models/`
#    - Nếu không có → service tự sinh mesh procedural (vẫn chạy OK)
#
# 4. Chạy service:
#    ```
#    python main.py
#    ```
#    → Service chạy tại http://localhost:8001
#
# ## API Docs
# Khi service chạy, truy cập http://localhost:8001/docs → Swagger UI
