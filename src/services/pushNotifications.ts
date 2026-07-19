import { authApi, pushSubscriptionsApi } from './api';

type SessionDevice = {
  _id?: string;
  sessionId?: string;
  deviceId?: string;
};

function decodeSessionId(accessToken: string) {
  const parts = accessToken.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(window.atob(padded)) as { sessionId?: string };
    return payload.sessionId?.trim() || null;
  } catch {
    return null;
  }
}

async function getCurrentDeviceId(accessToken: string) {
  const sessionId = decodeSessionId(accessToken);
  if (!sessionId) return null;

  const response = await authApi.getDevices();
  const payload = response.data?.data ?? response.data;
  const devices = Array.isArray(payload) ? payload as SessionDevice[] : [];
  const currentDevice = devices.find((device) =>
    String(device._id || device.sessionId || '').trim() === sessionId,
  );

  return currentDevice?.deviceId?.trim() || null;
}

function urlBase64ToUint8Array(value: string) {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=');
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function isWebPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function subscribeCurrentDeviceToPush(accessToken: string) {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
  if (!isWebPushSupported() || !publicKey || Notification.permission !== 'granted') return;

  const [registration, deviceId] = await Promise.all([
    navigator.serviceWorker.register('/push-sw.js'),
    getCurrentDeviceId(accessToken),
  ]);
  if (!deviceId) return;

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const serializedSubscription = subscription.toJSON();
  const p256dh = serializedSubscription.keys?.p256dh;
  const auth = serializedSubscription.keys?.auth;
  if (!p256dh || !auth) return;

  await pushSubscriptionsApi.upsert({
    deviceId,
    subscription: {
      endpoint: subscription.endpoint,
      keys: { p256dh, auth },
    },
  });
}
