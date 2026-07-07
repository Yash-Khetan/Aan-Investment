/**
 * repositories/ barrel — the auth data-access layer's public surface.
 *
 * Services import the singletons (userRepository, roleRepository, ...) or the
 * classes (for injecting a transaction handle / a mock in tests).
 */
export { UserRepository, userRepository, type UserRecord } from "./user.repository";
export { RoleRepository, roleRepository, type RoleRecord } from "./role.repository";
export {
    SessionRepository,
    sessionRepository,
    type SessionRecord,
    type CreateSessionInput,
} from "./session.repository";
export {
    PasswordResetRepository,
    passwordResetRepository,
    type PasswordResetRecord,
    type CreateResetTokenInput,
} from "./passwordReset.repository";
