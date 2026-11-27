import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.virtualdrum.koma',
  appName: 'KOMA',
  webDir: 'dist',
  backgroundColor: '#000000',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['127.0.0.1', 'localhost', '*'],
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#000000',
  },
};

export default config;
