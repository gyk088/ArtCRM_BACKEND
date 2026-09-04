import { PgObject } from 'pgobject';
import ExhibitionModel from '../models/ExhibitionModel.js';
import ExhibitionWorkModel from '../models/ExhibitionWorkModel.js';
import ExhibitionPhotoModel from '../models/ExhibitionPhotoModel.js';

export default class ExhibitionService {
    // Превращает плоские show_* колонки в вложенный visibleFields{...},
    // artist_or_gallery/start_date/end_date в camelCase — форма API
    // повторяет CollectionService.__toApiShape.
    static __toApiShape(exhibition) {
        const {
            artist_or_gallery,
            start_date, end_date,
            show_technique, show_year, show_seria, show_media, show_location, show_price,
            show_price_sort, show_artist_filter,
            display_currency, currency_rate, currency_rounding,
            ...rest
        } = exhibition;

        return {
            ...rest,
            artistOrGallery: artist_or_gallery,
            startDate: start_date,
            endDate: end_date,
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
    // пользователю — иначе в свою (публично доступную) выставку можно было
    // бы подставить чужой art_id и раскрыть чужую работу посторонним.
    static async __validateWorksOwnership(artIds, userId) {
        if (!Array.isArray(artIds) || !artIds.length) return [];

        const uniqueIds = [...new Set(artIds)];
        const placeholders = uniqueIds.map((_, i) => `$${i + 2}`).join(',');
        const query = `SELECT id FROM my_art_object WHERE user_id = $1 AND id IN (${placeholders})`;
        const result = await PgObject.query(query, [userId, ...uniqueIds]);
        const ownedIds = new Set(result.rows.map(r => r.id));

        return artIds.filter(id => ownedIds.has(id));
    }

    static async createExhibition(data, userId) {
        const exhibition = new ExhibitionModel({
            user_id: userId,
            name: data.name,
            subtitle: data.subtitle || null,
            description: data.description,
            artist_or_gallery: data.artistOrGallery,
            venue: data.venue || null,
            start_date: data.startDate || null,
            end_date: data.endDate || null,
            avatar_id: data.avatar?.id || null,
            show_technique: data.visibleFields?.technique !== false,
            show_year: data.visibleFields?.year !== false,
            show_seria: data.visibleFields?.seria !== false,
            show_media: data.visibleFields?.media !== false,
            show_location: data.visibleFields?.location !== false,
            show_price: data.visibleFields?.price !== false,
            show_price_sort: data.visibleFields?.priceSort !== false,
            show_artist_filter: data.visibleFields?.artistFilter !== false,
            display_currency: data.displayCurrency ?? null,
            currency_rate: data.currencyRate ?? 1,
            currency_rounding: data.currencyRounding ?? 1,
        });
        await exhibition.save();

        const workIds = await ExhibitionService.__validateWorksOwnership(data.works, userId);
        if (workIds.length) {
            await ExhibitionWorkModel.setWorksForExhibition(exhibition.f.id, workIds);
        }

        return ExhibitionService.getExhibitionById(exhibition.f.id, userId);
    }

    static async getAllExhibitions(userId) {
        const exhibitions = await ExhibitionModel.getAllWithAvatar(userId);
        const result = [];

        for (const exhibition of exhibitions) {
            const works = await ExhibitionWorkModel.getArtIdsByExhibitionId(exhibition.id);
            result.push({ ...ExhibitionService.__toApiShape(exhibition), works });
        }

        return result;
    }

    static async getExhibitionById(id, userId) {
        const exhibition = await ExhibitionModel.getByIdWithAvatar(id);
        if (!exhibition || exhibition.user_id !== userId) {
            throw new Error('Exhibition not found');
        }

        const works = await ExhibitionWorkModel.getArtIdsByExhibitionId(id);
        const photos = await ExhibitionPhotoModel.getResolvedByExhibitionId(id);
        return { ...ExhibitionService.__toApiShape(exhibition), works, photos };
    }

    static async updateExhibition(id, data, userId) {
        const exhibition = await ExhibitionModel.getById(id);
        if (!exhibition || exhibition.f.user_id !== userId) {
            throw new Error('Exhibition not found');
        }

        if (data.name !== undefined) exhibition.f.name = data.name;
        if (data.subtitle !== undefined) exhibition.f.subtitle = data.subtitle;
        if (data.artistOrGallery !== undefined) exhibition.f.artist_or_gallery = data.artistOrGallery;
        if (data.description !== undefined) exhibition.f.description = data.description;
        if (data.venue !== undefined) exhibition.f.venue = data.venue;
        if (data.startDate !== undefined) exhibition.f.start_date = data.startDate;
        if (data.endDate !== undefined) exhibition.f.end_date = data.endDate;
        if (data.avatar !== undefined) exhibition.f.avatar_id = data.avatar?.id || null;
        if (data.displayCurrency !== undefined) exhibition.f.display_currency = data.displayCurrency;
        if (data.currencyRate !== undefined) exhibition.f.currency_rate = data.currencyRate;
        if (data.currencyRounding !== undefined) exhibition.f.currency_rounding = data.currencyRounding;

        if (data.visibleFields) {
            const vf = data.visibleFields;
            if (vf.technique !== undefined) exhibition.f.show_technique = !!vf.technique;
            if (vf.year !== undefined) exhibition.f.show_year = !!vf.year;
            if (vf.seria !== undefined) exhibition.f.show_seria = !!vf.seria;
            if (vf.media !== undefined) exhibition.f.show_media = !!vf.media;
            if (vf.location !== undefined) exhibition.f.show_location = !!vf.location;
            if (vf.price !== undefined) exhibition.f.show_price = !!vf.price;
            if (vf.priceSort !== undefined) exhibition.f.show_price_sort = !!vf.priceSort;
            if (vf.artistFilter !== undefined) exhibition.f.show_artist_filter = !!vf.artistFilter;
        }

        await exhibition.save();

        if (Array.isArray(data.works)) {
            const workIds = await ExhibitionService.__validateWorksOwnership(data.works, userId);
            await ExhibitionWorkModel.setWorksForExhibition(id, workIds);
        }

        return ExhibitionService.getExhibitionById(id, userId);
    }

    static async deleteExhibition(id, userId) {
        const exhibition = await ExhibitionModel.getById(id);
        if (!exhibition || exhibition.f.user_id !== userId) {
            throw new Error('Exhibition not found');
        }

        await ExhibitionWorkModel.removeAllWorksFromExhibition(id);
        await ExhibitionPhotoModel.removeAllForExhibition(id);
        await exhibition.delete();

        return { success: true, message: 'Exhibition deleted successfully' };
    }

    // Публичная страница выставки — без авторизации, поэтому работы и фото
    // возвращаются уже полностью резолвленными.
    static async getPublicExhibition(id) {
        const exhibition = await ExhibitionModel.getByIdWithAvatar(id);
        if (!exhibition) {
            throw new Error('Exhibition not found');
        }

        const works = await ExhibitionWorkModel.getResolvedWorksForExhibition(id);
        const photos = await ExhibitionPhotoModel.getResolvedByExhibitionId(id);
        return { ...ExhibitionService.__toApiShape(exhibition), works, photos };
    }

    // ============= ГАЛЕРЕЯ ФОТО СОБЫТИЯ =============

    static async __getOwnedExhibition(exhibitionId, userId) {
        const exhibition = await ExhibitionModel.getById(exhibitionId);
        if (!exhibition || exhibition.f.user_id !== userId) {
            throw new Error('Exhibition not found');
        }
        return exhibition;
    }

    static async addPhoto(exhibitionId, data, userId) {
        await ExhibitionService.__getOwnedExhibition(exhibitionId, userId);

        const photo = new ExhibitionPhotoModel({
            exhibition_id: exhibitionId,
            file_id: data.fileId,
            caption: data.caption || null,
        });
        await photo.save();

        return ExhibitionPhotoModel.getResolvedByExhibitionId(exhibitionId);
    }

    static async updatePhoto(exhibitionId, photoId, data, userId) {
        await ExhibitionService.__getOwnedExhibition(exhibitionId, userId);

        const photo = await ExhibitionPhotoModel.getById(photoId);
        if (!photo || photo.f.exhibition_id !== exhibitionId) {
            throw new Error('Photo not found');
        }

        if (data.caption !== undefined) photo.f.caption = data.caption;
        await photo.save();

        return ExhibitionPhotoModel.getResolvedByExhibitionId(exhibitionId);
    }

    static async deletePhoto(exhibitionId, photoId, userId) {
        await ExhibitionService.__getOwnedExhibition(exhibitionId, userId);

        const photo = await ExhibitionPhotoModel.getById(photoId);
        if (!photo || photo.f.exhibition_id !== exhibitionId) {
            throw new Error('Photo not found');
        }

        await photo.delete();
        return ExhibitionPhotoModel.getResolvedByExhibitionId(exhibitionId);
    }

    // Фронтенд присылает id фото выставки в новом визуальном порядке (после
    // drag&drop) — нумеруем их по порядку в этом массиве, как reorderFiles/
    // reorderFolders в FileService.
    static async reorderPhotos(exhibitionId, ids, userId) {
        await ExhibitionService.__getOwnedExhibition(exhibitionId, userId);

        const photos = await ExhibitionPhotoModel.getByIdsForExhibition(ids, exhibitionId);
        if (photos.length !== ids.length) {
            throw new Error('Some photos not found or access denied');
        }

        const byId = new Map(photos.map(p => [p.f.id, p]));
        for (let i = 0; i < ids.length; i++) {
            const photo = byId.get(ids[i]);
            photo.f.order_num = i;
            await photo.save();
        }

        return ExhibitionPhotoModel.getResolvedByExhibitionId(exhibitionId);
    }
}
