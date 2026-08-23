import LinkModel from '../models/LinkModel.js';
import ArtLinkModel from '../models/ArtLinkModel.js';
import LinkArtistModel from '../models/LinkArtistModel.js';
import MyArtObject from '../models/ArtModel.js';
import MyArtist from '../models/ArtistModel.js';

export default class LinkService {
    // ============= LINK CRUD METHODS =============
    
    static async createLink(linkData, userId) {
        const link = new LinkModel({
            ...linkData,
            user_id: userId,
            ctime: new Date()
        });

        await link.save();
        return link;
    }

    static async getLinkById(id, userId) {
        const link = await LinkModel.getById(id);
        if (!link || link.f.user_id !== userId) {
            throw new Error('Link not found');
        }
        return link;
    }

    static async getAllLinks(userId) {
        const links = await LinkModel.getByUserId(userId);
        return links;
    }

    static async getLinksByUserId(userId) {
        const links = await LinkModel.getByUserId(userId);
        return links;
    }

    static async updateLink(linkData, userId) {
        const link = await LinkModel.getById(linkData.id);
        if (!link || link.f.user_id !== userId) {
            throw new Error('Link not found');
        }

        link.f.link = linkData.link !== undefined ? linkData.link : link.f.link;
        link.f.description = linkData.description !== undefined ? linkData.description : link.f.description;

        await link.save();
        return link;
    }

    static async deleteLink(id, userId) {
        const link = await LinkModel.getById(id);
        if (!link || link.f.user_id !== userId) {
            throw new Error('Link not found');
        }

        // Сначала удаляем все связи этого линка с объектами искусства и художниками
        await ArtLinkModel.removeAllArtsFromLink(id);
        await LinkArtistModel.removeAllArtistsFromLink(id);

        // Затем удаляем сам линк
        await link.delete();
        return { success: true, message: 'Link deleted successfully' };
    }
    
    // ============= LINK SEARCH METHODS =============
    
    static async searchLinks(searchTerm, userId) {
        const links = await LinkModel.searchByDescription(searchTerm);
        return links.filter(link => link.f.user_id === userId);
    }

    static async getLinkByUrl(linkUrl, userId) {
        const links = await LinkModel.getByLinkUrl(linkUrl);
        const link = links.find(l => l.f.user_id === userId);
        return link || null;
    }

    static async getUserLinksWithStats(userId) {
        const links = await LinkModel.getUserLinksWithArtObjects(userId);
        return links;
    }
    
    // ============= ART OBJECT LINK RELATIONS =============
    
    static async addLinkToArtObject(artId, linkId, userId) {
        // Проверяем, существует ли объект искусства и принадлежит ли он пользователю
        const artObject = await MyArtObject.getById(artId);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }

        // Проверяем, существует ли ссылка и принадлежит ли она пользователю
        const link = await LinkModel.getById(linkId);
        if (!link || link.f.user_id !== userId) {
            throw new Error('Link not found');
        }

        // Добавляем связь
        const relation = await ArtLinkModel.addLinkToArt(artId, linkId);
        return relation;
    }

    static async removeLinkFromArtObject(artId, linkId, userId) {
        const artObject = await MyArtObject.getById(artId);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }

        const result = await ArtLinkModel.removeLinkFromArt(artId, linkId);
        return result;
    }

    static async getLinksByArtObjectId(artId, userId) {
        // Проверяем, существует ли объект искусства и принадлежит ли он пользователю
        const artObject = await MyArtObject.getById(artId);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }

        const links = await ArtLinkModel.getCompleteLinksForArt(artId);
        return links;
    }

    static async getArtObjectsByLinkId(linkId, userId) {
        // Проверяем, существует ли ссылка и принадлежит ли она пользователю
        const link = await LinkModel.getById(linkId);
        if (!link || link.f.user_id !== userId) {
            throw new Error('Link not found');
        }

        const artObjects = await ArtLinkModel.getCompleteArtsForLink(linkId);
        return artObjects;
    }

    static async bulkAddLinksToArtObject(artId, linkIds, userId) {
        // Проверяем, существует ли объект искусства и принадлежит ли он пользователю
        const artObject = await MyArtObject.getById(artId);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }

        const relations = await ArtLinkModel.bulkAddLinksToArt(artId, linkIds);
        return relations;
    }

    static async removeAllLinksFromArtObject(artId, userId) {
        // Проверяем, существует ли объект искусства и принадлежит ли он пользователю
        const artObject = await MyArtObject.getById(artId);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }

        const result = await ArtLinkModel.removeAllLinksFromArt(artId);
        return result;
    }

    // ============= LINK ARTIST RELATIONS =============

    static async addArtistToLink(linkId, artistId, userId) {
        const link = await LinkModel.getById(linkId);
        if (!link || link.f.user_id !== userId) {
            throw new Error('Link not found');
        }

        const artist = await MyArtist.getById(artistId);
        if (!artist || artist.f.user_id !== userId) {
            throw new Error('Artist not found');
        }

        const relation = await LinkArtistModel.addArtistToLink(linkId, artistId);
        return relation;
    }

    static async removeArtistFromLink(linkId, artistId, userId) {
        const link = await LinkModel.getById(linkId);
        if (!link || link.f.user_id !== userId) {
            throw new Error('Link not found');
        }

        const result = await LinkArtistModel.removeArtistFromLink(linkId, artistId);
        return result;
    }

    static async getArtistsByLinkId(linkId, userId) {
        const link = await LinkModel.getById(linkId);
        if (!link || link.f.user_id !== userId) {
            throw new Error('Link not found');
        }

        const artists = await LinkArtistModel.getCompleteArtistsForLink(linkId);
        return artists;
    }

    static async getLinksByArtistId(artistId, userId) {
        const artist = await MyArtist.getById(artistId);
        if (!artist || artist.f.user_id !== userId) {
            throw new Error('Artist not found');
        }

        const links = await LinkArtistModel.getCompleteLinksForArtist(artistId);
        return links;
    }

    // ============= ADVANCED METHODS =============

    static async getCompleteLinkInfo(linkId, userId) {
        const link = await LinkModel.getById(linkId);
        if (!link || link.f.user_id !== userId) {
            throw new Error('Link not found');
        }

        const artObjects = await ArtLinkModel.getCompleteArtsForLink(linkId);
        const artObjectsCount = await ArtLinkModel.getArtObjectsCountByLink(linkId);

        return {
            ...link.f,
            art_objects: artObjects,
            art_objects_count: artObjectsCount
        };
    }

    static async getCompleteArtObjectWithLinks(artId, userId) {
        const artObject = await MyArtObject.getWithLinks(artId);
        if (!artObject || artObject.user_id !== userId) {
            throw new Error('Art object not found');
        }
        
        return artObject;
    }
    
    static async getLinksStatistics(userId) {
        const query = `
            SELECT
                COUNT(*) as total_links,
                AVG(LENGTH(link)) as avg_link_length,
                COUNT(CASE WHEN description IS NOT NULL THEN 1 END) as links_with_description,
                COUNT(CASE WHEN description IS NULL THEN 1 END) as links_without_description
            FROM my_link
            WHERE user_id = $1
        `;

        const result = await LinkModel.query(query, [userId]);
        return result[0];
    }

    static async getMostUsedLinks(limit = 10, userId) {
        const query = `
            SELECT
                l.*,
                COUNT(aol.art_id) as usage_count
            FROM my_link l
            INNER JOIN my_art_object_link aol ON l.id = aol.link_id
            WHERE l.user_id = $2
            GROUP BY l.id
            ORDER BY usage_count DESC
            LIMIT $1
        `;

        const links = await LinkModel.query(query, [limit, userId], LinkModel);
        return links;
    }

    static async getUnusedLinks(userId) {
        const query = `
            SELECT l.*
            FROM my_link l
            LEFT JOIN my_art_object_link aol ON l.id = aol.link_id
            WHERE aol.link_id IS NULL AND l.user_id = $1
        `;

        const links = await LinkModel.query(query, [userId], LinkModel);
        return links;
    }

    static async copyLinksFromArtToArt(sourceArtId, targetArtId, userId) {
        // Проверяем, что оба объекта принадлежат пользователю
        const sourceArt = await MyArtObject.getById(sourceArtId);
        const targetArt = await MyArtObject.getById(targetArtId);
        if (!sourceArt || sourceArt.f.user_id !== userId || !targetArt || targetArt.f.user_id !== userId) {
            throw new Error('Art object not found');
        }

        // Получаем все ссылки исходного объекта
        const sourceLinks = await ArtLinkModel.getLinkIdsByArtId(sourceArtId);
        
        if (sourceLinks.length === 0) {
            return { success: true, copied: 0, message: 'No links to copy' };
        }
        
        // Копируем ссылки на целевой объект
        const copiedLinks = [];
        for (const linkId of sourceLinks) {
            try {
                await ArtLinkModel.addLinkToArt(targetArtId, linkId);
                copiedLinks.push(linkId);
            } catch (error) {
                console.log(`Link ${linkId} already exists on target art object`);
            }
        }
        
        return { 
            success: true, 
            copied: copiedLinks.length, 
            total: sourceLinks.length 
        };
    }
    
    static async moveLinksFromArtToArt(sourceArtId, targetArtId, userId) {
        // Копируем ссылки
        const copyResult = await this.copyLinksFromArtToArt(sourceArtId, targetArtId, userId);

        // Удаляем ссылки с исходного объекта
        await ArtLinkModel.removeAllLinksFromArt(sourceArtId);
        
        return {
            success: true,
            moved: copyResult.copied,
            message: `Moved ${copyResult.copied} links from source to target art object`
        };
    }
    
    static async validateLinkUrl(linkUrl) {
        // Простая валидация URL
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        return urlPattern.test(linkUrl);
    }
    
    static async createLinkWithValidation(linkData, userId) {
        // Валидируем URL перед созданием
        const isValid = await this.validateLinkUrl(linkData.link);
        if (!isValid) {
            throw new Error('Invalid URL format');
        }

        // Проверяем, не существует ли уже такой URL у этого пользователя
        const existingLink = await this.getLinkByUrl(linkData.link, userId);
        if (existingLink) {
            throw new Error('Link with this URL already exists');
        }

        return await this.createLink(linkData, userId);
    }
}