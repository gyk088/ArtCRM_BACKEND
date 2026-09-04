import CollectionService from '../bll/services/CollectionService.js';
import ExhibitionService from '../bll/services/ExhibitionService.js';
import { icons } from '../bll/utils/svgIcons.js';

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function workWord(count) {
    const n = count % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return 'работ';
    if (n1 === 1) return 'работа';
    if (n1 >= 2 && n1 <= 4) return 'работы';
    return 'работ';
}

function isFieldVisible(visibleFields, key) {
    return !visibleFields || visibleFields[key] !== false;
}

const CURRENCY_SYMBOLS = { RUB: '₽', BYN: 'Br', USD: '$', EUR: '€' };

function hexToRgba(hex, alpha) {
    const clean = (hex || '').replace('#', '');
    if (clean.length !== 6) return null;
    const bigint = parseInt(clean, 16);
    if (Number.isNaN(bigint)) return null;
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Инлайн-стиль пилюли статуса — зеркалит getStatusColorStyle() из
// UserPictures/index.vue на фронте (та же тонировка/бордер/текст цветом
// статуса), чтобы выглядело одинаково и в CRM, и на публичной странице.
function statusPillStyle(color) {
    const tint = hexToRgba(color, 0.12);
    if (!tint) return '';
    return `background:${tint};color:${color};border-color:${color};`;
}

// Округление до шага (напр. 10 -> ...120, 130...; 1 -> целые числа).
function roundToStep(value, step) {
    const s = Number(step) > 0 ? Number(step) : 1;
    return Math.round(value / s) * s;
}

// Если у ссылки задана переопределённая валюта показа (display_currency) —
// цена работы (в её родной валюте) пересчитывается по заданному курсу и
// округлению и показывается в этой валюте; иначе показывается как есть,
// в собственной валюте работы.
function formatPrice(price, workCurrency, collection) {
    const num = Number(price);
    if (Number.isNaN(num)) return price;

    let value = num;
    let currency = workCurrency || 'RUB';

    if (collection?.displayCurrency) {
        const rate = Number(collection.currencyRate) > 0 ? Number(collection.currencyRate) : 1;
        const rounding = Number(collection.currencyRounding) > 0 ? Number(collection.currencyRounding) : 1;
        value = roundToStep(num * rate, rounding);
        currency = collection.displayCurrency;
    }

    const symbol = CURRENCY_SYMBOLS[currency] || CURRENCY_SYMBOLS.RUB;
    return new Intl.NumberFormat('ru-RU').format(value) + ' ' + symbol;
}

const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function formatDate(d) {
    return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateShort(d) {
    return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
}

// Человекочитаемый диапазон дат для мета-строки в hero и og:description —
// "1–30 сентября 2026", "15 августа – 10 сентября 2026", "с 1 сентября 2026" и т.п.
function formatDateRange(startDate, endDate) {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (!start && !end) return '';
    if (start && !end) return `С ${formatDate(start)}`;
    if (!start && end) return `По ${formatDate(end)}`;

    if (start.getTime() === end.getTime()) return formatDate(start);

    if (start.getFullYear() === end.getFullYear()) {
        if (start.getMonth() === end.getMonth()) {
            return `${start.getDate()}–${end.getDate()} ${MONTHS_RU[start.getMonth()]} ${start.getFullYear()}`;
        }
        return `${formatDateShort(start)} – ${formatDate(end)}`;
    }

    return `${formatDate(start)} – ${formatDate(end)}`;
}

export default class PublicPageController {
    // Серверный рендер публичной страницы ссылки (замена клиентского
    // CollectionLanding.vue) — переиспользует тот же CollectionService,
    // что и JSON-версия /api/v1/collections/public/:id.
    static async collectionLanding(request, reply) {
        try {
            const { id } = request.params;
            const collection = await CollectionService.getPublicCollection(id).catch(() => null);

            if (!collection) {
                return reply.code(404).view('collection-not-found.ejs');
            }

            const works = collection.works || [];
            const artistName = collection.artistOrGallery || '';
            const withAvatar = works.find(w => w.avatar && w.avatar.url);
            const heroImage = (withAvatar && withAvatar.avatar.url) || '';
            const coverImage = (collection.avatar && collection.avatar.url) || heroImage || '';
            const description = stripHtml(collection.description);
            // Количество работ должно быть видно в превью ссылки (например, при
            // пересылке в Telegram) всегда, а не только когда у ссылки нет
            // собственного описания — иначе оно пряталось за текстом описания.
            const workCountText = `${works.length} ${workWord(works.length)}`;
            const ogDescription = (description ? `${workCountText} · ${description}` : workCountText).slice(0, 160);
            const pageUrl = `${request.protocol}://${request.headers.host}${request.url}`;

            // Список художников для фильтра на странице — только те, что реально
            // встречаются среди работ этой ссылки, без дублей, по алфавиту.
            const distinctArtists = [...new Set(works.map(w => w.artist_name).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'ru'));

            return reply.view('collection.ejs', {
                collection,
                works,
                artistName,
                coverImage,
                workWord: workWord(works.length),
                ogDescription,
                pageUrl,
                icons,
                distinctArtists,
                isFieldVisible: (key) => isFieldVisible(collection.visibleFields, key),
                formatPrice: (price, workCurrency) => formatPrice(price, workCurrency, collection),
                statusPillStyle,
            });
        } catch (error) {
            request.log.error(error);
            reply.code(500).send('Internal Server Error');
        }
    }

    // Серверный рендер публичной страницы выставки — та же схема, что у
    // ссылки (переиспользует collection.css/collection.js целиком, т.к.
    // сетка работ/сортировка/фильтр/просмотрщик один в один), плюс галерея
    // фото события и мета-строка с датами/местом проведения.
    static async exhibitionLanding(request, reply) {
        try {
            const { id } = request.params;
            const exhibition = await ExhibitionService.getPublicExhibition(id).catch(() => null);

            if (!exhibition) {
                return reply.code(404).view('exhibition-not-found.ejs');
            }

            const works = exhibition.works || [];
            const photos = exhibition.photos || [];
            const artistName = exhibition.artistOrGallery || '';
            const withAvatar = works.find(w => w.avatar && w.avatar.url);
            const heroImage = (withAvatar && withAvatar.avatar.url) || (photos[0] && photos[0].file.url) || '';
            const coverImage = (exhibition.avatar && exhibition.avatar.url) || heroImage || '';
            const description = stripHtml(exhibition.description);
            const dateRangeText = formatDateRange(exhibition.startDate, exhibition.endDate);
            const workCountText = `${works.length} ${workWord(works.length)}`;

            const metaLine = [dateRangeText, exhibition.venue].filter(Boolean).join(' · ');
            const ogDescription = (
                metaLine
                    ? (description ? `${metaLine} · ${description}` : metaLine)
                    : (description ? `${workCountText} · ${description}` : workCountText)
            ).slice(0, 160);
            const pageUrl = `${request.protocol}://${request.headers.host}${request.url}`;

            const heroMetaParts = [dateRangeText, exhibition.venue, artistName].filter(Boolean);

            const distinctArtists = [...new Set(works.map(w => w.artist_name).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'ru'));

            return reply.view('exhibition.ejs', {
                exhibition,
                works,
                photos,
                artistName,
                coverImage,
                dateRangeText,
                heroMetaParts,
                workWord: workWord(works.length),
                ogDescription,
                pageUrl,
                icons,
                distinctArtists,
                isFieldVisible: (key) => isFieldVisible(exhibition.visibleFields, key),
                formatPrice: (price, workCurrency) => formatPrice(price, workCurrency, exhibition),
                statusPillStyle,
            });
        } catch (error) {
            request.log.error(error);
            reply.code(500).send('Internal Server Error');
        }
    }
}
