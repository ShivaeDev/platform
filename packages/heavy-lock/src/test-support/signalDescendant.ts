import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const signal = process.argv[2];
if (signal === undefined) {
	throw new Error("The signal fixture needs a signal to acknowledge.");
}

if (process.argv[3] === "descendant") {
	process.channel?.ref();
	process.on(signal, () => {
		process.stdout.write(`descendant received ${signal}\n`, () => process.exit(0));
	});
	process.send?.("ready");
} else {
	// Keeping the leader alive prevents exit-time cleanup from supplying the descendant's signal.
	process.on(signal, () => undefined);
	const descendant = spawn(process.execPath, [fileURLToPath(import.meta.url), signal, "descendant"], {
		stdio: ["ignore", "inherit", "inherit", "ipc"],
	});
	process.stdin.resume();
	process.stdin.on("end", () => descendant.kill("SIGKILL"));
	descendant.on("message", () => process.stdout.write("running\n"));
	descendant.on("exit", (code) => process.exit(code ?? 1));
}
