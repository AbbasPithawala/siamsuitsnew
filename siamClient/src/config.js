import axios from 'axios'

// Dynamic base URL based on environment
const baseURL = process.env.NODE_ENV === 'production' 
  ? '/api'  // Production: same origin with /api prefix
  : 'http://localhost:4545/api'; // Development: with /api prefix

export const axiosInstance = axios.create({
    baseURL: baseURL
})
