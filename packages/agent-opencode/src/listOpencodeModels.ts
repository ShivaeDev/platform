import { Effect, Option, Schema } from "effect";
import type { ModelChoice } from "@shivaedev/agent/eventData.ts";
import type { ReadFailure as BackendFailure } from "@shivaedev/agent/failures.ts";
import { opencodeFailure } from "#failure.ts";
import { Provider } from "#Provider.ts";
import { ProvidersResponse } from "#protocol.ts";

const decodeProviders = Schema.decodeUnknownOption(ProvidersResponse);
type Providers = typeof ProvidersResponse.Type;
function catalogued({ default: defaults, providers }: Providers): readonly ModelChoice[] {
	const listed: ModelChoice[] = [];
	let preferred: string | undefined;
	for (const provider of providers) {
		for (const model of Object.values(provider.models)) {
			const id = `${provider.id}/${model.id}`;
			if (preferred === undefined && defaults[provider.id] === model.id) {
				preferred = id;
			}
			listed.push({ efforts: Object.keys(model.variants ?? {}), id, isDefault: false, name: model.name });
		}
	}
	const standing = preferred ?? listed[0]?.id;
	return listed.map((model) => (model.id === standing ? { ...model, isDefault: true } : model));
}
function catalogue(response: unknown): Effect.Effect<readonly ModelChoice[], BackendFailure> {
	return Option.match(decodeProviders(response), {
		onNone: () => Effect.fail(opencodeFailure("GET /config/providers returned no catalog")),
		onSome: (listing) => Effect.succeed(catalogued(listing)),
	});
}
export const listOpencodeModels = Effect.fn("OpenCode.listOpencodeModels")(function* () {
	const server = yield* Provider;
	return yield* server.get({ body: undefined, path: "/config/providers", query: {} }).pipe(Effect.flatMap(catalogue));
});
