// ==================== HONO ENVIRONMENT TYPES ====================
// Khai báo kiểu dữ liệu cho các biến được middleware gắn vào Context
// Khi authMiddleware set c.set('userId', ...) → TypeScript cần biết kiểu
//
// Cách dùng: import { AppEnv } from '../types/env.js'
//            const app = new Hono<AppEnv>()

export type AppEnv = {
  Variables: {
    userId: string
    role: string
  }
}
