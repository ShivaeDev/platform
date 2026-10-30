import { Effect, Schema } from "effect";
import { Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Permission } from "#permission.ts";
import type { User } from "#roleSet.ts";
import { Access, AccessWithReaderTwice, AssignRoles, ReadAllUsers, ReadJobDetails, ReadJobs, ReadUsers } from "./policy.ts";

type RoleName = typeof Access.Role.Type;
type Owner = "alice" | "bob";

interface AccessEngine {
	access: typeof Access | typeof AccessWithReaderTwice;
	user: User<RoleName> | null | undefined;
}

const DECLARED_PERMISSIONS = [ReadUsers, ReadAllUsers, AssignRoles, ReadJobs, ReadJobDetails];

function grantNames(permissions: readonly Permission[]): readonly string[] {
	return permissions.map(({ name, strength }) => (strength === "any" ? `${name}.any` : name));
}

function failureOf(error: unknown) {
	if (error instanceof Unauthorized) {
		return "unauthorized";
	}
	if (error instanceof Forbidden) {
		return "forbidden";
	}
	if (error instanceof Schema.SchemaError) {
		return "rejected as an undeclared role";
	}
	return `unexpected failure: ${String(error)}`;
}

function outcomeOf<A, E>(effect: Effect.Effect<A, E>) {
	return Effect.catch(effect, (error) => Effect.succeed(failureOf(error)));
}

function allowed(effect: Effect.Effect<void, Forbidden | Unauthorized>) {
	return outcomeOf(Effect.as(effect, "allowed"));
}

function signedInUser(engine: AccessEngine) {
	return engine.user === null || engine.user === undefined
		? Effect.die(new Error("Declare signedIn(role) before reading alice's grants"))
		: Effect.succeed(engine.user);
}

export const accessStory = storyKit({
	create: (): AccessEngine => ({ access: Access, user: undefined }),
	name: "application access",
	stages: ["policy", "session"],
	verbs: (engine) => ({
		allowedGrants: () =>
			Effect.gen(function* () {
				const user = yield* signedInUser(engine);
				const outcomes = yield* Effect.forEach(DECLARED_PERMISSIONS, (permission) => allowed(engine.access.requirePermission(user, permission)));
				return grantNames(DECLARED_PERMISSIONS.filter((_, index) => outcomes[index] === "allowed"));
			}),
		checkRead: (owner: Owner) => Effect.sync(() => engine.access.canAccess(engine.user, ReadUsers, owner)),
		decodeRole: (stored: string) => outcomeOf(Schema.decodeUnknownEffect(engine.access.Role)(stored)),
		enforceGrant: (permission: Permission) => allowed(engine.access.requirePermission(engine.user, permission)),
		enforceRead: (owner: Owner) => allowed(engine.access.requireAccess(engine.user, ReadUsers, owner)),
		resolve: (stored: string) => outcomeOf(engine.access.resolve(stored)),
		resolvedGrants: () =>
			Effect.gen(function* () {
				const user = yield* signedInUser(engine);
				return grantNames((yield* engine.access.resolve(user.role)).permissions);
			}),
		shownGrants: () =>
			Effect.map(signedInUser(engine), (user) =>
				grantNames(DECLARED_PERMISSIONS.filter((permission) => engine.access.hasPermission(user.role, permission))),
			),
	}),
});

export function readerDeclaredTwice() {
	return accessStory.trait(
		"policy",
		"the role set declares reader with users.read and jobs.read, then again with roles.assign under a name known only at runtime",
		(engine) => {
			engine.access = AccessWithReaderTwice;
		},
	);
}

export function signedIn(role: RoleName) {
	return accessStory.trait("session", `alice is already signed in as a ${role}`, (engine) => {
		engine.user = { id: "alice", role };
	});
}

export function signedOut(user: null | undefined) {
	return accessStory.trait("session", `nobody is signed in, so the caller passes ${String(user)} as the user`, (engine) => {
		engine.user = user;
	});
}
