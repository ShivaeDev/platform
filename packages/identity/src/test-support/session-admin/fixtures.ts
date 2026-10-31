import { Effect } from "effect";
import { signedInUser } from "#server/better-auth/testing.ts";
import type { SessionAdminHost } from "./host.ts";

export type Device = "alice" | "bobLaptop" | "bobPhone";
export type Actor = Device | "anonymous";
type Login = Awaited<ReturnType<typeof signedInUser>>;
export type Accounts = Record<Device, Login>;

export const mintSessions = Effect.fnUntraced(function* (host: SessionAdminHost) {
	// These sessions start the story after sign-in, with recorded activity in the provider's storage.
	const alice = yield* Effect.promise(() => signedInUser(host.auth, { email: "alice@sessions.test", name: "alice", role: "admin" }));
	const bobLaptop = yield* Effect.promise(() => signedInUser(host.auth, { email: "bob@sessions.test", name: "bob", role: "viewer" }));
	const context = yield* Effect.promise(() => host.auth.$context);
	const bobPhone = yield* Effect.promise(() => context.test.login({ userId: bobLaptop.user.id }));
	const accounts = { alice, bobLaptop, bobPhone };
	for (const [device, activity] of [
		["alice", "2026-01-02"],
		["bobLaptop", "2026-01-03"],
		["bobPhone", "2026-01-04"],
	] as const) {
		yield* Effect.promise(() =>
			context.internalAdapter.updateSession(accounts[device].token, {
				createdAt: new Date("2026-01-01"),
				expiresAt: new Date("2100-01-01"),
				updatedAt: new Date(activity),
			}),
		);
	}
	return accounts;
});

export function headersOf(accounts: Accounts, actor: Actor) {
	return actor === "anonymous" ? new Headers() : accounts[actor].headers;
}

export function deviceOf(accounts: Accounts, id: string) {
	return Object.entries(accounts).find(([, login]) => login.session.id === id)?.[0] ?? id;
}

export function personOf(accounts: Accounts, id: string) {
	if (accounts.alice.user.id === id) {
		return "alice";
	}
	return accounts.bobLaptop.user.id === id ? "bob" : id;
}
