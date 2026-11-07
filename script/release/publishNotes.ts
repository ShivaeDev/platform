import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect, FileSystem, Path, Schema } from "effect";
import { write } from "@shivaedev/github/write.ts";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { type Entry, parseBody, renderEntries } from "@shivaedev/releases/sections.ts";
import { readWorkspace } from "@shivaedev/releases/workspace.ts";
import { githubLayer } from "#lib/githubLayer.ts";
import { type PublishedPackage, PublishedPackages } from "#release/publishedPackages.ts";
import config from "#release-config";

export const publishNotes = Effect.fn("Release.publishNotes")(function* (
	root: string,
	repository: string,
	published: readonly PublishedPackage[],
	commit: string,
) {
	if (published.length === 0) {
		return;
	}
	const workspace = yield* readWorkspace(root, config);
	const packages: string[] = [];
	const breaking: string[] = [];
	const rules: Entry[] = [];
	for (const pkg of workspace.packages.filter(({ manifest }) =>
		published.some(({ name, version }) => name === manifest.name && version === manifest.version),
	)) {
		const { name, version } = pkg.manifest;
		const section = pkg.changelog.split(/^## /mu).find((text) => text.startsWith(`${version} - `) || text.startsWith(`${version}\n`));
		if (section === undefined) {
			return yield* new ChangesetError({ message: `${name}@${version}: no released changelog notes.` });
		}
		const notes = section.slice(section.indexOf("\n") + 1).trim();
		packages.push(`## ${name} ${version}\n\n${notes}`);
		const entries = yield* Effect.fromResult(parseBody(`${name}@${version}`, notes));
		const migrations = entries.filter((entry) => entry.section === "Breaking");
		if (migrations.length > 0) {
			breaking.push(`### ${name}\n\n${renderEntries(migrations, false)}`);
		}
		rules.push(...entries.filter((entry) => entry.section === "Quality rules"));
	}
	const migrations =
		breaking.length === 0 && rules.length === 0
			? "No breaking changes or new or stricter quality rules in this release."
			: ["## Migration checklist", ...breaking, ...(rules.length === 0 ? [] : [renderEntries(rules).trimEnd()])].join("\n\n");
	yield* write(
		"POST",
		`/repos/${repository}/releases`,
		{
			body: `${[migrations, ...packages].join("\n\n")}\n`,
			name: `Release ${commit.slice(0, 7)}`,
			"tag_name": `release-${commit}`,
			"target_commitish": commit,
		},
		Schema.Struct({ id: Schema.Number }),
	);
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const root = path.resolve(".");
			const summary = yield* fs.readFileString(path.join(root, "pnpm-publish-summary.json"));
			const { publishedPackages } = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(PublishedPackages))(summary);
			yield* publishNotes(root, yield* Config.String("GITHUB_REPOSITORY"), publishedPackages, yield* Config.String("RELEASE_HEAD_SHA"));
		}).pipe(Effect.provide(githubLayer), Effect.provide(NodeServices.layer)),
	);
}
