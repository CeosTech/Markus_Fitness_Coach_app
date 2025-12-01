import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.markus.fitnesscoach',
  appName: 'ai-fitness-form-coach',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://markus-fitnesscoach-webapp-860825765167.europe-west1.run.app/',
    cleartext: false
  }
};

export default config;
