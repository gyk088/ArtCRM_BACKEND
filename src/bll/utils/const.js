export const ROLES = {
    SUPER_ADMIN: 'super_admin',
    GALLERY: 'gallery',
    MANAGER: 'manager',
    ARTIST: 'artist'
}

// Роли, которые Super Admin/Gallery могут назначать управляемым пользователям
// (сам Manager/Artist не входит в их "уровень" управления другими).
export const MANAGED_ROLES = [ROLES.MANAGER, ROLES.ARTIST]

// Базовый URL раздачи загруженных файлов (обложки/доп. изображения работ).
// Читаем process.env лениво, внутри функции, а не в константе на верхнем
// уровне модуля — в src/index.js роуты (а с ними и модели) импортируются
// статически ДО вызова dotenv.config(), поэтому на момент оценки top-level
// кода этих модулей process.env.FILE_BASE_URL ещё не был бы прочитан из .env.
export function getFileBaseUrl() {
    return process.env.FILE_BASE_URL || 'https://dev.myoffer.life/files';
}

export default {
    ROLES,
    getFileBaseUrl
}