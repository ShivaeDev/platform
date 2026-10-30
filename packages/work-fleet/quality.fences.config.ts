import { fence } from "@shivaedev/quality/imports/fence.ts";
import { files, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

export default [
	fence("fleet-uses-board-public-api")
		.because("Fleet is a Board addon; its shipped code uses only Board's documented integration exports.")
		.from(packages("work-fleet"))
		.mayNotImport(
			packages("work-board").except(
				files(
					"packages/work-board/src/integration/metadata.ts",
					"packages/work-board/src/server/search/snapshot.ts",
					"packages/work-board/src/diagnostics/source.ts",
					"packages/work-board/src/server/integration/board.ts",
					"packages/work-board/src/server/processOwnership.ts",
					"packages/work-board/src/server/integration/responses.ts",
					"packages/work-board/src/server/attention/managedRequestReceipt.ts",
					"packages/work-board/src/attention/RequestReceipt.ts",
					"packages/work-board/src/server/integration/diagnostics.ts",
					"packages/work-board/src/server/responses/publicationDirectory.ts",
				),
			),
		)
		.demonstratedBy({
			illegal: ["packages/work-fleet/src/board/documents.ts", "packages/work-board/src/server/metadata/parse.ts"],
			legal: ["packages/work-fleet/src/board/documents.ts", "packages/work-board/src/server/integration/board.ts"],
		}),
];
