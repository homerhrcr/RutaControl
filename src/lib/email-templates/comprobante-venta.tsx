import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface ComprobanteVentaProps {
  empresa?: string
  telefono?: string
  numero?: string
  cliente?: string
  identificacion?: string
  fecha?: string
  lineas?: Array<{ nombre: string; detalle: string; total: string }>
  descuento?: string
  total?: string
  pago?: string
  recibido?: string
  vuelto?: string
}

const Email = ({ empresa = 'Su empresa', telefono, numero = '', cliente, identificacion, fecha, lineas = [], descuento, total, pago, recibido, vuelto }: ComprobanteVentaProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{`Comprobante ${numero} de ${empresa}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={marca}>{empresa}</Text>
        {telefono ? <Text style={nota}>Tel: {telefono}</Text> : null}
        <Heading style={titulo}>Comprobante de venta #{numero}</Heading>
        <Text style={parrafo}>{cliente ? `Estimado(a) ${cliente}:` : 'Estimado(a) cliente:'}</Text>
        <Text style={parrafo}>Gracias por su compra. Este es el detalle de su comprobante.</Text>
        <Section style={caja}>
          {fecha ? <Text style={dato}><strong>Fecha:</strong> {fecha}</Text> : null}
          {identificacion ? <Text style={dato}><strong>Identificación:</strong> {identificacion}</Text> : null}
          {pago ? <Text style={dato}><strong>Pago:</strong> {pago}</Text> : null}
        </Section>
        {lineas.map((l, i) => (
          <Section key={i} style={{ margin: '0 0 8px' }}>
            <Text style={{ ...dato, fontWeight: 700 }}>{l.nombre}</Text>
            <Text style={dato}>{l.detalle} — {l.total}</Text>
          </Section>
        ))}
        <Hr style={linea} />
        {descuento ? <Text style={dato}>Descuento: -{descuento}</Text> : null}
        <Text style={totalStyle}>TOTAL: {total}</Text>
        {recibido ? <Text style={dato}>Recibido: {recibido} · Vuelto: {vuelto}</Text> : null}
        <Text style={nota}>Comprobante interno. No es factura electrónica autorizada por Hacienda.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Comprobante #${d['numero'] ?? ''} · ${d['empresa'] ?? 'Su empresa'}`,
  displayName: 'Comprobante de venta',
  previewData: {
    empresa: 'Lácteos La Rivera', numero: 'A1B2C3D4', cliente: 'María Jiménez', fecha: '23/10/2026 14:30',
    lineas: [{ nombre: 'Leche fresca 1L', detalle: '2 x ₡1.250', total: '₡2.500' }], total: '₡2.500', pago: 'EFECTIVO', recibido: '₡5.000', vuelto: '₡2.500',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const marca = { fontSize: '14px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase' as const, margin: '0 0 4px' }
const titulo = { fontSize: '20px', color: '#1f2937', margin: '12px 0 16px' }
const parrafo = { fontSize: '15px', lineHeight: '24px', color: '#374151', margin: '0 0 10px' }
const caja = { backgroundColor: '#f0fdfa', borderRadius: '8px', padding: '14px 16px', margin: '16px 0' }
const dato = { fontSize: '14px', color: '#1f2937', margin: '0 0 4px' }
const totalStyle = { fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '8px 0' }
const linea = { borderColor: '#e5e7eb', margin: '16px 0 10px' }
const nota = { fontSize: '12px', color: '#6b7280', margin: '8px 0 0' }
