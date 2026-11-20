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
					"packages/changes/src/compositeKeys.ts",
					"packages/changes/src/keys.ts",
					"packages/changes/src/readRecorder.ts",
					"packages/changes/src/syncToken.ts",
					"packages/errors/src/boundary.ts",
					"packages/errors/src/GeneratedSuccess.ts",
					"packages/errors/src/infrastructure.ts",
					"packages/errors/src/privateKeyBlocks.ts",
					"packages/errors/src/redact.ts",
					"packages/errors/src/redactCause.ts",
					"packages/errors/src/schemaFieldScope.ts",
					"packages/errors/src/schemaSensitiveAst.ts",
					"packages/errors/src/sensitive.ts",
					"packages/errors/src/sensitiveAssignmentValues.ts",
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
