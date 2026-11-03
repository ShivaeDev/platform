import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { carries, effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const REFERENCES = [
	'import * as FetchHttpClient from "effect/http/FetchHttpClient";',
	'import type { TestSpecification } from "vitest/node";',
	"export const RequestDefaults = FetchHttpClient.RequestInit;",
	"interface Options { readonly cache?: string }",
	'export const Defaults = Context.Reference<Options>("Defaults", { defaultValue: () => ({}) });',
	"interface OptionalBehavior { readonly read?: () => Effect.Effect<string> }",
	'export const OptionalService = Context.Reference<OptionalBehavior>("OptionalService", { defaultValue: () => ({}) });',
	"interface RequiredData { readonly value: string }",
	'export const RequiredReference = Context.Reference<RequiredData>("RequiredReference", { defaultValue: () => ({ value: "" }) });',
	"interface OptionalServiceData { readonly value?: string; readonly read?: () => Effect.Effect<string> }",
	'export class DataService extends Context.Service<DataService, OptionalServiceData>()("DataService") {}',
	'export const BrowserFetch = Context.Reference<typeof globalThis.fetch>("BrowserFetch", { defaultValue: () => globalThis.fetch });',
];

const OPTION_PARAMETERS = [
	{ code: "export const request = (options: RequestInit) => options;", name: "the RequestInit options a Reference holds" },
	{ code: "export const nested = (test: TestSpecification) => test.moduleId;", name: "a Vitest type that holds plain options" },
	{ code: "export const options = (settings: Options) => settings;", name: "options that a Reference of optional data holds" },
];

const REFERENCE_PARAMETERS = [
	{
		code: "export const reference = (referenceKey: typeof RequestDefaults) => referenceKey;",
		name: "the key of a Reference",
		parameter: "referenceKey",
	},
	{
		code: "export const fetching = (fetchKey: typeof BrowserFetch) => fetchKey;",
		name: "the key of a Reference to a function",
		parameter: "fetchKey",
	},
	{
		code: "export const optional = (optionalImplementation: OptionalBehavior) => optionalImplementation;",
		name: "a Reference's shape whose optional members are functions",
		parameter: "optionalImplementation",
	},
	{
		code: "export const required = (requiredReference: RequiredData) => requiredReference;",
		name: "a Reference's shape with a required member",
		parameter: "requiredReference",
	},
	{
		code: "export const data = (serviceData: OptionalServiceData) => serviceData;",
		name: "a service's shape of optional members",
		parameter: "serviceData",
	},
	{
		code: "export const carried = (nestedService: { readonly options?: Options; readonly store?: StoreShape }) => nestedService;",
		name: "an object that holds options beside a service shape",
		parameter: "nestedService",
	},
];

ruleStory.it(
	"effect/service-parameters accepts plain options held by References and third-party types",
	[
		effectResolves(),
		repositoryHas(
			...OPTION_PARAMETERS.map(({ code }, index) => serviceModule(`src/options-${String(index).padStart(2, "0")}.ts`, ...REFERENCES, code)),
		),
	],
	function* ({ check }) {
		expect(yield* check(serviceParameters)).toEqual([]);
	},
);

ruleStory.it(
	"effect/service-parameters reports Reference keys and service shapes alongside plain options",
	[
		effectResolves(),
		repositoryHas(
			...REFERENCE_PARAMETERS.map(({ code }, index) => serviceModule(`src/reference-${String(index).padStart(2, "0")}.ts`, ...REFERENCES, code)),
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceParameters);

		expect(findings.map(({ file, message }) => ({ file, message }))).toEqual(
			REFERENCE_PARAMETERS.map(({ parameter }, index) => ({
				file: `src/reference-${String(index).padStart(2, "0")}.ts`,
				message: carries(parameter),
			})),
		);
	},
);
