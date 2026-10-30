import { Effect } from "effect";
import type { ChangesetConfig } from "#config.ts";
import { ChangesetError } from "#error.ts";
import type { Source, Workspace } from "#model.ts";
import { parseChangeset } from "#parser.ts";
import { computePlan } from "#planner.ts";
import { previousPackage } from "#previousPackage.ts";
import { readHistory } from "#readHistory.ts";
import { validateRelease } from "#validateRelease.ts";
import { readWorkspace } from "#workspace.ts";

const validateInputs = Effect.fn("Changesets.validateInputs")(function* (before: readonly Source[], pending: readonly Source[], releasing: boolean) {
	for (const source of before) {
		const preserved = pending.find((item) => item.name === source.name);
		if (preserved === undefined ? !releasing : preserved.text !== source.text) {
			return yield* new ChangesetError({
				message: `${source.name}: keep pending changesets unchanged; add a new file for later changes or run releases apply to consume them.`,
			});
		}
	}
});

export const planDiff = Effect.fn("Changesets.planDiff")(function* (before: Workspace, after: Workspace) {
	const declarations = yield* Effect.forEach([...before.changesets, ...after.changesets], parseChangeset);
	const packages = after.packages.map((pkg) => ({
		...pkg,
		manifest: { ...pkg.manifest, version: previousPackage(before, declarations, pkg)?.manifest.version ?? "0.0.0" },
	}));
	return yield* computePlan(
		packages,
		before.changesets.filter((source) => !after.changesets.some((pending) => pending.name === source.name)),
	);
});

export const validateDiff = Effect.fn("Changesets.validateDiff")(function* (before: Workspace, after: Workspace) {
	const declarations = yield* Effect.forEach([...before.changesets, ...after.changesets], parseChangeset);
	for (const old of before.packages) {
		const replacement = after.packages.find((pkg) => pkg.directory === old.directory);
		const name = new RegExp(`(?<![\\w@/.-])${RegExp.escape(old.manifest.name)}(?![\\w/-]|\\.[\\w.-])`, "u");
		if (
			!(
				after.packages.some((pkg) => pkg.manifest.name === old.manifest.name)
				|| declarations.some(
					(changeset) =>
						after.packages.some((pkg) => Object.hasOwn(changeset.packages, pkg.manifest.name))
						&& (replacement === undefined || Object.hasOwn(changeset.packages, replacement.manifest.name))
						&& changeset.entries.some((entry) => entry.section === "Breaking" && name.test(entry.text)),
				)
			)
		) {
			return yield* new ChangesetError({
				message: `${old.manifest.name}: declare its rename or removal in .changeset/<name>.md with a ### Breaking entry naming ${old.manifest.name}. For a rename, name the new package and its bump in frontmatter; for a removal, name a remaining package and its bump. Keep released changelog history unchanged.`,
			});
		}
	}
	const bumped = after.packages.filter((pkg) => {
		const old = previousPackage(before, declarations, pkg);
		return old === undefined ? !pkg.manifest.private && pkg.manifest.version !== "0.0.0" : old.manifest.version !== pkg.manifest.version;
	});
	yield* validateInputs(before.changesets, after.changesets, bumped.length > 0);
	if (bumped.length === 0) {
		for (const pkg of after.packages) {
			const old = previousPackage(before, declarations, pkg);
			if ((old?.changelog ?? "# Changelog\n") !== pkg.changelog) {
				return yield* new ChangesetError({
					message: `${pkg.manifest.name}: CHANGELOG.md changes require a version bump; add .changeset/<name>.md and run releases apply.`,
				});
			}
		}
		return;
	}
	const plan = yield* planDiff(before, after);
	if (plan.releases.length === 0) {
		return yield* new ChangesetError({
			message: "A release needs deleted pending changesets from the base; restore versions and run releases apply.",
		});
	}
	yield* validateRelease(before, after, declarations, plan);
});

export const checkRepository = Effect.fn("Changesets.checkRepository")(function* (root: string, config: ChangesetConfig = {}, reference?: string) {
	const after = yield* readWorkspace(root, config);
	yield* computePlan(after.packages, after.changesets);
	const before = yield* readHistory(root, config, reference);
	yield* validateDiff(before, after);
});
