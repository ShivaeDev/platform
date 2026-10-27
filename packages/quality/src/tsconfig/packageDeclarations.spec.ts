import { afterEach, expect, it } from "vitest";
import { emittedDeclarations, seedPackageBuild } from "#test/packageBuild.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

it("package builds emit declarations whose inferred relative imports carry extensions through # aliases", () => {
	const root = seedPackageBuild([
		{ content: 'export class Token {\n\treadonly kind = "token";\n}\n', path: "src/token.ts" },
		{ content: 'import { Token } from "./token.ts";\n\nexport const issue = () => new Token();\n', path: "src/issue.ts" },
		{ content: 'import { issue } from "#issue.ts";\n\nexport const issued = issue();\n', path: "src/users/issued.ts" },
	]);
	const emitted = emittedDeclarations(root);
	expect(emitted.diagnostics).toEqual([]);
	expect(emitted.files.get("users/issued.d.ts")).toContain('import("../token.ts").Token');
});
