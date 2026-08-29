import CollectionService from '../bll/services/CollectionService.js';
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

            return reply.view('collection.ejs', {
                collection,
                works,
                artistName,
                coverImage,
                workWord: workWord(works.length),
                ogDescription,
                pageUrl,
                icons,
                isFieldVisible: (key) => isFieldVisible(collection.visibleFields, key),
                formatPrice: (price, workCurrency) => formatPrice(price, workCurrency, collection),
            });
        } catch (error) {
            request.log.error(error);
            reply.code(500).send('Internal Server Error');
        }
    }
}
