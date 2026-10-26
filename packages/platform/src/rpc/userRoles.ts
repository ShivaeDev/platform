import { Schema } from "effect";

export const UserRole = Schema.Literals(["user", "admin", "owner"]);
export type UserRole = typeof UserRole.Type;

export const AppUser = Schema.Struct({
	createdAt: Schema.DateTimeUtcFromString,
	email: Schema.String,
	id: Schema.String,
	name: Schema.String,
	roles: Schema.Array(Schema.String),
});

export const UserListInput = Schema.Struct({
	cursor: Schema.optionalKey(Schema.String),
	limit: Schema.Number.check(Schema.isInt(), Schema.isBetween({ maximum: 100, minimum: 1 })),
});
export const UserList = Schema.Struct({ next: Schema.OptionFromNullOr(Schema.String), users: Schema.Array(AppUser) });
export const ChangeRoleInput = Schema.Struct({ grant: Schema.Boolean, role: UserRole, userId: Schema.String });
export class LastOwner extends Schema.TaggedError<LastOwner>()("LastOwner", { userId: Schema.String }) {}
