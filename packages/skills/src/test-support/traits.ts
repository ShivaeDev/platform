import { fileURLToPath } from "node:url";
import { readInstalled } from "#installed.ts";
import { syncSkills } from "#syncSkills.ts";
import { removeFile, select, writeFile } from "./fixture.ts";
import { MANIFEST, skills } from "./skills.ts";

export function selected(...names: readonly string[]) {
	return skills.trait("selected", `the repository selects ${names.join(", ") || "no shared skills"}`, ({ repo }) => select(repo, names));
}

export const synced = skills.trait("synced", "the selected skills have been synced", ({ installed, repo }) => syncSkills(repo, installed));

export function selectionChangedTo(...names: readonly string[]) {
	return skills.trait("changed", `the selection changes to ${names.join(", ") || "no shared skills"}`, ({ repo }) => select(repo, names));
}

export const versionBumped = skills.trait("changed", "the installed package is bumped to 1.3.0", (engine) => {
	engine.installed = { ...engine.installed, version: "1.3.0" };
});

export function editedCopy(name: string, content = "# Edited by hand\n") {
	return skills.trait("changed", `${name}'s copied instructions are edited by hand`, ({ repo }) =>
		writeFile(`.agents/skills/${name}/SKILL.md`, content)(repo),
	);
}

export function addedCopyFile(name: string, file = "references/more.md", content = "# Added by hand\n") {
	return skills.trait("changed", `${name}'s copy has an extra file`, ({ repo }) => writeFile(`.agents/skills/${name}/${file}`, content)(repo));
}

export const removedNotes = skills.trait("changed", "alpha's copied notes are removed", ({ repo }) =>
	removeFile(".agents/skills/alpha/references/notes.md")(repo),
);

export const deletedBeta = skills.trait("changed", "beta's copied folder is deleted", ({ repo }) => removeFile(".agents/skills/beta")(repo));

export const localSkills = skills.trait("selected", "the repository has its own skills in both agent directories", function* ({ repo }) {
	yield* writeFile(".agents/skills/own/SKILL.md", "# Own\n")(repo);
	yield* writeFile(".claude/skills/local/SKILL.md", "# Local\n")(repo);
});

export const collidingSkills = skills.trait("selected", "local skills collide with selected names in both agent directories", function* ({ repo }) {
	yield* writeFile(".agents/skills/alpha/SKILL.md", "# Our alpha\n")(repo);
	yield* writeFile(".claude/skills/beta/SKILL.md", "# Our beta\n")(repo);
});

export function damagedManifest(content: string) {
	return skills.trait("changed", `the sync manifest is damaged: ${content}`, ({ repo }) => writeFile(MANIFEST, content)(repo));
}

export function invalidSelection(content: string) {
	return skills.trait("selected", `package.json has an invalid selection: ${content}`, ({ repo }) => writeFile("package.json", content)(repo));
}

export const shippedSkills = skills.trait("selected", "the repository selects the package's shipped skills", function* (engine) {
	engine.installed = yield* readInstalled(fileURLToPath(new URL("../..", import.meta.url)));
	yield* select(engine.repo, ["pr-description", "story-testing"]);
});
