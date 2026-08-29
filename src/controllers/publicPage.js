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

function formatPrice(price) {
    const num = Number(price);
    if (Number.isNaN(num)) return price;
    return new Intl.NumberFormat('ru-RU').format(num) + ' ₽';
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
            const ogDescription = (description || `${works.length} работ`).slice(0, 160);
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
                formatPrice,
            });
        } catch (error) {
            request.log.error(error);
            reply.code(500).send('Internal Server Error');
        }
    }
}
