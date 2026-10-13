import { execFileSync } from "node:child_process";
import { assertPackageChange } from "./assertPackageChange.ts";
import { decodeVersion, type PackageNotes } from "./package.ts";

function git(root: string, args: readonly string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export function readCommittedNotes(root: string, revision: string, name: string): PackageNotes | undefined {
	const directory = `packages/${name}`;
	const paths = git(root, ["ls-tree", "-r", "--name-only", revision, directory]).trim().split("\n");
	if (!paths.includes(`${directory}/package.json`)) {
		return undefined;
	}
	function read(path: string) {
		return git(root, ["show", `${revision}:${path}`]);
	}
	return {
		changelog: paths.includes(`${directory}/CHANGELOG.md`) ? read(`${directory}/CHANGELOG.md`) : "# Changelog\n",
		fragments: paths
			.filter((path) => path.startsWith(`${directory}/changes/`) && path.endsWith(".md"))
			.map((path) => ({ name: path.slice(`${directory}/changes/`.length), text: read(path) })),
		version: decodeVersion(read(`${directory}/package.json`)),
	};
}

export function releaseNotes(root: string, base: string, name: string, before: PackageNotes, after: PackageNotes): PackageNotes {
	if (before.version === after.version || before.changelog === after.changelog) {
		return before;
	}
	const commits = git(root, ["rev-list", "--first-parent", `${base}..HEAD`, "--", `packages/${name}`])
		.trim()
		.split("\n")
		.filter(Boolean);
	for (const commit of commits) {
		const notes = readCommittedNotes(root, commit, name);
		if (notes?.version === before.version) {
			assertPackageChange(name, before, notes);
			return notes;
		}
	}
	return before;
}
