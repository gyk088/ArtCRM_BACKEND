import FileModel from '../models/FileModel.js';
import FileFolderModel from '../models/FileFolderModel.js';
import fs from 'fs';
import util from 'util';
import { pipeline } from 'stream'
import { fileExt, cutStr } from '../utils/helpers.js';

const pump = util.promisify(pipeline)


export default class FileService {
  /**
   * Сохранить файл
   *
   * @param {object} data - см в @fastify/multipart
   * @return {object} result  - см schema в FileModel
   * @static
  */
  static async upload(data, user) {

    const fileStream = data.file
    const fileFields = data.fields

    const name = fileFields.name?.value || 'unnamed'
    const comment = fileFields.comment?.value || ''

    const fileObj = new FileModel({
      name,
      comment,
      filename: data.filename || 'none',
      encoding: data.encoding,
      mimetype: data.mimetype || 'none',
      size: 0,
      ext: fileExt(data.filename || ''),
      user_id: user.f.id
    });
    await fileObj.save();

    const filePath = './files/' + fileObj.f.id + '.' + fileObj.f.ext

    try {
      await pump(data.file, fs.createWriteStream(filePath))
    } catch (err) {
      fs.unlink(filePath, () => {})
      await fileObj.delete()

      if (fileStream.truncated || err.code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new Error(`Файл превышает максимальный размер ${FileService.MAX_FILE_SIZE_MB} МБ`)
      }
      throw err
    }

    if (fileStream.truncated) {
      fs.unlink(filePath, () => {})
      await fileObj.delete()
      throw new Error(`Файл превышает максимальный размер ${FileService.MAX_FILE_SIZE_MB} МБ`)
    }

    fileObj.f.size = fileStream.bytesRead
    await fileObj.save()

    return fileObj;
  }

  static get MAX_FILE_SIZE_MB() {
    return 5
  }


    /**
   * Удалить файл
   *
   * @param {string} id - ID файла
   * @param {object} user - объект пользователя
   * @return {object} result - результат удаления
   * @static
  */
  static async deleteFile(id, user) {
    try {
      // Получаем файл и проверяем права доступа
      const file = await this.getFileById(id, user);

      // Формируем путь к физическому файлу
      const filePath = `./files/${file.f.id}.${file.f.ext}`;

      // Удаляем физический файл, если он существует
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`File deleted from disk: ${filePath}`);
      } else {
        console.log(`File not found on disk: ${filePath}`);
      }

      // Удаляем запись из базы данных
      await file.delete();

      return {
        success: true,
        message: 'File deleted successfully',
        id: file.f.id
      };
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }




  /**
   * Получить файл по ID
   *
   * @param {string} id - ID файла
   * @param {object} user - объект пользователя
   * @return {object} result - файл
   * @static
  */
  static async getFileById(id, user) {
    try {
      const file = await FileModel.getByIdForUser(id, user.f.id);
      if (!file) {
        throw new Error('File not found or access denied');
      }
      return file;
    } catch (error) {
      console.error('Error getting file by id:', error);
      throw error;
    }
  }

  /**
   * Переименовать файл / изменить комментарий
   *
   * @param {string} id - ID файла
   * @param {object} fileData - {name, comment}
   * @param {object} user - объект пользователя
   * @return {object} result - обновлённый файл
   * @static
  */
  static async updateFile(id, fileData, user) {
    const file = await this.getFileById(id, user);

    file.f.name = fileData.name !== undefined ? fileData.name : file.f.name;
    file.f.comment = fileData.comment !== undefined ? fileData.comment : file.f.comment;

    await file.save();
    return file;
  }

  /**
   * Получить файл с физическим доступом
   *
   * @param {string} id - ID файла
   * @param {object} user - объект пользователя
   * @return {object} result - файл и путь к нему
   * @static
  */
  static async getFileWithPath(id, user) {
    try {
      const file = await this.getFileById(id, user);
      const filePath = `./files/${file.f.id}.${file.f.ext}`;

      // Проверяем существует ли файл физически
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found on disk');
      }

      return {
        ...file,
        filePath
      };
    } catch (error) {
      console.error('Error getting file with path:', error);
      throw error;
    }
  }

  /**
   * Получить все файлы пользователя с пагинацией
   *
   * @param {object} user - объект пользователя
   * @param {number} page - номер страницы
   * @param {number} limit - количество записей на странице
   * @return {object} result - объект с файлами и метаинформацией
   * @static
  */
  static async getAllByUserWithPagination(user, page = 1, limit = 10) {
    return FileModel.getAllByUserWithPagination(user, page, limit);
  }

  // ============= FILE FOLDER METHODS =============

  static async createFolder(folderData, user) {
    if (folderData.parent_id) {
      await this.getFolderById(folderData.parent_id, user);
    }

    const folder = new FileFolderModel({
      name: folderData.name,
      user_id: user.f.id,
      parent_id: folderData.parent_id || null
    });

    await folder.save();
    return folder;
  }

  static async getFolderById(id, user) {
    const folder = await FileFolderModel.getByIdForUser(id, user.f.id);
    if (!folder) {
      throw new Error('Folder not found or access denied');
    }
    return folder;
  }

  static async getFoldersByUser(user) {
    const folders = await FileFolderModel.getByUserId(user.f.id);
    return folders;
  }

  static async __getDescendantFolderIds(id, userId) {
    const children = await FileFolderModel.getByParentId(id, userId);
    let ids = [];
    for (const child of children) {
      ids.push(child.f.id);
      ids = ids.concat(await this.__getDescendantFolderIds(child.f.id, userId));
    }
    return ids;
  }

  static async updateFolder(id, folderData, user) {
    const folder = await this.getFolderById(id, user);

    folder.f.name = folderData.name !== undefined ? folderData.name : folder.f.name;

    if (folderData.parent_id !== undefined) {
      const newParentId = folderData.parent_id;

      if (newParentId === id) {
        throw new Error('Cannot move folder into itself');
      }

      if (newParentId) {
        await this.getFolderById(newParentId, user);

        const descendantIds = await this.__getDescendantFolderIds(id, user.f.id);
        if (descendantIds.includes(newParentId)) {
          throw new Error('Cannot move folder into its own subfolder');
        }
      }

      folder.f.parent_id = newParentId;
    }

    await folder.save();
    return folder;
  }

  static async __cascadeDeleteFolder(id, user) {
    const children = await FileFolderModel.getByParentId(id, user.f.id);
    for (const child of children) {
      await this.__cascadeDeleteFolder(child.f.id, user);
    }

    await FileModel.clearFolderId(id);

    const folder = await FileFolderModel.getByIdForUser(id, user.f.id);
    await folder.delete();
  }

  static async deleteFolder(id, user) {
    await this.getFolderById(id, user);

    await this.__cascadeDeleteFolder(id, user);
    return { success: true, message: 'Folder deleted successfully', id };
  }

  static async getFilesInFolder(id, user) {
    await this.getFolderById(id, user);

    const files = await FileModel.getByFolderId(id, user.f.id);
    return files;
  }

  static async moveFileToFolder(fileId, folderId, user) {
    await this.getFolderById(folderId, user);

    const file = await this.getFileById(fileId, user);

    file.f.folder_id = folderId;
    await file.save();
    return file;
  }

  static async removeFileFromFolder(fileId, user) {
    const file = await this.getFileById(fileId, user);

    file.f.folder_id = null;
    await file.save();
    return file;
  }
}
