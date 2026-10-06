import type { MainObservation, Preparation } from "#preparation/schema.ts";

export function prepared(overrides: Partial<Preparation> = {}): Preparation {
	return {
		baselinePaths: ["packages/example/quality-baseline.json"],
		baseRevision: "prepared-main",
		configuration: [{ path: "package.json", relevantKeys: ["scripts.test", "scripts.setup", "dependencies", "devDependencies"] }],
		contextComplete: true,
		dependencyPaths: ["packages/dependency/src", "pnpm-lock.yaml"],
		observedAt: 100,
		ownedPaths: ["packages/example/src/task.ts"],
		qualityPaths: ["quality.config.ts"],
		setupPaths: ["script/update", "pnpm-workspace.yaml"],
		sourcePaths: ["packages/example/src"],
		validation: [{ command: "pnpm --filter example test", revision: "prepared-main" }],
		...overrides,
	};
}

export function mainObservation(overrides: Partial<MainObservation> = {}): MainObservation {
	return {
		ancestor: true,
		changedPaths: [],
		complete: true,
		configurationChanges: [],
		fromRevision: "prepared-main",
		observedAt: 200,
		revision: "current-main",
		...overrides,
	};
}
