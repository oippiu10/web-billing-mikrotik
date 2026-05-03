import axios from 'axios'

// Konfigurasi base URL untuk API PHP Laragon
// Diasumsikan shadcn-admin diakses melalui proxy Vite atau berada di subfolder yang sama
const API_BASE_URL = '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Menangani error global jika diperlukan
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default api
