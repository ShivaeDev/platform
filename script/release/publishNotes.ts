import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect, FileSystem, Path, Schema } from "effect";
import { write } from "@shivaedev/github/write.ts";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { forwardedEntry } from "@shivaedev/releases/forwardedEntry.ts";
import { type Entry, parseBody, renderEntries } from "@shivaedev/releases/sections.ts";
import { readWorkspace } from "@shivaedev/releases/workspace.ts";
import { githubLayer } from "#lib/githubLayer.ts";
import { type PublishedPackage, PublishedPackages } from "#release/publishedPackages.ts";
import config from "#release-config";

// GitHub's releases API refuses a longer body with "body is too long (maximum is 125000 characters)". Its REST
// documentation states no limit; the number is taken from that refusal, which other release tools also truncate for.
const RELEASE_BODY_LIMIT = 125_000;

interface PackageNotes {
	readonly breaking: readonly Entry[];
	readonly directory: string;
	readonly name: string;
	readonly notes: string;
	readonly version: string;
}

const publishedNotes = Effect.fn("Release.publishedNotes")(function* (root: string, published: readonly PublishedPackage[]) {
	const workspace = yield* readWorkspace(root, config);
	const packages: PackageNotes[] = [];
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
		const entries = yield* Effect.fromResult(parseBody(`${name}@${version}`, notes));
		packages.push({ breaking: entries.filter((entry) => entry.section === "Breaking"), directory: pkg.directory, name, notes, version });
		rules.push(...entries.filter((entry) => entry.section === "Quality rules"));
	}
	return { packages, rules };
});

function migrationChecklist(packages: readonly PackageNotes[], rules: readonly Entry[]) {
	const owners = new Map(packages.flatMap(({ breaking, name }) => breaking.map((entry) => [forwardedEntry(name, entry).text, name] as const)));
	const groups = packages.flatMap(({ name, breaking: entries }) => {
		const owned = entries.filter((entry) => (owners.get(entry.text) ?? name) === name);
		return owned.length === 0 ? [] : [`### ${name}\n\n${renderEntries(owned, false)}`];
	});
	return groups.length === 0 && rules.length === 0
		? "No breaking changes or new or stricter quality rules in this release."
		: ["## Migration checklist", ...groups, ...(rules.length === 0 ? [] : [renderEntries(rules).trimEnd()])].join("\n\n");
}

const releaseBody = Effect.fn("Release.releaseBody")(function* (
	migrations: string,
	packages: readonly PackageNotes[],
	changelogUrl: (pkg: PackageNotes) => string,
) {
	const sections = packages.map((pkg) => ({ pkg, text: `## ${pkg.name} ${pkg.version}\n\n${pkg.notes}` }));
	function body() {
		return `${[migrations, ...sections.map(({ text }) => text)].join("\n\n")}\n`;
	}
	for (const section of sections.toSorted((left, right) => right.text.length - left.text.length)) {
		if (body().length <= RELEASE_BODY_LIMIT) {
			break;
		}
		const { name, version } = section.pkg;
		section.text = `## ${name} ${version}\n\nThese notes are too long for one GitHub release; read them in [CHANGELOG.md](${changelogUrl(section.pkg)}).`;
	}
	if (body().length > RELEASE_BODY_LIMIT) {
		return yield* new ChangesetError({
			message: `The migration checklist takes ${migrations.length} characters; with every package's notes linked, the release body is still over GitHub's ${RELEASE_BODY_LIMIT}-character limit.`,
		});
	}
	return body();
});

export const publishNotes = Effect.fn("Release.publishNotes")(function* (
	root: string,
	repository: string,
	published: readonly PublishedPackage[],
	commit: string,
) {
	if (published.length === 0) {
		return;
	}
	const tag = `release-${commit}`;
	const { packages, rules } = yield* publishedNotes(root, published);
	const body = yield* releaseBody(
		migrationChecklist(packages, rules),
		packages,
		({ directory }) => `https://github.com/${repository}/blob/${tag}/${directory}/CHANGELOG.md`,
	);
	yield* write(
		"POST",
		`/repos/${repository}/releases`,
		{ body, name: `Release ${commit.slice(0, 7)}`, "tag_name": tag, "target_commitish": commit },
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
