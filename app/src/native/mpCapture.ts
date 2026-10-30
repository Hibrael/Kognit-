import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

// Interface TS do plugin nativo MpCapture (10.6), em android/app/src/main/java/.../capture.

export interface CaptureItem { hash: string; package: string; postTime: number; title: string; text: string }
export interface MpCapturePlugin {
  isEnabled(): Promise<{ enabled: boolean }>
  isIgnoringBattery(): Promise<{ ignoring: boolean }>
  openNotificationAccess(): Promise<void>
  openAppDetails(): Promise<void>
  openBatterySettings(): Promise<void>
  peek(opts?: { limit?: number }): Promise<{ items: CaptureItem[]; total: number }>
  ack(opts: { hashes: string[] }): Promise<{ removed: number }>
  addListener(event: 'captured', fn: (e: { hash: string }) => void): Promise<PluginListenerHandle>
}
export const MpCapture = registerPlugin<MpCapturePlugin>('MpCapture')
