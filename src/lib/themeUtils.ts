import JSZip from 'jszip'
import { UploadAsset } from '../store/themeStore'

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Error leyendo archivo'))
    reader.readAsDataURL(file)
  })
}

export async function loadImage(source: string | Blob): Promise<HTMLImageElement> {
  const img = new Image()
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = typeof source === 'string' ? source : URL.createObjectURL(source)
  })
}

export type ImageResizeMode = 'stretch' | 'crop'

export async function resizeImageFile(file: File, width: number, height: number): Promise<UploadAsset> {
  return normalizeImageFile(file, width, height, 'stretch')
}

export async function normalizeImageFile(
  file: File,
  width: number,
  height: number,
  mode: ImageResizeMode,
): Promise<UploadAsset> {
  const dataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(dataUrl)

  if (image.width === width && image.height === height) {
    return { file, previewUrl: dataUrl }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el canvas')

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#080616'
  ctx.fillRect(0, 0, width, height)

  if (mode === 'stretch') {
    ctx.drawImage(image, 0, 0, width, height)
  } else {
    const scale = Math.max(width / image.width, height / image.height)
    const sourceWidth = width / scale
    const sourceHeight = height / scale
    const sourceX = Math.max(0, (image.width - sourceWidth) / 2)
    const sourceY = Math.max(0, (image.height - sourceHeight) / 2)
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height)
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('No se pudo generar la imagen redimensionada')

  return new Promise((resolve) => {
    const normalizedFile = new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.png`, {
      type: 'image/png',
    })
    resolve({ file: normalizedFile, previewUrl: URL.createObjectURL(blob) })
  })
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

function writeUtf16Le(view: DataView, offset: number, value: string, maxBytes: number) {
  const bytes = Math.min(value.length * 2, maxBytes - 2)
  for (let i = 0; i < bytes / 2; i += 1) {
    view.setUint16(offset + i * 2, value.charCodeAt(i), true)
  }
  if (bytes < maxBytes) {
    view.setUint16(offset + bytes, 0, true)
  }
}

export function createInfoSmdh(themeName: string, author: string, description: string): Blob {
  const size = 0x36c0
  const buffer = new ArrayBuffer(size)
  const view = new DataView(buffer)

  writeAscii(view, 0x00, 'SMDH')
  view.setUint16(0x04, 1, true)
  view.setUint16(0x06, 0, true)

  const shortDescription = themeName.slice(0, 63)
  const longDescription = description.slice(0, 255)
  const publisher = author.slice(0, 63)

  for (let entry = 0; entry < 16; entry += 1) {
    const base = 0x08 + entry * 0x200
    writeUtf16Le(view, base + 0x00, shortDescription, 0x80)
    writeUtf16Le(view, base + 0x80, longDescription, 0x100)
    writeUtf16Le(view, base + 0x180, publisher, 0x80)
  }

  view.setUint32(0x2018, 0x7fffffff, true)
  view.setUint32(0x2028, 0x0001, true)
  view.setUint8(0x202c, 1)
  view.setUint8(0x202d, 0)

  return new Blob([buffer], { type: 'application/octet-stream' })
}

export async function createViewportPreview(theme: {
  themeName: string
  author: string
  upperImage: UploadAsset | null
  lowerImage: UploadAsset | null
}): Promise<Blob> {
  const width = 420
  const height = 540
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')

  const context = ctx
  context.fillStyle = '#080616'
  context.fillRect(0, 0, width, height)

  context.strokeStyle = '#2F2FE4'
  context.lineWidth = 3
  context.fillStyle = '#0A0A1E'

  const top = { x: 10, y: 10, w: 400, h: 240 }
  const bottom = { x: 50, y: 280, w: 320, h: 240 }

  context.fillRect(top.x, top.y, top.w, top.h)
  context.strokeRect(top.x, top.y, top.w, top.h)
  context.fillRect(bottom.x, bottom.y, bottom.w, bottom.h)
  context.strokeRect(bottom.x, bottom.y, bottom.w, bottom.h)

  async function drawAsset(asset: UploadAsset | null, rect: { x: number; y: number; w: number; h: number }) {
    if (asset) {
      const image = await loadImage(asset.previewUrl)
      context.drawImage(image, rect.x, rect.y, rect.w, rect.h)
      context.strokeStyle = 'rgba(255,255,255,0.15)'
      context.lineWidth = 1
      context.strokeRect(rect.x, rect.y, rect.w, rect.h)
    } else {
      context.fillStyle = '#101335'
      context.fillRect(rect.x + 12, rect.y + 12, rect.w - 24, rect.h - 24)
      context.fillStyle = '#5D6CF5'
      context.font = '16px Inter'
      context.fillText('Cargar imagen aquí', rect.x + 20, rect.y + rect.h / 2)
    }
  }

  await drawAsset(theme.upperImage, top)
  await drawAsset(theme.lowerImage, bottom)

  ctx.fillStyle = '#D1D7FF'
  ctx.font = '700 18px Inter'
  ctx.fillText(theme.themeName || 'Tema 3DS', 18, 485)
  ctx.font = '500 14px Inter'
  ctx.fillText(`Autor: ${theme.author || 'Desconocido'}`, 18, 510)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error('No se pudo generar preview')
      resolve(blob)
    }, 'image/png')
  })
}

export function createPlaceholderBin(): Blob {
  return new Blob([new TextEncoder().encode('3DS THEME PLACEHOLDER BIN')], {
    type: 'application/octet-stream',
  })
}

export function sanitizeFolderName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9-_ ]+/g, '_') || '3ds-theme'
}

export async function buildThemeZip(theme: {
  themeName: string
  author: string
  description: string
  bgmFile: File | null
  upperImage: UploadAsset | null
  lowerImage: UploadAsset | null
}): Promise<Blob> {
  const zip = new JSZip()
  const folderName = sanitizeFolderName(theme.themeName)
  const folder = zip.folder(folderName)!

  const upperFile = theme.upperImage?.file
  const lowerFile = theme.lowerImage?.file
  const previewBlob = await createViewportPreview(theme)
  const smdhBlob = createInfoSmdh(theme.themeName, theme.author, theme.description)

  if (theme.bgmFile) {
    folder.file('bgm.bcstm', theme.bgmFile)
  }

  folder.file('body_LZ.bin', createPlaceholderBin())

  if (upperFile) {
    folder.file('bg_upper.png', upperFile)
  } else {
    folder.file('bg_upper.png', await createPlaceholderPng(400, 240, '#0A0A1E'))
  }

  if (lowerFile) {
    folder.file('bg_lower.png', lowerFile)
  } else {
    folder.file('bg_lower.png', await createPlaceholderPng(320, 240, '#0A0A1E'))
  }

  folder.file('preview.png', previewBlob)
  folder.file('info.smdh', smdhBlob)

  return zip.generateAsync({ type: 'blob' })
}

export async function createPlaceholderPng(width: number, height: number, fillColor: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.fillStyle = fillColor
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#2F2FE4'
  ctx.lineWidth = 3
  ctx.strokeRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.font = '20px Inter'
  ctx.fillText('PLACEHOLDER', 20, height / 2)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error('No se pudo generar placeholder')
      resolve(blob)
    }, 'image/png')
  })
}
