import MyArtObject from '../models/ArtModel.js';
import MyMedia from '../models/MediaModel.js';
import MySeria from '../models/SeriaModel.js';
import MyStatus from '../models/StatusModel.js';
import MyLocation from '../models/LocationModel.js';
import MyArtObjectUser from '../models/ArtUserModel.js';
import { PgObject } from 'pgobject';

export default class ArtService {
    // ============= ART OBJECT METHODS =============
    
    static async createArtObject(artData) {
        const artObject = new MyArtObject({
            ...artData,
            ctime: new Date(),
            utime: new Date()
        });
        
        await artObject.save();
        return artObject;
    }
    
    static async getArtObjectById(id) {
        const artObject = await MyArtObject.getById(id);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        return artObject;
    }
    
    static async getArtObjectWithDetails(id) {
        const artObject = await MyArtObject.getWithDetails(id);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        return artObject;
    }
    
    static async getAllArtObjects() {
        const artObjects = await MyArtObject.select();
        return artObjects;
    }
    
    static async getArtObjectsByUserId(userId) {
        const artObjects = await MyArtObject.getByUserId(userId);
        return artObjects;
    }
    
    static async getArtObjectsByFilters(filters) {
        const artObjects = await MyArtObject.getByFilters(filters);
        return artObjects;
    }
    
    static async updateArtObject(artData) {
        const artObject = await MyArtObject.getById(artData.id);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        // Обновляем только переданные поля
        artObject.f.name = artData.name !== undefined ? artData.name : artObject.f.name;
        artObject.f.technique = artData.technique !== undefined ? artData.technique : artObject.f.technique;
        artObject.f.media = artData.media !== undefined ? artData.media : artObject.f.media;
        artObject.f.seria = artData.seria !== undefined ? artData.seria : artObject.f.seria;
        artObject.f.status = artData.status !== undefined ? artData.status : artObject.f.status;
        artObject.f.location = artData.location !== undefined ? artData.location : artObject.f.location;
        artObject.f.price = artData.price !== undefined ? artData.price : artObject.f.price;
        artObject.f.year = artData.year !== undefined ? artData.year : artObject.f.year;
        artObject.f.utime = new Date();
        
        await artObject.save();
        return artObject;
    }
    
    static async deleteArtObject(id) {
        const artObject = await MyArtObject.getById(id);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        // Сначала удаляем все связи с пользователями
        const users = await MyArtObjectUser.getUsersForArt(id);
        for (const userId of users) {
            await MyArtObjectUser.removeUserFromArt(id, userId);
        }
        
        // Затем удаляем сам объект
        await artObject.delete();
        return { success: true, message: 'Art object deleted successfully' };
    }
    
    // ============= MEDIA METHODS =============
    
    static async createMedia(mediaData) {
        const media = new MyMedia({
            ...mediaData
        });
        
        await media.save();
        return media;
    }
    
    static async getMediaById(id) {
        const media = await MyMedia.getById(id);
        if (!media) {
            throw new Error('Media not found');
        }
        return media;
    }
    
    static async getAllMedia() {
        const mediaList = await MyMedia.select();
        return mediaList;
    }
    
    static async getMediaByUserId(userId) {
        const mediaList = await MyMedia.getByUserId(userId);
        return mediaList;
    }
    
    static async updateMedia(mediaData) {
        const media = await MyMedia.getById(mediaData.id);
        if (!media) {
            throw new Error('Media not found');
        }
        
        media.f.name = mediaData.name !== undefined ? mediaData.name : media.f.name;
        media.f.user_id = mediaData.user_id !== undefined ? mediaData.user_id : media.f.user_id;
        
        await media.save();
        return media;
    }
    
    static async deleteMedia(id) {
        const media = await MyMedia.getById(id);
        if (!media) {
            throw new Error('Media not found');
        }
        
        // Проверяем, есть ли объекты искусства с этим media
        const artObjects = await MyArtObject.select('media = $1', [id]);
        if (artObjects.length > 0) {
            throw new Error(`Cannot delete media: it is used by ${artObjects.length} art object(s)`);
        }
        
        await media.delete();
        return { success: true, message: 'Media deleted successfully' };
    }
    
    // ============= SERIA METHODS =============
    
    static async createSeria(seriaData) {
        const seria = new MySeria({
            ...seriaData
        });
        
        await seria.save();
        return seria;
    }
    
    static async getSeriaById(id) {
        const seria = await MySeria.getById(id);
        if (!seria) {
            throw new Error('Seria not found');
        }
        return seria;
    }
    
    static async getAllSerias() {
        const seriaList = await MySeria.select();
        return seriaList;
    }
    
    static async getSeriaByUserId(userId) {
        const seriaList = await MySeria.getByUserId(userId);
        return seriaList;
    }
    
    static async updateSeria(seriaData) {
        const seria = await MySeria.getById(seriaData.id);
        if (!seria) {
            throw new Error('Seria not found');
        }
        
        seria.f.name = seriaData.name !== undefined ? seriaData.name : seria.f.name;
        seria.f.user_id = seriaData.user_id !== undefined ? seriaData.user_id : seria.f.user_id;
        
        await seria.save();
        return seria;
    }
    
    static async deleteSeria(id) {
        const seria = await MySeria.getById(id);
        if (!seria) {
            throw new Error('Seria not found');
        }
        
        // Проверяем, есть ли объекты искусства с этой серией
        const artObjects = await MyArtObject.select('seria = $1', [id]);
        if (artObjects.length > 0) {
            throw new Error(`Cannot delete seria: it is used by ${artObjects.length} art object(s)`);
        }
        
        await seria.delete();
        return { success: true, message: 'Seria deleted successfully' };
    }
    
    // ============= STATUS METHODS =============
    
    static async createStatus(statusData) {
        const status = new MyStatus({
            ...statusData
        });
        
        await status.save();
        return status;
    }
    
    static async getStatusById(id) {
        const status = await MyStatus.getById(id);
        if (!status) {
            throw new Error('Status not found');
        }
        return status;
    }
    
    static async getAllStatuses() {
        const statusList = await MyStatus.select();
        return statusList;
    }
    
    static async getStatusByUserId(userId) {
        const statusList = await MyStatus.getByUserId(userId);
        return statusList;
    }
    
    static async updateStatus(statusData) {
        const status = await MyStatus.getById(statusData.id);
        if (!status) {
            throw new Error('Status not found');
        }
        
        status.f.name = statusData.name !== undefined ? statusData.name : status.f.name;
        status.f.user_id = statusData.user_id !== undefined ? statusData.user_id : status.f.user_id;
        
        await status.save();
        return status;
    }
    
    static async deleteStatus(id) {
        const status = await MyStatus.getById(id);
        if (!status) {
            throw new Error('Status not found');
        }
        
        // Проверяем, есть ли объекты искусства с этим статусом
        const artObjects = await MyArtObject.select('status = $1', [id]);
        if (artObjects.length > 0) {
            throw new Error(`Cannot delete status: it is used by ${artObjects.length} art object(s)`);
        }
        
        await status.delete();
        return { success: true, message: 'Status deleted successfully' };
    }
    
    // ============= LOCATION METHODS =============
    
    static async createLocation(locationData) {
        const location = new MyLocation({
            ...locationData
        });
        
        await location.save();
        return location;
    }
    
    static async getLocationById(id) {
        const location = await MyLocation.getById(id);
        if (!location) {
            throw new Error('Location not found');
        }
        return location;
    }
    
    static async getAllLocations() {
        const locationList = await MyLocation.select();
        return locationList;
    }
    
    static async getLocationByUserId(userId) {
        const locationList = await MyLocation.getByUserId(userId);
        return locationList;
    }
    
    static async updateLocation(locationData) {
        const location = await MyLocation.getById(locationData.id);
        if (!location) {
            throw new Error('Location not found');
        }
        
        location.f.name = locationData.name !== undefined ? locationData.name : location.f.name;
        location.f.user_id = locationData.user_id !== undefined ? locationData.user_id : location.f.user_id;
        
        await location.save();
        return location;
    }
    
    static async deleteLocation(id) {
        const location = await MyLocation.getById(id);
        if (!location) {
            throw new Error('Location not found');
        }
        
        // Проверяем, есть ли объекты искусства с этой локацией
        const artObjects = await MyArtObject.select('location = $1', [id]);
        if (artObjects.length > 0) {
            throw new Error(`Cannot delete location: it is used by ${artObjects.length} art object(s)`);
        }
        
        await location.delete();
        return { success: true, message: 'Location deleted successfully' };
    }
    
    // ============= ART OBJECT USER RELATIONS METHODS =============
    
    static async addUserToArtObject(artId, userId) {
        // Проверяем, существует ли объект искусства
        const artObject = await MyArtObject.getById(artId);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        // Проверяем, не существует ли уже такая связь
        const existingRelations = await MyArtObjectUser.select('art_id = $1 AND user_id = $2', [artId, userId]);
        if (existingRelations.length > 0) {
            throw new Error('User already linked to this art object');
        }
        
        const relation = await MyArtObjectUser.addUserToArt(artId, userId);
        return relation;
    }
    
    static async removeUserFromArtObject(artId, userId) {
        const result = await MyArtObjectUser.removeUserFromArt(artId, userId);
        if (!result) {
            throw new Error('Relation not found');
        }
        return { success: true, message: 'User removed from art object successfully' };
    }
    
    static async getUsersByArtObjectId(artId) {
        const artObject = await MyArtObject.getById(artId);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        const userIds = await MyArtObjectUser.getUsersForArt(artId);
        return userIds;
    }
    
    static async getArtObjectsByUserIdForRelation(userId) {
        const artIds = await MyArtObjectUser.getArtsForUser(userId);
        const artObjects = [];
        
        for (const artId of artIds) {
            const artObject = await MyArtObject.getById(artId);
            if (artObject) {
                artObjects.push(artObject);
            }
        }
        
        return artObjects;
    }
    
    // ============= ADVANCED QUERIES =============
    
    static async getCompleteArtObjectInfo(artId) {
        // Получаем объект искусства со всеми связанными данными
        const artObject = await MyArtObject.getWithDetails(artId);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        // Получаем связанных пользователей
        const userIds = await MyArtObjectUser.getUsersForArt(artId);
        
        return {
            ...artObject.f,
            linked_users: userIds
        };
    }
    
    static async searchArtObjects(searchTerm) {
        const query = `
            SELECT * FROM my_art_object 
            WHERE name ILIKE $1 
               OR technique ILIKE $1
            ORDER BY name
        `;
        const artObjects = await PgObject.query(query, [`%${searchTerm}%`], MyArtObject);
        return artObjects;
    }
    
    static async getArtObjectsStatistics() {
        const query = `
            SELECT 
                COUNT(*) as total_objects,
                AVG(price) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price,
                MIN(year) as oldest_year,
                MAX(year) as newest_year,
                COUNT(DISTINCT media) as unique_media,
                COUNT(DISTINCT seria) as unique_seria,
                COUNT(DISTINCT status) as unique_status,
                COUNT(DISTINCT location) as unique_location
            FROM my_art_object
        `;
        const result = await PgObject.query(query);
        return result[0];
    }
    
    static async bulkCreateArtObjects(artObjectsData) {
        const createdObjects = [];
        
        // Используем транзакцию для массового создания
        await PgObject.createTransaction(async () => {
            for (const artData of artObjectsData) {
                const artObject = await this.createArtObject(artData);
                createdObjects.push(artObject);
            }
        });
        
        return createdObjects;
    }
    
    static async updateArtObjectPartial(id, updates) {
        const artObject = await MyArtObject.getById(id);
        if (!artObject) {
            throw new Error('Art object not found');
        }
        
        // Обновляем только те поля, которые переданы
        Object.keys(updates).forEach(key => {
            if (artObject.f.hasOwnProperty(key)) {
                artObject.f[key] = updates[key];
            }
        });
        
        artObject.f.utime = new Date();
        await artObject.save();
        
        return artObject;
    }
}