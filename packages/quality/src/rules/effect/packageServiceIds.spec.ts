import { expect } from "@effect/vitest";
import { serviceIds } from "#rules/effect/serviceIds.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const workspace = repositoryHas(
	{ content: '{"workspaces":["packages/*"]}', path: "package.json" },
	{ content: '{"name":"@shivaedev/store"}', path: "packages/store/package.json" },
	{ content: '{"name":"@shivaedev/service"}', path: "packages/service/package.json" },
);

for (const [name, code, id = "Store"] of [
	["a curried Context.Service", 'Context.Service<Store>()("Store")'],
	["a direct Context.Service", 'Context.Service<Store>("Store")'],
	["a package name without its trailing slash", 'Context.Service<Store>("@shivaedev/store")', "@shivaedev/store"],
	["a Context.Reference", 'Context.Reference("Store", { defaultValue: () => 0 })'],
	["defineService", 'defineService({ id: "Store", methods: {} })'],
	["an RPC middleware service", 'RpcMiddleware.Service<Store>()("Store")'],
	["an RPC middleware tag", 'RpcMiddleware.Tag<Store>()("Store")'],
]) {
	ruleStory.it(
		`effect/service-ids reports ${name} with the package prefix and repair`,
		[
			workspace,
			repositoryHas({
				content: [
					'import { Context } from "effect";',
					'import { RpcMiddleware } from "effect/rpc";',
					'import { defineService } from "@shivaedev/service/adapters/defineService.ts";',
					code,
				].join("\n"),
				path: "packages/store/src/Store.ts",
			}),
		],
		function* ({ check }) {
			const findings = yield* check(serviceIds);

			expect(findings).toEqual([
				{
					file: "packages/store/src/Store.ts",
					line: 4,
					message: `Service id "${id}" must start with "@shivaedev/store/". Prefix the id with its package name and update references to that id.`,
				},
			]);
		},
	);
}

ruleStory.it(
	"effect/service-ids accepts package-prefixed ids in every supported form",
	[
		workspace,
		repositoryHas({
			content: [
				'import { Context } from "effect";',
				'import { RpcMiddleware } from "effect/rpc";',
				'import { defineService } from "@shivaedev/service/adapters/defineService.ts";',
				'Context.Service<Store>()("@shivaedev/store/Store");',
				'Context.Service<Store>("@shivaedev/store/Other");',
				'Context.Reference("@shivaedev/store/Count", { defaultValue: () => 0 });',
				'defineService({ id: "@shivaedev/store/Defined", methods: {} });',
				'RpcMiddleware.Service<Store>()("@shivaedev/store/Guard");',
				'RpcMiddleware.Tag<Store>()("@shivaedev/store/LegacyGuard");',
			].join("\n"),
			path: "packages/store/src/services.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(serviceIds);

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"effect/service-ids follows import and local aliases in adapters and test-support, including template and quoted ids",
	[
		workspace,
		repositoryHas(
			{
				content: 'import * as C from "effect/Context"; const { Service: tag } = C; tag<Store>()(`@shivaedev/other/Store`);',
				path: "packages/store/src/adapters/store.ts",
			},
			{
				content:
					'import { defineService as service } from "@shivaedev/service/adapters/defineService.ts"; service({ "id": "@shivaedev/storehouse/Store" });',
				path: "packages/store/src/test-support/store.ts",
			},
			{
				content: 'import { Service as tag } from "effect/rpc/RpcMiddleware"; tag<Guard>()("");',
				path: "packages/store/src/guard.spec.ts",
			},
		),
	],
	function* ({ check, locations }) {
		yield* check(serviceIds);

		expect(yield* locations()).toEqual([
			"packages/store/src/adapters/store.ts:1",
			"packages/store/src/guard.spec.ts:1",
			"packages/store/src/test-support/store.ts:1",
		]);
	},
);

ruleStory.it(
	"effect/service-ids leaves computed ids, unrelated constructors and files outside packages alone",
	[
		workspace,
		repositoryHas(
			{
				content: [
					'import { Context } from "effect";',
					'const id = "Store"; Context.Service<Store>()(id);',
					'Context.Reference("store/" + id, { defaultValue: () => 0 });',
					'function defineService(value) { return value; } defineService({ id: "Store" });',
					'const Other = { Service: (id) => id }; Other.Service("Store");',
				].join("\n"),
				path: "packages/store/src/computed.ts",
			},
			{ content: 'import { Context } from "effect"; Context.Service<Store>()("Store");', path: "examples/app/store.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceIds);

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"effect/service-ids checks defineService through the service package's own alias",
	[
		workspace,
		repositoryHas({
			content: 'import { defineService } from "#adapters/defineService.ts"; defineService({ id: "Local" });',
			path: "packages/service/src/local.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(serviceIds);

		expect(findings).toEqual([
			{
				file: "packages/service/src/local.ts",
				line: 1,
				message: 'Service id "Local" must start with "@shivaedev/service/". Prefix the id with its package name and update references to that id.',
			},
		]);
	},
);
