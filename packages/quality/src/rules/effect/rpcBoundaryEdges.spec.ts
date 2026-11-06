import { expect } from "@effect/vitest";
import { rpcBoundaryImports, rpcBoundaryResolves } from "#test/rpcBoundaryResolves.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { rpcBoundary } from "./rpcBoundary.ts";

for (const { name, code } of [
	{ code: 'const read = Effect.succeed("note").pipe(expose(Schema.String, options));', name: "rpcBoundary" },
	{ code: 'const read = Boundaries.rpcBoundaryHandlers(Api, options, { Read: () => Effect.succeed("note") });', name: "rpcBoundaryHandlers" },
]) {
	ruleStory.it(
		`effect/rpc-boundary reports ${name} in a service module with its repair`,
		[...rpcBoundaryResolves, repositoryHas({ content: [...rpcBoundaryImports, code].join("\n"), path: "src/service.ts" })],
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
	ruleStory.it(
		`effect/rpc-boundary accepts both boundaries in a module building RPC handlers with ${builder}`,
		[
			...rpcBoundaryResolves,
			repositoryHas({
				content: [
					...rpcBoundaryImports,
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

for (const { name, code, path } of [
	{
		code: 'const boundary = expose; Effect.succeed("note").pipe(boundary(Schema.String, options));',
		name: "a local boundary alias",
		path: "src/service.ts",
	},
	{
		code: 'const { rpcBoundaryHandlers: boundary } = Boundaries; boundary(Api, options, { Read: () => Effect.succeed("note") });',
		name: "a destructured namespace import",
		path: "src/adapters/service.ts",
	},
	{
		code: "const unrelated = { toLayer: (value: unknown) => value }; unrelated.toLayer({}); expose(Schema.String, options);",
		name: "a same-named method unrelated to RPC",
		path: "src/registration.ts",
	},
]) {
	ruleStory.it(
		`effect/rpc-boundary reports ${name}`,
		[...rpcBoundaryResolves, repositoryHas({ content: [...rpcBoundaryImports, code].join("\n"), path })],
		function* ({ check, locations }) {
			yield* check(rpcBoundary);

			expect(yield* locations()).toEqual([`${path}:7`]);
		},
	);
}

ruleStory.it(
	"effect/rpc-boundary follows a renamed re-export into a service module",
	[
		...rpcBoundaryResolves,
		repositoryHas(
			{ content: 'export { rpcBoundary as expose } from "@shivaedev/errors/boundary.ts";', path: "src/expose.ts" },
			{
				content: [
					'import { Schema } from "effect";',
					'import { expose } from "./expose.ts";',
					'expose(Schema.String, { unexpected: () => "unavailable" });',
				].join("\n"),
				path: "src/service.ts",
			},
		),
	],
	function* ({ check, locations }) {
		yield* check(rpcBoundary);

		expect(yield* locations()).toEqual(["src/service.ts:3"]);
	},
);

ruleStory.it(
	"effect/rpc-boundary accepts unrelated boundary functions and boundary test kits",
	[
		...rpcBoundaryResolves,
		repositoryHas(
			{ content: "function rpcBoundary() {} rpcBoundary();", path: "src/unrelated.ts" },
			{
				content: [...rpcBoundaryImports, "expose(Schema.String, options);"].join("\n"),
				path: "src/test-support/boundary.ts",
			},
		),
	],
	function* ({ check, findings }) {
		yield* check(rpcBoundary);

		expect(yield* findings()).toEqual([]);
	},
);
