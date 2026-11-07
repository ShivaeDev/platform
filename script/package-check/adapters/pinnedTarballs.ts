import { Config, Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { requireThat } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

const RegistryPackage = Schema.Struct({ versions: Schema.Record(Schema.String, Schema.Unknown) });

export const pinnedTarballs = Effect.fn("Packed.pinnedTarballs")(function* (packages: readonly Package[]) {
	const client = yield* HttpClient.HttpClient;
	const registry = yield* Config.String("npm_config_registry").pipe(Config.withDefault("https://registry.npmjs.org"));
	const entries = yield* Effect.forEach(
		packages,
		Effect.fn("Packed.lookupPinnedTarball")(function* ({ manifest: { name, version }, tarball }) {
			const response = yield* client.get(`${registry}/${encodeURIComponent(name)}`, {
				headers: { accept: "application/vnd.npm.install-v1+json" },
			});
			if (response.status !== HttpStatus.fromLiteral("NotFound")) {
				yield* requireThat(response.status === HttpStatus.fromLiteral("OK"), `npm lookup for ${name} failed with HTTP ${response.status}.`);
				const document = yield* HttpClientResponse.schemaBodyJson(RegistryPackage)(response);
				if (Object.hasOwn(document.versions, version)) {
					return [];
				}
			}
			return [[`${name}@${version}`, tarball]] as const;
		}),
		{ concurrency: 4 },
	);
	return Object.fromEntries(entries.flat());
});
