import ExcelJS from 'exceljs';
import { Buffer } from 'node:buffer';
import { PgObject } from 'pgobject';
import ReportService from './ReportService.js';

const MONEY_FMT = '#,##0.00';
const RATE_FMT = '0.0000##';
const PCT_FMT = '0.00"%"';
const DATE_FMT = 'dd.mm.yyyy';
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFECE4' } };

const DISCOUNT_LABELS = { any: 'все', none: 'без скидки', with: 'со скидкой' };
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// 'YYYY-MM-DD' -> Date в UTC-полночь: Excel хранит даты без часового пояса,
// так дата в ячейке совпадёт с датой продажи на любом сервере
const toExcelDate = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);
const fmtDate = (s) => (s ? s.split('-').reverse().join('.') : '');
const personName = (p) => (p ? [p.name, p.surname].filter(Boolean).join(' ') : '');

function styleHeader(row) {
    row.font = { bold: true };
    row.fill = HEADER_FILL;
    row.alignment = { vertical: 'middle', wrapText: true };
}

/**
 * Выгрузка отчёта в .xlsx — те же данные, что на экране (ReportService.compute),
 * с настоящими датами и числами (их можно сортировать и считать формулами).
 * Листы: «Продажи», «Сводка», «Параметры» (фильтры и использованные курсы).
 */
export default class ReportExportService {
    static async buildXlsx(id, actorUser) {
        const { report, rows, summary } = await ReportService.compute(id, actorUser);
        const cur = report.currency;

        const wb = new ExcelJS.Workbook();
        wb.creator = 'ArtCRM';
        wb.created = new Date();

        // ---------- Продажи ----------
        const ws = wb.addWorksheet('Продажи', { views: [{ state: 'frozen', ySplit: 1 }] });
        ws.columns = [
            { header: 'Дата продажи', key: 'date', width: 13, style: { numFmt: DATE_FMT } },
            { header: 'Работа', key: 'art', width: 32 },
            { header: 'Художник', key: 'artist', width: 22 },
            { header: 'Год', key: 'year', width: 7 },
            { header: 'Серия', key: 'seria', width: 18 },
            { header: 'Медиа', key: 'media', width: 16 },
            { header: 'Цена работы', key: 'list', width: 15, style: { numFmt: MONEY_FMT } },
            { header: 'Цена продажи', key: 'sale', width: 15, style: { numFmt: MONEY_FMT } },
            { header: 'Валюта сделки', key: 'currency', width: 10 },
            { header: 'Скидка, %', key: 'discount', width: 10, style: { numFmt: PCT_FMT } },
            { header: 'Скидка, сумма', key: 'discount_amount', width: 14, style: { numFmt: MONEY_FMT } },
            { header: `Курс к ${cur}`, key: 'rate', width: 11, style: { numFmt: RATE_FMT } },
            { header: `Цена работы, ${cur}`, key: 'list_conv', width: 15, style: { numFmt: MONEY_FMT } },
            { header: `Продажа, ${cur}`, key: 'sale_conv', width: 15, style: { numFmt: MONEY_FMT } },
            { header: 'Покупатель', key: 'buyer', width: 22 },
            { header: 'Оформил(а)', key: 'sold_by', width: 20 },
            { header: 'Комментарий', key: 'comment', width: 30 },
        ];
        styleHeader(ws.getRow(1));

        for (const r of rows) {
            const row = ws.addRow({
                date: toExcelDate(r.sale_date),
                art: r.art_name,
                artist: r.artist?.name || '',
                year: r.art_year ?? null,
                seria: r.seria?.name || '',
                media: r.media?.name || '',
                list: r.list_price,
                sale: r.sale_price,
                currency: r.currency,
                discount: r.discount_pct,
                discount_amount: r.discount_amount,
                rate: r.rate,
                list_conv: r.list_price_converted,
                sale_conv: r.sale_price_converted,
                buyer: r.contact?.name || '',
                sold_by: personName(r.sold_by),
                comment: r.comment || '',
            });
            // Нет курса — подсвечиваем, чтобы было видно, почему строка не в итоге
            if (r.rate === null) {
                row.getCell('rate').value = 'нет курса';
                row.getCell('rate').font = { color: { argb: 'FFB4441C' } };
            }
        }

        if (rows.length) {
            const first = 2;
            const last = rows.length + 1;
            const totalRow = ws.addRow({ art: 'Итого (с курсом)' });
            totalRow.font = { bold: true };
            for (const key of ['list_conv', 'sale_conv']) {
                const col = ws.getColumn(key).letter;
                totalRow.getCell(key).value = { formula: `SUM(${col}${first}:${col}${last})` };
            }
            ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: last, column: ws.columns.length } };
        }

        // ---------- Сводка ----------
        const ss = wb.addWorksheet('Сводка');
        ss.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
        const title = ss.addRow([report.name]);
        title.font = { bold: true, size: 14 };
        ss.addRow([`Валюта отчёта: ${cur}`]);
        ss.addRow([]);

        const kv = (label, value, fmt) => {
            const row = ss.addRow([label, value]);
            if (fmt) row.getCell(2).numFmt = fmt;
            return row;
        };
        kv('Продаж', summary.count);
        kv(`Выручка, ${cur}`, summary.total, MONEY_FMT).font = { bold: true };
        kv(`Средний чек, ${cur}`, summary.avg_check, MONEY_FMT);
        kv('Средняя скидка, %', summary.avg_discount_pct, PCT_FMT);
        kv(`Сумма скидок, ${cur}`, summary.discount_amount, MONEY_FMT);
        if (summary.missing_rates.length) {
            const warn = ss.addRow([
                'Не вошли в итог (нет курса): ' +
                summary.missing_rates.map(m => `${m.currency} — ${m.count}`).join(', '),
            ]);
            warn.font = { color: { argb: 'FFB4441C' }, bold: true };
        }

        const table = (heading, headers, data) => {
            ss.addRow([]);
            ss.addRow([heading]).font = { bold: true, size: 12 };
            styleHeader(ss.addRow(headers));
            for (const values of data) ss.addRow(values.map(v => v.value)).eachCell((cell, i) => {
                if (values[i - 1]?.fmt) cell.numFmt = values[i - 1].fmt;
            });
        };

        table('По валютам сделок', ['Валюта', 'Продаж', 'Сумма в валюте', `Курс к ${cur}`, `Сумма, ${cur}`],
            summary.by_currency.map(g => [
                { value: g.currency },
                { value: g.count },
                { value: g.total_original, fmt: MONEY_FMT },
                { value: g.rate ?? 'нет курса', fmt: g.rate ? RATE_FMT : null },
                { value: g.rate ? g.total : null, fmt: MONEY_FMT },
            ]));
        table('По художникам', ['Художник', 'Продаж', `Сумма, ${cur}`, 'Без курса'],
            summary.by_artist.map(g => [
                { value: g.artist?.name || 'Не указан' },
                { value: g.count },
                { value: g.total, fmt: MONEY_FMT },
                { value: g.count_without_rate || null },
            ]));
        table('По месяцам', ['Месяц', 'Продаж', `Сумма, ${cur}`, 'Без курса'],
            summary.by_month.map(g => {
                const [y, m] = g.month.split('-');
                return [
                    { value: `${MONTHS[Number(m) - 1]} ${y}` },
                    { value: g.count },
                    { value: g.total, fmt: MONEY_FMT },
                    { value: g.count_without_rate || null },
                ];
            }));

        // ---------- Параметры ----------
        const ps = wb.addWorksheet('Параметры');
        ps.columns = [{ width: 26 }, { width: 60 }];
        const names = await ReportExportService.__resolveFilterNames(report.filters);
        const f = report.filters;
        const params = [
            ['Отчёт', report.name],
            ['Валюта отчёта', cur],
            ['Сформирован', new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })],
            ['Период', `${f.date_from ? fmtDate(f.date_from) : 'с начала'} — ${f.date_to ? fmtDate(f.date_to) : 'по сегодня'}`],
            ['Художники', names.artists || 'все'],
            ['Серии', names.series || 'все'],
            ['Медиа', names.media || 'все'],
            ['Покупатели', names.contacts || 'все'],
            ['Оформили', names.sold_by || 'все'],
            ['Валюты сделок', f.currencies.length ? f.currencies.join(', ') : 'все'],
            ['Скидка', DISCOUNT_LABELS[f.discount] +
                (f.discount_min !== null || f.discount_max !== null
                    ? `, от ${f.discount_min ?? '—'}% до ${f.discount_max ?? '—'}%` : '')],
            [`Цена продажи, ${cur}`, f.price_min !== null || f.price_max !== null
                ? `от ${f.price_min ?? '—'} до ${f.price_max ?? '—'}` : 'любая'],
        ];
        styleHeader(ps.addRow(['Параметр', 'Значение']));
        params.forEach(p => ps.addRow(p));

        ps.addRow([]);
        styleHeader(ps.addRow(['Курс', `Единиц ${cur} за 1 единицу`]));
        ps.addRow([cur, 1]);
        for (const [currency, rate] of Object.entries(report.rates).sort()) {
            ps.addRow([currency, rate]).getCell(2).numFmt = RATE_FMT;
        }

        const buffer = await wb.xlsx.writeBuffer();
        return { buffer: Buffer.from(buffer), filename: `${report.name}.xlsx` };
    }

    // id из фильтров -> "Имя 1, Имя 2" для листа «Параметры»
    static async __resolveFilterNames(filters) {
        const lookup = async (table, ids, nameSql = 'name') => {
            if (!ids.length) return '';
            const res = await PgObject.query(`SELECT ${nameSql} AS name FROM ${table} WHERE id = ANY($1::uuid[])`, [ids]);
            return res.rows.map(r => r.name).filter(Boolean).join(', ');
        };
        return {
            artists: await lookup('my_artist', filters.artists),
            series: await lookup('my_seria', filters.series),
            media: await lookup('my_media', filters.media),
            contacts: await lookup('my_contact', filters.contacts),
            sold_by: await lookup('my_user', filters.sold_by, "concat_ws(' ', name, surname)"),
        };
    }
}
