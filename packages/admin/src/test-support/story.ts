import { type Layer, Option, Ref, Stream } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { adminRegistry } from "#registry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { adminEngine } from "./adminEngine.ts";
import { ChangesCollision, Jobs, Registry, Users } from "./pages.ts";

export const adminStory = storyKit({
	create: () => adminEngine,
	name: "admin registry",
	stages: ["session"],
	verbs: ({ client }, story) => ({
		changes: () => {
			story.tell("subscribe to job changes");
			return client["admin.jobs.$changes"]({ queries: [{ payload: undefined, query: "failed" }] }).pipe(Stream.take(1), Stream.runCollect);
		},
		failed: () => {
			story.tell("read failed jobs");
			return client["admin.jobs.failed"]();
		},
		profile: () => {
			story.tell("read the operator profile");
			return client["admin.users.profile"]();
		},
		retry: (id: string) => {
			story.tell(`retry job ${id}`);
			return client["admin.jobs.retry"]({ id });
		},
		userChanges: () => {
			story.tell("subscribe to user changes");
			return client["admin.users.$changes"]({ queries: [{ payload: undefined, query: "profile" }] }).pipe(Stream.take(1), Stream.runCollect);
		},
		watch: () => {
			story.tell("watch failed jobs");
			return client["admin.jobs.watch"]().pipe(Stream.runCollect);
		},
	}),
});

export function signedIn(role: string) {
	return adminStory.trait("session", `a caller already has the ${role} role`, ({ session }) =>
		Ref.set(session, Option.some({ user: { email: "operator@example.test", id: "operator", name: "Operator", role } })),
	);
}

export const registrationStory = storyKit({
	create: () => Registry,
	name: "admin registration",
	stages: [],
	verbs: () => ({
		duplicate: (kind: "id" | "path" | "tag" | "changes") => {
			const candidates = { changes: ChangesCollision, id: Users, path: Users, tag: Jobs };
			const other = candidates[kind];
			return adminRegistry(Jobs, {
				...other,
				id: kind === "id" ? Jobs.id : "another",
				route: kind === "path" ? Jobs.route : { path: "/admin/another", title: "Another" },
			});
		},
		register: (handlers: Readonly<Record<string, Layer.Any>>) => Reflect.apply(registerAdmin, undefined, [Registry, handlers]),
	}),
});
