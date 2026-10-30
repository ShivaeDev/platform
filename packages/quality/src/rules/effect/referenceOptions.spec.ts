import { expect } from "vitest";
import { effectPolicyStory, policyFiles } from "#effect-policy-story";
import { SERVICE_DECLARATION } from "#test/effectPolicyFiles.ts";

effectPolicyStory.it(
	"plain option data stays ordinary inside Vitest types while service keys and implementations stay visible",
	[
		policyFiles({
			content: `${SERVICE_DECLARATION}
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import type { TestSpecification } from "vitest/node";
export const RequestDefaults = FetchHttpClient.RequestInit;
interface Options { readonly cache?: string }
export const Defaults = Context.Reference<Options>("Defaults", { defaultValue: () => ({}) });
interface OptionalBehavior { readonly read?: () => Effect.Effect<string> }
export const OptionalService = Context.Reference<OptionalBehavior>("OptionalService", { defaultValue: () => ({}) });
interface RequiredData { readonly value: string }
export const RequiredReference = Context.Reference<RequiredData>("RequiredReference", { defaultValue: () => ({ value: "" }) });
interface OptionalServiceData { readonly value?: string; readonly read?: () => Effect.Effect<string> }
export class DataService extends Context.Service<DataService, OptionalServiceData>()("DataService") {}
export const request = (options: RequestInit) => options;
export const nested = (test: TestSpecification) => test.moduleId;
export const options = (settings: Options) => settings;
export const tag = (serviceKey: typeof Store) => serviceKey;
export const implementation = (serviceImplementation: StoreShape) => serviceImplementation;
export const reference = (referenceKey: typeof RequestDefaults) => referenceKey;
export const optional = (optionalImplementation: OptionalBehavior) => optionalImplementation;
export const required = (requiredReference: RequiredData) => requiredReference;
export const data = (serviceData: OptionalServiceData) => serviceData;
export const carried = (nestedService: { readonly options?: Options; readonly store?: StoreShape }) => nestedService;`,
			path: "src/options.ts",
		}),
	],
	function* ({ lint }) {
		const result = yield* lint();
		const exitCode = result.status;
		expect(exitCode).toBe(1);
		expect(result.stdout.match(/Parameter .+ carries a service\./gu)).toEqual([
			"Parameter serviceKey carries a service.",
			"Parameter serviceImplementation carries a service.",
			"Parameter referenceKey carries a service.",
			"Parameter optionalImplementation carries a service.",
			"Parameter requiredReference carries a service.",
			"Parameter serviceData carries a service.",
			"Parameter nestedService carries a service.",
		]);
	},
);
