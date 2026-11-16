// Портфолио художника: обложка, «о художнике», списки выставок, проекты
// (текст + фото экспозиции + работы). Создаётся из карточки художника,
// выгружается в PDF в браузере, открывается публичной страницей /portfolio/:id.
//
// Видимость — как у справочника художников (ArtService.__refScopeUserIds):
// у галереи и её менеджеров — общие портфолио, у остальных — свои.
import { randomUUID } from 'node:crypto';
import { PgObject } from 'pgobject';
import MyArtist from '../models/ArtistModel.js';
import ArtService from './ArtService.js';
import { getFileBaseUrl } from '../utils/const.js';
import { thumbUrl } from '../utils/thumbs.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => UUID_RE.test(String(v || ''));

const LIMITS = {
    title: 300,
    subtitle: 300,
    bio: 20000,
    exhibitions: 20000,
    contacts: 2000,
    sections: 40,
    sectionTitle: 300,
    sectionYear: 50,
    sectionText: 20000,
    photos: 60,
    caption: 500,
    works: 200,
};

const fileDto = (id, ext) => (id && ext ? { id, ext, url: `${getFileBaseUrl()}/${id}.${ext}`, thumb_url: thumbUrl(id, ext) } : null);

function text(value, field, max) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`Portfolio ${field} must be a string`);
    const v = String(value).replace(/\r\n/g, '\n').trim();
    if (v.length > max) throw new Error(`Portfolio ${field} too long (max ${max})`);
    return v || null;
}

export default class PortfolioService {
    /** Портфолио, доступное пользователю, или ошибка 'Portfolio not found' */
    static async __loadRow(id, actorUser) {
        if (!isUuid(id)) throw new Error('Portfolio not found');
        const scope = await ArtService.__refScopeUserIds(actorUser.f.id);
        const row = (await PgObject.query(
            'SELECT * FROM my_portfolio WHERE id = $1 AND user_id = ANY($2::uuid[])', [id, scope]
        )).rows[0];
        if (!row) throw new Error('Portfolio not found');
        return { row, scope };
    }

    static async __loadArtist(artistId, actorUser) {
        const artist = isUuid(artistId) ? await MyArtist.getById(String(artistId)) : null;
        if (!(await ArtService.__canUseRef(artist, actorUser.f.id))) throw new Error('Artist not found');
        return artist;
    }

    /** Проверка и нормализация присланных полей (только переданные) */
    static async __normalize(data, scope) {
        const out = {};
        const has = (k) => data[k] !== undefined;
        if (has('title')) {
            const t = text(data.title, 'title', LIMITS.title);
            if (!t) throw new Error('Portfolio title is required');
            out.title = t;
        }
        if (has('subtitle')) out.subtitle = text(data.subtitle, 'subtitle', LIMITS.subtitle);
        if (has('bio')) out.bio = text(data.bio, 'bio', LIMITS.bio);
        if (has('exhibitions_solo')) out.exhibitions_solo = text(data.exhibitions_solo, 'exhibitions', LIMITS.exhibitions);
        if (has('exhibitions_group')) out.exhibitions_group = text(data.exhibitions_group, 'exhibitions', LIMITS.exhibitions);
        if (has('contacts')) out.contacts = text(data.contacts, 'contacts', LIMITS.contacts);
        if (has('is_public')) {
            if (typeof data.is_public !== 'boolean') throw new Error('is_public must be true or false');
            out.is_public = data.is_public;
        }

        const fileIds = new Set();
        const workIds = new Set();
        for (const key of ['cover_id', 'bio_photo_id']) {
            if (!has(key)) continue;
            if (data[key] === null || data[key] === '') out[key] = null;
            else {
                if (!isUuid(data[key])) throw new Error('File not found');
                out[key] = String(data[key]);
                fileIds.add(out[key]);
            }
        }

        if (has('sections')) {
            if (!Array.isArray(data.sections)) throw new Error('sections must be an array');
            if (data.sections.length > LIMITS.sections) throw new Error(`Too many sections (max ${LIMITS.sections})`);
            out.sections = data.sections.map((s) => {
                if (!s || typeof s !== 'object') throw new Error('Invalid section');
                const photos = Array.isArray(s.photos) ? s.photos : [];
                const works = Array.isArray(s.works) ? s.works : [];
                if (photos.length > LIMITS.photos) throw new Error(`Too many photos in a section (max ${LIMITS.photos})`);
                if (works.length > LIMITS.works) throw new Error(`Too many works in a section (max ${LIMITS.works})`);
                return {
                    id: isUuid(s.id) ? String(s.id) : randomUUID(),
                    title: text(s.title, 'section title', LIMITS.sectionTitle),
                    year: text(s.year, 'section year', LIMITS.sectionYear),
                    text: text(s.text, 'section text', LIMITS.sectionText),
                    photos: photos.map((p) => {
                        const fileId = p?.file_id;
                        if (!isUuid(fileId)) throw new Error('File not found');
                        fileIds.add(String(fileId));
                        return { file_id: String(fileId), caption: text(p.caption, 'caption', LIMITS.caption) };
                    }),
                    works: [...new Set(works.map((w) => {
                        if (!isUuid(w)) throw new Error('Art object not found');
                        workIds.add(String(w));
                        return String(w);
                    }))],
                };
            });
        }

        // Файлы и работы — только из своего пространства (своё / галереи)
        if (fileIds.size) {
            const found = (await PgObject.query(
                'SELECT id FROM my_file WHERE id = ANY($1::uuid[]) AND user_id = ANY($2::uuid[])', [[...fileIds], scope]
            )).rows;
            if (found.length !== fileIds.size) throw new Error('File not found');
        }
        if (workIds.size) {
            const found = (await PgObject.query(
                'SELECT id FROM my_art_object WHERE id = ANY($1::uuid[]) AND user_id = ANY($2::uuid[])', [[...workIds], scope]
            )).rows;
            if (found.length !== workIds.size) throw new Error('Art object not found');
        }
        return out;
    }

    /** Полное портфолио с файлами и работами (для редактора, PDF и публичной страницы) */
    static async __resolve(row) {
        const sections = Array.isArray(row.sections) ? row.sections : [];
        const fileIds = new Set([row.cover_id, row.bio_photo_id].filter(Boolean));
        const workIds = new Set();
        for (const s of sections) {
            for (const p of s.photos || []) fileIds.add(p.file_id);
            for (const w of s.works || []) workIds.add(w);
        }
        const files = new Map((await PgObject.query(
            'SELECT id, ext FROM my_file WHERE id = ANY($1::uuid[])', [[...fileIds]]
        )).rows.map(f => [f.id, fileDto(f.id, f.ext)]));

        const works = new Map((await PgObject.query(`
            SELECT ao.id, ao.name, ao.year, ao.technique, ao.size, ao.description,
                f.id AS f_id, f.ext AS f_ext, s.id AS sale_id
            FROM my_art_object ao
            LEFT JOIN my_file f ON f.id = ao.avatar_id
            LEFT JOIN my_sale s ON s.art_id = ao.id
            WHERE ao.id = ANY($1::uuid[])
        `, [[...workIds]])).rows.map(w => [w.id, {
            id: w.id,
            name: w.name,
            year: w.year ?? null,
            technique: w.technique ?? null,
            size: w.size ?? null,
            description: w.description ?? null,
            sold: !!w.sale_id,
            avatar: fileDto(w.f_id, w.f_ext),
        }]));

        const artist = (await PgObject.query(
            'SELECT id, name FROM my_artist WHERE id = $1', [row.artist_id]
        )).rows[0] || null;

        return {
            id: row.id,
            artist: artist ? { id: artist.id, name: artist.name } : null,
            title: row.title,
            subtitle: row.subtitle,
            cover: files.get(row.cover_id) || null,
            bio: row.bio,
            bio_photo: files.get(row.bio_photo_id) || null,
            exhibitions_solo: row.exhibitions_solo,
            exhibitions_group: row.exhibitions_group,
            contacts: row.contacts,
            is_public: row.is_public,
            views: row.views,
            ctime: row.ctime,
            utime: row.utime,
            sections: sections.map(s => ({
                id: s.id,
                title: s.title ?? null,
                year: s.year ?? null,
                text: s.text ?? null,
                // удалённые файлы/работы просто пропадают из портфолио
                photos: (s.photos || []).filter(p => files.get(p.file_id))
                    .map(p => ({ file_id: p.file_id, file: files.get(p.file_id), caption: p.caption ?? null })),
                works: (s.works || []).map(id => works.get(id)).filter(Boolean),
            })),
        };
    }

    /** Портфолио художника — короткий список для карточки */
    static async listByArtist(artistId, actorUser) {
        await PortfolioService.__loadArtist(artistId, actorUser);
        const scope = await ArtService.__refScopeUserIds(actorUser.f.id);
        const rows = (await PgObject.query(`
            SELECT p.id, p.title, p.subtitle, p.is_public, p.views, p.ctime, p.utime, p.sections,
                f.id AS f_id, f.ext AS f_ext
            FROM my_portfolio p
            LEFT JOIN my_file f ON f.id = p.cover_id
            WHERE p.artist_id = $1 AND p.user_id = ANY($2::uuid[])
            ORDER BY p.utime DESC NULLS LAST
        `, [artistId, scope])).rows;
        return rows.map(r => ({
            id: r.id,
            title: r.title,
            subtitle: r.subtitle,
            is_public: r.is_public,
            views: r.views,
            ctime: r.ctime,
            utime: r.utime,
            cover: fileDto(r.f_id, r.f_ext),
            sections_count: Array.isArray(r.sections) ? r.sections.length : 0,
            works_count: Array.isArray(r.sections) ? r.sections.reduce((n, s) => n + (s.works?.length || 0), 0) : 0,
        }));
    }

    static async get(id, actorUser) {
        const { row } = await PortfolioService.__loadRow(id, actorUser);
        return PortfolioService.__resolve(row);
    }

    /**
     * Новое портфолио художника. Пустые поля заполняются из анкеты:
     * имя, «год · город», фото, «о художнике».
     */
    static async create(data, actorUser) {
        const artist = await PortfolioService.__loadArtist(data?.artist_id, actorUser);
        const scope = await ArtService.__refScopeUserIds(actorUser.f.id);
        const a = artist.f;
        const defaults = {
            title: a.name,
            subtitle: [a.birth_year, a.city].filter(Boolean).join(' | ') || null,
            cover_id: a.avatar_id || null,
            bio: a.bio || null,
            sections: [],
        };
        const fields = { ...defaults, ...(await PortfolioService.__normalize({ ...defaults, ...data }, scope)) };
        const row = (await PgObject.query(`
            INSERT INTO my_portfolio (user_id, artist_id, title, subtitle, cover_id, bio, bio_photo_id,
                exhibitions_solo, exhibitions_group, contacts, sections, is_public)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
            RETURNING *
        `, [
            actorUser.f.id, a.id, fields.title, fields.subtitle ?? null, fields.cover_id ?? null, fields.bio ?? null,
            fields.bio_photo_id ?? null, fields.exhibitions_solo ?? null, fields.exhibitions_group ?? null,
            fields.contacts ?? null, JSON.stringify(fields.sections || []), fields.is_public ?? true,
        ])).rows[0];
        return PortfolioService.__resolve(row);
    }

    static async update(id, data, actorUser) {
        const { row, scope } = await PortfolioService.__loadRow(id, actorUser);
        const fields = await PortfolioService.__normalize(data || {}, scope);
        const keys = Object.keys(fields);
        if (!keys.length) return PortfolioService.__resolve(row);
        const sets = keys.map((k, i) => (k === 'sections' ? `${k} = $${i + 2}::jsonb` : `${k} = $${i + 2}`));
        const values = keys.map(k => (k === 'sections' ? JSON.stringify(fields[k]) : fields[k]));
        const updated = (await PgObject.query(
            `UPDATE my_portfolio SET ${sets.join(', ')}, utime = now() WHERE id = $1 RETURNING *`, [row.id, ...values]
        )).rows[0];
        return PortfolioService.__resolve(updated);
    }

    static async remove(id, actorUser) {
        const { row } = await PortfolioService.__loadRow(id, actorUser);
        await PgObject.query('DELETE FROM my_portfolio WHERE id = $1', [row.id]);
        return { success: true };
    }

    /** Публичная страница: только если портфолио открыто по ссылке */
    static async getPublic(id, { countView = true } = {}) {
        if (!isUuid(id)) return null;
        const row = (await PgObject.query(
            'SELECT * FROM my_portfolio WHERE id = $1 AND is_public', [id]
        )).rows[0];
        if (!row) return null;
        if (countView) await PgObject.query('UPDATE my_portfolio SET views = views + 1 WHERE id = $1', [id]).catch(() => {});
        return PortfolioService.__resolve(row);
    }
}
