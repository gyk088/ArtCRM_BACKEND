import MyArtObject from '../models/ArtModel.js';
import MyMedia from '../models/MediaModel.js';
import MySeria from '../models/SeriaModel.js';
import MyStatus from '../models/StatusModel.js';
import MyLocation from '../models/LocationModel.js';
import MyArtist from '../models/ArtistModel.js';
import LinkArtistModel from '../models/LinkArtistModel.js';
import MyArtObjectUser from '../models/ArtUserModel.js';
import ArtImageModel from '../models/ArtImageModel.js';
import { PgObject } from 'pgobject';

export default class ArtService {
    // ============= ART OBJECT METHODS =============

    // Доп. изображения приходят с фронта как массив файлов ({id, ...}) либо готовых id
    static __extractImageFileIds(images) {
        return images.map(img => (typeof img === 'string' ? img : img.id));
    }

    static async createArtObject(artData, userId) {
        const { images, ...artFields } = artData;
        const artObject = new MyArtObject({
            ...artFields,
            user_id: userId,
            ctime: new Date(),
            utime: new Date()
        });

        await artObject.save();

        if (Array.isArray(images)) {
            await ArtImageModel.setImagesForArt(artObject.f.id, this.__extractImageFileIds(images));
        }

        return artObject;
    }

    static async getArtObjectById(id, userId) {
        const artObject = await MyArtObject.getById(id);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }
        return artObject;
    }

    static async getArtObjectWithDetails(id, userId) {
        const artObject = await MyArtObject.getWithDetails(id);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }
        return artObject;
    }

    static async getArtObjectByIdWithAvatar(id, userId) {
        const artObject = await MyArtObject.getByIdWithAvatar(id);
        if (!artObject || artObject.user_id !== userId) {
            throw new Error('Art object not found');
        }
        artObject.images = await ArtImageModel.getResolvedImagesForArt(id);
        return artObject;
    }

    static async getAllArtObjects(userId) {
        const artObjects = await MyArtObject.getAllWithAvatar(userId);
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

    static async updateArtObject(artData, userId) {
        const artObject = await MyArtObject.getById(artData.id);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }

        // Обновляем только переданные поля
        artObject.f.name = artData.name !== undefined ? artData.name : artObject.f.name;
        artObject.f.technique = artData.technique !== undefined ? artData.technique : artObject.f.technique;
        artObject.f.media = artData.media !== undefined ? artData.media : artObject.f.media;
        artObject.f.seria = artData.seria !== undefined ? artData.seria : artObject.f.seria;
        artObject.f.status = artData.status !== undefined ? artData.status : artObject.f.status;
        artObject.f.location = artData.location !== undefined ? artData.location : artObject.f.location;
        artObject.f.artist = artData.artist !== undefined ? artData.artist : artObject.f.artist;
        artObject.f.size = artData.size !== undefined ? artData.size : artObject.f.size;
        artObject.f.avatar_id = artData.avatar_id !== undefined ? artData.avatar_id : artObject.f.avatar_id;
        artObject.f.price = artData.price !== undefined ? artData.price : artObject.f.price;
        artObject.f.currency = artData.currency !== undefined ? artData.currency : artObject.f.currency;
        artObject.f.year = artData.year !== undefined ? artData.year : artObject.f.year;
        artObject.f.utime = new Date();

        await artObject.save();

        if (Array.isArray(artData.images)) {
            await ArtImageModel.setImagesForArt(artObject.f.id, this.__extractImageFileIds(artData.images));
        }

        return artObject;
    }

    static async deleteArtObject(id, userId) {
        const artObject = await MyArtObject.getById(id);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }

        // Сначала удаляем все связи с пользователями
        const users = await MyArtObjectUser.getUsersForArt(id);
        for (const userId of users) {
            await MyArtObjectUser.removeUserFromArt(id, userId);
        }

        // Удаляем связи доп. изображений
        await ArtImageModel.removeAllImagesFromArt(id);

        // Затем удаляем сам объект
        await artObject.delete();
        return { success: true, message: 'Art object deleted successfully' };
    }
    
    // ============= MEDIA METHODS =============

    static async createMedia(mediaData, userId) {
        const media = new MyMedia({
            ...mediaData,
            user_id: userId
        });

        await media.save();
        return media;
    }

    static async getMediaById(id, userId) {
        const media = await MyMedia.getById(id);
        if (!media || media.f.user_id !== userId) {
            throw new Error('Media not found');
        }
        return media;
    }

    static async getAllMedia(userId) {
        const mediaList = await MyMedia.getByUserId(userId);
        return mediaList;
    }

    static async getMediaByUserId(userId) {
        const mediaList = await MyMedia.getByUserId(userId);
        return mediaList;
    }

    static async updateMedia(mediaData, userId) {
        const media = await MyMedia.getById(mediaData.id);
        if (!media || media.f.user_id !== userId) {
            throw new Error('Media not found');
        }

        media.f.name = mediaData.name !== undefined ? mediaData.name : media.f.name;

        await media.save();
        return media;
    }

    static async deleteMedia(id, userId) {
        const media = await MyMedia.getById(id);
        if (!media || media.f.user_id !== userId) {
            throw new Error('Media not found');
        }

        // Проверяем, есть ли объекты искусства с этим media
        const artObjects = await MyArtObject.select('WHERE media = $1', [id]);
        if (artObjects.length > 0) {
            throw new Error(`Cannot delete media: it is used by ${artObjects.length} art object(s)`);
        }

        await media.delete();
        return { success: true, message: 'Media deleted successfully' };
    }

    // ============= SERIA METHODS =============

    static async createSeria(seriaData, userId) {
        const seria = new MySeria({
            ...seriaData,
            user_id: userId
        });

        await seria.save();
        return seria;
    }

    static async getSeriaById(id, userId) {
        const seria = await MySeria.getById(id);
        if (!seria || seria.f.user_id !== userId) {
            throw new Error('Seria not found');
        }
        return seria;
    }

    static async getAllSerias(userId) {
        const seriaList = await MySeria.getByUserId(userId);
        return seriaList;
    }

    static async getSeriaByUserId(userId) {
        const seriaList = await MySeria.getByUserId(userId);
        return seriaList;
    }

    static async updateSeria(seriaData, userId) {
        const seria = await MySeria.getById(seriaData.id);
        if (!seria || seria.f.user_id !== userId) {
            throw new Error('Seria not found');
        }

        seria.f.name = seriaData.name !== undefined ? seriaData.name : seria.f.name;

        await seria.save();
        return seria;
    }

    static async deleteSeria(id, userId) {
        const seria = await MySeria.getById(id);
        if (!seria || seria.f.user_id !== userId) {
            throw new Error('Seria not found');
        }

        // Проверяем, есть ли объекты искусства с этой серией
        const artObjects = await MyArtObject.select('WHERE seria = $1', [id]);
        if (artObjects.length > 0) {
            throw new Error(`Cannot delete seria: it is used by ${artObjects.length} art object(s)`);
        }

        await seria.delete();
        return { success: true, message: 'Seria deleted successfully' };
    }

    // ============= ARTIST METHODS =============

    static async createArtist(artistData, userId) {
        const artist = new MyArtist({
            ...artistData,
            user_id: userId
        });

        await artist.save();
        return artist;
    }

    static async getArtistById(id, userId) {
        const artist = await MyArtist.getById(id);
        if (!artist || artist.f.user_id !== userId) {
            throw new Error('Artist not found');
        }
        return artist;
    }

    static async getAllArtists(userId) {
        const artistList = await MyArtist.getByUserId(userId);
        return artistList;
    }

    static async getArtistByUserId(userId) {
        const artistList = await MyArtist.getByUserId(userId);
        return artistList;
    }

    static async updateArtist(artistData, userId) {
        const artist = await MyArtist.getById(artistData.id);
        if (!artist || artist.f.user_id !== userId) {
            throw new Error('Artist not found');
        }

        artist.f.name = artistData.name !== undefined ? artistData.name : artist.f.name;

        await artist.save();
        return artist;
    }

    static async deleteArtist(id, userId) {
        const artist = await MyArtist.getById(id);
        if (!artist || artist.f.user_id !== userId) {
            throw new Error('Artist not found');
        }

        // Проверяем, есть ли объекты искусства с этим художником
        const artObjects = await MyArtObject.select('WHERE artist = $1', [id]);
        if (artObjects.length > 0) {
            throw new Error(`Cannot delete artist: it is used by ${artObjects.length} art object(s)`);
        }

        // Удаляем связи художника со ссылками
        await LinkArtistModel.removeAllLinksFromArtist(id);

        await artist.delete();
        return { success: true, message: 'Artist deleted successfully' };
    }

    // ============= STATUS METHODS =============

    static async createStatus(statusData, userId) {
        const status = new MyStatus({
            ...statusData,
            user_id: userId
        });

        await status.save();
        return status;
    }

    static async getStatusById(id, userId) {
        const status = await MyStatus.getById(id);
        if (!status || status.f.user_id !== userId) {
            throw new Error('Status not found');
        }
        return status;
    }

    static async getAllStatuses(userId) {
        const statusList = await MyStatus.getByUserId(userId);
        return statusList;
    }

    static async getStatusByUserId(userId) {
        const statusList = await MyStatus.getByUserId(userId);
        return statusList;
    }

    static async updateStatus(statusData, userId) {
        const status = await MyStatus.getById(statusData.id);
        if (!status || status.f.user_id !== userId) {
            throw new Error('Status not found');
        }

        status.f.name = statusData.name !== undefined ? statusData.name : status.f.name;
        status.f.color = statusData.color !== undefined ? statusData.color : status.f.color;

        await status.save();
        return status;
    }

    static async deleteStatus(id, userId) {
        const status = await MyStatus.getById(id);
        if (!status || status.f.user_id !== userId) {
            throw new Error('Status not found');
        }

        // Проверяем, есть ли объекты искусства с этим статусом
        const artObjects = await MyArtObject.select('WHERE status = $1', [id]);
        if (artObjects.length > 0) {
            throw new Error(`Cannot delete status: it is used by ${artObjects.length} art object(s)`);
        }

        await status.delete();
        return { success: true, message: 'Status deleted successfully' };
    }

    // ============= LOCATION METHODS =============

    static async createLocation(locationData, userId) {
        const location = new MyLocation({
            ...locationData,
            user_id: userId
        });

        await location.save();
        return location;
    }

    static async getLocationById(id, userId) {
        const location = await MyLocation.getById(id);
        if (!location || location.f.user_id !== userId) {
            throw new Error('Location not found');
        }
        return location;
    }

    static async getAllLocations(userId) {
        const locationList = await MyLocation.getByUserId(userId);
        return locationList;
    }

    static async getLocationByUserId(userId) {
        const locationList = await MyLocation.getByUserId(userId);
        return locationList;
    }

    static async updateLocation(locationData, userId) {
        const location = await MyLocation.getById(locationData.id);
        if (!location || location.f.user_id !== userId) {
            throw new Error('Location not found');
        }

        location.f.name = locationData.name !== undefined ? locationData.name : location.f.name;

        await location.save();
        return location;
    }

    static async deleteLocation(id, userId) {
        const location = await MyLocation.getById(id);
        if (!location || location.f.user_id !== userId) {
            throw new Error('Location not found');
        }

        // Проверяем, есть ли объекты искусства с этой локацией
        const artObjects = await MyArtObject.select('WHERE location = $1', [id]);
        if (artObjects.length > 0) {
            throw new Error(`Cannot delete location: it is used by ${artObjects.length} art object(s)`);
        }

        await location.delete();
        return { success: true, message: 'Location deleted successfully' };
    }
    
    // ============= ART OBJECT USER RELATIONS METHODS =============
    
    static async addUserToArtObject(artId, userId, requesterId) {
        // Проверяем, существует ли объект искусства и принадлежит ли он запрашивающему
        const artObject = await MyArtObject.getById(artId);
        if (!artObject || artObject.f.user_id !== requesterId) {
            throw new Error('Art object not found');
        }

        // Проверяем, не существует ли уже такая связь
        const existingRelations = await MyArtObjectUser.select('WHERE art_id = $1 AND user_id = $2', [artId, userId]);
        if (existingRelations.length > 0) {
            throw new Error('User already linked to this art object');
        }

        const relation = await MyArtObjectUser.addUserToArt(artId, userId);
        return relation;
    }

    static async removeUserFromArtObject(artId, userId, requesterId) {
        const artObject = await MyArtObject.getById(artId);
        if (!artObject || artObject.f.user_id !== requesterId) {
            throw new Error('Art object not found');
        }

        const result = await MyArtObjectUser.removeUserFromArt(artId, userId);
        if (!result) {
            throw new Error('Relation not found');
        }
        return { success: true, message: 'User removed from art object successfully' };
    }

    static async getUsersByArtObjectId(artId, requesterId) {
        const artObject = await MyArtObject.getById(artId);
        if (!artObject || artObject.f.user_id !== requesterId) {
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

    static async getCompleteArtObjectInfo(artId, userId) {
        // Получаем объект искусства со всеми связанными данными
        const artObject = await MyArtObject.getWithDetails(artId);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }

        // Получаем связанных пользователей
        const userIds = await MyArtObjectUser.getUsersForArt(artId);

        return {
            ...artObject.f,
            linked_users: userIds
        };
    }

    static async searchArtObjects(searchTerm, userId) {
        const query = `
            SELECT * FROM my_art_object
            WHERE user_id = $1
              AND (name ILIKE $2 OR technique ILIKE $2)
            ORDER BY name
        `;
        const artObjects = await PgObject.query(query, [userId, `%${searchTerm}%`], MyArtObject);
        return artObjects;
    }

    static async getArtObjectsStatistics(userId) {
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
            WHERE user_id = $1
        `;
        const result = await PgObject.query(query, [userId]);
        return result[0];
    }

    static async bulkCreateArtObjects(artObjectsData, userId) {
        const createdObjects = [];

        // Используем транзакцию для массового создания
        await PgObject.createTransaction(async () => {
            for (const artData of artObjectsData) {
                const artObject = await this.createArtObject(artData, userId);
                createdObjects.push(artObject);
            }
        });

        return createdObjects;
    }

    static async updateArtObjectPartial(id, updates, userId) {
        const artObject = await MyArtObject.getById(id);
        if (!artObject || artObject.f.user_id !== userId) {
            throw new Error('Art object not found');
        }

        // Обновляем только те поля, которые есть в схеме
        // (artObject.f — Proxy поверх схемы, hasOwnProperty через него не работает,
        // поэтому проверяем на самой схеме класса)
        Object.keys(updates).forEach(key => {
            if (key === 'id' || key === 'user_id') return;
            if (Object.prototype.hasOwnProperty.call(MyArtObject.schema, key)) {
                artObject.f[key] = updates[key];
            }
        });
        
        artObject.f.utime = new Date();
        await artObject.save();
        
        return artObject;
    }
}