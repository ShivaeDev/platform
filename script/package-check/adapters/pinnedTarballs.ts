import { Config, Effect, Order, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { ReleasePlan, WorkspacePackage } from "@shivaedev/releases/model.ts";
import { parseChangeset } from "@shivaedev/releases/parser.ts";
import { computePlan, publishedDependencies } from "@shivaedev/releases/planner.ts";
import { readWorkspace } from "@shivaedev/releases/workspace.ts";
import { declarationChanges, declarationDriftChangeset } from "#lib/declarationChanges.ts";
import { command, requireThat } from "#package-check/io.ts";
import { decodeManifest, type Package, Versions } from "#package-check/model.ts";
import config from "#release-config";

const GENERATOR = "@shivaedev/create-app";
const PublishedVersion = Schema.Struct({
	dependencies: Schema.optional(Versions),
	optionalDependencies: Schema.optional(Versions),
	peerDependencies: Schema.optional(Versions),
});
const RegistryPackage = Schema.Struct({ versions: Schema.Record(Schema.String, PublishedVersion) });

interface Choice {
	readonly name: string;
	readonly reason: string;
	readonly tarball?: string;
	readonly version: string;
}

export const pinnedTarballs = Effect.fn("Packed.pinnedTarballs")(function* (
	root: string,
	packages: readonly Package[],
	pins: Readonly<Record<string, string>>,
) {
	const client = yield* HttpClient.HttpClient;
	const registry = yield* Config.String("npm_config_registry").pipe(Config.withDefault("https://registry.npmjs.org"));
	const publishedVersion = Effect.fn("Packed.publishedVersion")(function* ({ name, version }: { name: string; version: string }) {
		const response = yield* client.get(`${registry}/${encodeURIComponent(name)}`, {
			headers: { accept: "application/vnd.npm.install-v1+json" },
		});
		if (response.status === HttpStatus.fromLiteral("NotFound")) {
			return undefined;
		}
		yield* requireThat(response.status === HttpStatus.fromLiteral("OK"), `npm lookup for ${name} failed with HTTP ${response.status}.`);
		return (yield* HttpClientResponse.schemaBodyJson(RegistryPackage)(response)).versions[version];
	});
	const archives = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));
	const generator = archives.get(GENERATOR)?.manifest;
	// A commit that releases create-app publishes it with pins npm already serves; changesets still pending there wait for the release after it.
	const followsPlan = generator !== undefined && (yield* publishedVersion(generator)) !== undefined;
	if (generator !== undefined && !followsPlan) {
		yield* Effect.log(
			`This commit releases ${GENERATOR}@${generator.version}, which is not on npm, so pending changesets wait for the next release and select no archives.`,
		);
	}
	const workspace = followsPlan ? yield* readWorkspace(root, config) : undefined;
	const pendingReasons =
		workspace === undefined
			? new Map<string, string>()
			: yield* planReasons(yield* computePlan(workspace.packages, workspace.changesets, [], config), workspace.packages);
	const drifted: string[] = [];
	const choices = yield* Effect.forEach(
		Object.keys(pins).sort(Order.String),
		Effect.fn("Packed.choosePinnedSource")(function* (name) {
			const version = pins[name] ?? "";
			const pkg = archives.get(name);
			if (pkg === undefined || pkg.manifest.version !== version) {
				return choice(
					name,
					version,
					pkg === undefined ? "the pull request packs no archive of it" : `the pull request builds ${pkg.manifest.version}`,
				);
			}
			const planned = pendingReasons.get(name);
			if (planned !== undefined) {
				return choice(name, version, planned, pkg.tarball);
			}
			const published = yield* publishedVersion(pkg.manifest);
			if (published === undefined) {
				return choice(name, version, "it is not on npm", pkg.tarball);
			}
			const changes = declarationChanges(
				published,
				decodeManifest(yield* command(pkg.directory, "tar", ["-xzOf", pkg.tarball, "package/package.json"])),
			);
			if (changes.length > 0) {
				drifted.push(name);
				return choice(name, version, changes.join("; "), pkg.tarball);
			}
			return choice(
				name,
				version,
				followsPlan ? "nothing pending releases it and its declarations match npm" : "its version and declarations match npm",
			);
		}),
		{ concurrency: 4 },
	);
	const driftChangeset = declarationDriftChangeset(drifted);
	const driftReasons =
		workspace === undefined || driftChangeset === undefined
			? new Map<string, string>()
			: yield* planReasons(yield* computePlan(workspace.packages, [...workspace.changesets, driftChangeset], [], config), workspace.packages);
	const chosen = choices.map((current) => {
		const pkg = archives.get(current.name);
		const reason = driftReasons.get(current.name);
		return current.tarball === undefined && reason !== undefined && pkg?.manifest.version === current.version
			? choice(current.name, current.version, reason, pkg.tarball)
			: current;
	});
	for (const { name, reason, tarball, version } of chosen) {
		yield* Effect.log(`Installing ${name}@${version} from ${tarball === undefined ? "npm" : "the workspace archive"} because ${reason}.`);
	}
	return Object.fromEntries(chosen.flatMap(({ name, tarball }) => (tarball === undefined ? [] : [[name, tarball] as const])));
});

function choice(name: string, version: string, reason: string, tarball?: string): Choice {
	return tarball === undefined ? { name, reason, version } : { name, reason, tarball, version };
}

const planReasons = Effect.fn("Packed.planReasons")(function* (plan: ReleasePlan, packages: readonly WorkspacePackage[]) {
	const changesets = yield* Effect.forEach(plan.changesets, (source) => Effect.fromResult(parseChangeset(source)));
	const released = new Set(plan.releases.map(({ name }) => name));
	return new Map(
		plan.releases.map(({ bump, name }) => {
			const named = changesets.filter((changeset) => Object.hasOwn(changeset.packages, name)).map((changeset) => `.changeset/${changeset.name}`);
			if (named.length > 0) {
				return [name, `${named.join(" and ")} ${named.length === 1 ? "releases" : "release"} it (${bump})`];
			}
			const manifest = packages.find((pkg) => pkg.manifest.name === name)?.manifest;
			const after = manifest === undefined ? [] : publishedDependencies(manifest).filter((dependency) => released.has(dependency));
			return [name, `the next release patches it as a dependent of ${after.sort(Order.String).join(", ")}`];
		}),
	);
});
