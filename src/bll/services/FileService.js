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

    const usedBefore = await FileModel.getTotalSizeByUserId(user.f.id)
    const limit = user.f.storage_limit_bytes ?? FileService.DEFAULT_STORAGE_LIMIT_BYTES

    if (usedBefore >= limit) {
      // Места уже нет — сливаем стрим, не записывая на диск, иначе запрос
      // зависнет (fastify-multipart ждёт, пока часть будет вычитана).
      fileStream.resume()
      throw FileService.__storageLimitError(usedBefore, limit)
    }

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

    if (usedBefore + fileStream.bytesRead > limit) {
      fs.unlink(filePath, () => {})
      await fileObj.delete()
      throw FileService.__storageLimitError(usedBefore, limit)
    }

    fileObj.f.size = fileStream.bytesRead
    await fileObj.save()

    return fileObj;
  }

  static get MAX_FILE_SIZE_MB() {
    return 5
  }

  static get DEFAULT_STORAGE_LIMIT_BYTES() {
    return 5 * 1024 * 1024 * 1024 // 5 ГБ
  }

  static __storageLimitError(used, limit) {
    const error = new Error('Недостаточно места на диске');
    error.code = 'STORAGE_LIMIT_EXCEEDED';
    error.used = used;
    error.limit = limit;
    return error;
  }

  /**
   * Скопировать существующий файл (по id) в файлы указанного пользователя —
   * нужно при импорте ссылки/выставки: работы копируются в собственный
   * каталог целиком, включая обложку и доп. изображения, а не просто
   * ссылаются на чужой файл по id (тот может позже удалиться у владельца).
   * Файл ищется без проверки владельца — байты и так публично доступны без
   * авторизации через GET /:fileId, так что копирование не открывает
   * ничего, что не было доступно и раньше.
   *
   * @param {string} fileId - id исходного файла
   * @param {object} user - пользователь, которому будет принадлежать копия
   * @return {object} новый FileModel
   * @static
  */
  static async copyFile(fileId, user) {
    const sourceFile = await FileModel.getById(fileId);
    if (!sourceFile) {
      throw new Error('Source file not found');
    }

    const usedBefore = await FileModel.getTotalSizeByUserId(user.f.id);
    const limit = user.f.storage_limit_bytes ?? FileService.DEFAULT_STORAGE_LIMIT_BYTES;
    const size = sourceFile.f.size || 0;

    if (usedBefore + size > limit) {
      throw FileService.__storageLimitError(usedBefore, limit);
    }

    const fileObj = new FileModel({
      name: sourceFile.f.name,
      comment: sourceFile.f.comment,
      filename: sourceFile.f.filename,
      encoding: sourceFile.f.encoding,
      mimetype: sourceFile.f.mimetype,
      size,
      ext: sourceFile.f.ext,
      user_id: user.f.id
    });
    await fileObj.save();

    const sourcePath = `./files/${sourceFile.f.id}.${sourceFile.f.ext}`;
    const targetPath = `./files/${fileObj.f.id}.${fileObj.f.ext}`;

    try {
      await fs.promises.copyFile(sourcePath, targetPath);
    } catch (err) {
      await fileObj.delete();
      throw new Error('Source file is missing on disk');
    }

    return fileObj;
  }

  /**
   * Использовано/доступно места на диске для пользователя — показывается на
   * фронтенде (страница Файлы, окно "нет места") и в Админ-панели.
   *
   * @param {object} user
   * @return {object} { used, limit, remaining }
   * @static
  */
  static async getStorageInfo(user) {
    const used = await FileModel.getTotalSizeByUserId(user.f.id);
    const limit = user.f.storage_limit_bytes ?? FileService.DEFAULT_STORAGE_LIMIT_BYTES;
    return { used, limit, remaining: Math.max(0, limit - used) };
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

      // Отвязываем файл отовсюду, где он используется — иначе удаление
      // упадёт на внешнем ключе (avatar_id/file_id ссылаются на my_file).
      // Файл при этом удаляется полностью, работы/ссылки/выставки остаются,
      // просто теряют эту конкретную картинку (как плейсхолдер).
      const usage = await FileService.__unlinkFileEverywhere(id);

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
        id: file.f.id,
        unlinkedFrom: usage
      };
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Отвязать файл везде, где на него ссылаются (обложка работы, доп.
   * изображение работы, обложка ссылки/коллекции, обложка и фото галереи
   * выставки) — вызывается перед удалением самого файла.
   *
   * @param {string} fileId
   * @return {object} сколько записей отвязано/удалено по каждому типу
   * @static
  */
  static async __unlinkFileEverywhere(fileId) {
    const artAvatars = await FileModel.query('UPDATE my_art_object SET avatar_id = NULL WHERE avatar_id = $1', [fileId]);
    const artImages = await FileModel.query('DELETE FROM my_art_object_image WHERE file_id = $1', [fileId]);
    const collectionAvatars = await FileModel.query('UPDATE my_collection SET avatar_id = NULL WHERE avatar_id = $1', [fileId]);
    const exhibitionAvatars = await FileModel.query('UPDATE my_exhibition SET avatar_id = NULL WHERE avatar_id = $1', [fileId]);
    const exhibitionPhotos = await FileModel.query('DELETE FROM my_exhibition_photo WHERE file_id = $1', [fileId]);
    const folderAvatars = await FileModel.query('UPDATE my_file_folder SET avatar_id = NULL WHERE avatar_id = $1', [fileId]);

    return {
      artObjectAvatars: artAvatars.rowCount,
      artObjectImages: artImages.rowCount,
      collectionAvatars: collectionAvatars.rowCount,
      exhibitionAvatars: exhibitionAvatars.rowCount,
      exhibitionPhotos: exhibitionPhotos.rowCount,
      folderAvatars: folderAvatars.rowCount
    };
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
    return FileFolderModel.getByIdWithAvatar(folder.f.id);
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

      // order_num был позицией среди старых соседей — на новом уровне он
      // бессмысленен и может случайно совпасть с чужим. Сбрасываем, чтобы
      // перемещённая папка встала в конец нового уровня (как обычная новая).
      if ((folder.f.parent_id || null) !== (newParentId || null)) {
        folder.f.order_num = null;
      }

      folder.f.parent_id = newParentId;
    }

    if (folderData.avatar_id !== undefined) {
      folder.f.avatar_id = folderData.avatar_id || null;
    }

    await folder.save();
    return FileFolderModel.getByIdWithAvatar(folder.f.id);
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

  /**
   * Пересортировка файлов внутри одной папки (или корня) — фронтенд
   * присылает id файлов в новом визуальном порядке (после drag&drop),
   * мы просто нумеруем их по порядку в этом массиве.
   *
   * @param {string[]} ids - id файлов в новом порядке
   * @param {object} user
   * @return {object[]} обновлённые файлы
   * @static
  */
  static async reorderFiles(ids, user) {
    const files = await FileModel.getByIdsForUser(ids, user.f.id);
    if (files.length !== ids.length) {
      throw new Error('Some files not found or access denied');
    }

    const byId = new Map(files.map(f => [f.f.id, f]));
    for (let i = 0; i < ids.length; i++) {
      const file = byId.get(ids[i]);
      file.f.order_num = i;
      await file.save();
    }

    return ids.map(id => byId.get(id));
  }

  /**
   * Пересортировка папок внутри одного уровня вложенности (родителя или
   * корня) — аналогично reorderFiles.
   *
   * @param {string[]} ids - id папок в новом порядке
   * @param {object} user
   * @return {object[]} обновлённые папки
   * @static
  */
  static async reorderFolders(ids, user) {
    const folders = await FileFolderModel.getByIdsForUser(ids, user.f.id);
    if (folders.length !== ids.length) {
      throw new Error('Some folders not found or access denied');
    }

    const byId = new Map(folders.map(f => [f.f.id, f]));
    for (let i = 0; i < ids.length; i++) {
      const folder = byId.get(ids[i]);
      folder.f.order_num = i;
      await folder.save();
    }

    return ids.map(id => byId.get(id));
  }
}
