import { writes } from "#quality-fixtures/hookRepository.ts";
import { unusedRepository } from "./unusedRepository.ts";

export const crossWorkspaceEntries = unusedRepository.trait("repository", "scripts run files across workspace boundaries", (root) => {
	writes(
		root,
		"package.json",
		JSON.stringify({
			name: "fixture",
			private: true,
			scripts: { check: "node --conditions=source packages/app/src/from-root.ts" },
			type: "module",
			workspaces: ["packages/*"],
		}),
	);
	writes(root, "quality.config.ts", 'export default { sources: ["packages", "script"] };\n');
	writes(
		root,
		"packages/app/package.json",
		JSON.stringify({
			name: "app",
			private: true,
			scripts: {
				"check:published": "env -u NODE_OPTIONS node --conditions=source --env-file-if-exists=../../.env.local ../../script/starter-published.ts",
				"check:sibling": "node --conditions=source '../tool/src/from-sibling.ts'",
				"start": "node wrapper.ts -- node src/start.ts",
			},
			type: "module",
		}),
	);
	writes(root, "packages/tool/package.json", '{"name":"tool","private":true,"type":"module"}\n');
	writes(root, "packages/app/src/from-root.ts", "Number.isFinite(1);\n");
	writes(root, "packages/tool/src/from-sibling.ts", "Number.isFinite(1);\n");
	writes(root, "script/starter-published.ts", 'import { documentation } from "./documentation.ts";\nNumber.isFinite(documentation);\n');
	writes(root, "script/documentation.ts", "export const documentation = 1;\nexport const unusedDocumentation = 2;\n");
});
