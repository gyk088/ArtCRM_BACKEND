import FileService from '../bll/services/FileService.js';

export default class FileController {
    static async upload(request, reply) {
        try {        
            const data = await request.file();
            const file = await FileService.upload(data, request.user);
            return file
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async updateFile(request, reply) {
        try {
            const file = await FileService.updateFile(request.params.fileId, request.body, request.user);
            return file;
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async deleteFile(request, reply) {
        try {
            const result = await FileService.deleteFile(request.params.fileId, request.user);
            return result;
        } catch (error) {
            reply.code(400).send(error);
        }
    }

    static async getFile(request, reply) {
        try {
            return reply.sendFile(request.params.fileId)
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async getFile(request, reply) {
        try {
            return reply.sendFile(request.params.fileId)
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async getAllByUser(request, reply) {
        try {
            const files = await FileService.getAllByUserWithPagination(request.user, parseInt(request.query.page) || 1, parseInt(request.query.limit) || 10 );
            return files
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async createFolder(request, reply) {
        try {
            const folder = await FileService.createFolder(request.body, request.user);
            return folder;
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async getFolders(request, reply) {
        try {
            const folders = await FileService.getFoldersByUser(request.user);
            return folders;
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async updateFolder(request, reply) {
        try {
            const folder = await FileService.updateFolder(request.params.folderId, request.body, request.user);
            return folder;
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async getFilesInFolder(request, reply) {
        try {
            const files = await FileService.getFilesInFolder(request.params.folderId, request.user);
            return files;
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async moveFileToFolder(request, reply) {
        try {
            const { folderId } = request.body;
            const file = folderId
                ? await FileService.moveFileToFolder(request.params.fileId, folderId, request.user)
                : await FileService.removeFileFromFolder(request.params.fileId, request.user);
            return file;
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async deleteFolder(request, reply) {
        try {
            const result = await FileService.deleteFolder(request.params.folderId, request.user);
            return result;
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async reorderFiles(request, reply) {
        try {
            const files = await FileService.reorderFiles(request.body.ids || [], request.user);
            return files;
        } catch (error) {
            reply.code(400).send(error)
        }
    }

    static async reorderFolders(request, reply) {
        try {
            const folders = await FileService.reorderFolders(request.body.ids || [], request.user);
            return folders;
        } catch (error) {
            reply.code(400).send(error)
        }
    }
}