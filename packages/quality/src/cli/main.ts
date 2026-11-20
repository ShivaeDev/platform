import process from "node:process";
import { runMain } from "#adapters/runMain.ts";
import { withoutHeapLimit } from "#adapters/runWithHeapLimit.ts";
import { program } from "#cli/program.ts";

export function main(): void {
	runMain(
		program(process.argv.slice(2), {
			cwd: process.cwd(),
			launch: { options: withoutHeapLimit(process.execArgv), script: process.argv[1] ?? "" },
		}),
	);
}
