import { safeLocalStorage } from './storage-utils';

const DEVICE_ID_KEY = 'deviceId';

/**
 * Retrieves a unique device ID from LocalStorage.
 * If one does not exist, it creates a new one and stores it.
 * @returns The unique device ID.
 */
export function getDeviceId(): string {
  let deviceId = safeLocalStorage.getItem<string>(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    safeLocalStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}
