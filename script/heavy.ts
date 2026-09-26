import process from "node:process";
import { runHeavy } from "./heavy-process-lock/run.ts";

const command = process.argv.slice(2);
if (command.length === 0) {
	process.stderr.write("Usage: node script/heavy.ts <command> [...args]\n");
	process.exitCode = 2;
} else {
	process.exitCode = await runHeavy(command, {
		env: process.env,
		log: (line) => process.stderr.write(`${line}\n`),
		now: () => Date.now(),
	});
}
