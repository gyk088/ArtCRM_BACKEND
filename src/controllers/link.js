import LinkService from '../bll/services/LinkService.js';

export default class LinkController {
    // ============= LINK CRUD CONTROLLERS =============
    
    static async createLink(request, reply) {
        try {
            const link = await LinkService.createLink(request.body);
            return link;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async createLinkWithValidation(request, reply) {
        try {
            const link = await LinkService.createLinkWithValidation(request.body);
            return link;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getLinkById(request, reply) {
        try {
            const { id } = request.params;
            const link = await LinkService.getLinkById(id);
            return link;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getAllLinks(request, reply) {
        try {
            const links = await LinkService.getAllLinks();
            return links;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getLinksByUserId(request, reply) {
        try {
            const { userId } = request.params;
            const links = await LinkService.getLinksByUserId(userId);
            return links;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async updateLink(request, reply) {
        try {
            const link = await LinkService.updateLink(request.body);
            return link;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async deleteLink(request, reply) {
        try {
            const { id } = request.params;
            const result = await LinkService.deleteLink(id);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= LINK SEARCH CONTROLLERS =============
    
    static async searchLinks(request, reply) {
        try {
            const { searchTerm } = request.query;
            if (!searchTerm) {
                reply.code(400).send({ error: 'Search term is required' });
                return;
            }
            const results = await LinkService.searchLinks(searchTerm);
            return results;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getLinkByUrl(request, reply) {
        try {
            const { url } = request.params;
            const link = await LinkService.getLinkByUrl(url);
            if (!link) {
                reply.code(404).send({ error: 'Link not found' });
                return;
            }
            return link;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getUserLinksWithStats(request, reply) {
        try {
            const { userId } = request.params;
            const links = await LinkService.getUserLinksWithStats(userId);
            return links;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= ART OBJECT LINK RELATIONS CONTROLLERS =============
    
    static async addLinkToArtObject(request, reply) {
        try {
            const { artId, linkId } = request.params;
            const relation = await LinkService.addLinkToArtObject(artId, linkId);
            return relation;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async removeLinkFromArtObject(request, reply) {
        try {
            const { artId, linkId } = request.params;
            const result = await LinkService.removeLinkFromArtObject(artId, linkId);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getLinksByArtObjectId(request, reply) {
        try {
            const { artId } = request.params;
            const links = await LinkService.getLinksByArtObjectId(artId);
            return links;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getArtObjectsByLinkId(request, reply) {
        try {
            const { linkId } = request.params;
            const artObjects = await LinkService.getArtObjectsByLinkId(linkId);
            return artObjects;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async bulkAddLinksToArtObject(request, reply) {
        try {
            const { artId } = request.params;
            const { linkIds } = request.body;
            
            if (!linkIds || !Array.isArray(linkIds)) {
                reply.code(400).send({ error: 'linkIds array is required' });
                return;
            }
            
            const relations = await LinkService.bulkAddLinksToArtObject(artId, linkIds);
            return { added: relations.length, relations };
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async removeAllLinksFromArtObject(request, reply) {
        try {
            const { artId } = request.params;
            const result = await LinkService.removeAllLinksFromArtObject(artId);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    // ============= ADVANCED CONTROLLERS =============
    
    static async getCompleteLinkInfo(request, reply) {
        try {
            const { id } = request.params;
            const completeInfo = await LinkService.getCompleteLinkInfo(id);
            return completeInfo;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getCompleteArtObjectWithLinks(request, reply) {
        try {
            const { artId } = request.params;
            const artObject = await LinkService.getCompleteArtObjectWithLinks(artId);
            return artObject;
        } catch (error) {
            reply.code(404).send({ error: error.message });
        }
    }

    static async getLinksStatistics(request, reply) {
        try {
            const { userId } = request.query;
            const statistics = await LinkService.getLinksStatistics(userId);
            return statistics;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getMostUsedLinks(request, reply) {
        try {
            const limit = request.query.limit ? parseInt(request.query.limit) : 10;
            const links = await LinkService.getMostUsedLinks(limit);
            return links;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async getUnusedLinks(request, reply) {
        try {
            const links = await LinkService.getUnusedLinks();
            return links;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async copyLinksFromArtToArt(request, reply) {
        try {
            const { sourceArtId, targetArtId } = request.params;
            const result = await LinkService.copyLinksFromArtToArt(sourceArtId, targetArtId);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async moveLinksFromArtToArt(request, reply) {
        try {
            const { sourceArtId, targetArtId } = request.params;
            const result = await LinkService.moveLinksFromArtToArt(sourceArtId, targetArtId);
            return result;
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }

    static async validateLinkUrl(request, reply) {
        try {
            const { url } = request.body;
            if (!url) {
                reply.code(400).send({ error: 'URL is required' });
                return;
            }
            const isValid = await LinkService.validateLinkUrl(url);
            return { url, isValid };
        } catch (error) {
            reply.code(400).send({ error: error.message });
        }
    }
}