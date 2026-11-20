import { Effect, Predicate, Schema } from "effect";
import { expect, it } from "vitest";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { SUBJECT_TYPE_ID } from "@shivaedev/contract/subjectMiddleware.ts";
import { MaybeAuthenticated } from "@shivaedev/identity/middleware.ts";
import { selfSubject } from "@shivaedev/identity/subject.ts";
import { adminPage } from "#page.ts";
import { JobsPermission } from "#permissions.ts";

const Workspace = contract("workspace", {
	commands: [command("rename", { invalidates: () => [] })],
	queries: [query("title", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
	subject: selfSubject,
}).middleware(MaybeAuthenticated);

it("an admin page keeps its contract's subject, guards each operation with it once and keeps middleware applied to the whole contract", () => {
	const page = adminPage({
		contract: Workspace,
		id: "workspace",
		permission: JobsPermission,
		route: { path: "/admin/workspace", title: "Workspace" },
	});
	const guards = Object.fromEntries(
		[...page.contract.requests.values()].map((rpc) => {
			const middlewares: unknown[] = Predicate.hasProperty(rpc, "middlewares") && rpc.middlewares instanceof Set ? [...rpc.middlewares] : [];
			return [
				rpc._tag,
				{
					authenticated: middlewares.some((middleware) => Predicate.hasProperty(middleware, "key") && middleware.key === MaybeAuthenticated.key),
					subjects: middlewares.filter((middleware) => Predicate.hasProperty(middleware, SUBJECT_TYPE_ID)).length,
				},
			];
		}),
	);

	expect({ guards, subject: page.contract.declaration.subject === selfSubject }).toEqual({
		guards: {
			"workspace.$changes": { authenticated: true, subjects: 1 },
			"workspace.rename": { authenticated: true, subjects: 1 },
			"workspace.title": { authenticated: true, subjects: 1 },
		},
		subject: true,
	});
});
