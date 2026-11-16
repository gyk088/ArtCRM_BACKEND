// Бекап пользовательских данных — два отдельных архива:
//
//  • «Данные» (getDataBackup) — ZIP с данные.xlsx (читается человеком в Excel)
//    и data.json (все строки всех таблиц со связями — из него потом можно
//    будет сделать восстановление/перенос). Собирается сразу в запросе:
//    даже у большой галереи это единицы мегабайт.
//
//  • «Файлы» (startFilesBackup) — ZIP с оригиналами всех загруженных файлов
//    в структуре папок раздела «Файлы». Может весить гигабайты, поэтому
//    собирается в фоне (по одному архиву за раз на весь сервер), по
//    готовности приходит уведомление; скачать можно по ссылке со случайным
//    токеном в течение BACKUP_TTL_MS, потом архив удаляется.
//
// Архивы лежат в ./backups — эта папка НЕ раздаётся nginx/@fastify/static
// (в отличие от ./files), скачивание только через /api/v1/backup/download.
// Состояние фонового бекапа — json-файл рядом с архивом, поэтому таблица в
// БД не нужна, а после рестарта бэкенда готовые архивы остаются доступны.
//
// Кто может делать бекап и чьи данные в него входят (см. backupScope):
//  • Галерея — свои данные + данные всех своих менеджеров (они и так
//    работают с общими работами/контактами/файлами);
//  • Менеджер без галереи, Художник — только свои;
//  • Менеджер в галерее — нет (его данные уже в бекапе галереи);
//  • Super Admin — свой и бекап любого из перечисленных выше.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Buffer } from 'node:buffer';
import archiver from 'archiver';
import ExcelJS from 'exceljs';
import { PgObject } from 'pgobject';
import UserModel from '../models/UserModel.js';
import AuditLogModel from '../models/AuditLogModel.js';
import NotificationService from './NotificationService.js';
import { ROLES } from '../utils/const.js';
import { sharingScopeUserIds } from '../utils/userAccess.js';
import { FILES_DIR } from '../utils/thumbs.js';

export const BACKUP_DIR = './backups';
export const BACKUP_TTL_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[0-9a-f]{64}$/;
// Запас свободного места на диске сверх размера архива
const DISK_RESERVE_BYTES = 2 * 1024 * 1024 * 1024;
const XLSX_CELL_MAX = 32000;

// Поля пользователя, которые попадают в бекап (без пароля, токенов, PIN)
const USER_PUBLIC_FIELDS = ['id', 'name', 'surname', 'email', 'phone', 'role', 'country', 'city', 'bdate', 'ctime', 'managed_by_gallery_id', 'certificate_header_text'];

const CONTACT_WORK_LABELS = { purchased: 'купил', interested: 'интересуется' };
const PRIORITY_LABELS = { low: 'Низкий', normal: 'Обычный', high: 'Высокий' };
const ROLE_LABELS = { super_admin: 'Супер-админ', gallery: 'Галерея', manager: 'Менеджер', artist: 'Художник' };

// ===================== Кто и чьи данные =====================

/**
 * Можно ли делать бекап данных target'а и чьи данные в него войдут.
 * @return {{ allowed: boolean, reason?: string, userIds?: string[] }}
 */
async function backupScope(target) {
    const role = target.f.role;
    if (role === ROLES.MANAGER && target.f.managed_by_gallery_id) {
        return { allowed: false, reason: 'Ваши данные входят в бекап галереи — его делает галерея' };
    }
    if (role === ROLES.GALLERY) {
        return { allowed: true, userIds: await sharingScopeUserIds(target) };
    }
    if ([ROLES.MANAGER, ROLES.ARTIST, ROLES.SUPER_ADMIN].includes(role)) {
        return { allowed: true, userIds: [target.f.id] };
    }
    return { allowed: false, reason: 'Для этой роли бекап недоступен' };
}

/**
 * Свой бекап — всегда (если роль позволяет), чужой — только Super Admin.
 * На отказ отвечаем "не найдено", как и везде в проекте.
 */
async function resolveTarget(actor, targetUserId) {
    if (!targetUserId || targetUserId === actor.f.id) return actor;
    if (actor.f.role !== ROLES.SUPER_ADMIN || !UUID_RE.test(String(targetUserId))) {
        throw new Error('User not found');
    }
    const target = await UserModel.getUserById(targetUserId);
    if (!target) throw new Error('User not found');
    return target;
}

async function resolveAllowed(actor, targetUserId) {
    const target = await resolveTarget(actor, targetUserId);
    const scope = await backupScope(target);
    if (!scope.allowed) throw new Error(scope.reason);
    return { target, userIds: scope.userIds };
}

// ===================== Сбор данных из БД =====================

const q = async (sql, params) => (await PgObject.query(sql, params)).rows;

/**
 * Все строки, относящиеся к пользователям userIds: таблицы с user_id —
 * напрямую, связующие таблицы — через владельца родительской записи.
 * Сессии, журнал аудита, уведомления и статистика просмотров ссылок в
 * бекап не входят (это служебные данные, не данные пользователя).
 */
async function collectData(userIds) {
    const ids = [userIds];
    const own = (table) => q(`SELECT * FROM ${table} WHERE user_id = ANY($1) ORDER BY ctime NULLS LAST, id`, ids)
        .catch(() => q(`SELECT * FROM ${table} WHERE user_id = ANY($1)`, ids));
    const d = {};

    d.my_user = await q(`SELECT ${USER_PUBLIC_FIELDS.join(', ')} FROM my_user WHERE id = ANY($1) ORDER BY ctime`, ids);

    for (const t of ['my_artist', 'my_media', 'my_seria', 'my_status', 'my_location', 'my_tag',
        'my_contact_category', 'my_contact_source']) {
        d[t] = await q(`SELECT * FROM ${t} WHERE user_id = ANY($1) ORDER BY name`, ids);
    }
    for (const t of ['my_art_object', 'my_contact', 'my_collection', 'my_collection_folder', 'my_exhibition',
        'my_file', 'my_file_folder', 'my_link', 'my_note', 'my_report', 'my_task_board', 'my_task_status',
        'my_biography', 'my_cv', 'my_workspace']) {
        d[t] = await own(t);
    }

    const pick = (rows, key = 'id') => rows.map(r => r[key]);
    const artIds = pick(d.my_art_object);
    const contactIds = pick(d.my_contact);
    const collectionIds = pick(d.my_collection);
    const exhibitionIds = pick(d.my_exhibition);
    const linkIds = pick(d.my_link);
    const reportIds = pick(d.my_report);
    const boardIds = pick(d.my_task_board);
    const workspaceIds = pick(d.my_workspace);

    d.my_art_object_image = await q('SELECT * FROM my_art_object_image WHERE art_id = ANY($1) ORDER BY art_id, order_num', [artIds]);
    d.my_art_object_tag = await q('SELECT * FROM my_art_object_tag WHERE art_id = ANY($1)', [artIds]);
    d.my_art_object_link = await q('SELECT * FROM my_art_object_link WHERE art_id = ANY($1)', [artIds]);
    d.my_art_object_user = await q('SELECT * FROM my_art_object_user WHERE art_id = ANY($1)', [artIds]);
    d.my_sale = await q('SELECT * FROM my_sale WHERE user_id = ANY($1) OR art_id = ANY($2) ORDER BY sale_date, ctime', [userIds, artIds]);
    d.my_contact_work = await q('SELECT * FROM my_contact_work WHERE contact_id = ANY($1)', [contactIds]);
    d.my_collection_work = await q('SELECT * FROM my_collection_work WHERE collection_id = ANY($1) ORDER BY collection_id, order_num', [collectionIds]);
    d.my_exhibition_work = await q('SELECT * FROM my_exhibition_work WHERE exhibition_id = ANY($1) ORDER BY exhibition_id, order_num', [exhibitionIds]);
    d.my_exhibition_photo = await q('SELECT * FROM my_exhibition_photo WHERE exhibition_id = ANY($1) ORDER BY exhibition_id, order_num', [exhibitionIds]);
    d.my_link_artist = await q('SELECT * FROM my_link_artist WHERE link_id = ANY($1)', [linkIds]);
    d.my_report_commission = await q('SELECT * FROM my_report_commission WHERE report_id = ANY($1)', [reportIds]);
    d.my_report_rate = await q('SELECT * FROM my_report_rate WHERE report_id = ANY($1)', [reportIds]);
    d.my_task = await q('SELECT * FROM my_task WHERE board_id = ANY($1) OR user_id = ANY($2) ORDER BY board_id, order_num', [boardIds, userIds]);
    d.my_task_board_status = await q('SELECT * FROM my_task_board_status WHERE board_id = ANY($1)', [boardIds]);
    for (const t of ['my_block_text', 'my_block_table', 'my_block_images', 'my_block_links']) {
        d[t] = await q(`SELECT * FROM ${t} WHERE workspace_id = ANY($1) ORDER BY workspace_id, column_num, order_num`, [workspaceIds]);
    }
    d.my_block_image = await q('SELECT * FROM my_block_image WHERE block_images_id = ANY($1)', [pick(d.my_block_images)]);
    d.my_block_link = await q('SELECT * FROM my_block_link WHERE block_links_id = ANY($1)', [pick(d.my_block_links)]);

    return d;
}

// ===================== данные.xlsx =====================

const byId = (rows) => new Map(rows.map(r => [r.id, r]));
const personName = (u) => (u ? [u.name, u.surname].filter(Boolean).join(' ') || u.email || '' : '');
const htmlToText = (s) => String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
const cell = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string' && v.length > XLSX_CELL_MAX) return v.slice(0, XLSX_CELL_MAX) + '…';
    return v;
};
const num = (v) => (v === null || v === undefined || v === '' ? '' : Number(v));
const dt = (v) => (v ? new Date(v) : '');

function addSheet(wb, name, columns, rows) {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns.map(([header, key, width = 18, numFmt]) => ({ header, key, width, style: numFmt ? { numFmt } : {} }));
    for (const r of rows) ws.addRow(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cell(v)])));
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFECE4' } };
    head.alignment = { vertical: 'middle', wrapText: true };
    if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    return ws;
}

async function buildXlsx(d, meta) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ART CRM';
    wb.created = new Date();

    const users = byId(d.my_user);
    const artists = byId(d.my_artist);
    const media = byId(d.my_media);
    const series = byId(d.my_seria);
    const statuses = byId(d.my_status);
    const locations = byId(d.my_location);
    const tags = byId(d.my_tag);
    const files = byId(d.my_file);
    const arts = byId(d.my_art_object);
    const contacts = byId(d.my_contact);
    const categories = byId(d.my_contact_category);
    const sources = byId(d.my_contact_source);
    const taskStatuses = byId(d.my_task_status);
    const boards = byId(d.my_task_board);
    const fileFolders = byId(d.my_file_folder);
    const multiUser = d.my_user.length > 1;

    const fileName = (id) => { const f = files.get(id); return f ? `${f.name || f.filename || f.id}${f.ext && !String(f.name || '').endsWith('.' + f.ext) ? '.' + f.ext : ''}` : ''; };
    const artName = (id) => arts.get(id)?.name || '';
    const group = (rows, key) => {
        const m = new Map();
        for (const r of rows) { if (!m.has(r[key])) m.set(r[key], []); m.get(r[key]).push(r); }
        return m;
    };
    const tagsByArt = group(d.my_art_object_tag, 'art_id');
    const imagesByArt = group(d.my_art_object_image, 'art_id');
    const saleByArt = new Map(d.my_sale.map(s => [s.art_id, s]));
    const worksByContact = group(d.my_contact_work, 'contact_id');
    const worksByCollection = group(d.my_collection_work, 'collection_id');
    const worksByExhibition = group(d.my_exhibition_work, 'exhibition_id');
    const artistsByLink = group(d.my_link_artist, 'link_id');
    const ownerCol = multiUser ? [['Автор записи', 'owner', 22]] : [];
    const owner = (r) => (multiUser ? { owner: personName(users.get(r.user_id)) } : {});

    // О бекапе
    const info = wb.addWorksheet('О бекапе');
    info.columns = [{ width: 28 }, { width: 70 }];
    const infoRows = [
        ['Бекап данных ART CRM', ''],
        ['Создан', new Date(meta.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })],
        ['Аккаунт', `${personName(meta.target)} (${ROLE_LABELS[meta.target.role] || meta.target.role})`],
        ['Пользователи в бекапе', d.my_user.map(u => `${personName(u)} — ${ROLE_LABELS[u.role] || u.role}`).join('\n')],
        ['', ''],
        ['Что внутри', 'Этот файл — данные для чтения в Excel. Полная копия всех данных со связями — в data.json рядом. Сами картинки и файлы скачиваются отдельным бекапом «Файлы».'],
        ['', ''],
        ['Работ', d.my_art_object.length],
        ['Художников', d.my_artist.length],
        ['Контактов', d.my_contact.length],
        ['Продаж', d.my_sale.length],
        ['Ссылок', d.my_collection.length],
        ['Выставок', d.my_exhibition.length],
        ['Задач', d.my_task.length],
        ['Заметок', d.my_note.length],
        ['Файлов', d.my_file.length],
    ];
    for (const r of infoRows) info.addRow(r);
    info.getRow(1).font = { bold: true, size: 14 };
    info.getColumn(1).font = { bold: true };
    info.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

    addSheet(wb, 'Работы', [
        ['Название', 'name', 30], ['Художник', 'artist', 24], ['Техника', 'technique', 22], ['Размер', 'size', 14],
        ['Год', 'year', 8], ['Медиа', 'media', 16], ['Серия', 'seria', 18], ['Статус', 'status', 18],
        ['Локация', 'location', 18], ['Цена', 'price', 12, '#,##0.00'], ['Валюта', 'currency', 8], ['Теги', 'tags', 22],
        ['Описание', 'description', 40], ['Обложка', 'avatar', 26], ['Доп. изображения', 'images', 30],
        ['Продана', 'sold', 12, 'dd.mm.yyyy'], ['Создана', 'ctime', 16, 'dd.mm.yyyy hh:mm'], ['Изменена', 'utime', 16, 'dd.mm.yyyy hh:mm'],
        ...ownerCol, ['ID', 'id', 38],
    ], d.my_art_object.map(a => ({
        name: a.name, artist: artists.get(a.artist)?.name, technique: a.technique, size: a.size, year: num(a.year),
        media: media.get(a.media)?.name, seria: series.get(a.seria)?.name, status: statuses.get(a.status)?.name,
        location: locations.get(a.location)?.name, price: num(a.price), currency: a.currency,
        tags: (tagsByArt.get(a.id) || []).map(t => tags.get(t.tag_id)?.name).filter(Boolean).join(', '),
        description: a.description, avatar: fileName(a.avatar_id),
        images: (imagesByArt.get(a.id) || []).map(i => fileName(i.file_id)).filter(Boolean).join(', '),
        sold: saleByArt.get(a.id)?.sale_date ? new Date(`${saleByArt.get(a.id).sale_date}T00:00:00Z`) : '',
        ctime: dt(a.ctime), utime: dt(a.utime), ...owner(a), id: a.id,
    })));

    const worksPerArtist = group(d.my_art_object, 'artist');
    addSheet(wb, 'Художники', [['Имя', 'name', 30], ['Работ', 'count', 10], ...ownerCol, ['ID', 'id', 38]],
        d.my_artist.map(a => ({ name: a.name, count: (worksPerArtist.get(a.id) || []).length, ...owner(a), id: a.id })));

    addSheet(wb, 'Контакты', [
        ['Имя', 'name', 26], ['Компания', 'company', 22], ['Телефон', 'phone', 18], ['Email', 'email', 24],
        ['Мессенджер', 'messenger', 18], ['Город', 'city', 14], ['День рождения', 'birthday', 14, 'dd.mm.yyyy'],
        ['Категория', 'category', 16], ['Источник', 'source', 16], ['Заметки', 'notes', 40], ['Работы', 'works', 40],
        ['Создан', 'ctime', 16, 'dd.mm.yyyy hh:mm'], ...ownerCol, ['ID', 'id', 38],
    ], d.my_contact.map(c => ({
        name: c.name, company: c.company, phone: c.phone, email: c.email, messenger: c.messenger, city: c.city,
        birthday: c.birthday ? new Date(`${c.birthday}T00:00:00Z`) : '',
        category: categories.get(c.category)?.name, source: sources.get(c.source)?.name, notes: c.notes,
        works: (worksByContact.get(c.id) || []).map(w => `${artName(w.art_id)}${w.status ? ` (${CONTACT_WORK_LABELS[w.status] || w.status})` : ''}`).join(', '),
        ctime: dt(c.ctime), ...owner(c), id: c.id,
    })));

    addSheet(wb, 'Продажи', [
        ['Дата', 'date', 12, 'dd.mm.yyyy'], ['Работа', 'art', 30], ['Художник', 'artist', 24],
        ['Цена по прайсу', 'list', 14, '#,##0.00'], ['Цена продажи', 'price', 14, '#,##0.00'], ['Валюта', 'currency', 8],
        ['Скидка', 'discount', 12], ['Комиссия, %', 'commission', 12], ['Покупатель', 'buyer', 24],
        ['Продал', 'soldBy', 20], ['Художнику выплачено', 'paid', 12], ['Комментарий', 'comment', 36], ['ID', 'id', 38],
    ], d.my_sale.map(s => ({
        date: s.sale_date ? new Date(`${s.sale_date}T00:00:00Z`) : '', art: artName(s.art_id),
        artist: artists.get(arts.get(s.art_id)?.artist)?.name, list: num(s.list_price), price: num(s.sale_price),
        currency: s.currency,
        discount: s.discount_type && s.discount_value != null ? `${Number(s.discount_value)}${s.discount_type === 'pct' ? '%' : ` ${s.currency || ''}`.trimEnd()}` : '',
        commission: num(s.commission_pct), buyer: contacts.get(s.contact_id)?.name, soldBy: personName(users.get(s.sold_by)),
        paid: s.artist_paid ? 'да' : 'нет', comment: s.comment, id: s.id,
    })));

    addSheet(wb, 'Ссылки', [
        ['Название', 'name', 30], ['Подзаголовок', 'subtitle', 24], ['Описание', 'description', 40],
        ['Работы', 'works', 50], ['Обложка', 'avatar', 24], ['Создана', 'ctime', 16, 'dd.mm.yyyy hh:mm'], ...ownerCol, ['ID', 'id', 38],
    ], d.my_collection.map(c => ({
        name: c.name, subtitle: c.subtitle, description: c.description,
        works: (worksByCollection.get(c.id) || []).map(w => artName(w.art_id)).join(', '),
        avatar: fileName(c.avatar_id), ctime: dt(c.ctime), ...owner(c), id: c.id,
    })));

    addSheet(wb, 'Выставки', [
        ['Название', 'name', 30], ['Подзаголовок', 'subtitle', 24], ['Площадка', 'venue', 22],
        ['Начало', 'start', 12, 'dd.mm.yyyy'], ['Окончание', 'end', 12, 'dd.mm.yyyy'], ['Описание', 'description', 40],
        ['Работы', 'works', 50], ['Обложка', 'avatar', 24], ...ownerCol, ['ID', 'id', 38],
    ], d.my_exhibition.map(e => ({
        name: e.name, subtitle: e.subtitle, venue: e.venue,
        start: e.start_date ? new Date(`${e.start_date}T00:00:00Z`) : '', end: e.end_date ? new Date(`${e.end_date}T00:00:00Z`) : '',
        description: e.description, works: (worksByExhibition.get(e.id) || []).map(w => artName(w.art_id)).join(', '),
        avatar: fileName(e.avatar_id), ...owner(e), id: e.id,
    })));

    addSheet(wb, 'Задачи', [
        ['Доска', 'board', 22], ['Задача', 'title', 36], ['Статус', 'status', 16], ['Исполнитель', 'assignee', 20],
        ['Срок', 'due', 12, 'dd.mm.yyyy'], ['Приоритет', 'priority', 12], ['Описание', 'description', 40],
        ['Выполнена', 'completed', 16, 'dd.mm.yyyy hh:mm'], ['Создана', 'ctime', 16, 'dd.mm.yyyy hh:mm'], ['ID', 'id', 38],
    ], d.my_task.map(t => ({
        board: boards.get(t.board_id)?.name, title: t.title, status: taskStatuses.get(t.status_id)?.name,
        assignee: personName(users.get(t.assignee_id)), due: t.due_date ? new Date(`${t.due_date}T00:00:00Z`) : '',
        priority: PRIORITY_LABELS[t.priority] || t.priority, description: htmlToText(t.description), completed: dt(t.completed_at), ctime: dt(t.ctime), id: t.id,
    })));

    addSheet(wb, 'Заметки', [
        ['Заголовок', 'title', 30], ['Художник', 'artist', 22], ['Текст', 'content', 80],
        ['Изменена', 'utime', 16, 'dd.mm.yyyy hh:mm'], ...ownerCol, ['ID', 'id', 38],
    ], d.my_note.map(n => ({
        title: n.title, artist: artists.get(n.artist_id)?.name, content: htmlToText(n.content), utime: dt(n.utime || n.ctime), ...owner(n), id: n.id,
    })));

    const dict = [];
    for (const [label, rows] of [['Медиа', d.my_media], ['Серия', d.my_seria], ['Статус работы', d.my_status],
        ['Локация', d.my_location], ['Тег', d.my_tag], ['Категория контакта', d.my_contact_category],
        ['Источник контакта', d.my_contact_source], ['Статус задачи', d.my_task_status]]) {
        for (const r of rows) dict.push({ type: label, name: r.name, color: r.color || '', ...owner(r), id: r.id });
    }
    addSheet(wb, 'Справочники', [['Тип', 'type', 22], ['Название', 'name', 30], ['Цвет', 'color', 10], ...ownerCol, ['ID', 'id', 38]], dict);

    addSheet(wb, 'Справочник ссылок', [['Ссылка', 'link', 50], ['Описание', 'description', 40], ['Художники', 'artists', 30], ['ID', 'id', 38]],
        d.my_link.map(l => ({ link: l.link, description: l.description, artists: (artistsByLink.get(l.id) || []).map(a => artists.get(a.artist_id)?.name).filter(Boolean).join(', '), id: l.id })));

    const folderPath = (id) => {
        const parts = [];
        const seen = new Set();
        let f = fileFolders.get(id);
        while (f && !seen.has(f.id)) { seen.add(f.id); parts.unshift(f.name); f = fileFolders.get(f.parent_id); }
        return parts.join(' / ');
    };
    addSheet(wb, 'Файлы', [
        ['Папка', 'folder', 30], ['Название', 'name', 36], ['Тип', 'ext', 8], ['Размер, КБ', 'size', 12, '#,##0'],
        ['Комментарий', 'comment', 30], ['Загружен', 'ctime', 16, 'dd.mm.yyyy hh:mm'], ...ownerCol, ['ID', 'id', 38],
    ], d.my_file.map(f => ({
        folder: folderPath(f.folder_id), name: fileName(f.id), ext: f.ext, size: f.size ? Math.round(f.size / 1024) : '',
        comment: f.comment, ctime: dt(f.ctime), ...owner(f), id: f.id,
    })));

    addSheet(wb, 'Био и CV', [['Тип', 'type', 10], ['Заголовок', 'title', 30], ['Текст', 'text', 100], ['Изменён', 'utime', 16, 'dd.mm.yyyy hh:mm']], [
        ...d.my_biography.map(b => ({ type: 'Био', title: b.title, text: htmlToText(b.biography), utime: dt(b.utime || b.ctime) })),
        ...d.my_cv.map(c => ({ type: 'CV', title: c.title, text: htmlToText(c.cv), utime: dt(c.utime || c.ctime) })),
    ]);

    return wb.xlsx.writeBuffer();
}

// ===================== Общие утилиты =====================

const safeName = (s, fallback = 'file') => {
    const v = String(s ?? '').replace(/[\\/:*?"<>|]+/g, '_')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f]+/g, '').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
    return (v || fallback).slice(0, 150);
};
const dateStamp = (d = new Date()) => d.toISOString().slice(0, 10);
const archiveBaseName = (target, kind) => `artcrm-${kind}-${safeName(personName(target.f) || target.f.id, 'user').replace(/ /g, '_')}-${dateStamp()}`;

/** Собрать ZIP целиком в память (для небольшого бекапа «Данные») */
function zipToBuffer(entries) {
    return new Promise((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 6 } });
        const chunks = [];
        archive.on('data', (c) => chunks.push(c));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);
        for (const [name, content] of entries) archive.append(content, { name });
        archive.finalize();
    });
}

// ===================== Бекап «Файлы» (фон) =====================

const metaPath = (targetId) => path.join(BACKUP_DIR, `${targetId}.json`);
const zipPath = (token) => path.join(BACKUP_DIR, `${token}.zip`);

function readMeta(targetId) {
    try {
        return JSON.parse(fs.readFileSync(metaPath(targetId), 'utf8'));
    } catch {
        return null;
    }
}

function writeMeta(targetId, meta) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const tmp = `${metaPath(targetId)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(meta, null, 2));
    fs.renameSync(tmp, metaPath(targetId));
}

function removeZip(token) {
    if (token && TOKEN_RE.test(token)) fs.rm(zipPath(token), { force: true }, () => {});
    if (token && TOKEN_RE.test(token)) fs.rm(`${zipPath(token)}.part`, { force: true }, () => {});
}

// Один фоновый бекап за раз на весь сервер — архивация гигабайтов не
// должна отнимать диск/CPU у API сразу несколькими процессами.
let queue = Promise.resolve();
const running = new Set();

/** Файлы пользователей + путь внутри архива с учётом папок */
async function filesForArchive(userIds) {
    const files = await q('SELECT id, name, filename, ext, size, folder_id FROM my_file WHERE user_id = ANY($1) ORDER BY ctime, id', [userIds]);
    const folders = byId(await q('SELECT id, name, parent_id FROM my_file_folder WHERE user_id = ANY($1)', [userIds]));
    const folderPath = (id) => {
        const parts = [];
        const seen = new Set();
        let f = folders.get(id);
        while (f && !seen.has(f.id)) { seen.add(f.id); parts.unshift(safeName(f.name, 'Папка')); f = folders.get(f.parent_id); }
        return parts.join('/');
    };
    const used = new Set();
    return files.map((f) => {
        const ext = f.ext ? String(f.ext).replace(/[^0-9a-z]/gi, '') : '';
        let base = safeName(f.name || f.filename, f.id);
        if (ext && base.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) base = base.slice(0, -(ext.length + 1)) || f.id;
        const dir = folderPath(f.folder_id);
        let name = `${dir ? dir + '/' : ''}${base}${ext ? '.' + ext : ''}`;
        for (let i = 2; used.has(name.toLowerCase()); i++) name = `${dir ? dir + '/' : ''}${base} (${i})${ext ? '.' + ext : ''}`;
        used.add(name.toLowerCase());
        return { id: f.id, size: Number(f.size) || 0, source: path.join(FILES_DIR, `${f.id}${f.ext ? '.' + f.ext : ''}`), name };
    });
}

async function runFilesBackup(target, userIds, actor, token) {
    const targetId = target.f.id;
    const meta = readMeta(targetId);
    writeMeta(targetId, { ...meta, status: 'running', startedAt: new Date().toISOString() });

    const part = `${zipPath(token)}.part`;
    try {
        const list = await filesForArchive(userIds);
        const totalBytes = list.reduce((s, f) => s + f.size, 0);
        const st = await fs.promises.statfs(BACKUP_DIR);
        if (st.bavail * st.bsize < totalBytes + DISK_RESERVE_BYTES) {
            throw new Error('На сервере недостаточно места для архива — обратитесь к администратору');
        }

        const missing = [];
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(part);
            // Картинки и видео уже сжаты — store экономит CPU и почти не теряет в размере
            const archive = archiver('zip', { store: true });
            out.on('close', resolve);
            out.on('error', reject);
            archive.on('error', reject);
            archive.on('warning', (err) => console.warn('[backup] warning:', err.message));
            archive.pipe(out);
            for (const f of list) {
                if (fs.existsSync(f.source)) archive.file(f.source, { name: `files/${f.name}` });
                else missing.push(f.name);
            }
            const readme = [
                `Бекап файлов ART CRM — ${personName(target.f)}`,
                `Создан: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}`,
                `Файлов: ${list.length - missing.length}`,
                '',
                'Файлы лежат в папке files/ в той же структуре папок, что в разделе «Файлы».',
                'Какой файл к какой работе относится — смотрите в данные.xlsx из бекапа «Данные» (лист «Работы», колонки «Обложка» и «Доп. изображения»).',
                ...(missing.length ? ['', `Не найдено на сервере (${missing.length}):`, ...missing] : []),
            ].join('\n');
            archive.append(readme, { name: 'README.txt' });
            archive.finalize();
        });

        await fs.promises.rename(part, zipPath(token));
        const size = (await fs.promises.stat(zipPath(token))).size;
        const finishedAt = new Date();
        writeMeta(targetId, {
            ...readMeta(targetId), status: 'ready', size, filesCount: list.length - missing.length, missingCount: missing.length,
            finishedAt: finishedAt.toISOString(), expiresAt: new Date(finishedAt.getTime() + BACKUP_TTL_MS).toISOString(),
        });
        await NotificationService.notify({
            userId: actor.f.id, type: 'backup_ready', title: 'Бекап файлов готов',
            body: actor.f.id === targetId
                ? 'Архив можно скачать в разделе «Бекап» в течение 24 часов'
                : `Архив файлов «${personName(target.f)}» можно скачать в админ-панели в течение 24 часов`,
            link: actor.f.id === targetId ? '/home/backup' : '/home/admin', allowSelf: true,
        });
    } catch (err) {
        console.error('[backup] files backup failed:', err);
        fs.rm(part, { force: true }, () => {});
        writeMeta(targetId, { ...readMeta(targetId), status: 'failed', error: err.message, finishedAt: new Date().toISOString() });
        await NotificationService.notify({
            userId: actor.f.id, type: 'backup_failed', title: 'Не удалось сделать бекап файлов',
            body: err.message, link: actor.f.id === targetId ? '/home/backup' : '/home/admin', allowSelf: true,
        });
    } finally {
        running.delete(targetId);
    }
}

/** Публичное состояние бекапа файлов (без пути на диске) */
function publicFilesState(meta) {
    if (!meta) return null;
    const expired = meta.status === 'ready' && meta.expiresAt && new Date(meta.expiresAt) < new Date();
    return {
        status: expired ? 'expired' : meta.status,
        requestedAt: meta.requestedAt,
        finishedAt: meta.finishedAt || null,
        expiresAt: meta.expiresAt || null,
        size: meta.size || null,
        filesCount: meta.filesCount ?? null,
        missingCount: meta.missingCount ?? null,
        error: meta.status === 'failed' ? meta.error : null,
        downloadUrl: meta.status === 'ready' && !expired ? `/api/v1/backup/download/${meta.token}` : null,
    };
}

// ===================== Сервис =====================

export default class BackupService {
    /**
     * Что доступно пользователю: можно ли делать бекап, сколько файлов,
     * состояние последнего бекапа файлов.
     */
    static async status(actor, targetUserId) {
        const target = await resolveTarget(actor, targetUserId);
        const scope = await backupScope(target);
        if (!scope.allowed) return { allowed: false, reason: scope.reason };
        const [stats] = await q('SELECT count(*)::int AS count, COALESCE(sum(size), 0)::bigint AS bytes FROM my_file WHERE user_id = ANY($1)', [scope.userIds]);
        return {
            allowed: true,
            userId: target.f.id,
            name: personName(target.f),
            role: target.f.role,
            usersCount: scope.userIds.length,
            filesCount: stats.count,
            filesBytes: Number(stats.bytes),
            files: publicFilesState(readMeta(target.f.id)),
        };
    }

    /** Бекап «Данные»: { buffer, filename } — ZIP с данные.xlsx и data.json */
    static async getDataBackup(actor, targetUserId) {
        const { target, userIds } = await resolveAllowed(actor, targetUserId);
        const createdAt = new Date().toISOString();
        const data = await collectData(userIds);
        const xlsx = await buildXlsx(data, { createdAt, target: target.f });
        const json = JSON.stringify({
            format: 'artcrm-backup',
            version: 1,
            createdAt,
            account: { id: target.f.id, role: target.f.role, name: personName(target.f) },
            userIds,
            tables: data,
        }, null, 2);
        const readme = [
            `Бекап данных ART CRM — ${personName(target.f)}`,
            `Создан: ${new Date(createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}`,
            '',
            'данные.xlsx — все данные для просмотра в Excel (работы, художники, контакты, продажи, ссылки, выставки, задачи, заметки, справочники, список файлов).',
            'data.json — полная копия всех записей со связями (id), для восстановления или переноса.',
            'Сами картинки и файлы — в отдельном бекапе «Файлы».',
        ].join('\n');
        const buffer = await zipToBuffer([['данные.xlsx', Buffer.from(xlsx)], ['data.json', json], ['README.txt', readme]]);

        await AuditLogModel.log(actor.f.id, target.f.id, 'backup_data', { users: userIds.length, works: data.my_art_object.length })
            .catch((e) => console.error('[backup] audit log failed:', e));
        return { buffer, filename: `${archiveBaseName(target, 'data')}.zip` };
    }

    /** Запустить фоновый бекап «Файлы» */
    static async startFilesBackup(actor, targetUserId) {
        const { target, userIds } = await resolveAllowed(actor, targetUserId);
        const targetId = target.f.id;
        if (running.has(targetId)) throw new Error('Бекап файлов уже собирается — дождитесь уведомления');

        // предыдущий архив больше не нужен
        const prev = readMeta(targetId);
        if (prev?.token) removeZip(prev.token);

        const token = crypto.randomBytes(32).toString('hex');
        writeMeta(targetId, {
            status: 'queued', token, targetId, requestedBy: actor.f.id, requestedAt: new Date().toISOString(),
            downloadName: `${archiveBaseName(target, 'files')}.zip`,
        });
        running.add(targetId);
        await AuditLogModel.log(actor.f.id, targetId, 'backup_files', { users: userIds.length })
            .catch((e) => console.error('[backup] audit log failed:', e));

        queue = queue.then(() => runFilesBackup(target, userIds, actor, token));
        return BackupService.status(actor, targetUserId);
    }

    /**
     * Найти готовый архив по токену из ссылки. Токен — 256 бит случайности,
     * поэтому ссылка работает без авторизации (браузер качает файл сам,
     * без загрузки гигабайтов в память страницы).
     * @return {{ path, size, downloadName }|null}
     */
    static findDownload(token) {
        if (!TOKEN_RE.test(String(token || ''))) return null;
        let files = [];
        try {
            files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
        } catch {
            return null;
        }
        for (const f of files) {
            const meta = readMeta(f.slice(0, -5));
            if (meta?.token !== token || meta.status !== 'ready') continue;
            if (meta.expiresAt && new Date(meta.expiresAt) < new Date()) return null;
            const p = zipPath(token);
            if (!fs.existsSync(p)) return null;
            return { path: p, size: fs.statSync(p).size, downloadName: meta.downloadName || 'artcrm-files.zip' };
        }
        return null;
    }

    /**
     * Обслуживание папки бекапов: при старте — пометить прерванные рестартом
     * бекапы как неудавшиеся; периодически — удалить просроченные архивы.
     */
    static cleanup({ onStart = false } = {}) {
        let names = [];
        try {
            names = fs.readdirSync(BACKUP_DIR);
        } catch {
            return;
        }
        const now = Date.now();
        for (const n of names) {
            if (n.endsWith('.part') && onStart) fs.rm(path.join(BACKUP_DIR, n), { force: true }, () => {});
            if (!n.endsWith('.json')) continue;
            const targetId = n.slice(0, -5);
            const meta = readMeta(targetId);
            if (!meta) continue;
            if (onStart && (meta.status === 'queued' || meta.status === 'running')) {
                removeZip(meta.token);
                writeMeta(targetId, { ...meta, status: 'failed', error: 'Сервер был перезапущен во время сборки архива — запустите бекап ещё раз', finishedAt: new Date().toISOString() });
            } else if (meta.status === 'ready' && meta.expiresAt && new Date(meta.expiresAt).getTime() < now) {
                removeZip(meta.token);
                writeMeta(targetId, { ...meta, status: 'expired' });
            }
        }
    }
}
