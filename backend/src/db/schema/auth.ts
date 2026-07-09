import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    boolean,
    text,
    uniqueIndex,
    index
} from "drizzle-orm/pg-core";

/* ============================================================
   ROLES
============================================================ */

export const roles = pgTable("roles", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    name: varchar("name", {
        length: 100,
    }).notNull(),

    description: text("description"),

    isSystemRole: boolean("is_system_role")
        .default(false)
        .notNull(),

    isActive: boolean("is_active")
        .default(true)
        .notNull(),

    createdAt: timestamp("created_at", {
        withTimezone: true,
    }).defaultNow(),

    updatedAt: timestamp("updated_at", {
        withTimezone: true,
    }).defaultNow()

}, (table) => ({

    roleNameIdx: uniqueIndex("role_name_idx")
        .on(table.name)

}));

/* ============================================================
   PERMISSIONS
============================================================ */

export const permissions = pgTable("permissions", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    /** Machine-readable permission key, e.g. "user:read", "loan:create". */
    name: varchar("name", {
        length: 150,
    }).notNull(),

    description: text("description"),

    createdAt: timestamp("created_at", {
        withTimezone: true,
    }).defaultNow(),

    updatedAt: timestamp("updated_at", {
        withTimezone: true,
    }).defaultNow()

}, (table) => ({

    permissionNameIdx: uniqueIndex("permission_name_idx")
        .on(table.name)

}));

/* ============================================================
   ROLE PERMISSIONS  (roles ⇄ permissions join)
============================================================ */

export const rolePermissions = pgTable("role_permissions", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    roleId: uuid("role_id")
        .references(() => roles.id, {
            onDelete: "cascade"
        })
        .notNull(),

    permissionId: uuid("permission_id")
        .references(() => permissions.id, {
            onDelete: "cascade"
        })
        .notNull(),

    assignedAt: timestamp("assigned_at", {
        withTimezone: true,
    }).defaultNow(),

}, (table) => ({

    rolePermissionIdx: uniqueIndex("role_permission_idx")
        .on(table.roleId, table.permissionId)

}));

/* ============================================================
   USERS
============================================================ */

export const users = pgTable("users", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    firstName: varchar("first_name", {
        length: 150,
    }).notNull(),

    lastName: varchar("last_name", {
        length: 150,
    }),

    email: varchar("email", {
        length: 255,
    }).notNull(),

    phone: varchar("phone", {
        length: 20,
    }),

    passwordHash: varchar("password_hash", {
        length: 255,
    }).notNull(),

    isEmailVerified: boolean("is_email_verified")
        .default(false),

    isActive: boolean("is_active")
        .default(true),

    lastLoginAt: timestamp("last_login_at", {
        withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
        withTimezone: true,
    }).defaultNow(),

    updatedAt: timestamp("updated_at", {
        withTimezone: true,
    }).defaultNow(),

    deletedAt: timestamp("deleted_at", {
        withTimezone: true,
    })

}, (table) => ({

    emailIdx: uniqueIndex("user_email_idx")
        .on(table.email),

    phoneIdx: index("user_phone_idx")
        .on(table.phone)

}));

/* ============================================================
   USER ROLES
============================================================ */

export const userRoles = pgTable("user_roles", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    userId: uuid("user_id")
        .references(() => users.id, {
            onDelete: "cascade"
        })
        .notNull(),

    roleId: uuid("role_id")
        .references(() => roles.id)
        .notNull(),

    assignedAt: timestamp("assigned_at", {
        withTimezone: true,
    }).defaultNow(),

}, (table) => ({

    userRoleIdx: uniqueIndex("user_role_idx")
        .on(table.userId, table.roleId)

}));

/* ============================================================
   USER SESSIONS
============================================================ */

export const userSessions = pgTable("user_sessions", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    userId: uuid("user_id")
        .references(() => users.id, {
            onDelete: "cascade"
        })
        .notNull(),

    refreshToken: text("refresh_token")
        .notNull(),

    ipAddress: varchar("ip_address", {
        length: 100,
    }),

    userAgent: text("user_agent"),

    expiresAt: timestamp("expires_at", {
        withTimezone: true,
    }).notNull(),

    createdAt: timestamp("created_at", {
        withTimezone: true,
    }).defaultNow()

}, (table) => ({

    sessionUserIdx: index("session_user_idx")
        .on(table.userId)

}));

/* ============================================================
   PASSWORD RESET TOKENS
============================================================ */

export const passwordResetTokens = pgTable("password_reset_tokens", {

    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    userId: uuid("user_id")
        .references(() => users.id, {
            onDelete: "cascade"
        })
        .notNull(),

    token: varchar("token", {
        length: 255,
    }).notNull(),

    expiresAt: timestamp("expires_at", {
        withTimezone: true,
    }).notNull(),

    used: boolean("used")
        .default(false),

    createdAt: timestamp("created_at", {
        withTimezone: true,
    }).defaultNow()

}, (table) => ({

    tokenIdx: uniqueIndex("password_reset_token_idx")
        .on(table.token)

}));