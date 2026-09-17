import { PgObject } from 'pgobject';
import CollectionModel from '../models/CollectionModel.js';
import CollectionWorkModel from '../models/CollectionWorkModel.js';
import CollectionFolderModel from '../models/CollectionFolderModel.js';

export default class CollectionService {
    // Превращает плоские show_* колонки в вложенный visibleFields{...}
    // и artist_or_gallery в artistOrGallery — форма API ближе к тому,
    // с чем уже работает фронтенд (раньше это был localStorage-объект).
    static __toApiShape(collection) {
        const {
            artist_or_gallery,
            show_technique, show_year, show_seria, show_media, show_location, show_price,
            show_price_sort, show_artist_filter,
            display_currency, currency_rate, currency_rounding,
            ...rest
        } = collection;

        return {
            ...rest,
            artistOrGallery: artist_or_gallery,
            visibleFields: {
                technique: show_technique,
                year: show_year,
                seria: show_seria,
                media: show_media,
                location: show_location,
                price: show_price,
                priceSort: show_price_sort,
                artistFilter: show_artist_filter
            },
            displayCurrency: display_currency,
            currencyRate: currency_rate,
            currencyRounding: currency_rounding,
        };
    }

    // Оставляет в списке только те id работ, которые реально принадлежат
    // пользователю — иначе в свою (публично доступную) ссылку можно было бы
    // подставить чужой art_id и раскрыть чужую работу посторонним.
    static async __validateWorksOwnership(artIds, userId) {
        if (!Array.isArray(artIds) || !artIds.length) return [];

        const uniqueIds = [...new Set(artIds)];
        const placeholders = uniqueIds.map((_, i) => `$${i + 2}`).join(',');
        const query = `SELECT id FROM my_art_object WHERE user_id = $1 AND id IN (${placeholders})`;
        const result = await PgObject.query(query, [userId, ...uniqueIds]);
        const ownedIds = new Set(result.rows.map(r => r.id));

        return artIds.filter(id => ownedIds.has(id));
    }

    static async createCollection(data, userId) {
        const collection = new CollectionModel({
            user_id: userId,
            name: data.name,
            subtitle: data.subtitle || null,
            artist_or_gallery: data.artistOrGallery,
            description: data.description,
            avatar_id: data.avatar?.id || null,
            show_technique: data.visibleFields?.technique !== false,
            show_year: data.visibleFields?.year !== false,
            show_seria: data.visibleFields?.seria !== false,
            show_media: data.visibleFields?.media !== false,
            show_location: data.visibleFields?.location !== false,
            show_price: data.visibleFields?.price !== false,
            show_price_sort: data.visibleFields?.priceSort !== false,
            show_artist_filter: data.visibleFields?.artistFilter !== false,
            imported: !!data.imported,
            display_currency: data.displayCurrency ?? null,
            currency_rate: data.currencyRate ?? 1,
            currency_rounding: data.currencyRounding ?? 1,
        });
        await collection.save();

        const workIds = await CollectionService.__validateWorksOwnership(data.works, userId);
        if (workIds.length) {
            await CollectionWorkModel.setWorksForCollection(collection.f.id, workIds);
        }

        return CollectionService.getCollectionById(collection.f.id, userId);
    }

    static async getAllCollections(userId) {
        const collections = await CollectionModel.getAllWithAvatar(userId);
        const result = [];

        for (const collection of collections) {
            const works = await CollectionWorkModel.getArtIdsByCollectionId(collection.id);
            result.push({ ...CollectionService.__toApiShape(collection), works });
        }

        return result;
    }

    static async getCollectionById(id, userId) {
        const collection = await CollectionModel.getByIdWithAvatar(id);
        if (!collection || collection.user_id !== userId) {
            throw new Error('Collection not found');
        }

        const works = await CollectionWorkModel.getArtIdsByCollectionId(id);
        return { ...CollectionService.__toApiShape(collection), works };
    }

    static async updateCollection(id, data, userId) {
        const collection = await CollectionModel.getById(id);
        if (!collection || collection.f.user_id !== userId) {
            throw new Error('Collection not found');
        }

        if (data.name !== undefined) collection.f.name = data.name;
        if (data.subtitle !== undefined) collection.f.subtitle = data.subtitle;
        if (data.artistOrGallery !== undefined) collection.f.artist_or_gallery = data.artistOrGallery;
        if (data.description !== undefined) collection.f.description = data.description;
        if (data.avatar !== undefined) collection.f.avatar_id = data.avatar?.id || null;
        if (data.displayCurrency !== undefined) collection.f.display_currency = data.displayCurrency;
        if (data.currencyRate !== undefined) collection.f.currency_rate = data.currencyRate;
        if (data.currencyRounding !== undefined) collection.f.currency_rounding = data.currencyRounding;

        if (data.visibleFields) {
            const vf = data.visibleFields;
            if (vf.technique !== undefined) collection.f.show_technique = !!vf.technique;
            if (vf.year !== undefined) collection.f.show_year = !!vf.year;
            if (vf.seria !== undefined) collection.f.show_seria = !!vf.seria;
            if (vf.media !== undefined) collection.f.show_media = !!vf.media;
            if (vf.location !== undefined) collection.f.show_location = !!vf.location;
            if (vf.price !== undefined) collection.f.show_price = !!vf.price;
            if (vf.priceSort !== undefined) collection.f.show_price_sort = !!vf.priceSort;
            if (vf.artistFilter !== undefined) collection.f.show_artist_filter = !!vf.artistFilter;
        }

        await collection.save();

        if (Array.isArray(data.works)) {
            const workIds = await CollectionService.__validateWorksOwnership(data.works, userId);
            await CollectionWorkModel.setWorksForCollection(id, workIds);
        }

        return CollectionService.getCollectionById(id, userId);
    }

    static async deleteCollection(id, userId) {
        const collection = await CollectionModel.getById(id);
        if (!collection || collection.f.user_id !== userId) {
            throw new Error('Collection not found');
        }

        await CollectionWorkModel.removeAllWorksFromCollection(id);
        await collection.delete();

        return { success: true, message: 'Collection deleted successfully' };
    }

    // ============= COLLECTION FOLDER METHODS =============
    // Группировка ссылок по папкам — та же модель, что и файловый менеджер
    // (см. FileService: createFolder/updateFolder/deleteFolder/reorder*).

    static async createFolder(folderData, user) {
        if (folderData.parent_id) {
            await CollectionService.getFolderById(folderData.parent_id, user);
        }

        const folder = new CollectionFolderModel({
            name: folderData.name,
            user_id: user.f.id,
            parent_id: folderData.parent_id || null
        });

        await folder.save();
        return folder;
    }

    static async getFolderById(id, user) {
        const folder = await CollectionFolderModel.getByIdForUser(id, user.f.id);
        if (!folder) {
            throw new Error('Folder not found or access denied');
        }
        return folder;
    }

    static async getFoldersByUser(user) {
        return CollectionFolderModel.getByUserId(user.f.id);
    }

    static async __getDescendantFolderIds(id, userId) {
        const children = await CollectionFolderModel.getByParentId(id, userId);
        let ids = [];
        for (const child of children) {
            ids.push(child.f.id);
            ids = ids.concat(await CollectionService.__getDescendantFolderIds(child.f.id, userId));
        }
        return ids;
    }

    static async updateFolder(id, folderData, user) {
        const folder = await CollectionService.getFolderById(id, user);

        folder.f.name = folderData.name !== undefined ? folderData.name : folder.f.name;

        if (folderData.parent_id !== undefined) {
            const newParentId = folderData.parent_id;

            if (newParentId === id) {
                throw new Error('Cannot move folder into itself');
            }

            if (newParentId) {
                await CollectionService.getFolderById(newParentId, user);

                const descendantIds = await CollectionService.__getDescendantFolderIds(id, user.f.id);
                if (descendantIds.includes(newParentId)) {
                    throw new Error('Cannot move folder into its own subfolder');
                }
            }

            // order_num был позицией среди старых соседей — на новом уровне
            // он бессмысленен и может случайно совпасть с чужим. Сбрасываем,
            // чтобы перемещённая папка встала в конец нового уровня.
            if ((folder.f.parent_id || null) !== (newParentId || null)) {
                folder.f.order_num = null;
            }

            folder.f.parent_id = newParentId;
        }

        await folder.save();
        return folder;
    }

    static async __cascadeDeleteFolder(id, user) {
        const children = await CollectionFolderModel.getByParentId(id, user.f.id);
        for (const child of children) {
            await CollectionService.__cascadeDeleteFolder(child.f.id, user);
        }

        await CollectionModel.clearFolderId(id);

        const folder = await CollectionFolderModel.getByIdForUser(id, user.f.id);
        await folder.delete();
    }

    static async deleteFolder(id, user) {
        await CollectionService.getFolderById(id, user);

        await CollectionService.__cascadeDeleteFolder(id, user);
        return { success: true, message: 'Folder deleted successfully', id };
    }

    static async moveCollectionToFolder(collectionId, folderId, user) {
        if (folderId) {
            await CollectionService.getFolderById(folderId, user);
        }

        const collection = await CollectionModel.getById(collectionId);
        if (!collection || collection.f.user_id !== user.f.id) {
            throw new Error('Collection not found');
        }

        collection.f.folder_id = folderId || null;
        await collection.save();
        return CollectionService.getCollectionById(collectionId, user.f.id);
    }

    /**
     * Пересортировка ссылок внутри одной папки (или корня) — фронтенд
     * присылает id ссылок в новом визуальном порядке после drag&drop.
     *
     * @param {string[]} ids
     * @param {object} user
     * @static
    */
    static async reorderCollections(ids, user) {
        const collections = await CollectionModel.getByIdsForUser(ids, user.f.id);
        if (collections.length !== ids.length) {
            throw new Error('Some collections not found or access denied');
        }

        const byId = new Map(collections.map(c => [c.f.id, c]));
        for (let i = 0; i < ids.length; i++) {
            const collection = byId.get(ids[i]);
            collection.f.order_num = i;
            await collection.save();
        }

        return ids.map(id => byId.get(id));
    }

    /**
     * Пересортировка папок внутри одного уровня вложенности.
     *
     * @param {string[]} ids
     * @param {object} user
     * @static
    */
    static async reorderFolders(ids, user) {
        const folders = await CollectionFolderModel.getByIdsForUser(ids, user.f.id);
        if (folders.length !== ids.length) {
            throw new Error('Some folders not found or access denied');
        }

        const byId = new Map(folders.map(f => [f.f.id, f]));
        for (let i = 0; i < ids.length; i++) {
            const folder = byId.get(ids[i]);
            folder.f.order_num = i;
            await folder.save();
        }

        return ids.map(id => byId.get(id));
    }

    // Публичная страница ссылки — без авторизации, поэтому работы
    // возвращаются уже полностью резолвленными (имена справочников,
    // обложка, доп. изображения), без опоры на стор текущего зрителя.
    static async getPublicCollection(id) {
        const collection = await CollectionModel.getByIdWithAvatar(id);
        if (!collection) {
            throw new Error('Collection not found');
        }

        const works = await CollectionWorkModel.getResolvedWorksForCollection(id);
        return { ...CollectionService.__toApiShape(collection), works };
    }
}
