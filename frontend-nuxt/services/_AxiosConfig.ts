// Đây là cách gọi API cũ, tên ban đầu là clientAPI, hiện cách gọi API đang xài useFetch của Nuxt hỗ trợ
import axios from 'axios'

// API base URL - đọc từ biến môi trường khi build
// [LOCAL]      Chạy local backend:
const API_BASE = import.meta.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4005/api'
// [PRODUCTION] Chạy production trên Render:
// const API_BASE = import.meta.env.NUXT_PUBLIC_API_BASE || 'https://tmf-backend-a25p.onrender.com/api'

const clientAPI = (url?: string) => {
  const baseURL = url && url.length > 0 ? url : API_BASE

  return axios.create({
    baseURL,
    withCredentials: false,
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Accept: 'application/json',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json',
    },
  })
}

export default clientAPI
