import { expect } from "vitest";
import { vite } from "#test/vite.ts";
import { workspacePackageImporting } from "#test/workspacePackageImporting.ts";

const FROM_A_WORKSPACE_PACKAGE = [
	["a contract that imports query from operation.ts", "packages/billing/src/contract.ts", "an operation file: it defines a query or a command"],
	["a module file that calls defineModule", "packages/billing/src/billing.ts", "a module file: it calls defineModule"],
	["a repository on effect/sql/SqlClient", "packages/billing/src/repository.ts\n  → effect/dist/sql/SqlClient.js", "Effect's SQL client, effect/sql"],
] as const;

for (const [kind, chain, reason] of FROM_A_WORKSPACE_PACKAGE) {
	vite.it(
		`vite build fails when the page's script imports ${kind} from a workspace package whose contract and Effect the application's root cannot resolve`,
		[workspacePackageImporting(kind)],
		function* ({ builds }) {
			const built = yield* builds();

			expect(built).toEqual({
				failed: expect.stringContaining(
					`Server code reached the browser bundle: ${chain.split("\n  → ").at(-1)} is ${reason}. The import chain from the client entry:\n  index.html\n  → src/client.ts\n  → ${chain}\n`,
				),
			});
		},
	);
}

vite.it(
	"vite build bundles a page whose script imports a workspace package when neither the package nor the application depends on contract or Effect",
	[workspacePackageImporting("a plain function, and neither it nor the application depends on contract or Effect")],
	function* ({ builds }) {
		const built = yield* builds();

		expect(built).toBe("built");
	},
);
