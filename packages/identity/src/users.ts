import { Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const userKeys = collection("identity.users", Schema.String);
export const roleKeys = collection("identity.roles", Schema.String);

export const DirectoryUser = Schema.Struct({
	createdAt: Schema.DateTimeUtcFromDate,
	email: Schema.String,
	id: Schema.String,
	name: Schema.String,
	role: Schema.String,
});
export const UserListInput = Schema.Struct({
	cursor: Schema.optionalKey(Schema.String),
	limit: Schema.Number.check(Schema.isInt(), Schema.isBetween({ maximum: 100, minimum: 1 })),
});
export const UserList = Schema.Struct({ next: Schema.OptionFromNullOr(Schema.String), users: Schema.Array(DirectoryUser) });
export const AccountName = Schema.Struct({ id: Schema.String, name: Schema.String });
