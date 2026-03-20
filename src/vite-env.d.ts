/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_FUNCTIONS_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
