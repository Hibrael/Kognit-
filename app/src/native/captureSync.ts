import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'
import { api, ApiError } from '../lib/api'
import { MpCapture } from './mpCapture'

// Envio da fila de capturas (8.3): o back decide entre "Para revisar" e o parser (capture_mode).
// v1: envia quando o app abre ou volta ao primeiro plano, e quando chega uma captura com o app aberto.

let running = false
let again = false

export async function drainCaptures(email: string) {
  if (!Capacitor.isNativePlatform()) return
  if (running) { again = true; return }   // um "captured" durante a drenagem roda de novo no fim
  running = true
  try {
    const info = await Device.getInfo()
    const deviceLabel = `${info.manufacturer} ${info.model} · ${email}`
    do {
      again = false
      for (;;) {
        const { items } = await MpCapture.peek({ limit: 100 })
        if (!items.length) break
        let accepted: string[]
        try {
          accepted = (await api<{ accepted: string[] }>('/api/captures', { method: 'POST', json: { deviceLabel, items } })).accepted
        } catch (e) {
          // rede ou sessão: fica na fila e tenta no próximo resume
          console.warn('capturas não enviadas', e instanceof ApiError ? e.message : e)
          return
        }
        if (!accepted.length) return
        await MpCapture.ack({ hashes: accepted })
      }
    } while (again)
  } finally {
    running = false
  }
}

/** Chamar uma vez depois do login. Devolve a função que para a sincronização. */
export function startCaptureSync(email: string): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}
  const run = () => { void drainCaptures(email) }
  run()
  const handles = [App.addListener('resume', run), MpCapture.addListener('captured', run)]
  return () => { handles.forEach(h => h.then(x => x.remove())) }
}

/** F0: "Exportar capturas (JSON)" sem servidor, para ajustar as regras do parser com textos reais. */
export async function exportCaptures() {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const { items } = await MpCapture.peek({ limit: 2000 })
  const { uri } = await Filesystem.writeFile({ path: 'capturas.json', data: JSON.stringify(items, null, 2), directory: Directory.Cache, encoding: Encoding.UTF8 })
  await Share.share({ files: [uri] })
}
