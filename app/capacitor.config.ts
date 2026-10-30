import type { CapacitorConfig } from '@capacitor/cli'

// 10.7: o mesmo build (dist/) vai para o APK e para a web.
const config: CapacitorConfig = {
  appId: 'br.com.minhascontas.app',
  appName: 'Minhas contas',
  webDir: 'dist',
}

export default config
