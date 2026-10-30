import {
  Check, ChevronLeft, ChevronRight, Download, Moon, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Sun, Trash2, Upload, X,
  type LucideIcon,
} from 'lucide-react'

// Ícones Lucide em traço fino (~1px visual, 4.1). A classe "i" vem do CSS do protótipo.
const ICONS = {
  sun: Sun, moon: Moon, sliders: SlidersHorizontal, plus: Plus, pencil: Pencil, trash: Trash2, x: X, check: Check,
  search: Search, chevL: ChevronLeft, chevR: ChevronRight, download: Download, upload: Upload, rotate: RotateCcw,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export function Icon({ name }: { name: IconName }) {
  const C = ICONS[name]
  return <C className="i" strokeWidth={1.5} aria-hidden="true" />
}
