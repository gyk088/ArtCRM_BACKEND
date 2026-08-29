import PublicPageController from '../../controllers/publicPage.js'

// Серверно рендерённые публичные HTML-страницы — без /api/v1 префикса,
// т.к. это не JSON API, а страницы для браузера/шаринга в мессенджерах.
export default async function publicPageRoutes(fastify, _options) {
    fastify.get('/collection/:id', PublicPageController.collectionLanding)
}
