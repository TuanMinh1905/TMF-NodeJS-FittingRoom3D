
// Import kiểu request của Next.js để đọc thông tin HTTP request
import { NextRequest } from 'next/server';
// Import instance Prisma để thao tác với database
import { prisma } from '@/lib/prisma';
// Import helper xử lý CORS và trả về response không có nội dung
import { withCors, noContent } from '../_utils/cors';
// Schema validate dữ liệu sản phẩm (Zod) cho request body
import { productSchema } from '../_utils/schemas';
// Hàm map để chuyển các kiểu Decimal trong Prisma sang number trong JSON
import { mapProducts, mapProduct } from '../_utils/mapDecimal';

// Handler cho method OPTIONS, dùng cho preflight CORS, trả về 204 No Content
export async function OPTIONS() { return noContent(204); }

// Handler cho GET /api/products
// - Hỗ trợ phân trang (page, pageSize)
// - Hỗ trợ search theo tên, title, SKU, description (q hoặc search)
// - Hỗ trợ filter theo categoryId (có xử lý category cha/con) và brandId
export async function GET(req: NextRequest) {
  // Lấy query string từ URL của request
  const { searchParams } = new URL(req.url);
  // Đọc tham số page, nếu không có thì mặc định là 1
  const page = Number(searchParams.get('page') ?? '1');
  // Đọc tham số pageSize, mặc định 20 và giới hạn tối đa 100 để tránh query quá lớn
  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '20'), 100);
  // Tính số bản ghi cần bỏ qua (skip) dựa trên page hiện tại
  const skip = (page - 1) * pageSize;
  // Lọc theo categoryId (nếu có)
  const categoryId = searchParams.get('categoryId');
  // Lọc theo brandId (nếu có)
  const brandId = searchParams.get('brandId');
  // Chuỗi tìm kiếm, ưu tiên param q, nếu không có thì dùng search (phục vụ cả FE user và admin)
  const searchQuery = searchParams.get('q') || searchParams.get('search');

  // Khởi tạo điều kiện where cho Prisma (sẽ build dần tùy theo filter)
  let where: any = {};

  // Nếu có từ khóa tìm kiếm -> search theo nhiều trường: name, title, sku, description
  if (searchQuery) {
    where.OR = [
      { name: { contains: searchQuery } },
      { title: { contains: searchQuery } },
      { sku: { contains: searchQuery } },
      { description: { contains: searchQuery } },
    ];
  }

  // Nếu có categoryId -> filter theo danh mục
  if (categoryId) {
    // Ép kiểu categoryId sang số
    const catId = Number(categoryId);
    
    // Tìm category được yêu cầu
    const category = await prisma.category.findUnique({
      where: { id: catId },
    });

    if (category) {
      // Kiểm tra xem category này có con không (là category cha)
      // Lấy các category con (nếu có) của category hiện tại
      const childCategories = await prisma.category.findMany({
        where: { parentId: catId },
        select: { id: true },
      });

      if (childCategories.length > 0) {
        // Nếu category hiện tại là category cha → lấy sản phẩm của tất cả category con
        const childIds = childCategories.map(c => c.id);
        where.categoryId = { in: childIds };
      } else {
        // Nếu là category con (leaf) → chỉ lấy sản phẩm thuộc chính category đó
        where.categoryId = catId;
      }
    }
  }

  // Nếu có brandId -> thêm điều kiện filter theo brand
  if (brandId) {
    where.brandId = Number(brandId);
  }

  // Thực hiện 2 query song song:
  // - Đếm tổng số sản phẩm thỏa điều kiện (total)
  // - Lấy danh sách sản phẩm theo trang hiện tại (items)
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ 
      where,
      skip, 
      take: pageSize, 
      include: { category: true, brand: true }, 
      orderBy: { id: 'desc' } 
    }),
  ]);

  // Trả về dữ liệu kèm CORS:
  // - page, pageSize: thông tin phân trang
  // - total: tổng số bản ghi thỏa điều kiện
  // - items: danh sách sản phẩm đã được map Decimal -> number
  return withCors({ page, pageSize, total, items: mapProducts(items) });
}

// Handler cho POST /api/products
// - Nhận dữ liệu sản phẩm mới từ body
// - Validate bằng productSchema
// - Nếu hợp lệ thì tạo bản ghi product mới trong DB
export async function POST(req: NextRequest) {
  // Thử parse JSON từ request body, nếu lỗi thì trả về null
  const json = await req.json().catch(() => null);
  // Validate dữ liệu theo productSchema (Zod)
  const parsed = productSchema.safeParse(json);
  // Nếu validate thất bại -> trả về lỗi 400 cùng chi tiết lỗi
  if (!parsed.success) return withCors({ error: parsed.error.format() }, 400);
  // Tạo sản phẩm mới trong DB, đồng thời include thông tin category và brand liên quan
  const created = await prisma.product.create({ data: parsed.data, include: { category: true, brand: true } });
  // Trả về sản phẩm vừa tạo (đã map Decimal) với status 201 Created
  return withCors(mapProduct(created), 201);
}
