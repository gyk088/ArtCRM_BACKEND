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
      size: fileStream.bytesRead,
      ext: fileExt(data.filename || ''),
      user_id: user.f.id
    });
    await fileObj.save();
    await pump(data.file, fs.createWriteStream('./files/' + fileObj.f.id + '.' + fileObj.f.ext))
    return fileObj;
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
    const folder = new FileFolderModel({
      name: folderData.name,
      user_id: user.f.id
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

  static async updateFolder(id, folderData, user) {
    const folder = await this.getFolderById(id, user);

    folder.f.name = folderData.name !== undefined ? folderData.name : folder.f.name;

    await folder.save();
    return folder;
  }

  static async deleteFolder(id, user) {
    const folder = await this.getFolderById(id, user);

    // Отвязываем файлы от папки перед удалением
    await FileModel.clearFolderId(id);

    await folder.delete();
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
