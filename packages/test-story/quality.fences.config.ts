import { fence } from "@shivaedev/quality/imports/fence.ts";
import { files, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

export default [
	fence("screen-waits-follow-generic-signals")
		.because("Screen waits consume application signals; contract owns the projection of its activity.")
		.from(
			files(
				"packages/test-story/src/server/screenDriver.ts",
				"packages/test-story/src/server/screenSignal.ts",
				"packages/test-story/src/server/waitForScreen.ts",
			),
		)
		.mayNotReach(packages("contract"))
		.demonstratedBy({
			illegal: ["packages/test-story/src/server/waitForScreen.ts", "packages/contract/src/clientActivity.ts"],
			legal: ["packages/test-story/src/server/waitForScreen.ts", "packages/test-story/src/server/screenSignal.ts"],
		}),
];
