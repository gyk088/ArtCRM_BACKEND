import ExhibitionService from '../bll/services/ExhibitionService.js';

export default class ExhibitionController {
    static async createExhibition(request, reply) {
        try {
            const exhibition = await ExhibitionService.createExhibition(request.body, request.user.f.id);
            return exhibition;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getAllExhibitions(request, reply) {
        try {
            const exhibitions = await ExhibitionService.getAllExhibitions(request.user.f.id);
            return exhibitions;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getExhibitionById(request, reply) {
        try {
            const { id } = request.params;
            const exhibition = await ExhibitionService.getExhibitionById(id, request.user.f.id);
            return exhibition;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async updateExhibition(request, reply) {
        try {
            const { id } = request.params;
            const exhibition = await ExhibitionService.updateExhibition(id, request.body, request.user.f.id);
            return exhibition;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteExhibition(request, reply) {
        try {
            const { id } = request.params;
            const result = await ExhibitionService.deleteExhibition(id, request.user.f.id);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getPublicExhibition(request, reply) {
        try {
            const { id } = request.params;
            const exhibition = await ExhibitionService.getPublicExhibition(id);
            return exhibition;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async addPhoto(request, reply) {
        try {
            const { id } = request.params;
            const photos = await ExhibitionService.addPhoto(id, request.body, request.user.f.id);
            return photos;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updatePhoto(request, reply) {
        try {
            const { id, photoId } = request.params;
            const photos = await ExhibitionService.updatePhoto(id, photoId, request.body, request.user.f.id);
            return photos;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deletePhoto(request, reply) {
        try {
            const { id, photoId } = request.params;
            const photos = await ExhibitionService.deletePhoto(id, photoId, request.user.f.id);
            return photos;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async reorderPhotos(request, reply) {
        try {
            const { id } = request.params;
            const photos = await ExhibitionService.reorderPhotos(id, request.body.ids || [], request.user.f.id);
            return photos;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }
}
