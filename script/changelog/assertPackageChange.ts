import { collectFragments, migrateUnreleased, parseFragment, renderFragments } from "./fragments.ts";
import type { PackageNotes } from "./package.ts";

function preservedFragments(before: PackageNotes, after: PackageNotes): boolean {
	return before.fragments.every((old) => after.fragments.some((fragment) => fragment.name === old.name && fragment.text === old.text));
}

function isMigration(before: PackageNotes, after: PackageNotes): boolean {
	const migration = migrateUnreleased(before.changelog);
	if (migration === undefined || before.version !== after.version || migration.changelog !== after.changelog) {
		return false;
	}
	const added = after.fragments.filter((fragment) => !before.fragments.some((old) => old.name === fragment.name));
	const legacy = migration.fragment === "" ? [] : [{ name: "unreleased.md", text: migration.fragment }];
	return preservedFragments(before, after) && renderFragments(added) === renderFragments(legacy);
}

function assertRelease(name: string, before: PackageNotes, after: PackageNotes): void {
	const date = /^## [^\n]+ - (?<date>\d{4}-\d{2}-\d{2})$/mu.exec(after.changelog)?.groups?.date;
	const fragments = after.release?.fragments ?? before.fragments;
	if (date === undefined || fragments.length === 0) {
		throw new Error(`${name}: a release must collect and delete its pending fragments.`);
	}
	if (after.release !== undefined && (after.release.version !== after.version || after.release.date !== date)) {
		throw new Error(`${name}: release.json must match the released version and date.`);
	}
	if (new Set(fragments.map((fragment) => fragment.name)).size !== fragments.length) {
		throw new Error(`${name}: collect fragments with unique fragment names.`);
	}
	if (fragments.some((collected) => after.fragments.some((pending) => pending.name === collected.name))) {
		throw new Error(`${name}: a release must collect and delete its named fragments.`);
	}
	if (!preservedFragments(before, { ...after, fragments: [...after.fragments, ...fragments] })) {
		throw new Error(`${name}: keep existing fragments unchanged, either pending or collected.`);
	}
	if (collectFragments(before.changelog, after.version, date, fragments) !== after.changelog) {
		throw new Error(`${name}: release notes must match pnpm run changelog:release ${name}; released history cannot be edited.`);
	}
}

export function assertPackageChange(name: string, before: PackageNotes | undefined, after: PackageNotes): void {
	if (/^## Unreleased\s*$/mu.test(after.changelog)) {
		throw new Error(`${name}: record pending changes in changes/<short-name>.md, without an Unreleased section.`);
	}
	after.fragments.forEach(parseFragment);
	if (before === undefined) {
		return;
	}
	if (before.version === after.version && JSON.stringify(before.release) !== JSON.stringify(after.release)) {
		throw new Error(`${name}: release.json changes only in a release.`);
	}
	if (before.version === after.version && !preservedFragments(before, after)) {
		throw new Error(`${name}: keep existing fragments intact; add a new changes/<short-name>.md file for this PR.`);
	}
	if (before.changelog === after.changelog) {
		if (before.version !== after.version && (before.fragments.length > 0 || after.fragments.length > 0)) {
			throw new Error(`${name}: a release must collect and delete its named fragments with pnpm run changelog:release ${name}.`);
		}
		return;
	}
	if (isMigration(before, after)) {
		return;
	}
	if (before.version === after.version) {
		throw new Error(`${name}: CHANGELOG.md changes only in a release; add changes/<short-name>.md instead.`);
	}
	assertRelease(name, before, after);
}
