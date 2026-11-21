import { Cause, Effect, Layer, Option, Ref } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { adminRegistry, mergeAdminRegistries, validateAdminRegistry } from "#registry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import type { Access } from "#test/Access.ts";
import { adminEngine } from "#test/adminEngine.ts";
import { answered } from "#test/answers.ts";
import { FakeJobs } from "#test/FakeJobs.ts";
import { FakeUsers } from "#test/FakeUsers.ts";
import { firstChange } from "#test/firstChange.ts";
import { Jobs, pagesBesideJobs, Registry } from "#test/pages.ts";
import { type RoutePaths, routePages } from "#test/routePages.ts";

export const adminStory = storyKit({
	create: () => adminEngine,
	name: "admin registry",
	stages: ["session"],
	verbs: ({ client, liveFailedJobs }, story) => ({
		failedJobs: () => {
			story.tell("the caller reads the failed jobs");
			return answered(client["admin.jobs.failed"]());
		},
		jobChanges: () => {
			story.tell("the caller subscribes to job changes");
			return answered(firstChange(client["admin.jobs.$changes"]({ queries: [{ payload: undefined, query: "failed" }] })));
		},
		liveFailedJobs: () => {
			story.tell("the caller opens the live failed jobs query");
			return answered(liveFailedJobs());
		},
		profile: () => {
			story.tell("the caller reads their profile");
			return answered(client["admin.users.profile"]());
		},
		restrictedProfile: () => {
			story.tell("the caller reads a profile whose own query policy refuses access");
			return answered(client["admin.restricted.profile"]());
		},
		retry: (id: string) => {
			story.tell(`the caller retries ${id}`);
			return answered(client["admin.jobs.retry"]({ id }).pipe(Effect.as("retried")));
		},
		userChanges: () => {
			story.tell("the caller subscribes to user changes");
			return answered(firstChange(client["admin.users.$changes"]({ queries: [{ payload: undefined, query: "profile" }] })));
		},
	}),
});

export const signedOut = adminStory.trait("session", "no caller is signed in", ({ session }) => Ref.set(session, Option.none()));

export function signedInAs(role: typeof Access.Role.Type) {
	return adminStory.trait("session", `the caller is signed in as ${role}`, ({ session }) =>
		Ref.set(session, Option.some({ user: { email: `${role}@example.test`, emailVerified: true, id: role, name: role, role } })),
	);
}

function adminOutcome<A, E>(effect: Effect.Effect<A, E>, success: string) {
	return effect.pipe(
		Effect.as(success),
		Effect.catchCause((cause) => {
			const error = Cause.squash(cause);
			if (
				error instanceof Error
				&& /^(?:Duplicate admin (?:page id|RPC tag|path): |Overlapping admin paths: |Admin detail path .* must be under page path |Missing admin module: |Unregistered admin module: |Admin page .* is served by a module )/u.test(
					error.message,
				)
			) {
				return Effect.succeed(error.message);
			}
			return Effect.failCause(cause);
		}),
	);
}

function outcome(registry: ReturnType<typeof adminRegistry>, success: string) {
	return adminOutcome(validateAdminRegistry(registry.pages), success);
}

const MODULES = { jobs: FakeJobs, reports: FakeUsers, users: FakeUsers };

type HandlerPage = "jobs" | "reports" | "users";

export const registrationStory = storyKit({
	create: () => Registry,
	name: "admin registration",
	stages: [],
	verbs: (registry, story) => ({
		composeRoutes: (composition: "together" | "modules", ...routes: readonly RoutePaths[]) => {
			story.tell(`compose ${routes.map((route) => route.detail ?? route.path).join(" and ")} ${composition}`);
			const pages = routePages(routes);
			const combined = composition === "together" ? adminRegistry(...pages) : mergeAdminRegistries(...pages.map((page) => adminRegistry(page)));
			return outcome(combined, "composed");
		},
		composeWithJobs: (page: keyof typeof pagesBesideJobs) => {
			story.tell(`compose a registry of the jobs page and ${page}`);
			const pages = [Jobs, pagesBesideJobs[page]];
			const combined = mergeAdminRegistries(...pages.map((value) => adminRegistry(value)));
			return outcome(combined, "composed");
		},
		startModulesFor: (...pages: readonly HandlerPage[]) => {
			story.tell(`start the jobs and users pages with the modules for ${pages.join(" and ")}`);
			const modules = Object.fromEntries(pages.map((page) => [page, MODULES[page]]));
			// The module map's type already rejects missing and extra pages; the story checks the runtime guard behind it.
			const registration: { readonly handlers: Layer.Layer<never, unknown> } = Reflect.apply(registerAdmin, undefined, [registry, modules]);
			return adminOutcome(Layer.build(registration.handlers).pipe(Effect.scoped), "started");
		},
		startWithSwappedModules: () => {
			story.tell("start the jobs page with the users page's module and the users page with the jobs page's module");
			const registration: { readonly handlers: Layer.Layer<never, unknown> } = Reflect.apply(registerAdmin, undefined, [
				registry,
				{ jobs: FakeUsers, users: FakeJobs },
			]);
			return adminOutcome(Layer.build(registration.handlers).pipe(Effect.scoped), "started");
		},
	}),
});
