import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, files, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = folders("packages/contract/src");

export default [
	fence("contract-never-imports-server")
		.because("Browser packages ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(
			anything.except(
				files(
					"packages/changes/src/keys.ts",
					"packages/changes/src/readRecorder.ts",
					"packages/errors/src/boundary.ts",
					"packages/errors/src/infrastructure.ts",
					"packages/errors/src/redact.ts",
					"packages/errors/src/redactCause.ts",
					"packages/errors/src/sensitive.ts",
					"packages/errors/src/taxonomy.ts",
				),
				browserCode,
				packages("types", "service"),
				modules("effect"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/contract/src/contract.ts", external("@effect/sql-pg")],
			legal: ["packages/contract/src/contract.ts", "packages/service/src/defineService.ts", external("effect")],
		}),
];
