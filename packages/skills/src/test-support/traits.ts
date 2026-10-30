import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Path } from "effect";
import { readInstalled } from "#installed.ts";
import { syncSkills } from "#syncSkills.ts";
import { removeFile, select, writeFile } from "./fixture.ts";
import { MANIFEST, printedOrFailed, skills } from "./skills.ts";
import { checkOutPullRequest } from "./workflow.ts";

export const OWN_SKILL = "# The repository's own skill\n";
export const EDITED = "# Edited by hand\n";
export const ADDED = "# Added by hand\n";

function listed(names: readonly string[]) {
	return names.join(", ") || "no shared skills";
}

export function selected(...names: readonly string[]) {
	return skills.trait("selected", `the repository selects ${listed(names)}`, (engine) => select(engine, names));
}

export function packageJsonReads(content: string) {
	return skills.trait("selected", `the repository's package.json reads ${content}`, ({ repo }) => writeFile("package.json", content)(repo));
}

export function selectsShipped(...names: readonly string[]) {
	return skills.trait("selected", `the repository selects ${listed(names)} from the skills this package ships`, function* (engine) {
		engine.installed = yield* readInstalled(fileURLToPath(new URL("../..", import.meta.url)));
		yield* select(engine, names);
	});
}

export function ownSkill(folder: string) {
	return skills.trait("owned", `the repository keeps its own skill at ${folder}`, ({ repo }) => writeFile(`${folder}/SKILL.md`, OWN_SKILL)(repo));
}

export function ownBrokenLink(link: string) {
	return skills.trait("owned", `the repository keeps its own link at ${link}, whose target is gone`, function* ({ repo }) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		yield* fs.makeDirectory(path.dirname(path.join(repo, link)), { recursive: true });
		yield* fs.symlink("../../gone", path.join(repo, link));
	});
}

export const synced = skills.trait("synced", "the repository has synced its selection", ({ installed, repo }) =>
	Effect.flatMap(printedOrFailed(repo, syncSkills(repo, installed)), (outcome) =>
		outcome.startsWith("failed: ") ? Effect.die(new Error(`The synced trait could not sync: ${outcome}`)) : Effect.void,
	),
);

export function alsoSelects(name: string) {
	return skills.trait("changed", `the repository adds ${name} to its selection`, (engine) => select(engine, [...engine.selection, name]));
}

export function deselects(name: string) {
	return skills.trait("changed", `the repository drops ${name} from its selection`, (engine) =>
		select(
			engine,
			engine.selection.filter((selectedName) => selectedName !== name),
		),
	);
}

export const selectionEmptied = skills.trait("changed", "the repository empties its selection to []", (engine) => select(engine, []));

export function packageBumpedTo(version: string) {
	return skills.trait("changed", `the installed @shivaedev/skills is bumped from 1.2.0 to ${version}`, (engine) => {
		engine.installed = { ...engine.installed, version };
	});
}

export function editedByHand(name: string, file: string) {
	return skills.trait("changed", `${file} in ${name}'s copy is edited by hand`, ({ repo }) =>
		writeFile(`.agents/skills/${name}/${file}`, EDITED)(repo),
	);
}

export function addedByHand(name: string, file: string) {
	return skills.trait("changed", `${file} is added by hand to ${name}'s copy`, ({ repo }) =>
		writeFile(`.agents/skills/${name}/${file}`, ADDED)(repo),
	);
}

export function removedByHand(name: string, file: string) {
	return skills.trait("changed", `${file} is removed by hand from ${name}'s copy`, ({ repo }) => removeFile(`.agents/skills/${name}/${file}`)(repo));
}

export function copyDeleted(name: string) {
	return skills.trait("changed", `${name}'s copied folder is deleted`, ({ repo }) => removeFile(`.agents/skills/${name}`)(repo));
}

export function manifestOverwritten(content: string) {
	return skills.trait("changed", `the sync manifest is overwritten by hand with ${content}`, ({ repo }) => writeFile(MANIFEST, content)(repo));
}

export const pullRequestBranch = skills.trait(
	"pushed",
	"the selection is committed and pushed on a pull request branch, with the package's executable installed",
	function* (engine) {
		engine.remote = yield* checkOutPullRequest(engine.repo);
	},
);
