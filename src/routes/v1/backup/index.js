import BackupController from '../../../controllers/backup.js'
import auth from '../../../hooks/preHendler.js';

// Бекап данных пользователя (см. BackupService). ?userId= — чужой бекап,
// только для Super Admin.
export default async function backupRoutes(fastify) {
    fastify.get('/status', {preHandler: [auth()]}, BackupController.status)
    // «Данные» — ZIP (данные.xlsx + data.json) сразу в ответе
    fastify.get('/data', {preHandler: [auth()]}, BackupController.data)
    // «Файлы» — запуск фоновой сборки архива, по готовности — уведомление
    fastify.post('/files', {preHandler: [auth()]}, BackupController.startFiles)
    fastify.get('/download/:token', BackupController.download)
}
