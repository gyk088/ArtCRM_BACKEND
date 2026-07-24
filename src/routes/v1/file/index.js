'use strict'
import FileController from '../../../controllers/file.js'
import auth from '../../../hooks/preHendler.js'; 

export default async function fileRoutes(fastify) {
  fastify.post('/upload', {preHandler: [auth()]}, FileController.upload)
  fastify.get('/:fileId', FileController.getFile)
  fastify.get('/list', {preHandler: [auth()]}, FileController.getAllByUser)
  fastify.delete('/:fileId', {preHandler: [auth()]}, FileController.deleteFile)
  fastify.post('/folder', {preHandler: [auth()]}, FileController.createFolder)
  fastify.get('/folder/:folderId', {preHandler: [auth()]}, FileController.getFilesInFolder)
  fastify.patch('/:fileId/folder', {preHandler: [auth()]}, FileController.moveFileToFolder)
  fastify.delete('/folder/:folderId', {preHandler: [auth()]}, FileController.deleteFolder)
}