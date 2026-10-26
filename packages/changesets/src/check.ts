import { Effect } from "effect";
import { collectChangelog } from "#collectChangelog.ts";
import type { ChangesetConfig } from "#config.ts";
import { attempt, requireThat } from "#error.ts";
import type { ReleasePlan, Source, Workspace } from "#model.ts";
import { computePlan } from "#planner.ts";
import { readHistory } from "#readHistory.ts";
import { readWorkspace } from "#workspace.ts";

function validateInputs(before: readonly Source[], pending: readonly Source[], releasing: boolean): void {
	for (const source of before) {
		const preserved = pending.find((item) => item.name === source.name);
		requireThat(
			preserved === undefined ? releasing : preserved.text === source.text,
			`${source.name}: keep pending changesets unchanged; add a new file for later changes or run changesets apply to consume them.`,
		);
	}
}

export function planDiff(before: Workspace, after: Workspace) {
	const packages = [
		...before.packages,
		...after.packages
			.filter((pkg) => !before.packages.some((old) => old.manifest.name === pkg.manifest.name))
			.map((pkg) => ({ ...pkg, manifest: { ...pkg.manifest, version: "0.0.0" } })),
	];
	return computePlan(
		packages,
		before.changesets.filter((source) => !after.changesets.some((pending) => pending.name === source.name)),
	);
}

export function validateDiff(before: Workspace, after: Workspace): void {
	for (const old of before.packages) {
		requireThat(
			after.packages.some((pkg) => pkg.manifest.name === old.manifest.name),
			`${old.manifest.name}: restore the package and its released history before checking releases.`,
		);
	}
	const bumped = after.packages.filter((pkg) => {
		const old = before.packages.find((candidate) => candidate.manifest.name === pkg.manifest.name);
		return old === undefined ? !pkg.manifest.private && pkg.manifest.version !== "0.0.0" : old.manifest.version !== pkg.manifest.version;
	});
	validateInputs(before.changesets, after.changesets, bumped.length > 0);
	if (bumped.length === 0) {
		for (const pkg of after.packages) {
			const old = before.packages.find((candidate) => candidate.manifest.name === pkg.manifest.name);
			requireThat(
				(old?.changelog ?? "# Changelog\n") === pkg.changelog,
				`${pkg.manifest.name}: CHANGELOG.md changes require a version bump; add .changeset/<name>.md and run changesets apply.`,
			);
		}
		return;
	}
	const plan = planDiff(before, after);
	requireThat(plan.releases.length > 0, "A release needs deleted pending changesets from the base; restore versions and run changesets apply.");
	validateRelease(before, after, plan);
}

function validateRelease(before: Workspace, after: Workspace, plan: ReleasePlan): void {
	let date: string | undefined;
	for (const pkg of after.packages) {
		const old = before.packages.find((candidate) => candidate.manifest.name === pkg.manifest.name);
		const release = plan.releases.find((candidate) => candidate.name === pkg.manifest.name);
		requireThat(
			pkg.manifest.version === (release?.to ?? old?.manifest.version ?? "0.0.0"),
			`${pkg.manifest.name}: version differs from the release plan; restore versions and rerun changesets apply, including published dependents.`,
		);
		const headingDate =
			release === undefined
				? undefined
				: new RegExp(`^# Changelog\\n\\n## ${release.to.replaceAll(".", "\\.")} - (?<date>[^\\n]*)\\n`, "u").exec(pkg.changelog)?.groups?.date;
		if (release !== undefined) {
			requireThat(
				headingDate !== undefined,
				`${pkg.manifest.name}: release notes differ from changesets apply; restore the new changelog heading and rerun changesets apply.`,
			);
			requireThat(
				date === undefined || date === headingDate,
				"Use the same UTC release date in every new changelog heading; rerun changesets apply.",
			);
			date = headingDate;
		}
		const expected =
			release === undefined
				? (old?.changelog ?? "# Changelog\n")
				: collectChangelog(old?.changelog ?? "# Changelog\n", release, plan, headingDate ?? "");
		requireThat(
			pkg.changelog === expected,
			`${pkg.manifest.name}: release notes differ from changesets apply; restore released history and rerun changesets apply from unchanged inputs.`,
		);
	}
}

export const checkRepository = Effect.fn("Changesets.checkRepository")(function* (root: string, config: ChangesetConfig = {}, reference?: string) {
	const after = yield* readWorkspace(root, config);
	yield* attempt(() => computePlan(after.packages, after.changesets));
	const before = yield* readHistory(root, config, reference);
	yield* attempt(() => validateDiff(before, after));
});
