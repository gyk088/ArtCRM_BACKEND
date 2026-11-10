import MyArtObject from '../models/ArtModel.js';
import MyMedia from '../models/MediaModel.js';
import MySeria from '../models/SeriaModel.js';
import MyStatus from '../models/StatusModel.js';
import MyLocation from '../models/LocationModel.js';
import MyArtist from '../models/ArtistModel.js';
import LinkArtistModel from '../models/LinkArtistModel.js';
import MyArtObjectUser from '../models/ArtUserModel.js';
import ArtImageModel from '../models/ArtImageModel.js';
import ArtLinkModel from '../models/ArtLinkModel.js';
import CollectionWorkModel from '../models/CollectionWorkModel.js';
import ExhibitionWorkModel from '../models/ExhibitionWorkModel.js';
import ContactWorkModel from '../models/ContactWorkModel.js';
import UserModel from '../models/UserModel.js';
import SaleModel from '../models/SaleModel.js';
import AuthorizationService from './AuthorizationService.js';
import QuotaService from './QuotaService.js';
import { PgObject } from 'pgobject';
import { assertCanViewUserData, sharingScopeUserIds, toPerson } from '../utils/userAccess.js';

export default class ArtService {
    // ============= СПРАВОЧНИКИ: ОБЩИЙ ДОСТУП ВНУТРИ ГАЛЕРЕИ =============
    //
    // Справочники (медиа, серии, художники, статусы, локации) живут по тем
    // же правилам, что и работы: внутри галереи (сама Gallery + её Manager'ы,
    // см. AuthorizationService.gallerySharingScope) они общие. Иначе менеджер
    // видит работы галереи, но не видит названий их статусов/серий/... — у
    // работы стоит id записи из справочника галереи, которой нет в его списке.
    // Удалять запись может только её автор или сама галерея (как и работы).

    /**
     * id пользователей, чьи справочники видит userId: он сам, а у Gallery и
     * Manager — ещё галерея и все её менеджеры.
     */
    static async __refScopeUserIds(userId) {
        const actor = await UserModel.getUserById(userId);
        return actor ? sharingScopeUserIds(actor) : [userId];
    }

    /** Может ли userId смотреть/править (или удалить — forDelete) запись справочника */
    static async __canUseRef(entity, userId, { forDelete = false } = {}) {
        if (!entity) return false;
        const ownerId = entity.f.user_id;
        if (ownerId === userId) return true;

        const [actor, owner] = await Promise.all([
            UserModel.getUserById(userId),
            ownerId ? UserModel.getUserById(ownerId) : null,
        ]);
        if (!actor || !owner) return false;

        return forDelete
            ? AuthorizationService.canDeleteWorkOwner(toPerson(actor), toPerson(owner))
            : AuthorizationService.canAccessWorkOwner(toPerson(actor), toPerson(owner));
    }

    static async __getRefList(Model, userId) {
        const ids = await ArtService.__refScopeUserIds(userId);
        return Model.select('WHERE user_id = ANY($1::uuid[])', [ids]);
    }

    // ============= ART OBJECT METHODS =============

    // Доп. изображения приходят с фронта как массив файлов ({id, ...}) либо готовых id
    static __extractImageFileIds(images) {
        return images.map(img => (typeof img === 'string' ? img : img.id));
    }

    /**
     * Проверить, что actorUser имеет доступ к работе (свою — всегда; чужую —
     * только в рамках общей галереи, см. AuthorizationService). Бросает
     * ошибку "не найдено" вместо "нет доступа" — как и везде в проекте,
     * чтобы не подтверждать посторонним само существование записи.
     *
     * @param {object} actorUser - request.user
     * @param {object} artObject - PgObject (.f.user_id) либо resolved-объект (.user_id)
     * @param {object} [options]
     * @param {boolean} [options.forDelete] - более строгая проверка для удаления
     * @static
    */
    static async __assertCanAccessWork(actorUser, artObject, { forDelete = false } = {}) {
        if (!artObject) throw new Error('Art object not found');

        const ownerId = artObject.f ? artObject.f.user_id : artObject.user_id;
        const actor = toPerson(actorUser);
        if (ownerId === actor.id) return;

        const ownerUser = await UserModel.getUserById(ownerId);
        if (!ownerUser) throw new Error('Art object not found');

        const owner = toPerson(ownerUser);
        const allowed = forDelete
            ? AuthorizationService.canDeleteWorkOwner(actor, owner)
            : AuthorizationService.canAccessWorkOwner(actor, owner);

        if (!allowed) throw new Error('Art object not found');
    }

    static async createArtObject(artData, actorUser) {
        const { images, ...artFields } = artData;
        const artObject = new MyArtObject({
            ...artFields,
            user_id: actorUser.f.id,
            updated_by: actorUser.f.id,
            ctime: new Date(),
            utime: new Date()
        });

        await artObject.save();

        if (Array.isArray(images)) {
            await ArtImageModel.setImagesForArt(artObject.f.id, this.__extractImageFileIds(images));
        }

        return MyArtObject.getByIdWithAvatar(artObject.f.id);
    }

    static async getArtObjectById(id, actorUser) {
        const artObject = await MyArtObject.getById(id);
        await ArtService.__assertCanAccessWork(actorUser, artObject);
        return artObject;
    }

    static async getArtObjectWithDetails(id, actorUser) {
        const artObject = await MyArtObject.getWithDetails(id);
        await ArtService.__assertCanAccessWork(actorUser, artObject);
        return artObject;
    }

    static async getArtObjectByIdWithAvatar(id, actorUser) {
        const artObject = await MyArtObject.getByIdWithAvatar(id);
        await ArtService.__assertCanAccessWork(actorUser, artObject);
        artObject.images = await ArtImageModel.getResolvedImagesForArt(id);
        return artObject;
    }

    /**
     * Все работы, видимые пользователю: свои + (для Gallery и её
     * Manager'ов) все работы галереи — см. AuthorizationService.
     * gallerySharingScope и MyArtObject.getAllWithAvatar.
     */
    static async getAllArtObjects(actorUser) {
        const scope = AuthorizationService.gallerySharingScope(toPerson(actorUser));
        return MyArtObject.getAllWithAvatar(actorUser.f.id, scope);
    }

    /**
     * Работы конкретного пользователя (роут /art-objects/user/:userId).
     * Чужие — только если actor видит работы этого пользователя по правилам
     * галереи (см. assertCanViewUserData).
     */
    static async getArtObjectsByUserId(targetUserId, actorUser) {
        const userId = await assertCanViewUserData(actorUser, targetUserId);
        const artObjects = await MyArtObject.getByUserId(userId);
        return artObjects;
    }

    /**
     * Фильтрация работ (роут /art-objects/filters). Ищет среди тех же работ,
     * что видны в общем списке (свои + общие работы галереи).
     */
    static async getArtObjectsByFilters(filters, actorUser) {
        const scope = AuthorizationService.gallerySharingScope(toPerson(actorUser));
        return MyArtObject.getByFilters(filters || {}, actorUser.f.id, scope);
    }

    static async updateArtObject(artData, actorUser) {
        const artObject = await MyArtObject.getById(artData.id);
        await ArtService.__assertCanAccessWork(actorUser, artObject);

        // Обновляем только переданные поля
        artObject.f.name = artData.name !== undefined ? artData.name : artObject.f.name;
        artObject.f.technique = artData.technique !== undefined ? artData.technique : artObject.f.technique;
        artObject.f.description = artData.description !== undefined ? artData.description : artObject.f.description;
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
        artObject.f.updated_by = actorUser.f.id;
        artObject.f.utime = new Date();

        await artObject.save();

        if (Array.isArray(artData.images)) {
            await ArtImageModel.setImagesForArt(artObject.f.id, this.__extractImageFileIds(artData.images));
        }

        return MyArtObject.getByIdWithAvatar(artObject.f.id);
    }

    // Проданную работу удалить нельзя — она молча пропала бы из отчётов о
    // продажах. Сначала нужно отменить продажу (DELETE /api/v1/sales/:id).
    static async __assertNotSold(artObject) {
        if (await SaleModel.getByArtId(artObject.f.id)) {
            throw new Error(`Art object "${artObject.f.name}" is sold: cancel the sale before deleting`);
        }
    }

    static async deleteArtObject(id, actorUser) {
        const artObject = await MyArtObject.getById(id);
        await ArtService.__assertCanAccessWork(actorUser, artObject, { forDelete: true });
        await ArtService.__assertNotSold(artObject);

        // Сначала удаляем все связи с пользователями
        const users = await MyArtObjectUser.getUsersForArt(id);
        for (const userId of users) {
            await MyArtObjectUser.removeUserFromArt(id, userId);
        }

        // Удаляем связи доп. изображений
        await ArtImageModel.removeAllImagesFromArt(id);

        // Удаляем связи со ссылками (my_art_object_link)
        await ArtLinkModel.removeAllLinksFromArt(id);

        // Удаляем работу из всех ссылок (my_collection_work) и выставок (my_exhibition_work)
        await CollectionWorkModel.removeArtFromAllCollections(id);
        await ExhibitionWorkModel.removeArtFromAllExhibitions(id);

        // Отвязываем работу от контактов (my_contact_work — "куплено"/"интересуется")
        await ContactWorkModel.removeArtFromAllContacts(id);

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
        if (!(await ArtService.__canUseRef(media, userId))) {
            throw new Error('Media not found');
        }
        return media;
    }

    static async getAllMedia(userId) {
        const mediaList = await ArtService.__getRefList(MyMedia, userId);
        return mediaList;
    }

    static async getMediaByUserId(targetUserId, actorUser) {
        const userId = await assertCanViewUserData(actorUser, targetUserId);
        const mediaList = await MyMedia.getByUserId(userId);
        return mediaList;
    }

    static async updateMedia(mediaData, userId) {
        const media = await MyMedia.getById(mediaData.id);
        if (!(await ArtService.__canUseRef(media, userId))) {
            throw new Error('Media not found');
        }

        media.f.name = mediaData.name !== undefined ? mediaData.name : media.f.name;

        await media.save();
        return media;
    }

    static async deleteMedia(id, userId) {
        const media = await MyMedia.getById(id);
        if (!(await ArtService.__canUseRef(media, userId, { forDelete: true }))) {
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
        if (!(await ArtService.__canUseRef(seria, userId))) {
            throw new Error('Seria not found');
        }
        return seria;
    }

    static async getAllSerias(userId) {
        const seriaList = await ArtService.__getRefList(MySeria, userId);
        return seriaList;
    }

    static async getSeriaByUserId(targetUserId, actorUser) {
        const userId = await assertCanViewUserData(actorUser, targetUserId);
        const seriaList = await MySeria.getByUserId(userId);
        return seriaList;
    }

    static async updateSeria(seriaData, userId) {
        const seria = await MySeria.getById(seriaData.id);
        if (!(await ArtService.__canUseRef(seria, userId))) {
            throw new Error('Seria not found');
        }

        seria.f.name = seriaData.name !== undefined ? seriaData.name : seria.f.name;

        await seria.save();
        return seria;
    }

    static async deleteSeria(id, userId) {
        const seria = await MySeria.getById(id);
        if (!(await ArtService.__canUseRef(seria, userId, { forDelete: true }))) {
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

    static async createArtist(artistData, actorUser) {
        // Пул справочника художников — общий на галерею (см. QuotaService),
        // но только если actor вообще внутри такого пула (gallery/manager);
        // у обычного пользователя без галереи квоты нет — не ограничиваем.
        const poolGalleryId = QuotaService.poolGalleryId(toPerson(actorUser));
        if (poolGalleryId) {
            await QuotaService.assertCanAddCatalogArtist(poolGalleryId);
        }

        const artist = new MyArtist({
            ...artistData,
            user_id: actorUser.f.id
        });

        await artist.save();
        return artist;
    }

    static async getArtistById(id, userId) {
        const artist = await MyArtist.getById(id);
        if (!(await ArtService.__canUseRef(artist, userId))) {
            throw new Error('Artist not found');
        }
        return artist;
    }

    static async getAllArtists(userId) {
        const artistList = await ArtService.__getRefList(MyArtist, userId);
        return artistList;
    }

    static async getArtistByUserId(targetUserId, actorUser) {
        const userId = await assertCanViewUserData(actorUser, targetUserId);
        const artistList = await MyArtist.getByUserId(userId);
        return artistList;
    }

    static async updateArtist(artistData, userId) {
        const artist = await MyArtist.getById(artistData.id);
        if (!(await ArtService.__canUseRef(artist, userId))) {
            throw new Error('Artist not found');
        }

        artist.f.name = artistData.name !== undefined ? artistData.name : artist.f.name;

        await artist.save();
        return artist;
    }

    static async deleteArtist(id, userId) {
        const artist = await MyArtist.getById(id);
        if (!(await ArtService.__canUseRef(artist, userId, { forDelete: true }))) {
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
        if (!(await ArtService.__canUseRef(status, userId))) {
            throw new Error('Status not found');
        }
        return status;
    }

    static async getAllStatuses(userId) {
        const statusList = await ArtService.__getRefList(MyStatus, userId);
        return statusList;
    }

    static async getStatusByUserId(targetUserId, actorUser) {
        const userId = await assertCanViewUserData(actorUser, targetUserId);
        const statusList = await MyStatus.getByUserId(userId);
        return statusList;
    }

    static async updateStatus(statusData, userId) {
        const status = await MyStatus.getById(statusData.id);
        if (!(await ArtService.__canUseRef(status, userId))) {
            throw new Error('Status not found');
        }

        status.f.name = statusData.name !== undefined ? statusData.name : status.f.name;
        status.f.color = statusData.color !== undefined ? statusData.color : status.f.color;

        await status.save();
        return status;
    }

    static async deleteStatus(id, userId) {
        const status = await MyStatus.getById(id);
        if (!(await ArtService.__canUseRef(status, userId, { forDelete: true }))) {
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
        if (!(await ArtService.__canUseRef(location, userId))) {
            throw new Error('Location not found');
        }
        return location;
    }

    static async getAllLocations(userId) {
        const locationList = await ArtService.__getRefList(MyLocation, userId);
        return locationList;
    }

    static async getLocationByUserId(targetUserId, actorUser) {
        const userId = await assertCanViewUserData(actorUser, targetUserId);
        const locationList = await MyLocation.getByUserId(userId);
        return locationList;
    }

    static async updateLocation(locationData, userId) {
        const location = await MyLocation.getById(locationData.id);
        if (!(await ArtService.__canUseRef(location, userId))) {
            throw new Error('Location not found');
        }

        location.f.name = locationData.name !== undefined ? locationData.name : location.f.name;

        await location.save();
        return location;
    }

    static async deleteLocation(id, userId) {
        const location = await MyLocation.getById(id);
        if (!(await ArtService.__canUseRef(location, userId, { forDelete: true }))) {
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
    
    static async getArtObjectsByUserIdForRelation(targetUserId, actorUser) {
        const userId = await assertCanViewUserData(actorUser, targetUserId);
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
        return result.rows[0];
    }

    /**
     * Массовое создание работ. Сначала валидируем все записи (сеттеры схемы
     * проверяют цену/год/валюту при создании объекта), и только потом
     * сохраняем — чтобы ошибка в одной записи не оставила половину созданных.
     * (PgObject.createTransaction здесь не подходит: с Pool он открывает
     * транзакцию на случайном соединении и молча проглатывает ошибки.)
     */
    static async bulkCreateArtObjects(artObjectsData, actorUser) {
        artObjectsData.forEach((artData, index) => {
            if (!artData || typeof artData !== 'object') {
                throw new Error(`Item ${index}: art object must be an object`);
            }
            if (!artData.name) {
                throw new Error(`Item ${index}: name is required`);
            }
            try {
                const artFields = { ...artData };
                delete artFields.images;
                new MyArtObject({ ...artFields, user_id: actorUser.f.id });
            } catch (e) {
                throw new Error(`Item ${index}: ${e.message}`);
            }
        });

        const createdObjects = [];
        for (const artData of artObjectsData) {
            createdObjects.push(await this.createArtObject(artData, actorUser));
        }
        return createdObjects;
    }

    /**
     * Массовое удаление работ. Права проверяются для всех работ ДО удаления
     * первой — либо удаляются все, либо (при чужой/несуществующей) ни одной.
     */
    static async bulkDeleteArtObjects(ids, actorUser) {
        const uniqueIds = [...new Set(ids)];
        for (const id of uniqueIds) {
            const artObject = await MyArtObject.getById(id);
            await ArtService.__assertCanAccessWork(actorUser, artObject, { forDelete: true });
            await ArtService.__assertNotSold(artObject);
        }
        for (const id of uniqueIds) {
            await ArtService.deleteArtObject(id, actorUser);
        }
        return { success: true, deleted: uniqueIds.length };
    }

    static async updateArtObjectPartial(id, updates, actorUser) {
        const artObject = await MyArtObject.getById(id);
        await ArtService.__assertCanAccessWork(actorUser, artObject);

        // Обновляем только те поля, которые есть в схеме
        // (artObject.f — Proxy поверх схемы, hasOwnProperty через него не работает,
        // поэтому проверяем на самой схеме класса). user_id/updated_by —
        // служебные, задаются сервером, а не клиентом.
        Object.keys(updates).forEach(key => {
            if (key === 'id' || key === 'user_id' || key === 'updated_by') return;
            if (Object.prototype.hasOwnProperty.call(MyArtObject.schema, key)) {
                artObject.f[key] = updates[key];
            }
        });

        artObject.f.updated_by = actorUser.f.id;
        artObject.f.utime = new Date();
        await artObject.save();

        return MyArtObject.getByIdWithAvatar(id);
    }
}