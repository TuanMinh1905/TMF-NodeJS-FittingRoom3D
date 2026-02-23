# TMFashion Database ERD

## Sơ đồ ERD (Entity Relationship Diagram)

```mermaid
erDiagram
    Category {
        int id PK
        string name UK
        int parentId FK
        int sortOrder
        string slug
        boolean isActive
        datetime createdAt
        datetime updatedAt
        string urlImage
    }
    
    Brand {
        int id PK
        string name UK
        string slug
        string logoUrl
        string description
    }
    
    Product {
        int id PK
        string name
        string title
        string alias UK
        string sku UK
        decimal price
        decimal compareAtPrice
        string description
        string imageUrl
        decimal rating
        int reviewCount
        boolean isActive
        int categoryId FK
        int brandId FK
        datetime createdAt
        datetime updatedAt
    }
    
    ProductVariantSpec {
        int id PK
        int productId FK
        string sizeLabel
        string colorLabel
        string colorHex
        int stock
        decimal garmentChest
        decimal garmentShoulder
        decimal garmentLength
        string fabricMaterial
        decimal elasticity
        string glbModelUrl
        datetime createdAt
        datetime updatedAt
    }
    
    Image {
        int id PK
        string url
        string colorLabel
        int productId FK
    }
    
    Review {
        int id PK
        string content
        int rating
        int userId FK
        int productId FK
        datetime createdAt
    }
    
    User {
        int id PK
        string email UK
        string passwordHash
        string fullName
        string role
        datetime createdAt
        datetime updatedAt
    }
    
    Cart {
        int id PK
        int userId FK_UK
        datetime createdAt
        datetime updatedAt
    }
    
    CartItem {
        int id PK
        int cartId FK
        int variantId FK
        int quantity
    }
    
    Order {
        int id PK
        int userId FK
        string status
        decimal totalAmount
        string shippingAddress
        string phone
        string note
        datetime createdAt
        datetime updatedAt
    }
    
    OrderItem {
        int id PK
        int orderId FK
        int variantId FK
        int quantity
        decimal price
    }

    Category ||--o{ Product : "has"
    Brand ||--o{ Product : "has"
    Product ||--o{ ProductVariantSpec : "has variants"
    Product ||--o{ Image : "has"
    Product ||--o{ Review : "has"
    User ||--o{ Review : "writes"
    User ||--o| Cart : "owns"
    User ||--o{ Order : "places"
    Cart ||--o{ CartItem : "contains"
    ProductVariantSpec ||--o{ CartItem : "in cart"
    Order ||--o{ OrderItem : "contains"
    ProductVariantSpec ||--o{ OrderItem : "ordered"
```

## Mô tả các bảng

### 1. Category (Danh mục)
- Lưu danh mục sản phẩm (Áo, Quần, Váy...)
- Hỗ trợ danh mục cha-con qua `parentId`

### 2. Brand (Thương hiệu)
- Lưu thông tin thương hiệu

### 3. Product (Sản phẩm)
- Thông tin chung của sản phẩm
- Liên kết với Category và Brand

### 4. ProductVariantSpec (Biến thể sản phẩm - QUAN TRỌNG CHO 3D)
- Mỗi sản phẩm có nhiều biến thể (size/màu)
- **Thông số 3D:**
  - `garmentChest` - Số đo ngực
  - `garmentShoulder` - Số đo vai  
  - `garmentLength` - Chiều dài
  - `fabricMaterial` - Chất liệu vải
  - `elasticity` - Độ co giãn
  - `glbModelUrl` - **URL file .glb cho Virtual Fitting Room**

### 5. Image (Hình ảnh)
- Lưu nhiều ảnh cho mỗi sản phẩm
- `colorLabel` để nhóm ảnh theo màu

### 6. Review (Đánh giá)
- Đánh giá của khách hàng

### 7. User (Người dùng)
- Thông tin tài khoản

### 8. Cart & CartItem (Giỏ hàng)
- Giỏ hàng liên kết với `ProductVariantSpec` để biết size/màu

### 9. Order & OrderItem (Đơn hàng)
- Đơn hàng liên kết với `ProductVariantSpec`

## Các mối quan hệ

| Bảng A | Quan hệ | Bảng B | Mô tả |
|--------|---------|--------|-------|
| Category | 1:N | Product | Một danh mục có nhiều sản phẩm |
| Brand | 1:N | Product | Một thương hiệu có nhiều sản phẩm |
| Product | 1:N | ProductVariantSpec | Một sản phẩm có nhiều biến thể |
| Product | 1:N | Image | Một sản phẩm có nhiều ảnh |
| Product | 1:N | Review | Một sản phẩm có nhiều đánh giá |
| User | 1:1 | Cart | Mỗi user có 1 giỏ hàng |
| User | 1:N | Order | Một user có nhiều đơn hàng |
| User | 1:N | Review | Một user viết nhiều đánh giá |
| Cart | 1:N | CartItem | Giỏ hàng chứa nhiều item |
| Order | 1:N | OrderItem | Đơn hàng chứa nhiều item |
| ProductVariantSpec | 1:N | CartItem | Biến thể được thêm vào giỏ |
| ProductVariantSpec | 1:N | OrderItem | Biến thể được mua |


┌─────────────┐       ┌─────────────┐
│  Category   │       │    Brand    │
├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │
│ name        │       │ name        │
│ parentId    │       │ slug        │
│ slug        │       │ logoUrl     │
│ isActive    │       │ description │
└──────┬──────┘       └──────┬──────┘
       │ 1:N                 │ 1:N
       └──────────┬──────────┘
                  ▼
         ┌───────────────┐
         │    Product    │
         ├───────────────┤
         │ id (PK)       │
         │ name, sku     │
         │ price         │
         │ categoryId(FK)│
         │ brandId (FK)  │
         └───────┬───────┘
                 │ 1:N
       ┌─────────┼─────────┬─────────┐
       ▼         ▼         ▼         ▼
┌──────────┐ ┌────────┐ ┌────────┐ ┌────────────────────┐
│  Image   │ │ Review │ │        │ │ ProductVariantSpec │
├──────────┤ ├────────┤ │        │ ├────────────────────┤
│ id       │ │ id     │ │        │ │ id (PK)            │
│ url      │ │ content│ │        │ │ productId (FK)     │
│ colorLbl │ │ rating │ │        │ │ sizeLabel, colorLbl│
│ productId│ │ userId │ │        │ │ stock              │
└──────────┘ │ prodId │ │        │ │ ─────────────────  │
             └───┬────┘ │        │ │ garmentChest  🎯   │
                 │      │        │ │ garmentShoulder🎯  │
                 │      │        │ │ garmentLength  🎯  │
┌────────────────┘      │        │ │ glbModelUrl   🎯   │
│                       │        │ │ (File 3D .glb)     │
▼                       │        │ └─────────┬──────────┘
┌────────┐              │        │           │ 1:N
│  User  │──────────────┘        │     ┌─────┴─────┐
├────────┤ 1:N                   │     ▼           ▼
│ id(PK) │                       │ ┌─────────┐ ┌───────────┐
│ email  │                       │ │CartItem │ │ OrderItem │
│ passHsh│──┐ 1:1    1:N         │ ├─────────┤ ├───────────┤
│ role   │  │        │           │ │ cartId  │ │ orderId   │
└────────┘  │        │           │ │variantId│ │ variantId │
            ▼        ▼           │ │ quantity│ │ quantity  │
       ┌────────┐ ┌────────┐     │ └────┬────┘ │ price     │
       │  Cart  │ │ Order  │     │      │      └─────┬─────┘
       ├────────┤ ├────────┤     │      │            │
       │ userId │ │ userId │     │      │            │
       │        │ │ status │     │      └────────────┘
       └───┬────┘ │totalAmt│                 ▲
           │ 1:N  └───┬────┘                 │
           │          │ 1:N                  │
           └──────────┴──────────────────────┘