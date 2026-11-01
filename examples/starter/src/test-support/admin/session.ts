import { Effect, Predicate } from "effect";

export interface SignedInAccount {
	readonly email: string;
	readonly name: string;
	readonly permissions: readonly string[];
	readonly role: string;
}

function permissionNames(user: unknown) {
	if (!(Predicate.hasProperty(user, "permissions") && Array.isArray(user.permissions))) {
		return [];
	}
	return user.permissions.flatMap((permission: unknown) =>
		Predicate.hasProperty(permission, "name") && typeof permission.name === "string" ? [permission.name] : [],
	);
}

function text(user: unknown, field: string) {
	return Predicate.hasProperty(user, field) && typeof user[field] === "string" ? user[field] : "";
}

export const signedInAccount = Effect.fn("AdminStory.signedInAccount")(function* (baseUrl: string, cookie: string) {
	const response = yield* Effect.promise(() => fetch(`${baseUrl}/api/auth/get-session`, { headers: { cookie } }));
	const body: unknown = yield* Effect.promise(() => response.json());
	if (!Predicate.hasProperty(body, "user")) {
		return "no session";
	}
	const account: SignedInAccount = {
		email: text(body.user, "email"),
		name: text(body.user, "name"),
		permissions: permissionNames(body.user).sort((left, right) => left.localeCompare(right)),
		role: text(body.user, "role"),
	};
	return account;
});

export const sessionPermissions = Effect.fn("AdminStory.sessionPermissions")(function* (baseUrl: string, cookie: string) {
	const account = yield* signedInAccount(baseUrl, cookie);
	return typeof account === "string" ? account : account.permissions;
});
