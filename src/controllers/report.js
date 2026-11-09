import ReportService from '../bll/services/ReportService.js';
import ReportExportService from '../bll/services/ReportExportService.js';

export default class ReportController {
    static async list(request, reply) {
        try {
            return await ReportService.list(request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async get(request, reply) {
        try {
            return await ReportService.get(request.params.id, request.user);
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async create(request, reply) {
        try {
            return await ReportService.create(request.body || {}, request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async update(request, reply) {
        try {
            return await ReportService.update(request.params.id, request.body || {}, request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async remove(request, reply) {
        try {
            return await ReportService.delete(request.params.id, request.user);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async data(request, reply) {
        try {
            return await ReportService.compute(request.params.id, request.user);
        } catch (error) {
            reply.code(error.message === 'Report not found' ? 404 : 400).send({ error: error.message });
        }
    }

    static async suggestedRates(request, reply) {
        try {
            return await ReportService.getSuggestedRates(request.query.currency, request.user, request.query.exclude || null);
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async exportXlsx(request, reply) {
        try {
            const { buffer, filename } = await ReportExportService.buildXlsx(request.params.id, request.user);
            // Кириллица в имени файла — через filename* (RFC 5987), ASCII-запасной вариант — report.xlsx
            reply
                .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                .header('Content-Disposition', `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`)
                .send(buffer);
        } catch (error) {
            reply.code(error.message === 'Report not found' ? 404 : 400).send({ error: error.message });
        }
    }
}
