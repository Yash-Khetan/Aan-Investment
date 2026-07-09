import { permissionRepository } from "./auth.repository";

/**
 * AuthorizationService — the RBAC use-case layer.
 *
 * DELIBERATELY separate from AuthService (authentication). Authentication
 * answers "who are you?"; authorization answers "are you allowed to do this?".
 * This service only reads the permission graph (roles → role_permissions →
 * permissions) and evaluates permission checks. It performs NO token work,
 * NO password work, and NO session work.
 *
 * The permission repository is injected (defaults to the singleton) so this
 * class stays unit-testable with a mock.
 */
export class AuthorizationService {
    constructor(private readonly permissions = permissionRepository) {}

    /** All permission names effective for a user (via their active roles). */
    async getUserPermissions(userId: string): Promise<string[]> {
        return this.permissions.findPermissionNamesForUser(userId);
    }

    /** True only if the user holds EVERY required permission. */
    async hasAllPermissions(userId: string, required: string[]): Promise<boolean> {
        if (required.length === 0) return true;
        const granted = new Set(await this.getUserPermissions(userId));
        return required.every((p) => granted.has(p));
    }

    /** True if the user holds AT LEAST ONE of the required permissions. */
    async hasAnyPermission(userId: string, required: string[]): Promise<boolean> {
        if (required.length === 0) return true;
        const granted = new Set(await this.getUserPermissions(userId));
        return required.some((p) => granted.has(p));
    }
}

export const authorizationService = new AuthorizationService();
