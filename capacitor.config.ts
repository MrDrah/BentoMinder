import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // PLACEHOLDER application id. It becomes PERMANENT the moment an app with this id is published or distributed
  // (Play and installed devices identify the app by it). Change it BEFORE the first release build, never after.
  appId: 'app.bentominder',
  appName: 'BentoMinder',
  // The Vite build output (npm run build). `npm run cap:sync` builds first.
  webDir: 'dist',
  server: {
    // The WebView page origin becomes https://localhost (add it to the hosted function's ALLOWED_ORIGINS).
    androidScheme: 'https',
  },
};

export default config;
