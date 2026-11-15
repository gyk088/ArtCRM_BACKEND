import { PgObject } from 'pgobject';
import NoteModel from '../models/NoteModel.js';
import MyArtist from '../models/ArtistModel.js';
import ArtService from './ArtService.js';

const MAX_TITLE_LENGTH = 300;
// HTML из редактора (форматирование без картинок) — с большим запасом
const MAX_CONTENT_LENGTH = 1_000_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Заметки: заголовок, форматированный текст, необязательная привязка к
 * художнику; видно, кто и когда создал и кто последним изменил.
 *
 * Внутри галереи заметки общие — как работы и справочники: галерея и все её
 * менеджеры видят и правят заметки друг друга, удалить может автор или
 * сама галерея (ArtService.__canUseRef). У остальных ролей — личные.
 */
export default class NoteService {
    static __toDto(row) {
        return {
            id: row.id,
            title: row.title,
            content: row.content ?? '',
            artist: row.artist_id ? { id: row.artist_id, name: row.artist_name ?? null } : null,
            createdBy: { id: row.user_id, name: row.creator_name ?? null, surname: row.creator_surname ?? null },
            updatedBy: row.updated_by
                ? { id: row.updated_by, name: row.editor_name ?? null, surname: row.editor_surname ?? null }
                : null,
            ctime: row.ctime,
            utime: row.utime,
        };
    }

    static __selectSql(where) {
        return `
            SELECT n.*, a.name AS artist_name,
                c.name AS creator_name, c.surname AS creator_surname,
                e.name AS editor_name, e.surname AS editor_surname
            FROM my_note n
            LEFT JOIN my_artist a ON a.id = n.artist_id
            LEFT JOIN my_user c ON c.id = n.user_id
            LEFT JOIN my_user e ON e.id = n.updated_by
            WHERE ${where}
        `;
    }

    static async __getResolved(id) {
        const result = await PgObject.query(NoteService.__selectSql('n.id = $1') + ' LIMIT 1', [id]);
        return result.rows[0] ? NoteService.__toDto(result.rows[0]) : null;
    }

    static async __getAccessible(id, actorUser, { forDelete = false } = {}) {
        let note = null;
        if (UUID_RE.test(String(id))) note = await NoteModel.getById(id);
        if (!(await ArtService.__canUseRef(note, actorUser.f.id, { forDelete }))) {
            throw new Error('Note not found');
        }
        return note;
    }

    static __normalizeTitle(title) {
        if (typeof title !== 'string' || !title.trim()) throw new Error('Note title is required');
        if (title.length > MAX_TITLE_LENGTH) throw new Error(`Note title too long (max ${MAX_TITLE_LENGTH})`);
        return title.trim();
    }

    static __normalizeContent(content) {
        if (content === null || content === undefined) return '';
        if (typeof content !== 'string') throw new Error('Note content must be a string');
        if (content.length > MAX_CONTENT_LENGTH) throw new Error('Note is too long');
        return content;
    }

    // Художник — свой или из справочника галереи
    static async __normalizeArtist(artistId, actorUser) {
        if (artistId === null || artistId === undefined || artistId === '') return null;
        let artist = null;
        if (UUID_RE.test(String(artistId))) artist = await MyArtist.getById(artistId);
        if (!(await ArtService.__canUseRef(artist, actorUser.f.id))) throw new Error('Artist not found');
        return artist.f.id;
    }

    /** Список без текста (он может быть большим) — для страницы заметок */
    static async list(actorUser) {
        const scope = await ArtService.__refScopeUserIds(actorUser.f.id);
        const result = await PgObject.query(
            NoteService.__selectSql('n.user_id = ANY($1::uuid[])') + ' ORDER BY n.utime DESC',
            [scope]
        );
        return result.rows.map(row => {
            const dto = NoteService.__toDto(row);
            // короткий фрагмент вместо всего текста
            dto.preview = String(row.content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ').trim().slice(0, 200);
            delete dto.content;
            return dto;
        });
    }

    static async get(id, actorUser) {
        const note = await NoteService.__getAccessible(id, actorUser);
        return NoteService.__getResolved(note.f.id);
    }

    static async create(data, actorUser) {
        const title = NoteService.__normalizeTitle(data?.title);
        const content = NoteService.__normalizeContent(data?.content);
        const artistId = await NoteService.__normalizeArtist(data?.artist_id, actorUser);

        const note = new NoteModel({
            user_id: actorUser.f.id,
            title,
            content,
            artist_id: artistId,
            updated_by: null,
            ctime: new Date(),
            utime: new Date(),
        });
        await note.save();
        return NoteService.__getResolved(note.f.id);
    }

    /** Частичное изменение: title, content, artist_id — любые из них */
    static async update(id, data, actorUser) {
        const note = await NoteService.__getAccessible(id, actorUser);

        // всё проверяем до сохранения
        const title = data.title !== undefined ? NoteService.__normalizeTitle(data.title) : note.f.title;
        const content = data.content !== undefined ? NoteService.__normalizeContent(data.content) : note.f.content;
        const artistId = data.artist_id !== undefined
            ? await NoteService.__normalizeArtist(data.artist_id, actorUser)
            : note.f.artist_id;

        note.f.title = title;
        note.f.content = content;
        note.f.artist_id = artistId;
        note.f.updated_by = actorUser.f.id;
        note.f.utime = new Date();
        await note.save();
        return NoteService.__getResolved(note.f.id);
    }

    static async delete(id, actorUser) {
        const note = await NoteService.__getAccessible(id, actorUser, { forDelete: true });
        await note.delete();
        return { success: true };
    }
}
