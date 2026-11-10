import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { carries, effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { ruleCases } from "#test/ruleCases.ts";

const repository = ruleCases.repository(effectResolves());

import { assertThat } from "#testing/adapters/assertThat.ts";

// A Reference whose value is a function, so a parameter of that function type must not count as carrying it.
const CALLBACK_REFERENCE = [
	"type DefaultCallback = (key: string) => boolean;",
	'export const DefaultCallbackReference = Context.Reference<DefaultCallback>("DefaultCallback", { defaultValue: () => (key) => key.length > 0 });',
];

const ORDINARY_PARAMETERS = [
	{ name: "lookalike", type: "{ readonly read: () => Effect.Effect<string> }" },
	{ name: "referenceValue", type: "DefaultCallback" },
];

const CALLABLE_SERVICES = [
	'import { Schema } from "effect";',
	"interface Row { readonly id: string }",
	"type Invalidate = (payload: unknown, result: unknown) => readonly Row[];",
	'export class Invalidation extends Context.Service<Invalidation, Invalidate>()("Invalidation") {}',
	'type Lookup = <T extends "get">(tag: T) => T extends "get" ? Effect.Effect<string> : never;',
	'export class LookupService extends Context.Service<LookupService, Lookup>()("Lookup") {}',
];

const CALLABLE_PARAMETERS = [
	{ code: "export const client = (lookup: Lookup) => lookup;", name: "a generic function that is a service's shape", parameter: "lookup" },
	{ code: "export const direct = (invalidate: Invalidate) => invalidate;", name: "a function that is a service's shape", parameter: "invalidate" },
	{
		code: "export const nested = (services: { readonly invalidate: Invalidate }) => services.invalidate;",
		name: "an object that holds a function that is a service's shape",
		parameter: "services",
	},
];

for (const { name, type } of ORDINARY_PARAMETERS) {
	ruleCases.it(
		`effect/service-parameters accepts a ${name} parameter of type ${type}`,
		[repository.has(serviceModule("src/parameters.ts", ...CALLBACK_REFERENCE, `export const ordinary = (${name}: ${type}) => ${name};`))],
		function* ({ check }) {
			yield* assertThat(yield* check(serviceParameters), (actual) => actual.toEqual([]));
		},
	);
}

ruleCases.it(
	"effect/service-parameters accepts a Schema beside services whose shapes are functions",
	[repository.has(serviceModule("src/collections.ts", ...CALLABLE_SERVICES, "export const schema = (codec: Schema.Top) => codec;"))],
	function* ({ check }) {
		yield* assertThat(yield* check(serviceParameters), (actual) => actual.toEqual([]));
	},
);

for (const { code, name, parameter } of CALLABLE_PARAMETERS) {
	ruleCases.it(
		`effect/service-parameters reports a parameter that takes ${name}`,
		[repository.has(serviceModule("src/collections.ts", ...CALLABLE_SERVICES, code))],
		function* ({ check, messages }) {
			yield* check(serviceParameters);

			yield* assertThat(yield* messages(), (actual) => actual.toEqual([carries(parameter)]));
		},
	);
}
