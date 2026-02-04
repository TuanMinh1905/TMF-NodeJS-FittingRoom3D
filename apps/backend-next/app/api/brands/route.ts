import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { corsHeaders, noContent } from "../_utils/cors";

export function OPTIONS() {
  return noContent();
}

export async function GET() {
  // findMany tương ứng với lệnh SELECT * FROM brands
  // Chúng ta có thể thêm where vào trong dấu {} để lọc dữ liệu nếu cần
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { id: "asc" },
    });

    // Trả về respone dạng JSON cùng với header CORS
    return NextResponse.json(brands, {
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("Error fetching brands:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
