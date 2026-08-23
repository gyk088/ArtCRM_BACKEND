export const ROLES = {
    SUPER_ADMIN: 'super_admin',
    GALLERY: 'gallery',
    MANAGER: 'manager',
    ARTIST: 'artist'
}

// Роли, которые Super Admin/Gallery могут назначать управляемым пользователям
// (сам Manager/Artist не входит в их "уровень" управления другими).
export const MANAGED_ROLES = [ROLES.MANAGER, ROLES.ARTIST]

export default {
    ROLES
}