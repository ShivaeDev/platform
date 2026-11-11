import { expect } from "@effect/vitest";
import { rpcBoundary } from "#rules/effect/rpcBoundary.ts";
import { ruleCases } from "#test/ruleCases.ts";

const repository = ruleCases.repository();

const imports = [
	'import { Context, Effect, Schema } from "effect";',
	'import { Rpc, RpcGroup } from "effect/rpc";',
	'import { rpcBoundary as expose } from "@shivaedev/errors/boundary.ts";',
	'import * as Boundaries from "@shivaedev/errors/rpcBoundaryHandlers.ts";',
	'const Api = RpcGroup.make(Rpc.make("Read", { success: Schema.String, error: Schema.String }));',
	'const options = { unexpected: () => "unavailable" };',
];

for (const { name, code } of [
	{ code: 'const read = Effect.succeed("note").pipe(expose(Schema.String, options));', name: "rpcBoundary" },
	{ code: 'const read = Boundaries.rpcBoundaryHandlers(Api, options, { Read: () => Effect.succeed("note") });', name: "rpcBoundaryHandlers" },
]) {
	ruleCases.it(
		`effect/rpc-boundary reports ${name} in a service module with its repair`,
		[repository.has({ content: [...imports, code].join("\n"), path: "src/service.ts" })],
		function* ({ check }) {
			const findings = yield* check(rpcBoundary);

			expect(findings).toEqual([
				{
					file: "src/service.ts",
					line: 7,
					message: `Uses ${name} outside a module that builds RPC handlers. Move the boundary into the module calling the RPC group's toLayer, toLayerHandler, toHandlers or of; services must keep their own typed failures.`,
				},
			]);
		},
	);
}

for (const builder of ["toLayer", "toHandlers", "of", "toLayerHandler"]) {
	ruleCases.it(
		`effect/rpc-boundary accepts both boundaries in a module building RPC handlers with ${builder}`,
		[
			repository.has({
				content: [
					...imports,
					'const handlers = Boundaries.rpcBoundaryHandlers(Api, options, { Read: () => Effect.succeed("note").pipe(expose(Schema.String, options)) });',
					builder === "toLayerHandler" ? 'Api.toLayerHandler("Read", handlers.Read);' : `Api.${builder}(handlers);`,
				].join("\n"),
				path: "src/registration.ts",
			}),
		],
		function* ({ check, findings }) {
			yield* check(rpcBoundary);

			expect(yield* findings()).toEqual([]);
		},
	);
}

ruleCases.it(
	"effect/rpc-boundary accepts a group imported from its contract module or declared as a class",
	[
		repository.has(
			{
				content: [
					'import { rpcBoundary } from "@shivaedev/errors/boundary.ts";',
					'import { Notes } from "#modules/notes/contract.ts";',
					"Notes.application.toLayer({ Read: () => Notes.read().pipe(rpcBoundary(Notes.error, Notes.options)) });",
				].join("\n"),
				path: "src/notes/registration.ts",
			},
			{
				content: [
					...imports,
					'class Group extends RpcGroup.make().prefix("notes.") {}',
					'Group.toLayer({ Read: () => Effect.succeed("note").pipe(expose(Schema.String, options)) });',
				].join("\n"),
				path: "src/group/registration.ts",
			},
		),
	],
	function* ({ check, findings }) {
		yield* check(rpcBoundary);

		expect(yield* findings()).toEqual([]);
	},
);

for (const { name, code, path } of [
	{
		code: "const unrelated = { toLayer: (value: unknown) => value }; unrelated.toLayer({}); expose(Schema.String, options);",
		name: "a same-named method unrelated to RPC",
		path: "src/registration.ts",
	},
	{
		code: 'class Notes extends Context.Service<Notes, { read: unknown }>()("Notes") {} Notes.of({ read: Effect.succeed("note").pipe(expose(Schema.String, options)) });',
		name: "a service tag's of",
		path: "src/adapters/service.ts",
	},
	{
		code: 'import { Notes } from "#notes/Notes.ts"; Notes.of({ read: Effect.succeed("note").pipe(expose(Schema.String, options)) });',
		name: "an imported service tag's of",
		path: "src/notes/service.ts",
	},
]) {
	ruleCases.it(
		`effect/rpc-boundary reports a boundary beside ${name}`,
		[repository.has({ content: [...imports, code].join("\n"), path })],
		function* ({ check, locations }) {
			yield* check(rpcBoundary);

			expect(yield* locations()).toEqual([`${path}:7`]);
		},
	);
}

ruleCases.it(
	"effect/rpc-boundary accepts unrelated boundary functions and boundary test kits",
	[
		repository.has(
			{ content: "function rpcBoundary() {} rpcBoundary();", path: "src/unrelated.ts" },
			{
				content: [...imports, "expose(Schema.String, options);"].join("\n"),
				path: "src/test-support/boundary.ts",
			},
		),
	],
	function* ({ check, findings }) {
		yield* check(rpcBoundary);

		expect(yield* findings()).toEqual([]);
	},
);
