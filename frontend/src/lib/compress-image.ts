import { isImage, scaledSize } from './evidence'

const QUALITY = 0.8

// Reduces a photo (longest side 1600 px, JPEG) before it is uploaded. A file that is not an image, a photo the browser
// cannot decode, or a result that is not smaller than the original, comes back as it was. Browser only: it is never
// called at import time.
export async function compressImage(file: File): Promise<File> {
  if (!isImage(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = scaledSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }
    // JPEG has no transparency: a transparent PNG would turn black without a background.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    if (!blob || blob.size > file.size) return file
    return new File([blob], `${file.name.replace(/\.[^.]*$/, '')}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
