import { join } from "node:path";

export function reportPaths(outputDir: string) {
	return {
		flaky: join(outputDir, "flaky-tests.json"),
		json: join(outputDir, "tests.json"),
		junit: join(outputDir, "tests.junit.xml"),
		rerunCache: join(outputDir, "vite-rerun"),
	};
}

export function attemptPaths(outputDir: string, attempt: number) {
	return {
		json: join(outputDir, `tests.attempt-${attempt}.json`),
		junit: join(outputDir, `tests.attempt-${attempt}.junit.xml`),
		snapshot: join(outputDir, `tests.attempt-${attempt}.bin`),
	};
}

export const ATTEMPT_REPORT = /^tests\.attempt-\d+\.(?:json|junit\.xml|bin)$/u;
