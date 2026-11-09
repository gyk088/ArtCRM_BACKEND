import BiographyModel from '../models/BiographyModel.js';
import CvModel from '../models/CvModel.js';

const MAX_TITLE_LENGTH = 500;
// Текст — HTML из tiptap-редактора, запас с учётом разметки
const MAX_TEXT_LENGTH = 200000;
// Сколько документов за раз можно перенести из localStorage (см. importMany)
const MAX_IMPORT_ITEMS = 200;

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * CRUD для "текстовых документов" пользователя — биографий (my_biography)
 * и резюме (my_cv). Таблицы устроены одинаково, отличается только колонка
 * с текстом (Model.textColumn), поэтому логика общая.
 *
 * Документы строго личные: видит и правит их только владелец (user_id),
 * общей видимости галереи, как у работ, здесь нет. Чужой документ
 * отвечает "не найдено", как и везде в проекте.
 *
 * Наружу отдаётся та же форма, что раньше жила в localStorage фронта:
 * { id, title, text, createdAt, updatedAt }.
 */
class TextDocumentService {
    constructor(Model, notFoundMessage) {
        this.Model = Model;
        this.notFoundMessage = notFoundMessage;
    }

    toDto(doc) {
        return {
            id: doc.f.id,
            title: doc.f.title || '',
            text: doc.f[this.Model.textColumn] || '',
            createdAt: doc.f.ctime,
            updatedAt: doc.f.utime || doc.f.ctime,
        };
    }

    validate({ title, text }) {
        if (typeof title !== 'string' || !title.trim()) {
            throw new Error('Title is required');
        }
        if (title.length > MAX_TITLE_LENGTH) {
            throw new Error(`Title too long (max ${MAX_TITLE_LENGTH} characters)`);
        }
        if (text != null && typeof text !== 'string') {
            throw new Error('Text must be a string');
        }
        if (text && text.length > MAX_TEXT_LENGTH) {
            throw new Error(`Text too long (max ${MAX_TEXT_LENGTH} characters)`);
        }
    }

    async getOwned(id, userId) {
        const doc = await this.Model.getById(id);
        if (!doc || doc.f.user_id !== userId) {
            throw new Error(this.notFoundMessage);
        }
        return doc;
    }

    async getAll(userId) {
        const docs = await this.Model.getByUserId(userId);
        return docs.map(doc => this.toDto(doc));
    }

    async getById(id, userId) {
        return this.toDto(await this.getOwned(id, userId));
    }

    async create(data, userId, { ctime, utime } = {}) {
        this.validate(data);
        const now = new Date();
        const doc = new this.Model({
            user_id: userId,
            title: data.title.trim(),
            [this.Model.textColumn]: data.text || '',
            ctime: ctime || now,
            utime: utime || now,
        });
        await doc.save();
        return this.toDto(doc);
    }

    async update(id, data, userId) {
        this.validate(data);
        const doc = await this.getOwned(id, userId);
        doc.f.title = data.title.trim();
        doc.f[this.Model.textColumn] = data.text || '';
        doc.f.utime = new Date();
        await doc.save();
        return this.toDto(doc);
    }

    async delete(id, userId) {
        const doc = await this.getOwned(id, userId);
        await doc.delete();
        return { success: true };
    }

    /**
     * Разовый перенос документов, которые раньше хранились только в
     * localStorage браузера. Сохраняет исходные даты создания/изменения.
     * Невалидные записи пропускаются, а не валят весь импорт.
     */
    async importMany(items, userId) {
        if (!Array.isArray(items)) throw new Error('items array is required');
        if (items.length > MAX_IMPORT_ITEMS) {
            throw new Error(`Too many items (max ${MAX_IMPORT_ITEMS})`);
        }

        const created = [];
        let skipped = 0;
        for (const item of items) {
            try {
                created.push(await this.create(
                    { title: item?.title, text: item?.text },
                    userId,
                    { ctime: parseDate(item?.createdAt), utime: parseDate(item?.updatedAt) }
                ));
            } catch {
                skipped++;
            }
        }
        return { created, skipped };
    }
}

export const BiographyService = new TextDocumentService(BiographyModel, 'Biography not found');
export const CvService = new TextDocumentService(CvModel, 'CV not found');
