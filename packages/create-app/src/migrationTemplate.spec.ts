import { expect } from "vitest";
import { application } from "#test/application.ts";
import { customTemplate } from "#test/traits.ts";

for (const path of ["src/server/migrations/20261018-create-labels.ts", "src/modules/labels/server/migrations/create-labels.ts"]) {
	application.it(
		`packing refuses ${path}, which breaks the sequential migration filename convention`,
		[customTemplate({ [path]: "export default {};" }, `the template holds the migration ${path}`)],
		function* ({ pack }) {
			expect(yield* pack()).toBe(`refused: Invalid migration filename: ${path}`);
		},
	);
}
