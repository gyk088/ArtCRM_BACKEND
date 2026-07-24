import ArtController from '../../../controllers/art.js'
import auth from '../../../hooks/preHendler.js'; 

export default async function artRoutes(fastify, _options) {   
    // Art Object routes
    fastify.post('/art-objects', {preHandler: [auth()]}, ArtController.createArtObject);
    fastify.get('/art-objects', {preHandler: [auth()]}, ArtController.getAllArtObjects);
    fastify.get('/art-objects/filters', {preHandler: [auth()]}, ArtController.getArtObjectsByFilters);
    fastify.get('/art-objects/search', {preHandler: [auth()]}, ArtController.searchArtObjects);
    fastify.get('/art-objects/statistics', {preHandler: [auth()]}, ArtController.getArtObjectsStatistics);
    fastify.get('/art-objects/user/:userId', {preHandler: [auth()]}, ArtController.getArtObjectsByUserId);
    fastify.get('/art-objects/:id', {preHandler: [auth()]}, ArtController.getArtObjectById);
    fastify.get('/art-objects/:id/details', {preHandler: [auth()]}, ArtController.getArtObjectWithDetails);
    fastify.get('/art-objects/:id/complete', {preHandler: [auth()]}, ArtController.getCompleteArtObjectInfo);
    fastify.put('/art-objects/:id', {preHandler: [auth()]}, ArtController.updateArtObjectPartial);
    fastify.put('/art-objects', {preHandler: [auth()]}, ArtController.updateArtObject);
    fastify.delete('/art-objects/:id', {preHandler: [auth()]}, ArtController.deleteArtObject);
    
    // Media routes
    fastify.post('/media', {preHandler: [auth()]},ArtController.createMedia);
    fastify.get('/media', {preHandler: [auth()]}, ArtController.getAllMedia);
    fastify.get('/media/user/:userId', {preHandler: [auth()]}, ArtController.getMediaByUserId);
    fastify.get('/media/:id', {preHandler: [auth()]}, ArtController.getMediaById);
    fastify.put('/media', {preHandler: [auth()]}, ArtController.updateMedia);
    fastify.delete('/media/:id', {preHandler: [auth()]}, ArtController.deleteMedia);
    
    // Seria routes
    fastify.post('/serias', {preHandler: [auth()]}, ArtController.createSeria);
    fastify.get('/serias', {preHandler: [auth()]}, ArtController.getAllSerias);
    fastify.get('/serias/user/:userId', {preHandler: [auth()]}, ArtController.getSeriaByUserId);
    fastify.get('/serias/:id', {preHandler: [auth()]}, ArtController.getSeriaById);
    fastify.put('/serias', {preHandler: [auth()]}, ArtController.updateSeria);
    fastify.delete('/serias/:id', {preHandler: [auth()]}, ArtController.deleteSeria);
    
    // Status routes
    fastify.post('/statuses', {preHandler: [auth()]}, ArtController.createStatus);
    fastify.get('/statuses', {preHandler: [auth()]}, ArtController.getAllStatuses);
    fastify.get('/statuses/user/:userId', {preHandler: [auth()]}, ArtController.getStatusByUserId);
    fastify.get('/statuses/:id', {preHandler: [auth()]}, ArtController.getStatusById);
    fastify.put('/statuses', {preHandler: [auth()]}, ArtController.updateStatus);
    fastify.delete('/statuses/:id', {preHandler: [auth()]}, ArtController.deleteStatus);
    
    // Location routes
    fastify.post('/locations', {preHandler: [auth()]}, ArtController.createLocation);
    fastify.get('/locations', {preHandler: [auth()]}, ArtController.getAllLocations);
    fastify.get('/locations/user/:userId', {preHandler: [auth()]}, ArtController.getLocationByUserId);
    fastify.get('/locations/:id', {preHandler: [auth()]}, ArtController.getLocationById);
    fastify.put('/locations', {preHandler: [auth()]}, ArtController.updateLocation);
    fastify.delete('/locations/:id', {preHandler: [auth()]}, ArtController.deleteLocation);
    
    // Relations routes
    fastify.post('/art-objects/:artId/users/:userId', {preHandler: [auth()]}, ArtController.addUserToArtObject);
    fastify.delete('/art-objects/:artId/users/:userId', {preHandler: [auth()]}, ArtController.removeUserFromArtObject);
    fastify.get('/art-objects/:artId/users', {preHandler: [auth()]}, ArtController.getUsersByArtObjectId);
    fastify.get('/users/:userId/art-objects', {preHandler: [auth()]}, ArtController.getArtObjectsByUserIdForRelation);
    
    // Bulk operations
    fastify.post('/art-objects/bulk', {preHandler: [auth()]}, ArtController.bulkCreateArtObjects);
}