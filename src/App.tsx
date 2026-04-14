import { useMemo, useState } from 'react'
import { ImagePlus, Folder, File, DownloadCloud, Sparkles } from 'lucide-react'
import { useThemeStore } from './store/themeStore'
import { buildThemeZip, createPlaceholderPng, loadImage, normalizeImageFile, readFileAsDataUrl } from './lib/themeUtils'

type PendingResizeInfo = {
  file: File
  target: 'upper' | 'lower'
  expectedWidth: number
  expectedHeight: number
  imageWidth: number
  imageHeight: number
  previewUrl: string
}

function formatFileName(file: File | null) {
  return file ? file.name : 'Ningún archivo cargado'
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 text-lg font-semibold text-white">
        <Sparkles className="h-5 w-5 text-vibrant" />
        {title}
      </div>
      <p className="mt-1 text-sm text-slate-300">{description}</p>
    </div>
  )
}

function PanelLabel({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
      <Icon className="h-4 w-4 text-vibrant" />
      {label}
    </div>
  )
}

function InputRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-3xl border border-slate-700/70 bg-navy/90 p-4 shadow-[0_15px_40px_rgba(10,9,27,0.4)]">
      <div className="text-sm font-semibold text-slate-200">{label}</div>
      {children}
    </div>
  )
}

export default function App() {
  const {
    themeName,
    author,
    description,
    flags,
    bgmFile,
    upperImage,
    lowerImage,
    folderIcon,
    fileIcon,
    setThemeName,
    setAuthor,
    setDescription,
    setFlag,
    setBgmFile,
    setUpperImage,
    setLowerImage,
    setFolderIcon,
    setFileIcon,
  } = useThemeStore()

  const [statusMessage, setStatusMessage] = useState<string | null>('Carga tus imágenes para ver la previsualización en tiempo real.')
  const [exporting, setExporting] = useState(false)
  const [pendingResize, setPendingResize] = useState<PendingResizeInfo | null>(null)

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 'upper' | 'lower',
  ) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    event.target.value = ''

    const expected = target === 'upper' ? { width: 400, height: 240 } : { width: 320, height: 240 }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const image = await loadImage(dataUrl)

      if (image.width === expected.width && image.height === expected.height) {
        const normalized = await normalizeImageFile(file, expected.width, expected.height, 'stretch')
        if (target === 'upper') setUpperImage(normalized)
        else setLowerImage(normalized)
        setStatusMessage(`Imagen ${target === 'upper' ? 'superior' : 'inferior'} lista con dimensiones correctas.`)
        return
      }

      setPendingResize({
        file,
        target,
        expectedWidth: expected.width,
        expectedHeight: expected.height,
        imageWidth: image.width,
        imageHeight: image.height,
        previewUrl: dataUrl,
      })
      setStatusMessage(
        `La imagen tiene ${image.width}×${image.height}. Elige estirar o recortar para ajustarla a ${expected.width}×${expected.height}.`,
      )
    } catch (error) {
      setStatusMessage('No se pudo procesar la imagen, intenta con un PNG válido.')
    }
  }

  const handleImageResizeChoice = async (mode: 'stretch' | 'crop') => {
    if (!pendingResize) return
    setStatusMessage('Procesando la imagen según tu elección...')
    try {
      const normalized = await normalizeImageFile(
        pendingResize.file,
        pendingResize.expectedWidth,
        pendingResize.expectedHeight,
        mode,
      )

      if (pendingResize.target === 'upper') setUpperImage(normalized)
      else setLowerImage(normalized)
      setStatusMessage(
        `Imagen ${pendingResize.target === 'upper' ? 'superior' : 'inferior'} ${
          mode === 'stretch' ? 'estirada' : 'recortada'
        } a ${pendingResize.expectedWidth}×${pendingResize.expectedHeight}.`,
      )
    } catch {
      setStatusMessage('No se pudo procesar la imagen. Intenta con otro archivo válido.')
    } finally {
      setPendingResize(null)
    }
  }

  const cancelPendingResize = () => {
    setPendingResize(null)
    setStatusMessage('Carga cancelada. Selecciona otra imagen o intenta de nuevo.')
  }

  const handleAssetUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'folder' | 'file') => {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    const url = URL.createObjectURL(file)
    const asset = { file, previewUrl: url }
    if (type === 'folder') setFolderIcon(asset)
    else setFileIcon(asset)
  }

  const topScreenStyle = useMemo(
    () => ({
      backgroundImage: upperImage ? `url(${upperImage.previewUrl})` : 'linear-gradient(180deg, rgba(34,50,123,0.85), rgba(13,16,38,0.9))',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }),
    [upperImage],
  )

  const bottomScreenStyle = useMemo(
    () => ({
      backgroundImage: lowerImage ? `url(${lowerImage.previewUrl})` : 'linear-gradient(180deg, rgba(28,34,80,0.9), rgba(8,6,22,0.95))',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }),
    [lowerImage],
  )

  const handleBgmUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setBgmFile(file)
    if (file) setStatusMessage(`BGM cargada: ${file.name}`)
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
  }

  const exportTheme = async () => {
    setExporting(true)
    setStatusMessage('Generando paquete Anemone3DS...')
    try {
      const zipBlob = await buildThemeZip({
        themeName,
        author,
        description,
        bgmFile,
        upperImage,
        lowerImage,
      })
      downloadBlob(zipBlob, `${themeName.replace(/[^a-zA-Z0-9-_ ]+/g, '_') || '3ds-theme'}.zip`)
      setStatusMessage('Lista! Descarga del archivo .zip iniciada.')
    } catch (error) {
      setStatusMessage('Ocurrió un error al exportar. Revisa tus activos y vuelve a intentar.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-deep px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <header className="mx-auto mb-6 max-w-7xl rounded-[32px] border border-slate-700/60 bg-navy/95 p-6 shadow-[0_30px_90px_rgba(8,6,22,0.55)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">3DS Theme Studio</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Editor de temas Anemone3DS</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Carga tus imágenes, visualiza las dos pantallas en tiempo real y exporta el paquete listo para Anemone.</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="inline-flex items-center gap-2 rounded-full bg-vibrant/15 px-3 py-2 text-sm text-vibrant ring-1 ring-vibrant/20">Paleta Deep Sea / Dark Pro</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-2 text-sm text-slate-300">Interfaz accesible y orientada a usuarios</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <section className="space-y-5 rounded-[32px] border border-slate-700/70 bg-navy/90 p-5">
          <SectionHeader title="Configuración global" description="Ajusta los metadatos que se incluirán en info.smdh y el comportamiento del tema." />

          <InputRow label="Nombre del Tema">
            <input
              value={themeName}
              onChange={(event) => setThemeName(event.target.value)}
              className="w-full rounded-3xl border border-slate-700/80 bg-[#11193c] px-4 py-3 text-white outline-none transition focus:border-vibrant/80"
              placeholder="Ej. Ocean Depth"
            />
          </InputRow>

          <InputRow label="Autor">
            <div className="flex items-center gap-3">
              <UserIcon />
              <input
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                className="w-full rounded-3xl border border-slate-700/80 bg-[#11193c] px-4 py-3 text-white outline-none transition focus:border-vibrant/80"
                placeholder="Tu nombre o alias"
              />
            </div>
          </InputRow>

          <InputRow label="Descripción breve">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              className="w-full resize-none rounded-3xl border border-slate-700/80 bg-[#11193c] px-4 py-3 text-white outline-none transition focus:border-vibrant/80"
              placeholder="Describe el estilo del tema, por ejemplo: oscuro, marino y elegante."
            />
          </InputRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <InputRow label="Visibilidad Home Menu">
              <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={flags.homeVisible}
                  onChange={(event) => setFlag('homeVisible', event.target.checked)}
                  className="h-5 w-5 rounded border-slate-600 bg-slate-900 text-vibrant focus:ring-vibrant"
                />
                Mostrar el tema en el home menu
              </label>
            </InputRow>

            <InputRow label="Soporte 3D">
              <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={flags.allow3D}
                  onChange={(event) => setFlag('allow3D', event.target.checked)}
                  className="h-5 w-5 rounded border-slate-600 bg-slate-900 text-vibrant focus:ring-vibrant"
                />
                Permitir 3D en la 3DS
              </label>
            </InputRow>
          </div>

          <InputRow label="Audio BGM opcional">
            <input type="file" accept="audio/*,.bcstm" onChange={handleBgmUpload} className="w-full text-sm text-slate-200" />
            <p className="mt-2 text-xs text-slate-400">Carga un archivo .bcstm para incluirlo como música del tema.</p>
          </InputRow>

          <div className="rounded-3xl border border-slate-700/80 bg-slate-950/20 p-4 text-sm text-slate-300">
            <div className="font-medium text-slate-100">Estado de exportación</div>
            <p className="mt-2 leading-6">{statusMessage}</p>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-700/70 bg-navy/90 p-5 shadow-[0_20px_60px_rgba(8,6,22,0.35)]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Previsualización 3DS</h2>
              <p className="mt-1 text-sm text-slate-300">Simula las dos pantallas del sistema con actualizaciones instantáneas.</p>
            </div>
            <div className="rounded-3xl bg-slate-950/60 px-4 py-3 text-sm text-slate-200 ring-1 ring-slate-700/80">
              Exporta un ZIP compatible con Anemone3DS
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-700/80 bg-[#050814]/95 p-5 shadow-[inset_0_0_80px_rgba(47,47,228,0.08)]">
            <div className="mx-auto max-w-[500px] rounded-[40px] border border-slate-700/80 bg-[#111726] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-center gap-2 pb-4">
                <span className="h-2.5 w-16 rounded-full bg-slate-600/80" />
                <span className="h-2.5 w-12 rounded-full bg-slate-600/80" />
              </div>

              <div className="rounded-[32px] border border-slate-700/70 bg-[#090d2b] p-4 shadow-[inset_0_0_40px_rgba(47,47,228,0.12)]">
                <div className="mb-4 flex items-center justify-between rounded-[24px] bg-slate-950/20 px-4 py-3 text-sm text-slate-300">
                  <span className="font-medium text-white">Pantalla superior</span>
                  <span className="text-slate-400">400 × 240</span>
                </div>
                <div className="relative h-[240px] overflow-hidden rounded-[28px] border border-slate-700/70 bg-slate-900" style={topScreenStyle}>
                  {!upperImage && <div className="flex h-full items-center justify-center text-slate-500">Arrastra / carga bg_upper.png</div>}
                  <div className="pointer-events-none absolute left-4 top-4 h-3 w-3 rounded-full bg-white/15 shadow-[0_0_20px_rgba(255,255,255,0.08)]" />
                  <div className="pointer-events-none absolute right-4 top-4 h-3 w-3 rounded-full bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]" />
                </div>
              </div>

              <div className="mt-6 rounded-[32px] border border-slate-700/70 bg-[#090d2b] p-4 shadow-[inset_0_0_40px_rgba(47,47,228,0.12)]">
                <div className="mb-4 flex items-center justify-between rounded-[24px] bg-slate-950/20 px-4 py-3 text-sm text-slate-300">
                  <span className="font-medium text-white">Pantalla inferior</span>
                  <span className="text-slate-400">320 × 240</span>
                </div>
                <div className="relative h-[240px] overflow-hidden rounded-[28px] border border-slate-700/70 bg-slate-900" style={bottomScreenStyle}>
                  {!lowerImage && <div className="flex h-full items-center justify-center text-slate-500">Arrastra / carga bg_lower.png</div>}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>Área de pantalla táctil</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between rounded-[28px] border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                <span className="font-medium text-white">Modelo 3DS</span>

              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-300">
              Los fondos se ajustan automáticamente a la resolución de la 3DS y se muestran en tiempo real.
            </div>
            <button
              type="button"
              onClick={exportTheme}
              disabled={exporting || !themeName.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-vibrant px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(47,47,228,0.35)] transition hover:bg-[#2727f4] disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              <DownloadCloud className="h-5 w-5" />
              {exporting ? 'Generando...' : 'Exportar tema'}
            </button>
          </div>
        </section>

        <section className="space-y-5 rounded-[32px] border border-slate-700/70 bg-navy/90 p-5">
          <SectionHeader title="Activos visuales" description="Carga los recursos del tema y valida sus resoluciones automáticamente." />

          <InputRow label="Fondo pantalla superior (bg_upper.png)">
            <label className="group relative block cursor-pointer rounded-3xl border border-slate-700/80 bg-[#11193c] px-4 py-5 text-center text-sm text-slate-300 transition hover:border-vibrant/80">
              <input type="file" accept="image/png" className="hidden" onChange={(event) => handleImageUpload(event, 'upper')} />
              <div className="flex flex-col items-center justify-center gap-2">
                <ImagePlus className="h-6 w-6 text-vibrant" />
                <span className="font-medium text-white">Seleccionar bg_upper.png</span>
                <span className="text-xs text-slate-400">400 × 240 px</span>
              </div>
            </label>
            <p className="text-sm text-slate-400">{upperImage ? upperImage.file.name : 'No hay imagen cargada'}</p>
          </InputRow>

          <InputRow label="Fondo pantalla inferior (bg_lower.png)">
            <label className="group relative block cursor-pointer rounded-3xl border border-slate-700/80 bg-[#11193c] px-4 py-5 text-center text-sm text-slate-300 transition hover:border-vibrant/80">
              <input type="file" accept="image/png" className="hidden" onChange={(event) => handleImageUpload(event, 'lower')} />
              <div className="flex flex-col items-center justify-center gap-2">
                <ImagePlus className="h-6 w-6 text-vibrant" />
                <span className="font-medium text-white">Seleccionar bg_lower.png</span>
                <span className="text-xs text-slate-400">320 × 240 px</span>
              </div>
            </label>
            <p className="text-sm text-slate-400">{lowerImage ? lowerImage.file.name : 'No hay imagen cargada'}</p>
          </InputRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <InputRow label="Icono de carpeta">
              <label className="group relative block cursor-pointer rounded-3xl border border-slate-700/80 bg-[#11193c] px-4 py-5 text-center text-sm text-slate-300 transition hover:border-vibrant/80">
                <input type="file" accept="image/png" className="hidden" onChange={(event) => handleAssetUpload(event, 'folder')} />
                <div className="flex flex-col items-center justify-center gap-2">
                  <Folder className="h-6 w-6 text-vibrant" />
                  <span className="font-medium text-white">Seleccionar icono</span>
                </div>
              </label>
              <p className="text-sm text-slate-400">{folderIcon ? folderIcon.file.name : 'No hay icono cargado'}</p>
            </InputRow>

            <InputRow label="Icono de archivo">
              <label className="group relative block cursor-pointer rounded-3xl border border-slate-700/80 bg-[#11193c] px-4 py-5 text-center text-sm text-slate-300 transition hover:border-vibrant/80">
                <input type="file" accept="image/png" className="hidden" onChange={(event) => handleAssetUpload(event, 'file')} />
                <div className="flex flex-col items-center justify-center gap-2">
                  <File className="h-6 w-6 text-vibrant" />
                  <span className="font-medium text-white">Seleccionar icono</span>
                </div>
              </label>
              <p className="text-sm text-slate-400">{fileIcon ? fileIcon.file.name : 'No hay icono cargado'}</p>
            </InputRow>
          </div>

          <InputRow label="Archivos cargados">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-700/80 bg-slate-950/70 px-4 py-3">
                <span className="font-medium">BGM</span>
                <span className="text-slate-400">{formatFileName(bgmFile)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-700/80 bg-slate-950/70 px-4 py-3">
                <span className="font-medium">Fondo superior</span>
                <span className="text-slate-400">{upperImage ? upperImage.file.name : 'Sin cargar'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-700/80 bg-slate-950/70 px-4 py-3">
                <span className="font-medium">Fondo inferior</span>
                <span className="text-slate-400">{lowerImage ? lowerImage.file.name : 'Sin cargar'}</span>
              </div>
            </div>
          </InputRow>
        </section>
      </main>

      {pendingResize ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[32px] border border-slate-700/90 bg-[#11193c] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Ajuste de imagen</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Dimensiones no coinciden</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  La imagen seleccionada tiene <strong>{pendingResize.imageWidth}×{pendingResize.imageHeight}</strong>, pero se requiere <strong>{pendingResize.expectedWidth}×{pendingResize.expectedHeight}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={cancelPendingResize}
                className="rounded-full border border-slate-700/80 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-vibrant/80 hover:text-white"
              >
                Cancelar
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => handleImageResizeChoice('stretch')}
                className="rounded-[28px] border border-vibrant/70 bg-vibrant/10 px-5 py-6 text-left text-white transition hover:bg-vibrant/20"
              >
                <p className="text-xl font-semibold text-white">Estirar imagen</p>
                <p className="mt-2 text-sm text-slate-300">
                  Se ajusta la imagen completa al tamaño requerido. Ideal si no te importa deformar ligeramente la composición.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleImageResizeChoice('crop')}
                className="rounded-[28px] border border-slate-700/80 bg-slate-950/80 px-5 py-6 text-left text-white transition hover:border-vibrant/80"
              >
                <p className="text-xl font-semibold text-white">Recortar imagen</p>
                <p className="mt-2 text-sm text-slate-300">
                  Se mantiene la proporción y se recorta el exceso. Recomendada para preservar la calidad visual del tema.
                </p>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function UserIcon() {
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-vibrant">A</span>
}
