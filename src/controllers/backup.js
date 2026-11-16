import fs from 'fs';
import BackupService from '../bll/services/BackupService.js';

const errorCode = (error) => (error.message === 'User not found' ? 404 : 400);

// Кириллица в имени файла — через filename* (RFC 5987), ASCII-запасной вариант
const contentDisposition = (filename, fallback) =>
    `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;

export default class BackupController {
    static async status(request, reply) {
        try {
            return await BackupService.status(request.user, request.query.userId);
        } catch (error) {
            reply.code(errorCode(error)).send({ error: error.message });
        }
    }

    static async data(request, reply) {
        try {
            const { buffer, filename } = await BackupService.getDataBackup(request.user, request.query.userId);
            reply
                .header('Content-Type', 'application/zip')
                .header('Content-Disposition', contentDisposition(filename, 'artcrm-data.zip'))
                .send(buffer);
        } catch (error) {
            request.log.error(error);
            reply.code(errorCode(error)).send({ error: error.message });
        }
    }

    static async startFiles(request, reply) {
        try {
            return await BackupService.startFilesBackup(request.user, request.body?.userId || request.query.userId);
        } catch (error) {
            reply.code(errorCode(error)).send({ error: error.message });
        }
    }

    // Без авторизации: доступ — по случайному токену в ссылке (см. BackupService.findDownload)
    static async download(request, reply) {
        const found = BackupService.findDownload(request.params.token);
        if (!found) {
            reply.code(404).type('text/plain; charset=utf-8').send('Ссылка на бекап устарела или неверна. Сделайте бекап заново в разделе «Бекап».');
            return;
        }
        reply
            .header('Content-Type', 'application/zip')
            .header('Content-Length', found.size)
            .header('Content-Disposition', contentDisposition(found.downloadName, 'artcrm-files.zip'))
            .header('Cache-Control', 'no-store');
        return reply.send(fs.createReadStream(found.path));
    }
}
