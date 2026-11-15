// Разово создать превью (files/thumbs/<id>.webp) для уже загруженных картинок.
// Запуск из папки бэкенда:  node install/make-thumbs.mjs
// Повторный запуск безопасен — существующие превью пропускаются.
import fs from 'fs'
import { FILES_DIR, isThumbable, makeThumb, thumbPath } from '../src/bll/utils/thumbs.js'

const files = fs.readdirSync(FILES_DIR, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => {
    const dot = d.name.lastIndexOf('.')
    return { id: d.name.slice(0, dot), ext: d.name.slice(dot + 1) }
  })
  .filter((f) => f.id && isThumbable(f.ext) && !fs.existsSync(thumbPath(f.id)))

console.log(`Картинок без превью: ${files.length}`)
let done = 0
let failed = 0
const started = Date.now()
for (const f of files) {
  if (await makeThumb(f.id, f.ext)) done++
  else failed++
  if ((done + failed) % 50 === 0) console.log(`  ${done + failed}/${files.length}`)
}
console.log(`Готово: создано ${done}, не удалось ${failed}, ${Math.round((Date.now() - started) / 1000)} с`)
