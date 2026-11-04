import { Effect } from "effect";
import { ChangesetError } from "#error.ts";
import type { Bump } from "#model.ts";

const parseVersion = Effect.fn("Changesets.parseVersion")(function* (name: string, version: string) {
	const match = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)$/u.exec(version);
	if (match === null) {
		return yield* new ChangesetError({ message: `${name}: use a stable major.minor.patch version before planning a release; found ${version}.` });
	}
	return [Number(match.groups?.major), Number(match.groups?.minor), Number(match.groups?.patch)] as const;
});

export const nextVersion = Effect.fn("Changesets.nextVersion")(function* (name: string, version: string, bump: Bump, floor?: string) {
	let parts = yield* parseVersion(name, version);
	if (floor !== undefined) {
		const minimum = yield* parseVersion(`${name} version floor`, floor);
		const difference = parts[0] - minimum[0] || parts[1] - minimum[1] || parts[2] - minimum[2];
		if (difference < 0) {
			parts = minimum;
		}
	}
	const [major, minor, patch] = parts;
	if (bump === "major") {
		return `${major + 1}.0.0`;
	}
	return bump === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
});
