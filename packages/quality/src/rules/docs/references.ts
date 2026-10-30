import { join, posix } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { headingAnchors } from "#docs/headingAnchors.ts";
import { importFindings } from "#docs/importFindings.ts";
import { isDocument } from "#docs/isDocument.ts";
import { linkFindings } from "#docs/linkFindings.ts";
import { markdownLines } from "#docs/markdownLines.ts";
import { repositoryOf } from "#docs/repositoryLink.ts";
import { type WorkspacePackage, workspacePackages } from "#imports/workspace.ts";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";

function field(value: unknown, key: string): unknown {
	return typeof value === "object" && value !== null && key in value ? Reflect.get(value, key) : undefined;
}

// A linked document, such as CLAUDE.md beside AGENTS.md, is checked once through its target.
function isLink(root: string, file: string): boolean {
	const real = ts.sys.realpath ?? ((path: string) => path);
	return real(join(root, file)) !== join(real(root), file);
}

function reader(inputs: RuleInputs): (path: string) => Effect.Effect<string | undefined> {
	return (path) => Effect.promise(() => inputs.readText(path));
}

function anchorsReader(read: ReturnType<typeof reader>): (path: string) => Effect.Effect<ReadonlySet<string> | undefined> {
	const known = new Map<string, ReadonlySet<string> | undefined>();
	return (path) =>
		known.has(path)
			? Effect.succeed(known.get(path))
			: Effect.map(read(path), (text) => {
					const anchors = text === undefined ? undefined : headingAnchors(markdownLines(text));
					known.set(path, anchors);
					return anchors;
				});
}

const references = Effect.fn("Docs.references")(function* (inputs: RuleInputs) {
	const read = reader(inputs);
	const packages: readonly WorkspacePackage[] = yield* Effect.promise(() => workspacePackages(inputs));
	const manifests = new Map(
		yield* Effect.forEach(packages, (owner) =>
			Effect.map(
				Effect.promise(() => readPackageManifest(inputs.readText, posix.join(owner.directory, "package.json"))),
				(manifest) => [owner.name, manifest] as const,
			),
		),
	);
	const shared = {
		anchors: anchorsReader(read),
		exports: new Map([...manifests].map(([name, manifest]) => [name, field(manifest, "exports")])),
		packages: new Map(packages.map((owner) => [owner.name, owner])),
		readText: read,
		repository: repositoryOf(yield* Effect.promise(() => readPackageManifest(inputs.readText, "package.json"))),
		root: inputs.root,
	};
	const documents = inputs.files.filter((file) => isDocument(file) && !isLink(inputs.root, file));
	const findings = yield* Effect.forEach(documents, (file) =>
		Effect.flatMap(read(file), (text): Effect.Effect<readonly Finding[]> => {
			if (text === undefined) {
				return Effect.succeed([]);
			}
			const readme = packages.find((owner) => file === posix.join(owner.directory, "README.md"));
			const published = readme !== undefined && field(manifests.get(readme.name), "private") !== true ? readme.directory : undefined;
			const context = { ...shared, owner: readme?.name, published };
			return Effect.map(Effect.all([linkFindings(context, file, markdownLines(text)), importFindings(context, file, text)]), (found) =>
				found.flat().toSorted((left, right) => (left.line ?? 0) - (right.line ?? 0)),
			);
		}),
	);
	return findings.flat();
});

export const docsReferences = defineRule({
	check: (inputs) => Effect.runPromise(references(inputs)),
	description:
		"Links, heading anchors and documented modules and exports in Markdown resolve, so documentation cannot point at a file, a heading or an API that no longer exists.",
	id: "docs/references",
});
