import { expect } from "vitest";
import { application } from "#test/application.ts";
import { installedPackageManager, realSetup } from "#test/traits.ts";

const SUCCESSFUL_EXIT = 0;

application.it(
	"records and lowers Quality debt through the generated app's package script",
	[realSetup, installedPackageManager],
	function* ({ cli, write, pnpm, git, baseline }) {
		const generated = yield* cli(["my-app"]);
		expect(generated.status, generated.stdout + generated.stderr).toBe(SUCCESSFUL_EXIT);
		write("src/debt.ts", "// TODO: finish the feature\nexport function debt() {\n\treturn 1;\n}\n");
		const recorded = pnpm("baseline", "write", "--rule", "comments/no-todo");
		expect(recorded.status, recorded.stdout + recorded.stderr).toBe(SUCCESSFUL_EXIT);
		expect(baseline()).toBe('{"path":"src/debt.ts","rule":"comments/no-todo","count":1}\n');
		const staged = git("add", ".");
		expect(staged.status, staged.stderr).toBe(SUCCESSFUL_EXIT);
		const committed = git("commit", "-m", "Record findings from the new Quality rule");
		expect(committed.status, committed.stdout + committed.stderr).toBe(SUCCESSFUL_EXIT);
		write("src/debt.ts", "export function debt() {\n\treturn 1;\n}\n");
		const tightened = pnpm("baseline", "tighten");
		expect(tightened.status, tightened.stdout + tightened.stderr).toBe(SUCCESSFUL_EXIT);
		expect(baseline()).toBe("");
	},
);
