import { PgObject } from 'pgobject';
import CollectionModel from '../models/CollectionModel.js';
import CollectionWorkModel from '../models/CollectionWorkModel.js';

export default class CollectionService {
    // Превращает плоские show_* колонки в вложенный visibleFields{...}
    // и artist_or_gallery в artistOrGallery — форма API ближе к тому,
    // с чем уже работает фронтенд (раньше это был localStorage-объект).
    static __toApiShape(collection) {
        const {
            artist_or_gallery,
            show_technique, show_year, show_seria, show_media, show_location, show_price,
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
                price: show_price
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
            artist_or_gallery: data.artistOrGallery,
            description: data.description,
            avatar_id: data.avatar?.id || null,
            show_technique: data.visibleFields?.technique !== false,
            show_year: data.visibleFields?.year !== false,
            show_seria: data.visibleFields?.seria !== false,
            show_media: data.visibleFields?.media !== false,
            show_location: data.visibleFields?.location !== false,
            show_price: data.visibleFields?.price !== false,
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
