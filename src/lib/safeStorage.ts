import { createJSONStorage } from 'zustand/middleware';

/**
 * localStorage for zustand persist that NEVER throws. A QuotaExceeded
 * mid-setItem otherwise propagates out of the store action — straight
 * through whatever game effect triggered the save and into the
 * router's error page (seen in the wild when daily play snapshots
 * filled the quota). Losing one save beats losing the screen.
 */
export const safeJSONStorage = () =>
  createJSONStorage(() => ({
    getItem: (name: string) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: string) => {
      try {
        localStorage.setItem(name, value);
      } catch (e) {
        console.warn(`persist: could not save ${name}`, e);
      }
    },
    removeItem: (name: string) => {
      try {
        localStorage.removeItem(name);
      } catch {
        // ignore
      }
    },
  }));
