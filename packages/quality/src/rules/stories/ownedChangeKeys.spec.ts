import { expect } from "@effect/vitest";
import { changeKeyConsumer, changeKeysResolve, orderKeys } from "#test/changeKeys.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { importedChangeKeys } from "./importedChangeKeys.ts";

const packages = [effectResolves(), changeKeysResolve()];

for (const { name, code } of [
	{ code: 'commit(["orders"]);', name: "a SQL announcement array" },
	{ code: '(commit)(["orders"]);', name: "a wrapped announcement API" },
	{ code: 'const announce = (commit); announce(["orders"]);', name: "a wrapped announcement alias" },
	{ code: 'Reactivity.Reactivity.use((r) => r.mutation(["orders"], Effect.void));', name: "a service mutation" },
	{ code: 'Reactivity["invalidate"](["orders"]);', name: "an element-access invalidation" },
	{ code: "const rawIds = [1]; commit({ rawIds });", name: "a shorthand record key" },
	{ code: "commit({ ...{ orders: [1] } });", name: "a spread record key" },
	{ code: 'commit([...(["orders"] as const)]);', name: "a spread array key" },
	{ code: 'function write() { const announce = commit; announce(["orders"]); }', name: "a scoped announcement alias" },

	{ code: "commit({ orders: [1] });", name: "an unquoted announcement record key" },
	{ code: 'commit({ "orders": [1] });', name: "a quoted announcement record key" },
	{ code: 'commit({ ["orders"]: [1] });', name: "a computed announcement record key" },
	{ code: 'const announce = commit; announce(["orders"]);', name: "an aliased announcement API" },
	{ code: 'Reactivity.invalidate(["orders"]);', name: "a Reactivity namespace call" },
	{ code: 'Native.invalidate(["orders"]);', name: "an aggregate Reactivity import" },
	{ code: 'refresh(["orders"]);', name: "a renamed Reactivity import" },
	{
		code: 'Effect.gen(function* () { const r = yield* Reactivity.Reactivity; r.invalidateUnsafe(["orders"]); });',
		name: "an unsafe service invalidation",
	},
	{ code: "Reactivity.Reactivity.use((r) => r.invalidate({ orders: [1] }));", name: "a service callback" },
	{ code: 'Reactivity.mutation(["orders"])(Effect.void);', name: "a curried mutation" },
	{ code: 'Reactivity.mutation(Effect.void, ["orders"]);', name: "an uncurried mutation" },
	{ code: 'collectionInvalidationKeys("orders");', name: "a collection encoder" },
	{ code: 'recordKey("orders", "alice");', name: "a record encoder" },
	{ code: 'invalidationKeys([{ _tag: "Item", collection: "orders", id: "alice" }]);', name: "a typed collection name" },
	{ code: 'readKeys([{ _tag: "Bucket", collection: orders.name, field: "owner", value: "alice" }]);', name: "a typed bucket name" },
	{ code: "commit(([`orders`] as const));", name: "a wrapped static template" },
	{ code: 'commit(true ? ["orders"] : [orders.name]);', name: "a conditional key" },
]) {
	ruleStory.it(
		`boundaries/imported-change-keys reports ${name} with its repair and location`,
		[...packages, repositoryHas(orderKeys, changeKeyConsumer(code))],
		function* ({ check }) {
			const findings = yield* check(importedChangeKeys);

			expect(findings).toEqual([
				{
					file: "src/consumer.ts",
					line: 8,
					message:
						"Names a change collection or bucket with a literal. Import its owner's declaration and use its name, list, item or bucket key instead.",
				},
			]);
		},
	);
}

for (const { name, code } of [
	{
		code: 'Reactivity.Reactivity.use((r) => r.invalidate([{ topic: "orders" }, { _tag: "Cache", field: "orders" }, 42]));',
		name: "opaque object and numeric keys without collection names",
	},
	{
		code: 'commit([orders.list, orders.item(1), orders.bucket.owner("alice")]);',
		name: "imported typed list, item and bucket keys with literal values",
	},
	{ code: 'commit({ [orders.name]: ["alice", 1] });', name: "an imported collection name and literal record IDs" },
	{
		code: 'Reactivity.invalidate(collectionInvalidationKeys(orders.name)); recordKey(orders.name, "alice");',
		name: "an imported declaration in key encoders",
	},
	{
		code: 'import { Schema } from "effect"; import { collection } from "@shivaedev/changes/keys.ts"; const local = collection("local", Schema.Number); commit([local.list]);',
		name: "a locally declared collection",
	},
	{ code: 'const router = { invalidate: (_: unknown) => Effect.void }; router.invalidate(["orders"]);', name: "an unrelated invalidate method" },
	{ code: 'function action(commit: (keys: unknown) => void) { commit(["orders"]); }', name: "a shadowed API name" },
]) {
	ruleStory.it(
		`boundaries/imported-change-keys accepts ${name}`,
		[...packages, repositoryHas(orderKeys, changeKeyConsumer(code))],
		function* ({ check }) {
			const findings = yield* check(importedChangeKeys);

			expect(findings).toEqual([]);
		},
	);
}
