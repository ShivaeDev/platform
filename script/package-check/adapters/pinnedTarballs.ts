import { Config, Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { declarationChanges } from "#lib/declarationChanges.ts";
import { matchingWorkspaceTarballs } from "#package-check/adapters/matchingWorkspaceTarballs.ts";
import { command, requireThat } from "#package-check/io.ts";
import { decodeManifest, type Package, Versions } from "#package-check/model.ts";

const PublishedVersion = Schema.Struct({
	dependencies: Schema.optional(Versions),
	optionalDependencies: Schema.optional(Versions),
	peerDependencies: Schema.optional(Versions),
});
const RegistryPackage = Schema.Struct({ versions: Schema.Record(Schema.String, PublishedVersion) });

export const pinnedTarballs = Effect.fn("Packed.pinnedTarballs")(function* (
	packages: readonly Package[],
	pins: Readonly<Record<string, string>>,
	options: { preferWorkspace?: readonly string[] } = {},
) {
	const workspace = matchingWorkspaceTarballs(packages, pins, options.preferWorkspace ?? []);
	const preferred = new Set(Object.keys(workspace));
	const matching = packages.filter(({ manifest }) => pins[manifest.name] === manifest.version && !preferred.has(manifest.name));
	const client = yield* HttpClient.HttpClient;
	const registry = yield* Config.String("npm_config_registry").pipe(Config.withDefault("https://registry.npmjs.org"));
	const entries = yield* Effect.forEach(
		matching,
		Effect.fn("Packed.lookupPinnedTarball")(function* ({ directory, manifest: { name, version }, tarball }) {
			const response = yield* client.get(`${registry}/${encodeURIComponent(name)}`, {
				headers: { accept: "application/vnd.npm.install-v1+json" },
			});
			let reasons: readonly string[] = ["it is not on npm"];
			if (response.status !== HttpStatus.fromLiteral("NotFound")) {
				yield* requireThat(response.status === HttpStatus.fromLiteral("OK"), `npm lookup for ${name} failed with HTTP ${response.status}.`);
				const published = (yield* HttpClientResponse.schemaBodyJson(RegistryPackage)(response)).versions[version];
				if (published !== undefined) {
					reasons = declarationChanges(published, decodeManifest(yield* command(directory, "tar", ["-xzOf", tarball, "package/package.json"])));
				}
			}
			if (reasons.length === 0) {
				return [];
			}
			yield* Effect.log(`Installing ${name}@${version} from the workspace archive because ${reasons.join("; ")}.`);
			return [[name, tarball]] as const;
		}),
		{ concurrency: 4 },
	);
	return { ...Object.fromEntries(entries.flat()), ...workspace };
});
