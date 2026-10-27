import { Schema } from "effect";

export const AppUser = Schema.Struct({
	createdAt: Schema.DateTimeUtcFromString,
	email: Schema.String,
	id: Schema.String,
	name: Schema.String,
	role: Schema.String,
});

export const UserListInput = Schema.Struct({
	cursor: Schema.optionalKey(Schema.String),
	limit: Schema.Number.check(Schema.isInt(), Schema.isBetween({ maximum: 100, minimum: 1 })),
});
export const UserList = Schema.Struct({ next: Schema.OptionFromNullOr(Schema.String), users: Schema.Array(AppUser) });
export interface ChangeRoleInput<TRole extends string = string> {
	readonly role: TRole;
	readonly userId: string;
}
export class LastRoleAssigner extends Schema.TaggedError<LastRoleAssigner>()("LastRoleAssigner", { userId: Schema.String }) {}
