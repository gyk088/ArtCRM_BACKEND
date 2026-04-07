import ArtController from '../../../controllers/art.js'

export default async function artRoutes(fastify, options) {
    // Art Object routes
    fastify.post('/art-objects', ArtController.createArtObject);
    fastify.get('/art-objects', ArtController.getAllArtObjects);
    fastify.get('/art-objects/filters', ArtController.getArtObjectsByFilters);
    fastify.get('/art-objects/search', ArtController.searchArtObjects);
    fastify.get('/art-objects/statistics', ArtController.getArtObjectsStatistics);
    fastify.get('/art-objects/user/:userId', ArtController.getArtObjectsByUserId);
    fastify.get('/art-objects/:id', ArtController.getArtObjectById);
    fastify.get('/art-objects/:id/details', ArtController.getArtObjectWithDetails);
    fastify.get('/art-objects/:id/complete', ArtController.getCompleteArtObjectInfo);
    fastify.put('/art-objects/:id', ArtController.updateArtObjectPartial);
    fastify.put('/art-objects', ArtController.updateArtObject);
    fastify.delete('/art-objects/:id', ArtController.deleteArtObject);
    
    // Media routes
    fastify.post('/media', ArtController.createMedia);
    fastify.get('/media', ArtController.getAllMedia);
    fastify.get('/media/user/:userId', ArtController.getMediaByUserId);
    fastify.get('/media/:id', ArtController.getMediaById);
    fastify.put('/media', ArtController.updateMedia);
    fastify.delete('/media/:id', ArtController.deleteMedia);
    
    // Seria routes
    fastify.post('/serias', ArtController.createSeria);
    fastify.get('/serias', ArtController.getAllSerias);
    fastify.get('/serias/user/:userId', ArtController.getSeriaByUserId);
    fastify.get('/serias/:id', ArtController.getSeriaById);
    fastify.put('/serias', ArtController.updateSeria);
    fastify.delete('/serias/:id', ArtController.deleteSeria);
    
    // Status routes
    fastify.post('/statuses', ArtController.createStatus);
    fastify.get('/statuses', ArtController.getAllStatuses);
    fastify.get('/statuses/user/:userId', ArtController.getStatusByUserId);
    fastify.get('/statuses/:id', ArtController.getStatusById);
    fastify.put('/statuses', ArtController.updateStatus);
    fastify.delete('/statuses/:id', ArtController.deleteStatus);
    
    // Location routes
    fastify.post('/locations', ArtController.createLocation);
    fastify.get('/locations', ArtController.getAllLocations);
    fastify.get('/locations/user/:userId', ArtController.getLocationByUserId);
    fastify.get('/locations/:id', ArtController.getLocationById);
    fastify.put('/locations', ArtController.updateLocation);
    fastify.delete('/locations/:id', ArtController.deleteLocation);
    
    // Relations routes
    fastify.post('/art-objects/:artId/users/:userId', ArtController.addUserToArtObject);
    fastify.delete('/art-objects/:artId/users/:userId', ArtController.removeUserFromArtObject);
    fastify.get('/art-objects/:artId/users', ArtController.getUsersByArtObjectId);
    fastify.get('/users/:userId/art-objects', ArtController.getArtObjectsByUserIdForRelation);
    
    // Bulk operations
    fastify.post('/art-objects/bulk', ArtController.bulkCreateArtObjects);
}