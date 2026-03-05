// ==================== SEED DATA — Dữ liệu mẫu đầy đủ cho TMFashion ====================
// Chạy: npx tsx src/seed.ts
// Sẽ xóa toàn bộ dữ liệu cũ rồi seed lại từ đầu

import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { User } from './models/user.js'
import { Category } from './models/category.js'
import { Brand } from './models/brand.js'
import { Product } from './models/product.js'
import { Image } from './models/image.js'
import { Cart, CartItem } from './models/cart.js'
import { Order, OrderItem } from './models/order.js'

// FittingSession model (import trực tiếp schema vì nó nằm trong route file)
const FittingSessionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user_height: { type: Number, required: true },
    user_weight: { type: Number, required: true },
    user_chest: { type: Number },
    user_waist: { type: Number },
    user_hip: { type: Number },
    recommended_size: { type: String, required: true },
    fit_score: { type: Number, required: true, min: 0, max: 100 },
    ai_comment: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at' } }
)
const FittingSession =
  mongoose.models.FittingSession || mongoose.model('FittingSession', FittingSessionSchema)

// ==================== KẾT NỐI DB ====================
const MONGO_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/TMFDatabase'

async function seed() {
  console.log('🔌 Đang kết nối MongoDB...')
  await mongoose.connect(MONGO_URL)
  console.log('✅ Đã kết nối MongoDB:', MONGO_URL)

  // ==================== XÓA DỮ LIỆU CŨ ====================
  console.log('\n🗑️  Đang xóa dữ liệu cũ...')
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Brand.deleteMany({}),
    Product.deleteMany({}),
    Image.deleteMany({}),
    Cart.deleteMany({}),
    CartItem.deleteMany({}),
    Order.deleteMany({}),
    OrderItem.deleteMany({}),
    FittingSession.deleteMany({}),
  ])
  console.log('✅ Đã xóa sạch toàn bộ dữ liệu cũ')

  // ==================== 1. USERS — Người dùng ====================
  console.log('\n👤 Đang tạo người dùng...')
  const passwordHash = await bcrypt.hash('123456', 10)
  const adminHash = await bcrypt.hash('admin123', 10)

  const users = await User.insertMany([
    {
      email: 'admin@tmfashion.vn',
      password_hash: adminHash,
      full_name: 'Quản Trị Viên',
      role: 'admin',
    },
    {
      email: 'minh@gmail.com',
      password_hash: passwordHash,
      full_name: 'Nguyễn Văn Minh',
      role: 'customer',
    },
    {
      email: 'lan@gmail.com',
      password_hash: passwordHash,
      full_name: 'Trần Thị Lan',
      role: 'customer',
    },
    {
      email: 'hieu@gmail.com',
      password_hash: passwordHash,
      full_name: 'Lê Quốc Hiếu',
      role: 'customer',
    },
    {
      email: 'thao@gmail.com',
      password_hash: passwordHash,
      full_name: 'Phạm Thanh Thảo',
      role: 'customer',
    },
    {
      email: 'duc@gmail.com',
      password_hash: passwordHash,
      full_name: 'Hoàng Minh Đức',
      role: 'customer',
    },
    {
      email: 'nhi@gmail.com',
      password_hash: passwordHash,
      full_name: 'Võ Yến Nhi',
      role: 'customer',
    },
    {
      email: 'tuan@gmail.com',
      password_hash: passwordHash,
      full_name: 'Đặng Anh Tuấn',
      role: 'customer',
    },
  ])
  console.log(`✅ Đã tạo ${users.length} người dùng`)

  const [admin, minh, lan, hieu, thao, duc, nhi, tuan] = users

  // ==================== 2. CATEGORIES — Danh mục (3 cấp) ====================
  console.log('\n📂 Đang tạo danh mục...')

  // --- Cấp 1: Danh mục gốc ---
  const catNam = await Category.create({
    name: 'Thời trang Nam',
    parent_id: null,
    sortOrder: 1,
    slug: 'thoi-trang-nam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400',
  })
  const catNu = await Category.create({
    name: 'Thời trang Nữ',
    parent_id: null,
    sortOrder: 2,
    slug: 'thoi-trang-nu',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400',
  })
  const catUnisex = await Category.create({
    name: 'Unisex',
    parent_id: null,
    sortOrder: 3,
    slug: 'unisex',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400',
  })
  const catPhuKien = await Category.create({
    name: 'Phụ kiện',
    parent_id: null,
    sortOrder: 4,
    slug: 'phu-kien',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400',
  })

  // --- Cấp 2: Nam ---
  const catAoNam = await Category.create({
    name: 'Áo Nam',
    parent_id: catNam._id,
    sortOrder: 1,
    slug: 'ao-nam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400',
  })
  const catQuanNam = await Category.create({
    name: 'Quần Nam',
    parent_id: catNam._id,
    sortOrder: 2,
    slug: 'quan-nam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400',
  })

  // --- Cấp 2: Nữ ---
  const catAoNu = await Category.create({
    name: 'Áo Nữ',
    parent_id: catNu._id,
    sortOrder: 1,
    slug: 'ao-nu',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400',
  })
  const catQuanNu = await Category.create({
    name: 'Quần Nữ',
    parent_id: catNu._id,
    sortOrder: 2,
    slug: 'quan-nu',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400',
  })
  const catVayDam = await Category.create({
    name: 'Váy & Đầm',
    parent_id: catNu._id,
    sortOrder: 3,
    slug: 'vay-dam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400',
  })

  // --- Cấp 2: Unisex ---
  const catAoUnisex = await Category.create({
    name: 'Áo Unisex',
    parent_id: catUnisex._id,
    sortOrder: 1,
    slug: 'ao-unisex',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
  })

  // --- Cấp 2: Phụ kiện ---
  const catTuiXach = await Category.create({
    name: 'Túi xách',
    parent_id: catPhuKien._id,
    sortOrder: 1,
    slug: 'tui-xach',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400',
  })
  const catNon = await Category.create({
    name: 'Nón & Mũ',
    parent_id: catPhuKien._id,
    sortOrder: 2,
    slug: 'non-mu',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1588850561407-ed78c334e67a?w=400',
  })

  // --- Cấp 3: Áo Nam chi tiết ---
  const catAoThunNam = await Category.create({
    name: 'Áo thun Nam',
    parent_id: catAoNam._id,
    sortOrder: 1,
    slug: 'ao-thun-nam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
  })
  const catAoSoMiNam = await Category.create({
    name: 'Áo sơ mi Nam',
    parent_id: catAoNam._id,
    sortOrder: 2,
    slug: 'ao-so-mi-nam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400',
  })
  const catAoKhoacNam = await Category.create({
    name: 'Áo khoác Nam',
    parent_id: catAoNam._id,
    sortOrder: 3,
    slug: 'ao-khoac-nam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400',
  })
  const catAoPoloNam = await Category.create({
    name: 'Áo Polo Nam',
    parent_id: catAoNam._id,
    sortOrder: 4,
    slug: 'ao-polo-nam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1625910513413-5fc36e9b1d5f?w=400',
  })

  // --- Cấp 3: Quần Nam chi tiết ---
  const catQuanJeanNam = await Category.create({
    name: 'Quần Jean Nam',
    parent_id: catQuanNam._id,
    sortOrder: 1,
    slug: 'quan-jean-nam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400',
  })
  const catQuanTayNam = await Category.create({
    name: 'Quần tây Nam',
    parent_id: catQuanNam._id,
    sortOrder: 2,
    slug: 'quan-tay-nam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400',
  })
  const catQuanShortNam = await Category.create({
    name: 'Quần short Nam',
    parent_id: catQuanNam._id,
    sortOrder: 3,
    slug: 'quan-short-nam',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400',
  })

  // --- Cấp 3: Áo Nữ chi tiết ---
  const catAoThunNu = await Category.create({
    name: 'Áo thun Nữ',
    parent_id: catAoNu._id,
    sortOrder: 1,
    slug: 'ao-thun-nu',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1554568218-0f1715e72254?w=400',
  })
  const catAoSoMiNu = await Category.create({
    name: 'Áo sơ mi Nữ',
    parent_id: catAoNu._id,
    sortOrder: 2,
    slug: 'ao-so-mi-nu',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400',
  })
  const catAoKhoacNu = await Category.create({
    name: 'Áo khoác Nữ',
    parent_id: catAoNu._id,
    sortOrder: 3,
    slug: 'ao-khoac-nu',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=400',
  })

  // --- Cấp 3: Váy & Đầm chi tiết ---
  const catVayNgan = await Category.create({
    name: 'Váy ngắn',
    parent_id: catVayDam._id,
    sortOrder: 1,
    slug: 'vay-ngan',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400',
  })
  const catDamDai = await Category.create({
    name: 'Đầm dài',
    parent_id: catVayDam._id,
    sortOrder: 2,
    slug: 'dam-dai',
    isActive: true,
    url_image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400',
  })

  console.log('✅ Đã tạo 23 danh mục (4 gốc + 7 cấp 2 + 12 cấp 3)')

  // ==================== 3. BRANDS — Thương hiệu ====================
  console.log('\n🏷️  Đang tạo thương hiệu...')
  const brands = await Brand.insertMany([
    {
      name: 'TMFashion',
      slug: 'tmfashion',
      logo_url: 'https://via.placeholder.com/200x80?text=TMFashion',
      description: 'Thương hiệu thời trang Việt Nam — phong cách trẻ trung, hiện đại',
    },
    {
      name: 'Việt Tiến',
      slug: 'viet-tien',
      logo_url: 'https://via.placeholder.com/200x80?text=VietTien',
      description: 'Thương hiệu thời trang công sở hàng đầu Việt Nam từ 1975',
    },
    {
      name: 'Ninomaxx',
      slug: 'ninomaxx',
      logo_url: 'https://via.placeholder.com/200x80?text=Ninomaxx',
      description: 'Thời trang trẻ, năng động dành cho giới trẻ Việt Nam',
    },
    {
      name: 'IVY moda',
      slug: 'ivy-moda',
      logo_url: 'https://via.placeholder.com/200x80?text=IVYmoda',
      description: 'Thời trang nữ cao cấp — sang trọng, thanh lịch',
    },
    {
      name: 'CANIFA',
      slug: 'canifa',
      logo_url: 'https://via.placeholder.com/200x80?text=CANIFA',
      description: 'Thời trang gia đình Việt — chất lượng, giá hợp lý',
    },
    {
      name: 'ROUTINE',
      slug: 'routine',
      logo_url: 'https://via.placeholder.com/200x80?text=ROUTINE',
      description: 'Thời trang nam thiết kế tối giản, chất liệu cao cấp',
    },
    {
      name: 'YODY',
      slug: 'yody',
      logo_url: 'https://via.placeholder.com/200x80?text=YODY',
      description: 'Thời trang & đồ dùng gia đình — tiện lợi, giá tốt',
    },
    {
      name: 'Elise',
      slug: 'elise',
      logo_url: 'https://via.placeholder.com/200x80?text=Elise',
      description: 'Thời trang nữ công sở — nữ tính, hiện đại',
    },
  ])
  console.log(`✅ Đã tạo ${brands.length} thương hiệu`)

  const [brTMF, brVietTien, brNinomaxx, brIVY, brCanifa, brRoutine, brYody, brElise] = brands

  // ==================== 4. PRODUCTS — Sản phẩm (30 sản phẩm) ====================
  console.log('\n👕 Đang tạo sản phẩm...')
  const products = await Product.insertMany([
    // ===== ÁO THUN NAM (4 SP) =====
    {
      name: 'Áo thun nam cổ tròn basic',
      title: 'Áo thun nam cotton mềm mại, thoáng mát',
      alias: 'ao-thun-nam-co-tron-basic',
      sku: 'ATN-001',
      price: 199000,
      compare_at_price: 299000,
      description: 'Áo thun nam chất liệu cotton 100%, co giãn tốt, mặc thoáng mát',
      image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
      model_3d_url: '/models/tshirt-basic.glb',
      rating: 4.5,
      review_count: 128,
      stock: 250,
      is_active: true,
      category_id: catAoThunNam._id,
      brand_id: brCanifa._id,
    },
    {
      name: 'Áo thun nam in hình phong cách',
      title: 'Áo thun nam oversize in graphic độc đáo',
      alias: 'ao-thun-nam-in-hinh-phong-cach',
      sku: 'ATN-002',
      price: 259000,
      compare_at_price: 350000,
      description: 'Áo thun oversize form rộng, in hình nghệ thuật, xu hướng streetwear',
      image_url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=500',
      model_3d_url: '/models/tshirt-graphic.glb',
      rating: 4.3,
      review_count: 89,
      stock: 180,
      is_active: true,
      category_id: catAoThunNam._id,
      brand_id: brNinomaxx._id,
    },
    {
      name: 'Áo thun nam thể thao dry-fit',
      title: 'Áo thun thể thao thoáng khí, nhanh khô',
      alias: 'ao-thun-nam-the-thao-dry-fit',
      sku: 'ATN-003',
      price: 329000,
      compare_at_price: 450000,
      description: 'Áo thun thể thao công nghệ dry-fit, thấm hút mồ hôi cực tốt',
      image_url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=500',
      model_3d_url: '/models/tshirt-sport.glb',
      rating: 4.7,
      review_count: 215,
      stock: 300,
      is_active: true,
      category_id: catAoThunNam._id,
      brand_id: brYody._id,
    },
    {
      name: 'Áo thun nam cổ V cao cấp',
      title: 'Áo thun nam cổ V chất liệu premium',
      alias: 'ao-thun-nam-co-v-cao-cap',
      sku: 'ATN-004',
      price: 279000,
      compare_at_price: 380000,
      description: 'Áo thun cổ V form slim fit, chất vải cotton pha spandex co giãn',
      image_url: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=500',
      model_3d_url: '',
      rating: 4.4,
      review_count: 67,
      stock: 150,
      is_active: true,
      category_id: catAoThunNam._id,
      brand_id: brRoutine._id,
    },

    // ===== ÁO SƠ MI NAM (3 SP) =====
    {
      name: 'Áo sơ mi nam trắng công sở',
      title: 'Áo sơ mi trắng dài tay, ít nhăn',
      alias: 'ao-so-mi-nam-trang-cong-so',
      sku: 'SMN-001',
      price: 459000,
      compare_at_price: 599000,
      description: 'Áo sơ mi trắng công sở, chất vải ít nhăn, phù hợp đi làm & hội họp',
      image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500',
      model_3d_url: '/models/shirt-white.glb',
      rating: 4.6,
      review_count: 342,
      stock: 200,
      is_active: true,
      category_id: catAoSoMiNam._id,
      brand_id: brVietTien._id,
    },
    {
      name: 'Áo sơ mi nam kẻ caro xanh',
      title: 'Áo sơ mi kẻ caro phong cách casual',
      alias: 'ao-so-mi-nam-ke-caro-xanh',
      sku: 'SMN-002',
      price: 389000,
      compare_at_price: 520000,
      description: 'Áo sơ mi kẻ caro xanh dương, form regular, mặc đi chơi hay đi làm đều đẹp',
      image_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500',
      model_3d_url: '',
      rating: 4.2,
      review_count: 98,
      stock: 120,
      is_active: true,
      category_id: catAoSoMiNam._id,
      brand_id: brRoutine._id,
    },
    {
      name: 'Áo sơ mi nam linen ngắn tay',
      title: 'Áo sơ mi linen mát mẻ cho mùa hè',
      alias: 'ao-so-mi-nam-linen-ngan-tay',
      sku: 'SMN-003',
      price: 429000,
      compare_at_price: 550000,
      description: 'Áo sơ mi chất liệu linen tự nhiên, thoáng mát, form rộng thoải mái',
      image_url: 'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=500',
      model_3d_url: '/models/shirt-linen.glb',
      rating: 4.5,
      review_count: 156,
      stock: 90,
      is_active: true,
      category_id: catAoSoMiNam._id,
      brand_id: brTMF._id,
    },

    // ===== ÁO KHOÁC NAM (2 SP) =====
    {
      name: 'Áo khoác nam bomber đen',
      title: 'Áo khoác bomber phong cách Hàn Quốc',
      alias: 'ao-khoac-nam-bomber-den',
      sku: 'AKN-001',
      price: 599000,
      compare_at_price: 850000,
      description: 'Áo khoác bomber nam màu đen, lót lông ấm áp, khóa kéo chắc chắn',
      image_url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500',
      model_3d_url: '/models/jacket-bomber.glb',
      rating: 4.8,
      review_count: 267,
      stock: 80,
      is_active: true,
      category_id: catAoKhoacNam._id,
      brand_id: brNinomaxx._id,
    },
    {
      name: 'Áo khoác nam hoodie xám',
      title: 'Áo hoodie nỉ bông giữ ấm tốt',
      alias: 'ao-khoac-nam-hoodie-xam',
      sku: 'AKN-002',
      price: 489000,
      compare_at_price: 650000,
      description: 'Áo hoodie nỉ bông dày dặn, mũ trùm có dây rút, túi kangaroo tiện lợi',
      image_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500',
      model_3d_url: '',
      rating: 4.6,
      review_count: 189,
      stock: 110,
      is_active: true,
      category_id: catAoKhoacNam._id,
      brand_id: brCanifa._id,
    },

    // ===== ÁO POLO NAM (2 SP) =====
    {
      name: 'Áo Polo nam xanh navy',
      title: 'Áo Polo nam cotton pique cao cấp',
      alias: 'ao-polo-nam-xanh-navy',
      sku: 'PLN-001',
      price: 359000,
      compare_at_price: 480000,
      description: 'Áo Polo nam chất cotton pique dày dặn, cổ bẻ lịch sự, thêu logo tinh tế',
      image_url: 'https://images.unsplash.com/photo-1625910513413-5fc36e9b1d5f?w=500',
      model_3d_url: '/models/polo-navy.glb',
      rating: 4.5,
      review_count: 203,
      stock: 170,
      is_active: true,
      category_id: catAoPoloNam._id,
      brand_id: brVietTien._id,
    },
    {
      name: 'Áo Polo nam trắng classic',
      title: 'Áo Polo trắng dáng slim fit',
      alias: 'ao-polo-nam-trang-classic',
      sku: 'PLN-002',
      price: 339000,
      compare_at_price: 450000,
      description: 'Áo Polo trắng classic, phù hợp mọi dịp từ công sở đến dạo phố',
      image_url: 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=500',
      model_3d_url: '',
      rating: 4.3,
      review_count: 145,
      stock: 200,
      is_active: true,
      category_id: catAoPoloNam._id,
      brand_id: brRoutine._id,
    },

    // ===== QUẦN JEAN NAM (2 SP) =====
    {
      name: 'Quần jean nam slim fit xanh đậm',
      title: 'Quần jean co giãn dáng ôm vừa',
      alias: 'quan-jean-nam-slim-fit-xanh-dam',
      sku: 'QJN-001',
      price: 529000,
      compare_at_price: 699000,
      description: 'Quần jean nam slim fit, chất denim co giãn, màu xanh đậm classic',
      image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=500',
      model_3d_url: '/models/jean-slim.glb',
      rating: 4.6,
      review_count: 312,
      stock: 180,
      is_active: true,
      category_id: catQuanJeanNam._id,
      brand_id: brTMF._id,
    },
    {
      name: 'Quần jean nam rách gối streetwear',
      title: 'Quần jean rách phong cách đường phố',
      alias: 'quan-jean-nam-rach-goi-streetwear',
      sku: 'QJN-002',
      price: 489000,
      compare_at_price: 650000,
      description: 'Quần jean nam rách gối, wash nhẹ, phong cách streetwear năng động',
      image_url: 'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=500',
      model_3d_url: '',
      rating: 4.3,
      review_count: 178,
      stock: 100,
      is_active: true,
      category_id: catQuanJeanNam._id,
      brand_id: brNinomaxx._id,
    },

    // ===== QUẦN TÂY NAM (2 SP) =====
    {
      name: 'Quần tây nam đen công sở',
      title: 'Quần tây slim công sở thanh lịch',
      alias: 'quan-tay-nam-den-cong-so',
      sku: 'QTN-001',
      price: 459000,
      compare_at_price: 600000,
      description: 'Quần tây nam đen, form slim, ly sắc nét, phù hợp đi làm & sự kiện',
      image_url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500',
      model_3d_url: '/models/trouser-black.glb',
      rating: 4.7,
      review_count: 289,
      stock: 160,
      is_active: true,
      category_id: catQuanTayNam._id,
      brand_id: brVietTien._id,
    },
    {
      name: 'Quần tây nam xám chinos',
      title: 'Quần chinos nam form regular thoải mái',
      alias: 'quan-tay-nam-xam-chinos',
      sku: 'QTN-002',
      price: 419000,
      compare_at_price: 550000,
      description: 'Quần chinos xám nhạt, chất vải cotton pha, co giãn nhẹ, dễ phối đồ',
      image_url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=500',
      model_3d_url: '',
      rating: 4.4,
      review_count: 134,
      stock: 140,
      is_active: true,
      category_id: catQuanTayNam._id,
      brand_id: brRoutine._id,
    },

    // ===== QUẦN SHORT NAM (2 SP) =====
    {
      name: 'Quần short nam kaki basic',
      title: 'Quần short kaki thoải mái cho mùa hè',
      alias: 'quan-short-nam-kaki-basic',
      sku: 'QSN-001',
      price: 279000,
      compare_at_price: 380000,
      description: 'Quần short nam kaki, túi hông tiện lợi, thích hợp đi biển & dạo phố',
      image_url: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=500',
      model_3d_url: '',
      rating: 4.2,
      review_count: 87,
      stock: 200,
      is_active: true,
      category_id: catQuanShortNam._id,
      brand_id: brYody._id,
    },
    {
      name: 'Quần short nam thể thao',
      title: 'Quần short thể thao nhanh khô',
      alias: 'quan-short-nam-the-thao',
      sku: 'QSN-002',
      price: 249000,
      compare_at_price: 340000,
      description: 'Quần short thể thao thoáng mát, cạp chun có dây rút, thích hợp tập gym',
      image_url: 'https://images.unsplash.com/photo-1571455786673-9d9d6c194f90?w=500',
      model_3d_url: '',
      rating: 4.5,
      review_count: 112,
      stock: 250,
      is_active: true,
      category_id: catQuanShortNam._id,
      brand_id: brCanifa._id,
    },

    // ===== ÁO THUN NỮ (2 SP) =====
    {
      name: 'Áo thun nữ croptop trắng',
      title: 'Áo croptop nữ cotton thoáng mát',
      alias: 'ao-thun-nu-croptop-trang',
      sku: 'ATF-001',
      price: 189000,
      compare_at_price: 260000,
      description: 'Áo croptop nữ form ôm, chất cotton mềm, phối cùng quần cạp cao cực đẹp',
      image_url: 'https://images.unsplash.com/photo-1554568218-0f1715e72254?w=500',
      model_3d_url: '/models/croptop-white.glb',
      rating: 4.4,
      review_count: 198,
      stock: 300,
      is_active: true,
      category_id: catAoThunNu._id,
      brand_id: brIVY._id,
    },
    {
      name: 'Áo thun nữ oversize pastel',
      title: 'Áo thun oversize nữ phong cách Hàn',
      alias: 'ao-thun-nu-oversize-pastel',
      sku: 'ATF-002',
      price: 229000,
      compare_at_price: 310000,
      description: 'Áo thun oversize tông pastel nhẹ nhàng, chất liệu cotton mềm rũ',
      image_url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500',
      model_3d_url: '',
      rating: 4.3,
      review_count: 156,
      stock: 220,
      is_active: true,
      category_id: catAoThunNu._id,
      brand_id: brCanifa._id,
    },

    // ===== ÁO SƠ MI NỮ (2 SP) =====
    {
      name: 'Áo sơ mi nữ trắng thanh lịch',
      title: 'Áo sơ mi nữ công sở tay dài',
      alias: 'ao-so-mi-nu-trang-thanh-lich',
      sku: 'SMF-001',
      price: 399000,
      compare_at_price: 530000,
      description: 'Áo sơ mi nữ trắng, chất vải mềm rũ, form dáng thanh lịch cho nàng công sở',
      image_url: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=500',
      model_3d_url: '/models/shirt-female-white.glb',
      rating: 4.6,
      review_count: 234,
      stock: 170,
      is_active: true,
      category_id: catAoSoMiNu._id,
      brand_id: brElise._id,
    },
    {
      name: 'Áo sơ mi nữ sọc cổ vest',
      title: 'Áo sơ mi nữ phối cổ vest thời thượng',
      alias: 'ao-so-mi-nu-soc-co-vest',
      sku: 'SMF-002',
      price: 449000,
      compare_at_price: 590000,
      description: 'Áo sơ mi nữ sọc dọc, phối cổ vest cá tính, phù hợp đi làm lẫn đi chơi',
      image_url: 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=500',
      model_3d_url: '',
      rating: 4.4,
      review_count: 112,
      stock: 100,
      is_active: true,
      category_id: catAoSoMiNu._id,
      brand_id: brIVY._id,
    },

    // ===== ÁO KHOÁC NỮ (1 SP) =====
    {
      name: 'Áo khoác nữ dạ tweed hồng',
      title: 'Áo khoác dạ ngắn phong cách quý cô',
      alias: 'ao-khoac-nu-da-tweed-hong',
      sku: 'AKF-001',
      price: 899000,
      compare_at_price: 1200000,
      description: 'Áo khoác dạ tweed màu hồng nhạt, form ngắn ngang eo, phong cách Pháp sang trọng',
      image_url: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=500',
      model_3d_url: '/models/jacket-tweed.glb',
      rating: 4.8,
      review_count: 87,
      stock: 50,
      is_active: true,
      category_id: catAoKhoacNu._id,
      brand_id: brElise._id,
    },

    // ===== VÁY & ĐẦM (3 SP) =====
    {
      name: 'Váy ngắn chữ A trắng',
      title: 'Váy chữ A trắng thanh lịch',
      alias: 'vay-ngan-chu-a-trang',
      sku: 'VN-001',
      price: 359000,
      compare_at_price: 480000,
      description: 'Váy chữ A trắng dáng xòe nhẹ, độ dài ngang gối, phù hợp đi làm & đi tiệc',
      image_url: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=500',
      model_3d_url: '/models/skirt-a-white.glb',
      rating: 4.5,
      review_count: 176,
      stock: 130,
      is_active: true,
      category_id: catVayNgan._id,
      brand_id: brIVY._id,
    },
    {
      name: 'Đầm dài hoa nhí vintage',
      title: 'Đầm maxi hoa nhí phong cách bohemian',
      alias: 'dam-dai-hoa-nhi-vintage',
      sku: 'DD-001',
      price: 559000,
      compare_at_price: 750000,
      description: 'Đầm maxi họa tiết hoa nhí, chất vải chiffon nhẹ bay, thích hợp đi biển & dạo phố',
      image_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500',
      model_3d_url: '',
      rating: 4.7,
      review_count: 203,
      stock: 80,
      is_active: true,
      category_id: catDamDai._id,
      brand_id: brElise._id,
    },
    {
      name: 'Đầm công sở đen sang trọng',
      title: 'Đầm ôm body đen thanh lịch',
      alias: 'dam-cong-so-den-sang-trong',
      sku: 'DD-002',
      price: 659000,
      compare_at_price: 890000,
      description: 'Đầm ôm body đen, chất liệu co giãn, tôn dáng cực kỳ, phù hợp sự kiện & công sở',
      image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500',
      model_3d_url: '/models/dress-black.glb',
      rating: 4.8,
      review_count: 167,
      stock: 60,
      is_active: true,
      category_id: catDamDai._id,
      brand_id: brIVY._id,
    },

    // ===== ÁO UNISEX (2 SP) =====
    {
      name: 'Áo thun unisex logo TMFashion',
      title: 'Áo thun unisex in logo thương hiệu',
      alias: 'ao-thun-unisex-logo-tmfashion',
      sku: 'UNI-001',
      price: 219000,
      compare_at_price: 300000,
      description: 'Áo thun unisex in logo TMFashion, form rộng thoải mái, mặc cặp đôi cực đẹp',
      image_url: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500',
      model_3d_url: '/models/tshirt-unisex.glb',
      rating: 4.4,
      review_count: 321,
      stock: 400,
      is_active: true,
      category_id: catAoUnisex._id,
      brand_id: brTMF._id,
    },
    {
      name: 'Áo hoodie unisex xám melange',
      title: 'Áo hoodie unisex nỉ cotton dày dặn',
      alias: 'ao-hoodie-unisex-xam-melange',
      sku: 'UNI-002',
      price: 459000,
      compare_at_price: 620000,
      description: 'Áo hoodie unisex chất nỉ cotton, tông xám melange dễ phối, ấm áp mùa đông',
      image_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500',
      model_3d_url: '',
      rating: 4.6,
      review_count: 198,
      stock: 150,
      is_active: true,
      category_id: catAoUnisex._id,
      brand_id: brCanifa._id,
    },

    // ===== PHỤ KIỆN — TÚI XÁCH (2 SP) =====
    {
      name: 'Túi tote vải canvas basic',
      title: 'Túi tote vải canvas in chữ thời trang',
      alias: 'tui-tote-vai-canvas-basic',
      sku: 'TX-001',
      price: 159000,
      compare_at_price: 220000,
      description: 'Túi tote vải canvas dày, in chữ phong cách, đựng được laptop 14 inch',
      image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500',
      model_3d_url: '',
      rating: 4.3,
      review_count: 89,
      stock: 350,
      is_active: true,
      category_id: catTuiXach._id,
      brand_id: brTMF._id,
    },
    {
      name: 'Túi xách nữ da PU sang trọng',
      title: 'Túi xách nữ da PU phong cách Hàn Quốc',
      alias: 'tui-xach-nu-da-pu-sang-trong',
      sku: 'TX-002',
      price: 459000,
      compare_at_price: 650000,
      description: 'Túi xách nữ da PU mềm, kiểu dáng thanh lịch, nhiều ngăn tiện dụng',
      image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500',
      model_3d_url: '',
      rating: 4.5,
      review_count: 134,
      stock: 90,
      is_active: true,
      category_id: catTuiXach._id,
      brand_id: brElise._id,
    },

    // ===== PHỤ KIỆN — NÓN (1 SP) =====
    {
      name: 'Nón lưỡi trai thêu logo',
      title: 'Nón bucket & lưỡi trai phong cách',
      alias: 'non-luoi-trai-theu-logo',
      sku: 'NON-001',
      price: 149000,
      compare_at_price: 200000,
      description: 'Nón lưỡi trai thêu logo TMFashion, chất liệu cotton, điều chỉnh được size',
      image_url: 'https://images.unsplash.com/photo-1588850561407-ed78c334e67a?w=500',
      model_3d_url: '',
      rating: 4.2,
      review_count: 76,
      stock: 500,
      is_active: true,
      category_id: catNon._id,
      brand_id: brTMF._id,
    },
  ])
  console.log(`✅ Đã tạo ${products.length} sản phẩm`)

  // ==================== 5. IMAGES — Hình ảnh sản phẩm (mỗi SP 2-3 ảnh) ====================
  console.log('\n🖼️  Đang tạo hình ảnh sản phẩm...')
  const imageData: { url: string; product_id: mongoose.Types.ObjectId }[] = []
  const extraImages = [
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
    'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400',
    'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400',
    'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400',
    'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400',
    'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400',
    'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=400',
    'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400',
    'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400',
    'https://images.unsplash.com/photo-1625910513413-5fc36e9b1d5f?w=400',
  ]

  for (const product of products) {
    // Ảnh chính (giống image_url)
    imageData.push({ url: product.image_url, product_id: product._id })
    // Ảnh phụ 1
    imageData.push({
      url: extraImages[Math.floor(Math.random() * extraImages.length)],
      product_id: product._id,
    })
    // 50% sản phẩm có ảnh phụ 2
    if (Math.random() > 0.5) {
      imageData.push({
        url: extraImages[Math.floor(Math.random() * extraImages.length)],
        product_id: product._id,
      })
    }
  }
  const images = await Image.insertMany(imageData)
  console.log(`✅ Đã tạo ${images.length} hình ảnh cho ${products.length} sản phẩm`)

  // ==================== 6. CARTS & CART ITEMS — Giỏ hàng ====================
  console.log('\n🛒 Đang tạo giỏ hàng...')

  // Minh: 3 sản phẩm trong giỏ
  const cartMinh = await Cart.create({ user_id: minh._id })
  await CartItem.insertMany([
    { cart_id: cartMinh._id, product_id: products[0]._id, quantity: 2 },  // Áo thun nam basic x2
    { cart_id: cartMinh._id, product_id: products[11]._id, quantity: 1 }, // Quần jean slim x1
    { cart_id: cartMinh._id, product_id: products[7]._id, quantity: 1 },  // Áo khoác bomber x1
  ])

  // Lan: 2 sản phẩm
  const cartLan = await Cart.create({ user_id: lan._id })
  await CartItem.insertMany([
    { cart_id: cartLan._id, product_id: products[17]._id, quantity: 1 }, // Áo croptop nữ x1
    { cart_id: cartLan._id, product_id: products[22]._id, quantity: 1 }, // Váy chữ A x1
  ])

  // Thảo: 1 sản phẩm
  const cartThao = await Cart.create({ user_id: thao._id })
  await CartItem.insertMany([
    { cart_id: cartThao._id, product_id: products[21]._id, quantity: 1 }, // Áo khoác dạ tweed x1
  ])

  // Đức: 2 sản phẩm
  const cartDuc = await Cart.create({ user_id: duc._id })
  await CartItem.insertMany([
    { cart_id: cartDuc._id, product_id: products[2]._id, quantity: 2 },   // Áo thể thao x2
    { cart_id: cartDuc._id, product_id: products[16]._id, quantity: 1 },  // Quần short thể thao x1
  ])

  console.log('✅ Đã tạo 4 giỏ hàng với 10 sản phẩm')

  // ==================== 7. ORDERS & ORDER ITEMS — Đơn hàng ====================
  console.log('\n📦 Đang tạo đơn hàng...')

  // --- Đơn 1: Minh — Đã giao ---
  const order1 = await Order.create({
    user_id: minh._id,
    status: 'delivered',
    total_amount: 1187000,
    shipping_address: '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    phone: '0901234567',
    note: 'Giao giờ hành chính, gọi trước khi giao',
    payment_method: 'cod',
    payment_status: 'confirmed',
  })
  await OrderItem.insertMany([
    { order_id: order1._id, product_id: products[0]._id, quantity: 2, price: 199000 },  // Áo thun x2
    { order_id: order1._id, product_id: products[4]._id, quantity: 1, price: 459000 },  // Áo sơ mi trắng
    { order_id: order1._id, product_id: products[15]._id, quantity: 1, price: 279000 }, // Quần short kaki
  ])

  // --- Đơn 2: Lan — Đã xác nhận, đang ship ---
  const order2 = await Order.create({
    user_id: lan._id,
    status: 'shipping',
    total_amount: 1458000,
    shipping_address: '456 Lê Lợi, Quận 3, TP. Hồ Chí Minh',
    phone: '0912345678',
    note: '',
    payment_method: 'e_wallet',
    payment_status: 'confirmed',
  })
  await OrderItem.insertMany([
    { order_id: order2._id, product_id: products[19]._id, quantity: 1, price: 399000 }, // Áo sơ mi nữ trắng
    { order_id: order2._id, product_id: products[22]._id, quantity: 1, price: 359000 }, // Váy chữ A
    { order_id: order2._id, product_id: products[24]._id, quantity: 1, price: 659000 }, // Đầm công sở đen
  ])

  // --- Đơn 3: Hiếu — Đang chờ xác nhận ---
  const order3 = await Order.create({
    user_id: hieu._id,
    status: 'pending',
    total_amount: 1088000,
    shipping_address: '789 Trần Hưng Đạo, Quận 5, TP. Hồ Chí Minh',
    phone: '0923456789',
    note: 'Gói quà giúp mình nhé',
    payment_method: 'bank_transfer',
    payment_status: 'pending',
  })
  await OrderItem.insertMany([
    { order_id: order3._id, product_id: products[7]._id, quantity: 1, price: 599000 },  // Áo khoác bomber
    { order_id: order3._id, product_id: products[1]._id, quantity: 1, price: 259000 },  // Áo thun in hình
    { order_id: order3._id, product_id: products[15]._id, quantity: 1, price: 249000 }, // Quần short thể thao
  ])

  // --- Đơn 4: Thảo — Đã giao ---
  const order4 = await Order.create({
    user_id: thao._id,
    status: 'delivered',
    total_amount: 1347000,
    shipping_address: '321 Võ Văn Tần, Quận 10, TP. Hồ Chí Minh',
    phone: '0934567890',
    note: '',
    payment_method: 'credit_card',
    payment_status: 'confirmed',
  })
  await OrderItem.insertMany([
    { order_id: order4._id, product_id: products[17]._id, quantity: 2, price: 189000 }, // Áo croptop x2
    { order_id: order4._id, product_id: products[23]._id, quantity: 1, price: 559000 }, // Đầm hoa nhí
    { order_id: order4._id, product_id: products[18]._id, quantity: 1, price: 229000 }, // Áo thun oversize pastel
  ])

  // --- Đơn 5: Đức — Đã xác nhận ---
  const order5 = await Order.create({
    user_id: duc._id,
    status: 'confirmed',
    total_amount: 987000,
    shipping_address: '567 Cách Mạng Tháng Tám, Tân Bình, TP. Hồ Chí Minh',
    phone: '0945678901',
    note: 'Ship nhanh giúp mình nha, cần gấp',
    payment_method: 'e_wallet',
    payment_status: 'confirmed',
  })
  await OrderItem.insertMany([
    { order_id: order5._id, product_id: products[2]._id, quantity: 1, price: 329000 },  // Áo thể thao dry-fit
    { order_id: order5._id, product_id: products[11]._id, quantity: 1, price: 529000 }, // Quần jean slim
    { order_id: order5._id, product_id: products[29]._id, quantity: 1, price: 149000 }, // Nón lưỡi trai
  ])

  // --- Đơn 6: Nhi — Đã hủy ---
  const order6 = await Order.create({
    user_id: nhi._id,
    status: 'cancelled',
    total_amount: 899000,
    shipping_address: '890 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh',
    phone: '0956789012',
    note: 'Hủy vì đổi ý',
    payment_method: 'cod',
    payment_status: 'failed',
  })
  await OrderItem.insertMany([
    { order_id: order6._id, product_id: products[21]._id, quantity: 1, price: 899000 }, // Áo khoác dạ tweed
  ])

  // --- Đơn 7: Tuấn — Đã giao ---
  const order7 = await Order.create({
    user_id: tuan._id,
    status: 'delivered',
    total_amount: 1247000,
    shipping_address: '234 Phan Xích Long, Phú Nhuận, TP. Hồ Chí Minh',
    phone: '0967890123',
    note: '',
    payment_method: 'bank_transfer',
    payment_status: 'confirmed',
  })
  await OrderItem.insertMany([
    { order_id: order7._id, product_id: products[9]._id, quantity: 1, price: 359000 },  // Áo Polo navy
    { order_id: order7._id, product_id: products[13]._id, quantity: 1, price: 459000 }, // Quần tây đen
    { order_id: order7._id, product_id: products[6]._id, quantity: 1, price: 429000 },  // Áo sơ mi linen
  ])

  // --- Đơn 8: Minh — Đang ship (đơn thứ 2 của Minh) ---
  const order8 = await Order.create({
    user_id: minh._id,
    status: 'shipping',
    total_amount: 678000,
    shipping_address: '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    phone: '0901234567',
    note: '',
    payment_method: 'e_wallet',
    payment_status: 'confirmed',
  })
  await OrderItem.insertMany([
    { order_id: order8._id, product_id: products[25]._id, quantity: 1, price: 219000 }, // Áo unisex logo
    { order_id: order8._id, product_id: products[26]._id, quantity: 1, price: 459000 }, // Hoodie unisex
  ])

  // --- Đơn 9: Lan — Đã giao (đơn thứ 2 của Lan) ---
  const order9 = await Order.create({
    user_id: lan._id,
    status: 'delivered',
    total_amount: 618000,
    shipping_address: '456 Lê Lợi, Quận 3, TP. Hồ Chí Minh',
    phone: '0912345678',
    note: 'Gói riêng từng sản phẩm',
    payment_method: 'credit_card',
    payment_status: 'confirmed',
  })
  await OrderItem.insertMany([
    { order_id: order9._id, product_id: products[27]._id, quantity: 1, price: 159000 }, // Túi tote
    { order_id: order9._id, product_id: products[28]._id, quantity: 1, price: 459000 }, // Túi xách da PU
  ])

  // --- Đơn 10: Thảo — Pending (đơn thứ 2) ---
  const order10 = await Order.create({
    user_id: thao._id,
    status: 'pending',
    total_amount: 788000,
    shipping_address: '321 Võ Văn Tần, Quận 10, TP. Hồ Chí Minh',
    phone: '0934567890',
    note: '',
    payment_method: 'cod',
    payment_status: 'pending',
  })
  await OrderItem.insertMany([
    { order_id: order10._id, product_id: products[20]._id, quantity: 1, price: 449000 }, // Áo sơ mi nữ sọc
    { order_id: order10._id, product_id: products[10]._id, quantity: 1, price: 339000 }, // Áo Polo trắng
  ])

  console.log('✅ Đã tạo 10 đơn hàng (delivered: 4, shipping: 2, confirmed: 1, pending: 2, cancelled: 1)')

  // ==================== 8. FITTING SESSIONS — Lịch sử thử đồ / Phòng thay đồ ảo ====================
  console.log('\n👗 Đang tạo lịch sử phòng thử đồ...')
  const fittingSessions = await FittingSession.insertMany([
    // Minh thử 3 lần
    {
      user_id: minh._id,
      product_id: products[0]._id, // Áo thun nam basic
      user_height: 172,
      user_weight: 65,
      user_chest: 92,
      user_waist: 76,
      user_hip: 94,
      recommended_size: 'M',
      fit_score: 92,
      ai_comment: 'Bạn có chỉ số BMI 22.0 (cân đối). Gợi ý size M cho sản phẩm "Áo thun nam cổ tròn basic". Đây là size phù hợp nhất!',
    },
    {
      user_id: minh._id,
      product_id: products[4]._id, // Áo sơ mi trắng
      user_height: 172,
      user_weight: 65,
      user_chest: 92,
      user_waist: 76,
      user_hip: 94,
      recommended_size: 'M',
      fit_score: 88,
      ai_comment: 'Bạn có chỉ số BMI 22.0 (cân đối). Gợi ý size M cho sản phẩm "Áo sơ mi nam trắng công sở". Form slim fit sẽ tôn dáng.',
    },
    {
      user_id: minh._id,
      product_id: products[11]._id, // Quần jean slim
      user_height: 172,
      user_weight: 65,
      user_chest: 92,
      user_waist: 76,
      user_hip: 94,
      recommended_size: 'M',
      fit_score: 85,
      ai_comment: 'Bạn có chỉ số BMI 22.0 (cân đối). Gợi ý size M cho sản phẩm "Quần jean nam slim fit xanh đậm". Quần jean slim fit sẽ ôm vừa vặn.',
    },

    // Lan thử 2 lần
    {
      user_id: lan._id,
      product_id: products[17]._id, // Áo croptop
      user_height: 160,
      user_weight: 48,
      user_chest: 80,
      user_waist: 62,
      user_hip: 86,
      recommended_size: 'S',
      fit_score: 95,
      ai_comment: 'Bạn có chỉ số BMI 18.8 (cân đối). Gợi ý size S cho sản phẩm "Áo thun nữ croptop trắng". Áo croptop size S sẽ vừa vặn và tôn dáng.',
    },
    {
      user_id: lan._id,
      product_id: products[22]._id, // Váy chữ A
      user_height: 160,
      user_weight: 48,
      user_chest: 80,
      user_waist: 62,
      user_hip: 86,
      recommended_size: 'S',
      fit_score: 90,
      ai_comment: 'Bạn có chỉ số BMI 18.8 (cân đối). Gợi ý size S cho sản phẩm "Váy ngắn chữ A trắng". Váy dáng xòe sẽ rất hợp với vóc dáng của bạn.',
    },

    // Thảo thử 2 lần
    {
      user_id: thao._id,
      product_id: products[23]._id, // Đầm hoa nhí
      user_height: 163,
      user_weight: 52,
      user_chest: 84,
      user_waist: 66,
      user_hip: 90,
      recommended_size: 'S',
      fit_score: 88,
      ai_comment: 'Bạn có chỉ số BMI 19.6 (cân đối). Gợi ý size S cho sản phẩm "Đầm dài hoa nhí vintage". Đầm maxi sẽ rất phù hợp với chiều cao của bạn.',
    },
    {
      user_id: thao._id,
      product_id: products[21]._id, // Áo khoác dạ tweed
      user_height: 163,
      user_weight: 52,
      user_chest: 84,
      user_waist: 66,
      user_hip: 90,
      recommended_size: 'S',
      fit_score: 91,
      ai_comment: 'Bạn có chỉ số BMI 19.6 (cân đối). Gợi ý size S cho sản phẩm "Áo khoác nữ dạ tweed hồng". Áo khoác ngắn rất hợp dáng người nhỏ nhắn.',
    },

    // Đức thử 2 lần
    {
      user_id: duc._id,
      product_id: products[2]._id, // Áo thể thao dry-fit
      user_height: 178,
      user_weight: 75,
      user_chest: 100,
      user_waist: 82,
      user_hip: 98,
      recommended_size: 'L',
      fit_score: 87,
      ai_comment: 'Bạn có chỉ số BMI 23.7 (hơi thừa cân). Gợi ý size L cho sản phẩm "Áo thun nam thể thao dry-fit". Size L sẽ thoải mái khi tập luyện.',
    },
    {
      user_id: duc._id,
      product_id: products[7]._id, // Áo khoác bomber
      user_height: 178,
      user_weight: 75,
      user_chest: 100,
      user_waist: 82,
      user_hip: 98,
      recommended_size: 'L',
      fit_score: 83,
      ai_comment: 'Bạn có chỉ số BMI 23.7 (hơi thừa cân). Gợi ý size L cho sản phẩm "Áo khoác nam bomber đen". Bomber dáng rộng, mặc L vừa đẹp.',
    },

    // Nhi thử 1 lần
    {
      user_id: nhi._id,
      product_id: products[24]._id, // Đầm công sở đen
      user_height: 158,
      user_weight: 45,
      user_chest: 78,
      user_waist: 60,
      user_hip: 84,
      recommended_size: 'S',
      fit_score: 93,
      ai_comment: 'Bạn có chỉ số BMI 18.0 (gầy). Gợi ý size S cho sản phẩm "Đầm công sở đen sang trọng". Đầm ôm body size S sẽ tôn dáng mảnh mai.',
    },

    // Tuấn thử 2 lần
    {
      user_id: tuan._id,
      product_id: products[9]._id, // Áo Polo navy
      user_height: 175,
      user_weight: 70,
      user_chest: 96,
      user_waist: 78,
      user_hip: 96,
      recommended_size: 'M',
      fit_score: 89,
      ai_comment: 'Bạn có chỉ số BMI 22.9 (cân đối). Gợi ý size M cho sản phẩm "Áo Polo nam xanh navy". Polo cổ bẻ size M sẽ lịch sự và vừa vặn.',
    },
    {
      user_id: tuan._id,
      product_id: products[13]._id, // Quần tây đen
      user_height: 175,
      user_weight: 70,
      user_chest: 96,
      user_waist: 78,
      user_hip: 96,
      recommended_size: 'M',
      fit_score: 86,
      ai_comment: 'Bạn có chỉ số BMI 22.9 (cân đối). Gợi ý size M cho sản phẩm "Quần tây nam đen công sở". Form slim vừa vặn, thoải mái khi ngồi.',
    },

    // Hiếu thử 1 lần
    {
      user_id: hieu._id,
      product_id: products[7]._id, // Áo khoác bomber
      user_height: 168,
      user_weight: 62,
      user_chest: 90,
      user_waist: 74,
      user_hip: 92,
      recommended_size: 'M',
      fit_score: 90,
      ai_comment: 'Bạn có chỉ số BMI 22.0 (cân đối). Gợi ý size M cho sản phẩm "Áo khoác nam bomber đen". Form bomber rộng, size M là lựa chọn hoàn hảo.',
    },
  ])
  console.log(`✅ Đã tạo ${fittingSessions.length} lượt thử đồ ảo`)

  // ==================== TỔNG KẾT ====================
  console.log('\n' + '='.repeat(60))
  console.log('🎉 SEED DATA HOÀN TẤT!')
  console.log('='.repeat(60))
  console.log(`   👤 Người dùng:        ${users.length} (1 admin + ${users.length - 1} khách hàng)`)
  console.log(`   📂 Danh mục:          23 (4 gốc + 7 cấp 2 + 12 cấp 3)`)
  console.log(`   🏷️  Thương hiệu:       ${brands.length}`)
  console.log(`   👕 Sản phẩm:          ${products.length}`)
  console.log(`   🖼️  Hình ảnh:          ${images.length}`)
  console.log(`   🛒 Giỏ hàng:          4 (10 sản phẩm)`)
  console.log(`   📦 Đơn hàng:          10 (delivered: 4, shipping: 2, confirmed: 1, pending: 2, cancelled: 1)`)
  console.log(`   👗 Lượt thử đồ:       ${fittingSessions.length}`)
  console.log('='.repeat(60))
  console.log('\n📌 Tài khoản đăng nhập:')
  console.log('   Admin:    admin@tmfashion.vn / admin123')
  console.log('   Khách:    minh@gmail.com / 123456')
  console.log('   Khách:    lan@gmail.com / 123456')
  console.log('   (tất cả khách hàng đều mật khẩu: 123456)')

  await mongoose.disconnect()
  console.log('\n🔌 Đã ngắt kết nối MongoDB. Xong!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Lỗi khi seed:', err)
  process.exit(1)
})
