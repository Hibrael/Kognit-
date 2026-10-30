import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { handleAuthReturn } from '../lib/session'

// Integração com o APK (10.3): o Google bloqueia login dentro do WebView, então o login abre no navegador do
// sistema e volta por minhascontas://auth?code= (ou ?token= do link mágico).

export const native = Capacitor.isNativePlatform()

export function openExternal(url: string) {
  if (native) void Browser.open({ url })
  else location.assign(url)
}

/** Escuta o deep link de volta do login. onMessage recebe o erro, se houver. */
let listening = false
export function listenAuthDeepLinks(onMessage: (msg: string | null) => void) {
  if (!native || listening) return
  listening = true
  void App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith('minhascontas://auth')) return
    onMessage(await handleAuthReturn(url))
    void Browser.close().catch(() => {})
  })
}
