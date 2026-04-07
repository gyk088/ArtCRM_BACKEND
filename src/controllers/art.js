import ArtService from '../bll/services/ArtService.js';

export default class ArtController {
    // ============= ART OBJECT CONTROLLERS =============
    
    static async createArtObject(request, reply) {
        try {
            const artObject = await ArtService.createArtObject(request.body);
            return artObject;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getArtObjectById(request, reply) {
        try {
            const { id } = request.params;
            const artObject = await ArtService.getArtObjectById(id);
            return artObject;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getArtObjectWithDetails(request, reply) {
        try {
            const { id } = request.params;
            const artObject = await ArtService.getArtObjectWithDetails(id);
            return artObject;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getAllArtObjects(request, reply) {
        try {
            const artObjects = await ArtService.getAllArtObjects();
            return artObjects;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getArtObjectsByUserId(request, reply) {
        try {
            const { userId } = request.params;
            const artObjects = await ArtService.getArtObjectsByUserId(userId);
            return artObjects;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getArtObjectsByFilters(request, reply) {
        try {
            const filters = request.query;
            const artObjects = await ArtService.getArtObjectsByFilters(filters);
            return artObjects;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateArtObject(request, reply) {
        try {
            const artObject = await ArtService.updateArtObject(request.body);
            return artObject;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateArtObjectPartial(request, reply) {
        try {
            const { id } = request.params;
            const updates = request.body;
            const artObject = await ArtService.updateArtObjectPartial(id, updates);
            return artObject;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteArtObject(request, reply) {
        try {
            const { id } = request.params;
            const result = await ArtService.deleteArtObject(id);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= MEDIA CONTROLLERS =============
    
    static async createMedia(request, reply) {
        try {
            const media = await ArtService.createMedia(request.body);
            return media;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getMediaById(request, reply) {
        try {
            const { id } = request.params;
            const media = await ArtService.getMediaById(id);
            return media;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getAllMedia(request, reply) {
        try {
            const mediaList = await ArtService.getAllMedia();
            return mediaList;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getMediaByUserId(request, reply) {
        try {
            const { userId } = request.params;
            const mediaList = await ArtService.getMediaByUserId(userId);
            return mediaList;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateMedia(request, reply) {
        try {
            const media = await ArtService.updateMedia(request.body);
            return media;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteMedia(request, reply) {
        try {
            const { id } = request.params;
            const result = await ArtService.deleteMedia(id);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= SERIA CONTROLLERS =============
    
    static async createSeria(request, reply) {
        try {
            const seria = await ArtService.createSeria(request.body);
            return seria;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getSeriaById(request, reply) {
        try {
            const { id } = request.params;
            const seria = await ArtService.getSeriaById(id);
            return seria;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getAllSerias(request, reply) {
        try {
            const seriaList = await ArtService.getAllSerias();
            return seriaList;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getSeriaByUserId(request, reply) {
        try {
            const { userId } = request.params;
            const seriaList = await ArtService.getSeriaByUserId(userId);
            return seriaList;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateSeria(request, reply) {
        try {
            const seria = await ArtService.updateSeria(request.body);
            return seria;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteSeria(request, reply) {
        try {
            const { id } = request.params;
            const result = await ArtService.deleteSeria(id);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= STATUS CONTROLLERS =============
    
    static async createStatus(request, reply) {
        try {
            const status = await ArtService.createStatus(request.body);
            console.log(status)
            return status;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getStatusById(request, reply) {
        try {
            const { id } = request.params;
            const status = await ArtService.getStatusById(id);
            return status;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getAllStatuses(request, reply) {
        try {
            const statusList = await ArtService.getAllStatuses();
            return statusList;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getStatusByUserId(request, reply) {
        try {
            const { userId } = request.params;
            const statusList = await ArtService.getStatusByUserId(userId);
            return statusList;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateStatus(request, reply) {
        try {
            const status = await ArtService.updateStatus(request.body);
            return status;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteStatus(request, reply) {
        try {
            const { id } = request.params;
            const result = await ArtService.deleteStatus(id);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= LOCATION CONTROLLERS =============
    
    static async createLocation(request, reply) {
        try {
            const location = await ArtService.createLocation(request.body);
            return location;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getLocationById(request, reply) {
        try {
            const { id } = request.params;
            const location = await ArtService.getLocationById(id);
            return location;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getAllLocations(request, reply) {
        try {
            const locationList = await ArtService.getAllLocations();
            return locationList;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getLocationByUserId(request, reply) {
        try {
            const { userId } = request.params;
            const locationList = await ArtService.getLocationByUserId(userId);
            return locationList;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateLocation(request, reply) {
        try {
            const location = await ArtService.updateLocation(request.body);
            return location;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteLocation(request, reply) {
        try {
            const { id } = request.params;
            const result = await ArtService.deleteLocation(id);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= ART OBJECT USER RELATIONS CONTROLLERS =============
    
    static async addUserToArtObject(request, reply) {
        try {
            const { artId, userId } = request.params;
            const relation = await ArtService.addUserToArtObject(artId, userId);
            return relation;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async removeUserFromArtObject(request, reply) {
        try {
            const { artId, userId } = request.params;
            const result = await ArtService.removeUserFromArtObject(artId, userId);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getUsersByArtObjectId(request, reply) {
        try {
            const { artId } = request.params;
            const users = await ArtService.getUsersByArtObjectId(artId);
            return { artId, users };
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getArtObjectsByUserIdForRelation(request, reply) {
        try {
            const { userId } = request.params;
            const artObjects = await ArtService.getArtObjectsByUserIdForRelation(userId);
            return artObjects;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= ADVANCED QUERIES CONTROLLERS =============
    
    static async getCompleteArtObjectInfo(request, reply) {
        try {
            const { id } = request.params;
            const completeInfo = await ArtService.getCompleteArtObjectInfo(id);
            return completeInfo;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async searchArtObjects(request, reply) {
        try {
            const { searchTerm } = request.query;
            if (!searchTerm) {
                reply.code(400).send({ error: 'Search term is required' });
                return;
            }
            const results = await ArtService.searchArtObjects(searchTerm);
            return results;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getArtObjectsStatistics(request, reply) {
        try {
            const statistics = await ArtService.getArtObjectsStatistics();
            return statistics;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async bulkCreateArtObjects(request, reply) {
        try {
            const { artObjects } = request.body;
            if (!artObjects || !Array.isArray(artObjects)) {
                reply.code(400).send({ error: 'artObjects array is required' });
                return;
            }
            const createdObjects = await ArtService.bulkCreateArtObjects(artObjects);
            return { created: createdObjects.length, objects: createdObjects };
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }
}