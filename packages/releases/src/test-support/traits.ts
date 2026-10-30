import { Effect, FileSystem } from "effect";
import { CORE, changeset as changesetText, FEATURE_NOTE, git, HISTORY, runCli, write } from "./fixture.ts";
import { editManifest, manifestOf, manifests, rangeOn } from "./manifests.ts";
import { workspace } from "./workspace.ts";

type Bumps = Readonly<Record<string, string>>;

const CONFIG = ".changeset/changesets.config.ts";
const changesetError = new URL("../error.ts", import.meta.url).href;

function asking(packages: Bumps, body: string) {
	const bumps = Object.entries(packages).map(([name, bump]) => `${name} ${bump}`);
	const sections = [...body.matchAll(/^### (?<section>.+)$/gmu)].map((match) => match.groups?.section);
	return `asks for ${bumps.join(" and ")} with ${sections.length === 0 ? "no section heading" : `${sections.join(" and ")} notes`}`;
}

const editChangelog = Effect.fn("ReleasesStory.editChangelog")(function* (root: string, name: string, change: (text: string) => string) {
	const fs = yield* FileSystem.FileSystem;
	const file = `${(yield* manifestOf(root, name)).directory}/CHANGELOG.md`;
	yield* write(root, file, change(yield* fs.readFileString(`${root}/${file}`)));
});

export function changeset(file: string, packages: Bumps, body = FEATURE_NOTE) {
	return workspace.trait("pending", `${file}.md ${asking(packages, body)}`, ({ root }) =>
		write(root, `.changeset/${file}.md`, changesetText(packages, body)),
	);
}

export function renameDeclared(
	from: string,
	to: string,
	{ entry = "rename", frontmatter = to }: { readonly entry?: "rename" | "naming both"; readonly frontmatter?: string } = {},
) {
	const note =
		entry === "rename"
			? `Rename \`${from}\` to \`${to}\`; use the new package name.`
			: `\`${from}\` is now published as \`${to}\`; use the new package name.`;
	return workspace.trait(
		"pending",
		`rename.md declares ${from}'s rename to ${to} in the Breaking entry "${note}" and asks for ${frontmatter} minor`,
		({ root }) => write(root, ".changeset/rename.md", changesetText({ [frontmatter]: "minor" }, `### Breaking\n\n- ${note}\n`)),
	);
}

export function removalDeclared(name: string, replacement: string) {
	return workspace.trait("pending", `retire.md declares ${name}'s removal in a Breaking note and asks for ${CORE} minor`, ({ root }) =>
		write(
			root,
			".changeset/retire.md",
			changesetText({ [CORE]: "minor" }, `### Breaking\n\n- Remove \`${name}\`; use \`${replacement}\` directly.\n`),
		),
	);
}

export function pending(packages: Bumps = { [CORE]: "minor" }) {
	return changeset("feature", packages);
}

export function changesetReading(file: string, description: string, text: string) {
	return workspace.trait("pending", `${file}.md is ${description}`, ({ root }) => write(root, `.changeset/${file}.md`, text));
}

export const directoryInstructions = workspace.trait("pending", ".changeset/README.md holds instructions for authors", ({ root }) =>
	write(root, ".changeset/README.md", "# Author release notes here\n"),
);

export const onMain = workspace.trait("main", "the work so far is merged into main, the base the check compares against", ({ root }) =>
	Effect.sync(() => {
		git(root, ["add", "."]);
		git(root, ["commit", "--allow-empty", "-m", "Work on main"]);
		git(root, ["branch", "-f", "main", "HEAD"]);
	}),
);

export function mergingReleaseFromMain({ withAnotherBranch }: { readonly withAnotherBranch: boolean }) {
	return workspace.trait(
		"main",
		`after the branch committed its own work, main released ${CORE} 0.2.4, and the branch is merging main${withAnotherBranch ? " and another branch" : ""} without committing yet`,
		function* ({ root }) {
			yield* write(root, "feature-work.md", "Feature branch work.\n");
			yield* Effect.sync(() => {
				git(root, ["add", "."]);
				git(root, ["commit", "-m", "Feature work"]);
			});
			if (withAnotherBranch) {
				yield* Effect.sync(() => git(root, ["switch", "-c", "another-change", "main"]));
				yield* write(root, "another-work.md", "Another branch's work.\n");
				yield* Effect.sync(() => {
					git(root, ["add", "."]);
					git(root, ["commit", "-m", "Another change"]);
				});
			}
			yield* Effect.sync(() => git(root, ["switch", "main"]));
			yield* editManifest(root, CORE, ({ json }) => ({ ...json, version: "0.2.4" }));
			yield* editChangelog(root, CORE, (text) =>
				text.replace("# Changelog\n", "# Changelog\n\n## 0.2.4 - 2026-10-18\n\n### Fixed\n\n- Released on main.\n"),
			);
			yield* Effect.sync(() => {
				git(root, ["add", "."]);
				git(root, ["commit", "-m", "Release on main"]);
				git(root, ["switch", "feature"]);
				git(root, ["merge", "--no-commit", ...(withAnotherBranch ? ["another-change", "main"] : ["main"])]);
			});
		},
	);
}

export const applied = workspace.trait("changed", "releases apply has applied the pending changesets on the branch", ({ root }) =>
	Effect.sync(() => {
		const result = runCli(root, ["apply"]);
		if (result.status !== 0) {
			throw new Error(`Could not apply the release precondition: ${result.stderr}`);
		}
	}),
);

export const released = workspace.traits(onMain, applied);

export function laterChangeset(file: string, packages: Bumps, body = FEATURE_NOTE) {
	return workspace.trait("changed", `then ${file}.md ${asking(packages, body)}`, ({ root }) =>
		write(root, `.changeset/${file}.md`, changesetText(packages, body)),
	);
}

export function changesetEdited(file: string, packages: Bumps, body: string) {
	return workspace.trait("changed", `${file}.md is edited and now ${asking(packages, body)}`, ({ root }) =>
		write(root, `.changeset/${file}.md`, changesetText(packages, body)),
	);
}

export function changesetDeleted(file: string) {
	return workspace.trait("changed", `${file}.md is deleted`, function* ({ root }) {
		yield* (yield* FileSystem.FileSystem).remove(`${root}/.changeset/${file}.md`);
	});
}

export const privateWithoutChangelog = workspace.trait(
	"workspace",
	`@test/private, a private dependent of ${CORE}, has no CHANGELOG.md`,
	function* ({ root }) {
		yield* (yield* FileSystem.FileSystem).remove(`${root}/packages/private/CHANGELOG.md`);
	},
);

export function versionSet(name: string, version: string) {
	return workspace.trait("changed", `${name}'s version is set to ${version} by hand`, ({ root }) =>
		editManifest(root, name, ({ json }) => ({ ...json, version })),
	);
}

export function rangeSet(dependent: string, dependency: string, range: string) {
	return workspace.trait("changed", `${dependent} declares ${dependency} with ${range}`, ({ root }) =>
		editManifest(root, dependent, (found) => {
			const { field, ranges } = rangeOn(found, dependency);
			return { ...found.json, [field]: { ...ranges, [dependency]: range } };
		}),
	);
}

export function dependencyAdded(dependent: string, dependency: string, range: string) {
	return workspace.trait("changed", `${dependent} adds a published dependency on ${dependency} with ${range}`, ({ root }) =>
		editManifest(root, dependent, ({ json, manifest }) => ({ ...json, dependencies: { ...manifest.dependencies, [dependency]: range } })),
	);
}

export function renamed(from: string, to: string) {
	return workspace.trait("changed", `${from} is renamed to ${to} in its manifest and in every manifest that names it`, function* ({ root }) {
		for (const { directory, text } of yield* manifests(root)) {
			yield* write(root, `${directory}/package.json`, text.replaceAll(JSON.stringify(from), JSON.stringify(to)));
		}
	});
}

export function moved(name: string, directory: string) {
	return workspace.trait("changed", `${name}'s folder moves to ${directory}, with its CHANGELOG.md`, function* ({ root }) {
		yield* (yield* FileSystem.FileSystem).rename(`${root}/${(yield* manifestOf(root, name)).directory}`, `${root}/${directory}`);
	});
}

export function removed(name: string) {
	return workspace.trait("changed", `${name}'s package.json is deleted`, function* ({ root }) {
		yield* (yield* FileSystem.FileSystem).remove(`${root}/${(yield* manifestOf(root, name)).directory}/package.json`);
	});
}

export function newPackage(name: string) {
	const directory = `packages/${name.slice("@test/".length)}`;
	return workspace.trait("changed", `a new package ${name} appears in ${directory} at the 0.0.0 placeholder, without a changelog`, ({ root }) =>
		write(root, `${directory}/package.json`, JSON.stringify({ name, version: "0.0.0" })),
	);
}

export function historyRewritten(name: string) {
	return workspace.trait("changed", `"Released history." in ${name}'s CHANGELOG.md is rewritten to "Edited history."`, ({ root }) =>
		editChangelog(root, name, (text) => text.replace("Released history.", "Edited history.")),
	);
}

export function changelogEdited(name: string, from: string, to: string) {
	const line = to === "" ? `drops "${from.trim()}"` : `says "${to.trim()}" instead of "${from.trim()}"`;
	return workspace.trait("changed", `${name}'s CHANGELOG.md ${line}`, ({ root }) => editChangelog(root, name, (text) => text.replace(from, to)));
}

export function changelogReset(name: string) {
	return workspace.trait("changed", `${name}'s CHANGELOG.md is reset to its released history, without the new release's notes`, ({ root }) =>
		editChangelog(root, name, () => HISTORY),
	);
}

export function changelogReading(name: string, description: string, text: string) {
	return workspace.trait("changed", `${name}'s CHANGELOG.md ${description}`, ({ root }) => editChangelog(root, name, () => text));
}

export function headingDated(name: string, date: string) {
	return workspace.trait("changed", `${name}'s new release heading is dated ${date}`, ({ root }) =>
		editChangelog(root, name, (text) => text.replace(/^(?<heading>## [^ ]+ - )[^\n]+/mu, `$<heading>${date}`)),
	);
}

export function configured(description: string, source: string) {
	return workspace.trait("changed", `${CONFIG} ${description}`, ({ root }) => write(root, CONFIG, source));
}

export const extraModule = workspace.trait("changed", "modules/extra holds @test/extra 1.0.0, outside the default package folders", ({ root }) =>
	write(root, "modules/extra/package.json", JSON.stringify({ name: "@test/extra", version: "1.0.0" })),
);

export const hookFromSiblingModule = workspace.trait(
	"changed",
	`${CONFIG} imports its hook from the sibling module recordPlan.ts, which records each planned release`,
	function* ({ root }) {
		yield* write(root, CONFIG, 'import recordPlan from "./recordPlan.ts";\nexport default { hooks: [recordPlan] };\n');
		yield* write(
			root,
			".changeset/recordPlan.ts",
			`import { Effect, FileSystem } from "effect";\nexport default ({ root, plan }) => Effect.gen(function* () {\n\tconst fs = yield* FileSystem.FileSystem;\n\tyield* fs.writeFileString(\`\${root}/hook-record.txt\`, plan.releases.map((release) => \`planned \${release.name} \${release.to}\\n\`).join(""));\n});\n`,
		);
	},
);

export function hooksRecordingCore(labels: readonly string[]) {
	return workspace.trait(
		"changed",
		`${CONFIG} runs the hooks ${labels.join(" and ")}, each recording the ${CORE} version it reads on disk`,
		({ root }) =>
			write(
				root,
				CONFIG,
				`import { Effect, FileSystem } from "effect";\nconst record = (label) => ({ root }) => Effect.gen(function* () {\n\tconst fs = yield* FileSystem.FileSystem;\n\tconst { version } = JSON.parse(yield* fs.readFileString(\`\${root}/packages/core/package.json\`));\n\tconst previous = (yield* fs.exists(\`\${root}/hook-record.txt\`)) ? yield* fs.readFileString(\`\${root}/hook-record.txt\`) : "";\n\tyield* fs.writeFileString(\`\${root}/hook-record.txt\`, \`\${previous}\${label} saw ${CORE} at \${version}\\n\`);\n});\nexport default { hooks: [${labels.map((label) => `record(${JSON.stringify(label)})`).join(", ")}] };\n`,
			),
	);
}

export function hookFails(message: string) {
	return workspace.trait("changed", `${CONFIG}'s hook fails with ChangesetError "${message}"`, ({ root }) =>
		write(
			root,
			CONFIG,
			`import { Effect } from "effect";\nimport { ChangesetError } from ${JSON.stringify(changesetError)};\nexport default { hooks: [() => Effect.fail(new ChangesetError({ message: ${JSON.stringify(message)} }))] };\n`,
		),
	);
}
