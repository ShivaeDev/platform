import { Effect, FileSystem, Path } from "effect";
import { linkedInto, writeFiles } from "#test/fixtureProject.ts";
import { vite } from "#test/vite.ts";

// A workspace package the application depends on, through which its page reaches server code. The package brings its own
// @shivaedev/contract and Effect, as under pnpm when only it depends on them, so the application's root resolves neither.

const PAGE = `<!doctype html>
<html>
	<body>
		<script type="module" src="/src/client.ts"></script>
	</body>
</html>
`;

const MANIFEST = `{ "name": "@fixture/billing", "type": "module", "exports": { "./*.ts": "./src/*.ts" } }
`;

interface WorkspacePackage {
	readonly brings: readonly ("@shivaedev/contract" | "effect")[];
	readonly files: Readonly<Record<string, string>>;
}

const WORKSPACE_PACKAGES = {
	"a contract that imports query from operation.ts": {
		brings: ["@shivaedev/contract", "effect"],
		files: {
			"index.html": PAGE,
			"packages/billing/package.json": MANIFEST,
			"packages/billing/src/contract.ts": `import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";

const List = query("list", { reads: () => [], success: Schema.Array(Schema.String) });

export const Billing = contract("billing", { queries: [List] });
`,
			"src/client.ts": `import { Billing } from "@fixture/billing/contract.ts";

console.log(Billing);
`,
		},
	},
	"a module file that calls defineModule": {
		brings: ["@shivaedev/contract", "effect"],
		files: {
			"index.html": PAGE,
			"packages/billing/package.json": MANIFEST,
			"packages/billing/src/billing.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";

const Totals = query("totals", {
	*run() {
		return [1, 2];
	},
});

export const Billing = defineModule({ name: "billing", operations: [Totals], wire: {} });
`,
			"src/client.ts": `import { Billing } from "@fixture/billing/billing.ts";

console.log(Billing);
`,
		},
	},
	"a plain function, and neither it nor the application depends on contract or Effect": {
		brings: [],
		files: {
			"index.html": PAGE,
			"packages/billing/package.json": MANIFEST,
			"packages/billing/src/total.ts": `export function total(amounts: readonly number[]): number {
	return amounts.reduce((sum, amount) => sum + amount, 0);
}
`,
			"src/client.ts": `import { total } from "@fixture/billing/total.ts";

console.log(total([1, 2]));
`,
		},
	},
	"a repository on effect/sql/SqlClient": {
		brings: ["effect"],
		files: {
			"index.html": PAGE,
			"packages/billing/package.json": MANIFEST,
			"packages/billing/src/repository.ts": `import { SqlClient } from "effect/sql/SqlClient";

export const billingRepository = { client: SqlClient };
`,
			"src/client.ts": `import { billingRepository } from "@fixture/billing/repository.ts";

console.log(billingRepository);
`,
		},
	},
} satisfies Record<string, WorkspacePackage>;

const laidOut = Effect.fn("BuildStory.laidOut")(function* (root: string, files: WorkspacePackage["files"], brings: WorkspacePackage["brings"]) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const billing = path.join(root, "packages", "billing");
	yield* fs.remove(path.join(root, "node_modules", "@shivaedev", "contract"));
	yield* fs.remove(path.join(root, "node_modules", "effect"));
	yield* writeFiles(root, files);
	yield* fs.makeDirectory(path.join(root, "node_modules", "@fixture"));
	yield* fs.symlink(billing, path.join(root, "node_modules", "@fixture", "billing"));
	for (const name of brings) {
		yield* linkedInto(billing, name);
	}
});

export function workspacePackageImporting(kind: keyof typeof WORKSPACE_PACKAGES) {
	const { brings, files } = WORKSPACE_PACKAGES[kind];
	const bringing = brings.length === 0 ? "" : ` that brings its own ${brings.join(" and ")}`;
	return vite.trait(
		"project",
		`the application's root resolves neither contract nor Effect, and its page's script imports ${kind} from a workspace package${bringing}`,
		(engine) => laidOut(engine.root, files, brings),
	);
}
