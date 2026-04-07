import LinkModel from '../models/LinkModel.js';
import ArtLinkModel from '../models/ArtLinkModel.js';
import MyArtObject from '../models/MyArtObject.js';

export default class LinkService {
    // ============= LINK CRUD METHODS =============
    
    static async createLink(linkData) {
        const link = new LinkModel({
            ...linkData,
            ctime: new Date()
        });
        
        await link.save();
        return link;
    }
    
    static async getLinkById(id) {
        const link = await LinkModel.getById(id);
        if (!link) {
            throw new Error('Link not found');
        }
        return link;
    }
    
    static async getAllLinks() {
        const links = await LinkModel.select();
        return links;
    }
    
    static async getLinksByUserId(userId) {
        const links = await LinkModel.getByUserId(userId);
        return links;
    }
    
    static async updateLink(linkData) {
        const link = await LinkModel.getById(linkData.id);
        if (!link) {
            throw new Error('Link not found');
        }
        
        link.f.link = linkData.link !== undefined ? linkData.link : link.f.link;
        link.f.description = linkData.description !== undefined ? linkData.description : link.f.description;
        link.f.user_id = linkData.user_id !== undefined ? linkData.user_id : link.f.user_id;
        
        await link.save();
        return link;
    }
    
    static async deleteLink(id) {
        const link = await LinkModel.getById(id);
        if (!link) {
            throw new Error('Link not found');
        }
        
        // Сначала удаляем все связи этого линка с объектами искусства
        await ArtLinkModel.removeAllArtsFromLink(id);
        
        // Затем удаляем сам линк
        await link.delete();
        return { success: true, message: 'Link deleted successfully' };
    }
    
    // ============= LINK SEARCH METHODS =============
    
    static async searchLinks(searchTerm) {
        const links = await LinkModel.searchByDescription(searchTerm);
        return links;
    }
    
    static async getLinkByUrl(linkUrl) {
        const links = await LinkModel.getByLinkUrl(linkUrl);
        return links.length > 0 ? links[0] : null;
    }
    
    static async getUserLinksWithStats(userId) {
        const links = await LinkModel.getUserLinksWithArtObjects(userId);
        return links;
    }
    
    // ============= ART OBJECT LINK RELATIONS =============
    
    static async addLinkToArtObject(artId, linkId) {
        // Проверяем, существует ли объект искусства
        const artObject = await MyArtObject.getById(artId);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        // Проверяем, существует ли ссылка
        const link = await LinkModel.getById(linkId);
        if (!link) {
            throw new Error('Link not found');
        }
        
        // Добавляем связь
        const relation = await ArtLinkModel.addLinkToArt(artId, linkId);
        return relation;
    }
    
    static async removeLinkFromArtObject(artId, linkId) {
        const result = await ArtLinkModel.removeLinkFromArt(artId, linkId);
        return result;
    }
    
    static async getLinksByArtObjectId(artId) {
        // Проверяем, существует ли объект искусства
        const artObject = await MyArtObject.getById(artId);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        const links = await ArtLinkModel.getCompleteLinksForArt(artId);
        return links;
    }
    
    static async getArtObjectsByLinkId(linkId) {
        // Проверяем, существует ли ссылка
        const link = await LinkModel.getById(linkId);
        if (!link) {
            throw new Error('Link not found');
        }
        
        const artObjects = await ArtLinkModel.getCompleteArtsForLink(linkId);
        return artObjects;
    }
    
    static async bulkAddLinksToArtObject(artId, linkIds) {
        // Проверяем, существует ли объект искусства
        const artObject = await MyArtObject.getById(artId);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        const relations = await ArtLinkModel.bulkAddLinksToArt(artId, linkIds);
        return relations;
    }
    
    static async removeAllLinksFromArtObject(artId) {
        // Проверяем, существует ли объект искусства
        const artObject = await MyArtObject.getById(artId);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        const result = await ArtLinkModel.removeAllLinksFromArt(artId);
        return result;
    }
    
    // ============= ADVANCED METHODS =============
    
    static async getCompleteLinkInfo(linkId) {
        const link = await LinkModel.getById(linkId);
        if (!link) {
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
    
    static async getCompleteArtObjectWithLinks(artId) {
        const artObject = await MyArtObject.getWithLinks(artId);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        return artObject;
    }
    
    static async getLinksStatistics(userId = null) {
        let query = `
            SELECT 
                COUNT(*) as total_links,
                COUNT(DISTINCT user_id) as unique_users,
                AVG(LENGTH(link)) as avg_link_length,
                COUNT(CASE WHEN description IS NOT NULL THEN 1 END) as links_with_description,
                COUNT(CASE WHEN description IS NULL THEN 1 END) as links_without_description
            FROM my_link
        `;
        
        const values = [];
        
        if (userId) {
            query += ` WHERE user_id = $1`;
            values.push(userId);
        }
        
        const result = await LinkModel.query(query, values);
        return result[0];
    }
    
    static async getMostUsedLinks(limit = 10) {
        const query = `
            SELECT 
                l.*,
                COUNT(aol.art_id) as usage_count
            FROM my_link l
            INNER JOIN my_art_object_link aol ON l.id = aol.link_id
            GROUP BY l.id
            ORDER BY usage_count DESC
            LIMIT $1
        `;
        
        const links = await LinkModel.query(query, [limit], LinkModel);
        return links;
    }
    
    static async getUnusedLinks() {
        const query = `
            SELECT l.*
            FROM my_link l
            LEFT JOIN my_art_object_link aol ON l.id = aol.link_id
            WHERE aol.link_id IS NULL
        `;
        
        const links = await LinkModel.query(query, [], LinkModel);
        return links;
    }
    
    static async copyLinksFromArtToArt(sourceArtId, targetArtId) {
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
    
    static async moveLinksFromArtToArt(sourceArtId, targetArtId) {
        // Копируем ссылки
        const copyResult = await this.copyLinksFromArtToArt(sourceArtId, targetArtId);
        
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
    
    static async createLinkWithValidation(linkData) {
        // Валидируем URL перед созданием
        const isValid = await this.validateLinkUrl(linkData.link);
        if (!isValid) {
            throw new Error('Invalid URL format');
        }
        
        // Проверяем, не существует ли уже такой URL
        const existingLink = await this.getLinkByUrl(linkData.link);
        if (existingLink) {
            throw new Error('Link with this URL already exists');
        }
        
        return await this.createLink(linkData);
    }
}