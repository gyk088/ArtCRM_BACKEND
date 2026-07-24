import LinkController from '../../../controllers/link.js'
import auth from '../../../hooks/preHendler.js';        

export default async function linkRoutes(fastify, options) {
    // Link CRUD routes
    fastify.post('/', {preHandler: [auth()]},  LinkController.createLink);
    fastify.post('/validated', {preHandler: [auth()]}, LinkController.createLinkWithValidation);
    fastify.get('/', {preHandler: [auth()]}, LinkController.getAllLinks);
    fastify.get('/user/:userId', {preHandler: [auth()]}, LinkController.getLinksByUserId);
    fastify.get('/search', {preHandler: [auth()]}, LinkController.searchLinks);
    fastify.get('/statistics', {preHandler: [auth()]}, LinkController.getLinksStatistics);
    fastify.get('/most-used', {preHandler: [auth()]}, LinkController.getMostUsedLinks);
    fastify.get('/unused', {preHandler: [auth()]}, LinkController.getUnusedLinks);
    fastify.get('/url/:url', {preHandler: [auth()]}, LinkController.getLinkByUrl);
    fastify.get('/:id', {preHandler: [auth()]}, LinkController.getLinkById);
    fastify.get('/:id/complete', {preHandler: [auth()]}, LinkController.getCompleteLinkInfo);
    fastify.put('/', {preHandler: [auth()]}, LinkController.updateLink);
    fastify.delete('/:id', {preHandler: [auth()]}, LinkController.deleteLink);
    
    //  User stats routes
    fastify.get('/users/:userId/links-stats', {preHandler: [auth()]}, LinkController.getUserLinksWithStats);
    
    // Art object - Link relations routes
    fastify.post('/art-objects/:artId/links/:linkId', {preHandler: [auth()]}, LinkController.addLinkToArtObject);
    fastify.delete('/art-objects/:artId/links/:linkId', {preHandler: [auth()]}, LinkController.removeLinkFromArtObject);
    fastify.get('/art-objects/:artId/links', {preHandler: [auth()]}, LinkController.getLinksByArtObjectId);
    fastify.get('/:linkId/art-objects', {preHandler: [auth()]}, LinkController.getArtObjectsByLinkId);
    fastify.post('/art-objects/:artId/links/bulk', {preHandler: [auth()]}, LinkController.bulkAddLinksToArtObject);
    fastify.delete('/art-objects/:artId/links', {preHandler: [auth()]}, LinkController.removeAllLinksFromArtObject);
    
    //  Advanced operations routes
    fastify.get('/art-objects/:artId/complete-with-links', {preHandler: [auth()]}, LinkController.getCompleteArtObjectWithLinks);
    fastify.post('/art-objects/:sourceArtId/copy-links/:targetArtId', {preHandler: [auth()]}, LinkController.copyLinksFromArtToArt);
    fastify.post('/art-objects/:sourceArtId/move-links/:targetArtId', {preHandler: [auth()]}, LinkController.moveLinksFromArtToArt);
    
    // Validation route
    fastify.post('/validate', {preHandler: [auth()]}, LinkController.validateLinkUrl);
}