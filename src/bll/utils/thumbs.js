// Превью картинок для списков и таблиц.
//
// Оригиналы весят в среднем ~0.6 МБ (до 5 МБ), а в таблицах показываются
// размером 40–60px — без превью страница «Мои работы» тянет сотни мегабайт,
// и запросы к API ждут в очереди браузера за картинками.
//
// Превью лежит рядом с оригиналами: files/thumbs/<id>.webp (nginx отдаёт его
// той же location /files/). Создаётся при загрузке/копировании файла; для
// старых файлов — скрипт install/make-thumbs.mjs.
//
// sharp подключается лениво: если пакет не установлен, бэкенд работает как
// раньше, просто без превью (фронтенд в этом случае показывает оригинал).
import fs from 'fs'
import path from 'path'
import { getFileBaseUrl } from './const.js'

export const FILES_DIR = './files'
export const THUMB_DIR = path.join(FILES_DIR, 'thumbs')
export const THUMB_SIZE = 480

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tif', 'tiff'])

export const isThumbable = (ext) => IMAGE_EXTS.has(String(ext || '').toLowerCase())

/** URL превью или null, если файл не картинка */
export const thumbUrl = (id, ext) => (id && isThumbable(ext) ? `${getFileBaseUrl()}/thumbs/${id}.webp` : null)

export const thumbPath = (id) => path.join(THUMB_DIR, `${id}.webp`)

let sharpPromise = null
function loadSharp() {
  if (!sharpPromise) {
    sharpPromise = import('sharp')
      .then((m) => {
        const sharp = m.default
        sharp.concurrency(1) // не отнимаем все ядра у API
        sharp.cache(false)
        return sharp
      })
      .catch((err) => {
        console.warn('[thumbs] sharp не установлен — превью не создаются:', err.message)
        return null
      })
  }
  return sharpPromise
}

/**
 * Создать превью для файла. Ошибки не пробрасываются: превью — оптимизация,
 * из-за неё загрузка файла падать не должна.
 * @return {Promise<boolean>} создано ли превью
 */
export async function makeThumb(id, ext, { force = false } = {}) {
  if (!isThumbable(ext)) return false
  const sharp = await loadSharp()
  if (!sharp) return false
  const target = thumbPath(id)
  try {
    if (!force && fs.existsSync(target)) return true
    await fs.promises.mkdir(THUMB_DIR, { recursive: true })
    const tmp = `${target}.${process.pid}.tmp`
    await sharp(path.join(FILES_DIR, `${id}.${ext}`), { failOn: 'none', limitInputPixels: 100_000_000 })
      .rotate() // учитываем EXIF-ориентацию фото с телефона
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(tmp)
    await fs.promises.rename(tmp, target)
    return true
  } catch (err) {
    console.warn(`[thumbs] не удалось создать превью ${id}.${ext}:`, err.message)
    return false
  }
}

export function removeThumb(id) {
  fs.unlink(thumbPath(id), () => {})
}
