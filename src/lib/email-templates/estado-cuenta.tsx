import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface EstadoCuentaProps {
  empresa?: string
  telefono?: string
  cliente?: string
  fecha?: string
  periodo?: string
  compras?: string
  pagado?: string
  saldo?: string
  movimientos?: Array<{ titulo: string; lineas: string[]; total: string }>
}

const Email = ({ empresa = 'Su empresa', telefono, cliente, fecha, periodo, compras, pagado, saldo, movimientos = [] }: EstadoCuentaProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{`Estado de cuenta de ${empresa}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={marca}>{empresa}</Text>
        {telefono ? <Text style={nota}>Tel: {telefono}</Text> : null}
        <Heading style={titulo}>Estado de cuenta</Heading>
        <Text style={parrafo}>{cliente ? `Estimado(a) ${cliente}:` : 'Estimado(a) cliente:'}</Text>
        <Section style={caja}>
          {fecha ? <Text style={dato}><strong>Fecha:</strong> {fecha}</Text> : null}
          {periodo ? <Text style={dato}><strong>Periodo:</strong> {periodo}</Text> : null}
          <Text style={dato}>Compras: {compras}</Text>
          <Text style={dato}>Pagado (contado + abonos): {pagado}</Text>
          <Text style={{ ...dato, fontWeight: 700 }}>Saldo pendiente: {saldo}</Text>
        </Section>
        {movimientos.length ? <Text style={{ ...dato, fontWeight: 700, margin: '8px 0' }}>Detalle de movimientos</Text> : null}
        {movimientos.map((m, i) => (
          <Section key={i} style={{ margin: '0 0 10px' }}>
            <Text style={{ ...dato, fontWeight: 700 }}>{m.titulo}</Text>
            {m.lineas.map((x, j) => <Text key={j} style={dato}>• {x}</Text>)}
            <Text style={dato}>Total: {m.total}</Text>
          </Section>
        ))}
        <Hr style={linea} />
        <Text style={nota}>Gracias por su preferencia.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Estado de cuenta · ${d['empresa'] ?? 'Su empresa'}`,
  displayName: 'Estado de cuenta',
  previewData: {
    empresa: 'Mi empresa', cliente: 'María Jiménez', fecha: '05 nov 2026', compras: '₡10 300', pagado: '₡10 300', saldo: '₡0',
    movimientos: [{ titulo: '05 nov 2026 · Contado', lineas: ['2× Queso: ₡7 600'], total: '₡7 600' }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const marca = { fontSize: '14px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase' as const, margin: '0 0 4px' }
const titulo = { fontSize: '20px', color: '#1f2937', margin: '12px 0 16px' }
const parrafo = { fontSize: '15px', lineHeight: '24px', color: '#374151', margin: '0 0 10px' }
const caja = { backgroundColor: '#f0fdfa', borderRadius: '8px', padding: '14px 16px', margin: '16px 0' }
const dato = { fontSize: '14px', color: '#1f2937', margin: '0 0 4px' }
const linea = { borderColor: '#e5e7eb', margin: '16px 0 10px' }
const nota = { fontSize: '12px', color: '#6b7280', margin: '8px 0 0' }
