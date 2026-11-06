import type { ComponentType } from 'react'
import { template as comprobanteVenta } from './comprobante-venta'
import { template as estadoCuenta } from './estado-cuenta'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'comprobante-venta': comprobanteVenta,
  'estado-cuenta': estadoCuenta,
}
