import { Effect, FileSystem, Schema } from "effect";
import { BaseCoverageProvider, type CoverageProvider, type Vitest } from "vitest/node";
import { failWith } from "#error.ts";
import { attemptPaths } from "#internal/reportPaths.ts";

const CoverageReport = Schema.Struct({ coverageMap: Schema.optional(Schema.Unknown) });
const decodeCoverage = Schema.decodeUnknownEffect(Schema.fromJsonString(CoverageReport));

export const deferCoverageThresholds = Effect.fn("VitestRerun.deferCoverageThresholds")(function* (vitest: Vitest) {
	const provider = yield* Effect.tryPromise({
		catch: failWith("Vitest could not load its coverage provider"),
		try: () => vitest.createCoverageProvider(),
	});
	const options = provider?.resolveOptions();
	const thresholds = options?.thresholds;
	if (options !== undefined) {
		options.thresholds = {};
	}
	return Effect.fn("VitestRerun.finishCoverage")(function* (outputDir: string, attempt: number, json: string) {
		if (provider === null || options === undefined) {
			return undefined;
		}
		const fs = yield* FileSystem.FileSystem;
		const maps: unknown[] = [];
		for (let earlier = 1; earlier <= attempt; earlier += 1) {
			const path = earlier === attempt ? json : attemptPaths(outputDir, earlier).json;
			const { coverageMap } = yield* decodeCoverage(yield* fs.readFileString(path));
			if (coverageMap !== undefined) {
				maps.push(coverageMap);
			}
		}
		options.thresholds = thresholds ?? {};
		return yield* Effect.tryPromise({ catch: failWith("Vitest could not merge coverage"), try: () => reportMergedCoverage(provider, maps) });
	});
});

async function reportMergedCoverage(provider: CoverageProvider, maps: unknown[]): Promise<unknown> {
	let merged: unknown;
	if (provider instanceof BaseCoverageProvider) {
		const generate = provider.generateReports.bind(provider);
		provider.generateReports = async (map, allTestsRun) => {
			merged = map;
			await generate(map, allTestsRun);
		};
	}
	await provider.mergeReports?.(maps);
	return merged;
}
