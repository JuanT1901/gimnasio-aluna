// Genera el PDF del certificado con el formato del colegio. Solo se usa en el servidor.
// (Las imágenes de @react-pdf no son etiquetas <img> del navegador y no llevan «alt».)
/* eslint-disable jsx-a11y/alt-text */
import { Document, Font, Page, View, Text, Image, Svg, Path, Rect, Circle, Ellipse, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import {
  type CamposCertificado, type Colegio, type FilaNotas, type FormatoNotas, type TipoCertificado,
  textoCertificado,
} from './comun'

// Sin guiones al final de línea: @react-pdf usa reglas del inglés y partía palabras como «CON-DUCTA»
Font.registerHyphenationCallback(palabra => [palabra])

const MORADO = '#3b3f8f'
const TINTA = '#2b2b2b'

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 40, paddingHorizontal: 62, fontFamily: 'Helvetica', fontSize: 12.5, color: TINTA, position: 'relative' },
  // Marca de agua: la imagen mide 1561 × 1600 px
  marcaAgua: { position: 'absolute', left: 64, top: 160, width: 496, height: 508 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aluna: { width: 118, alignItems: 'center' },
  gimnasio: { fontSize: 8, color: MORADO, marginTop: 2, letterSpacing: 1 },
  resolucion: { flex: 1, textAlign: 'center', fontFamily: 'Helvetica-BoldOblique', fontSize: 7.5, color: MORADO, lineHeight: 1.5, paddingHorizontal: 10 },
  body: { marginTop: 56, flexGrow: 1 },
  // Título, texto y cierre van juntos como un bloque, centrado en el espacio entre la fecha y la firma
  contenido: { flexGrow: 1, justifyContent: 'center', paddingBottom: 100 },
  bodyNotas: { marginTop: 34, flexGrow: 1 },
  fecha: { fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  fechaIzq: { marginBottom: 10 },
  titulo: { fontFamily: 'Helvetica-Bold', textAlign: 'center', fontSize: 13.5, marginBottom: 26 },
  // @react-pdf suma el espacio propio de la fuente: 0.9 da el mismo interlineado de los formatos del colegio
  parrafo: { textAlign: 'justify', lineHeight: 1.15 },
  parrafoNotas: { textAlign: 'justify', lineHeight: 1 },
  cierre: { textAlign: 'justify', lineHeight: 1.15, marginTop: 34 },
  bold: { fontFamily: 'Helvetica-Bold' },
  tabla: { marginTop: 14, borderTopWidth: 0.8, borderLeftWidth: 0.8, borderColor: '#333', fontSize: 8.6 },
  fila: { flexDirection: 'row' },
  celda: { borderRightWidth: 0.8, borderBottomWidth: 0.8, borderColor: '#333', paddingVertical: 3, paddingHorizontal: 4, justifyContent: 'center' },
  th: { fontFamily: 'Helvetica-Bold', backgroundColor: '#f3f4f6', textAlign: 'center' },
  nota: { width: 34, textAlign: 'center' },
  area: { width: 150, fontFamily: 'Helvetica-Bold', fontSize: 7.6 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 },
  firmaBloque: { fontSize: 10.5, lineHeight: 1.4 },
  firma: { width: 175, height: 37, objectFit: 'contain', marginBottom: 4 },
  contactos: { gap: 5 },
  contacto: { flexDirection: 'row', alignItems: 'center', gap: 6, fontFamily: 'Helvetica-Bold', fontSize: 8.6, color: MORADO },
  meta: { position: 'absolute', left: 62, right: 62, bottom: 18, fontSize: 7, color: '#6b7280' },
  sello: { position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 96, letterSpacing: 8, color: '#dc2626', opacity: 0.14, transform: 'rotate(-30deg)' },
})

// Íconos del pie de página (WhatsApp, correo, web y dirección)
const Icono = ({ tipo }: { tipo: 'wa' | 'mail' | 'web' | 'pin' }) => (
  <Svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
    {tipo === 'wa' && <><Rect x="0" y="0" width="24" height="24" rx="5" fill="#25d366" /><Path d="M12 5.2a6.8 6.8 0 0 0-5.9 10.2L5.2 18.8l3.5-.9A6.8 6.8 0 1 0 12 5.2z" fill="none" stroke="#ffffff" strokeWidth={1.5} /><Path d="M9.5 9c.2-.4.5-.4.7-.4h.5l.8 1.7-.5.8c.5.9 1.2 1.6 2.1 2.1l.8-.5 1.7.8v.5c0 .4-.4.9-1.1 1-1.7.2-5-2.8-5.1-4.6 0-.6.1-1.1.1-1.4z" fill="#ffffff" /></>}
    {tipo === 'mail' && <><Circle cx="12" cy="12" r="12" fill="#1d4ed8" /><Rect x="6" y="8" width="12" height="8.5" rx="1.2" fill="none" stroke="#ffffff" strokeWidth={1.5} /><Path d="M6.5 8.6 12 13l5.5-4.4" fill="none" stroke="#ffffff" strokeWidth={1.5} /></>}
    {tipo === 'web' && <><Rect x="0" y="0" width="24" height="24" rx="5" fill="#e0f2fe" /><Circle cx="12" cy="12" r="6.5" fill="none" stroke="#0284c7" strokeWidth={1.5} /><Ellipse cx="12" cy="12" rx="2.8" ry="6.5" fill="none" stroke="#0284c7" strokeWidth={1.3} /><Path d="M5.5 12h13" stroke="#0284c7" strokeWidth={1.3} /></>}
    {tipo === 'pin' && <><Path d="M12 1.5a7.2 7.2 0 0 0-7.2 7.2c0 5.4 7.2 13.8 7.2 13.8s7.2-8.4 7.2-13.8A7.2 7.2 0 0 0 12 1.5z" fill="#dc2626" /><Path d="M8.4 10.2 12 7.1l3.6 3.1v3.6H8.4z" fill="#ffffff" /></>}
  </Svg>
)

const fmt = (n: number | null) => (typeof n === 'number' ? n.toFixed(1) : '')

function TablaNotas({ filas, formato }: { filas: FilaNotas[], formato: FormatoNotas }) {
  const notas = (f: FilaNotas) => [...f.p.slice(0, 3), f.def].map((n, i) => (
    <View key={i} style={[s.celda, s.nota]}><Text>{fmt(n)}</Text></View>
  ))
  const encabezadoNotas = ['1P', '2P', '3P', 'DEF'].map(t => <View key={t} style={[s.celda, s.nota, s.th]}><Text>{t}</Text></View>)

  if (formato === 'preescolar') {
    return (
      <View style={s.tabla}>
        <View style={s.fila} fixed><View style={[s.celda, s.th, { flex: 1 }]}><Text>ASIGNATURA</Text></View>{encabezadoNotas}</View>
        {filas.map((f, i) => (
          <View key={i} style={s.fila} wrap={false}><View style={[s.celda, { flex: 1 }]}><Text>{f.subject.toUpperCase()}</Text></View>{notas(f)}</View>
        ))}
      </View>
    )
  }

  // Filas agrupadas por área: la celda del área ocupa todas sus materias
  const grupos: { area: string, filas: FilaNotas[] }[] = []
  for (const f of filas) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.area === f.area) ultimo.filas.push(f)
    else grupos.push({ area: f.area, filas: [f] })
  }
  return (
    <View style={s.tabla}>
      <View style={s.fila} fixed>
        <View style={[s.celda, s.th, s.area]}><Text>ÁREA</Text></View>
        <View style={[s.celda, s.th, { flex: 1 }]}><Text>ASIGNATURA</Text></View>
        {encabezadoNotas}
      </View>
      {grupos.map((g, i) => (
        <View key={i} style={s.fila} wrap={false}>
          <View style={[s.celda, s.area]}><Text>{g.area}</Text></View>
          {/* Las materias se estiran para ocupar el alto del área cuando su nombre ocupa varias líneas */}
          <View style={{ flex: 1 }}>
            {g.filas.map((f, j) => (
              <View key={j} style={[s.fila, { flexGrow: 1 }]}><View style={[s.celda, { flex: 1 }]}><Text>{f.subject.toUpperCase()}</Text></View>{notas(f)}</View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

export type DatosPdf = {
  colegio: Colegio
  tipo: TipoCertificado
  campos: CamposCertificado
  formato: FormatoNotas
  notas: FilaNotas[] | null
  codigo: string
  verificacion: string | null
  firma: Buffer | null
  logoAluna: Buffer | null
  logoLudo: Buffer | null
  marcaAgua: Buffer | null
  // Certificado de prueba (solo en desarrollo): sin número ni código de verificación; «sello» agrega PRUEBA en diagonal
  prueba?: { sello: boolean }
}

// Una hoja carta con el certificado
function PaginaCertificado({ d }: { d: DatosPdf }) {
  const texto = textoCertificado(d.tipo, d.campos, d.colegio, d.formato)
  const c = d.colegio
  const web = c.website.replace(/^https?:\/\//, '')
  // La puntuación que sigue a un tramo en negrita (p. ej. la coma después del nombre) se pega a ese tramo:
  // si quedan en tramos separados, @react-pdf puede partir la línea entre ellos y agregar un guion («Galindo-»)
  const segmentos = texto.parrafo.reduce<typeof texto.parrafo>((acc, seg) => {
    const prev = acc[acc.length - 1]
    const signos = seg.t.match(/^[,.;:]+/)?.[0]
    if (prev && signos) { acc[acc.length - 1] = { ...prev, t: prev.t + signos }; seg = { ...seg, t: seg.t.slice(signos.length) } }
    if (seg.t) acc.push(seg)
    return acc
  }, [])
  const parrafo = segmentos.map((seg, i) => <Text key={i} style={seg.b ? s.bold : undefined}>{seg.t}</Text>)

  return (
    <Page size="LETTER" style={s.page}>
      {d.marcaAgua && <Image src={d.marcaAgua} style={s.marcaAgua} fixed />}

      <View style={s.head}>
        <View style={s.aluna}>
          {d.logoAluna && <Image src={d.logoAluna} style={{ width: 118 }} />}
          <Text style={s.gimnasio}>— GIMNASIO —</Text>
        </View>
        <Text style={s.resolucion}>{c.resolutionText}{'\n'}{c.daneText}</Text>
        {d.logoLudo ? <Image src={d.logoLudo} style={{ width: 88 }} /> : <View style={{ width: 88 }} />}
      </View>

      {d.tipo === 'notas' ? (
        <View style={s.bodyNotas}>
          <Text style={s.fechaIzq}>{texto.fecha}</Text>
          <Text style={s.parrafoNotas}>{parrafo}</Text>
          {d.notas && <TablaNotas filas={d.notas} formato={d.formato} />}
        </View>
      ) : (
        <View style={s.body}>
          <Text style={s.fecha}>{texto.fecha}</Text>
          <View style={s.contenido}>
            <View>
              {texto.titulo && <Text style={s.titulo}>{texto.titulo}</Text>}
              <Text style={s.parrafo}>{parrafo}</Text>
            </View>
            {texto.cierre && <Text style={s.cierre}>{texto.cierre}</Text>}
          </View>
        </View>
      )}

      <View style={s.bottom} wrap={false}>
        <View style={s.firmaBloque}>
          {d.firma ? <Image src={d.firma} style={s.firma} /> : <View style={{ height: 41 }} />}
          <Text style={s.bold}>{c.signerShort}</Text>
          <Text>{c.signerTitle}.</Text>
          <Text>{c.institutionName}.</Text>
        </View>
        <View style={s.contactos}>
          <View style={s.contacto}><Icono tipo="wa" /><Text>{c.contactPhone}</Text></View>
          <View style={s.contacto}><Icono tipo="mail" /><Text>{c.contactEmail}</Text></View>
          <View style={s.contacto}><Icono tipo="web" /><Text>{web}</Text></View>
          <View style={s.contacto}><Icono tipo="pin" /><Text>{c.addressLine1}{'\n'}{c.addressLine2}</Text></View>
        </View>
      </View>

      {d.prueba?.sello && <Text style={s.sello} fixed>PRUEBA</Text>}

      <Text style={s.meta} fixed>
        {d.prueba ? 'Certificado de prueba · Sin validez · No tiene número ni código de verificación'
          : `Certificado N.º ${d.codigo}${d.verificacion ? ` · Código de verificación ${d.verificacion} · Verifícalo en ${web}/certificados` : ''}`}
      </Text>
    </Page>
  )
}

export async function generarPdfCertificado(d: DatosPdf): Promise<Buffer> {
  return renderToBuffer(
    <Document title={`Certificado ${d.codigo}`} author={d.colegio.institutionName} language="es">
      <PaginaCertificado d={d} />
    </Document>,
  )
}

// Varios certificados en un solo PDF, una hoja por certificado (para comparar certificados de prueba)
export async function generarPdfVarios(lista: DatosPdf[], titulo: string): Promise<Buffer> {
  return renderToBuffer(
    <Document title={titulo} author={lista[0]?.colegio.institutionName} language="es">
      {lista.map((d, i) => <PaginaCertificado key={i} d={d} />)}
    </Document>,
  )
}
