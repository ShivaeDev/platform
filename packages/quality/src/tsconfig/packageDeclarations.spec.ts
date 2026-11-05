import { withMatchers } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { packageBuild, packageExtendsQualityConfig, packageHas } from "#test/packageBuild.ts";

packageBuild.it(
	"the supported TypeScript 7 CLI emits a package declaration whose inferred type imports a relative module with its extension through a # alias, without diagnostics",
	[
		packageExtendsQualityConfig(),
		packageHas(
			{ content: 'export class Token {\n\treadonly kind = "token";\n}\n', path: "src/token.ts" },
			{ content: 'import { Token } from "./token.ts";\n\nexport const issue = () => new Token();\n', path: "src/issue.ts" },
			{ content: 'import { issue } from "#issue.ts";\n\nexport const issued = issue();\n', path: "src/users/issued.ts" },
		),
	],
	function* ({ builds, declaration, diagnostics }) {
		yield* builds();

		yield* withMatchers((expect) =>
			outcomes([
				["diagnostics", () => diagnostics(), []],
				["users/issued.d.ts", () => declaration("users/issued.d.ts"), expect.stringContaining('import("../token.ts").Token')],
			]),
		);
	},
);
