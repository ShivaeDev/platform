import { Effect, Layer, Option, Predicate, Ref, Stream } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { adminRegistry } from "#registry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import type { Access } from "./Access.ts";
import { adminEngine } from "./adminEngine.ts";
import { answered } from "./answers.ts";
import { Jobs, pagesBesideJobs, Registry } from "./pages.ts";

function firstChange<E, R>(changes: Stream.Stream<unknown, E, R>) {
	return changes.pipe(
		Stream.runHead,
		Effect.map((first) => (Option.isSome(first) && Predicate.isTagged(first.value, "Resync") ? "resync" : `first change ${JSON.stringify(first)}`)),
	);
}

export const adminStory = storyKit({
	create: () => adminEngine,
	name: "admin registry",
	stages: ["session"],
	verbs: ({ client }, story) => ({
		failedJobs: () => {
			story.tell("the caller reads the failed jobs");
			return answered(client["admin.jobs.failed"]());
		},
		jobChanges: () => {
			story.tell("the caller subscribes to job changes");
			return answered(firstChange(client["admin.jobs.$changes"]({ queries: [{ payload: undefined, query: "failed" }] })));
		},
		profile: () => {
			story.tell("the caller reads their profile");
			return answered(client["admin.users.profile"]());
		},
		retry: (id: string) => {
			story.tell(`the caller retries ${id}`);
			return answered(client["admin.jobs.retry"]({ id }).pipe(Effect.as("retried")));
		},
		userChanges: () => {
			story.tell("the caller subscribes to user changes");
			return answered(firstChange(client["admin.users.$changes"]({ queries: [{ payload: undefined, query: "profile" }] })));
		},
		watchFailedJobs: () => {
			story.tell("the caller watches the failed jobs");
			return answered(client["admin.jobs.watch"]().pipe(Stream.runHead, Effect.map(Option.getOrUndefined)));
		},
	}),
});

export const signedOut = adminStory.trait("session", "no caller is signed in", ({ session }) => Ref.set(session, Option.none()));

export function signedInAs(role: typeof Access.Role.Type) {
	return adminStory.trait("session", `the caller is signed in as ${role}`, ({ session }) =>
		Ref.set(session, Option.some({ user: { email: `${role}@example.test`, id: role, name: role, role } })),
	);
}

function outcome(build: () => unknown, success: string) {
	return Effect.sync(() => {
		try {
			build();
			return success;
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
	});
}

type HandlerPage = "jobs" | "reports" | "users";

export const registrationStory = storyKit({
	create: () => Registry,
	name: "admin registration",
	stages: [],
	verbs: (registry, story) => ({
		composeWithJobs: (page: keyof typeof pagesBesideJobs) => {
			story.tell(`compose a registry of the jobs page and ${page}`);
			return outcome(() => adminRegistry(Jobs, pagesBesideJobs[page]), "composed");
		},
		registerHandlersFor: (...pages: readonly HandlerPage[]) => {
			story.tell(`register the jobs and users pages with handlers for ${pages.join(" and ")}`);
			const handlers = Object.fromEntries(pages.map((page) => [page, Layer.empty]));
			// The handler map's type already rejects missing and extra pages; the story checks the runtime guard behind it.
			return outcome(() => Reflect.apply(registerAdmin, undefined, [registry, handlers]), "registered");
		},
	}),
});
