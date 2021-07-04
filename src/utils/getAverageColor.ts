import { RGB } from '../types/RGB'

interface Options {
  blockSize: number;
  defaultRBG: RGB;
}

function isXYinCircle (x: number, y: number, cx: number, cy: number): boolean {
  const r = (cx + cy) / 4
  const dx = x - cx
  const dy = y - cy
  return (dx * dx + dy * dy <= r * r)
}

export default async (src: string, options = {
  blockSize: 1,
  defaultRBG: { r: 0, g: 0, b: 0 }
} as Options) => {
  const blockSize = options.blockSize // only visit every 5 pixels
  const defaultRGB = options.defaultRBG // for non-supporting envs
  const imgEl = document.createElement('img')
  imgEl.src = src
  const canvas = document.createElement('canvas')
  const context = canvas.getContext && canvas.getContext('2d')
  const rgb = { r: 0, g: 0, b: 0 } as RGB
  let i = -4
  let count = 0

  if (!context || !imgEl) {
    console.error('return defaultRGB', canvas, context, imgEl)
    return defaultRGB
  }

  return await new Promise((resolve, reject) => {
    imgEl.onerror = reject
    imgEl.onload = () => {
      const height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height
      const width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width

      context.drawImage(imgEl, 0, 0)

      const data = context.getImageData(0, 0, width, height)
      const length = data.data.length

      while ((i += blockSize * 4) < length) {
        const x = (i * blockSize) % width
        const y = (i * blockSize) / x
        if (!isXYinCircle(x, y, width / 2, height / 2)) {
          ++count
          rgb.r += data.data[i]
          rgb.g += data.data[i + 1]
          rgb.b += data.data[i + 2]
        }
      }

      // ~~ used to floor values
      rgb.r = ~~(rgb.r / count)
      rgb.g = ~~(rgb.g / count)
      rgb.b = ~~(rgb.b / count)

      resolve(rgb)
    }
  })
}
