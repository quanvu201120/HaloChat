/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_WEBRTC_STUN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
