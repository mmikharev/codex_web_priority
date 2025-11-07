import { contextBridge } from 'electron';

const apiBaseUrl = process.env.VITE_API_BASE_URL;

contextBridge.exposeInMainWorld('electronAPI', {
  getApiBaseUrl() {
    return apiBaseUrl;
  },
});
