import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const signal = process.argv[2];
const lifetime = Number(process.argv[3]);
if (signal === undefined) {
	throw new Error("The signal fixture needs a signal to acknowledge.");
}

if (process.argv[4] === "descendant") {
	const deadline = setTimeout(() => process.exit(1), lifetime);
	process.on(signal, () => {
		clearTimeout(deadline);
		process.stdout.write(`descendant received ${signal}\n`, () => process.exit(0));
	});
	process.send?.("ready");
} else {
	// Keeping the leader alive prevents exit-time cleanup from supplying the descendant's signal.
	process.on(signal, () => undefined);
	const descendant = spawn(process.execPath, [fileURLToPath(import.meta.url), signal, String(lifetime), "descendant"], {
		stdio: ["ignore", "inherit", "inherit", "ipc"],
	});
	descendant.on("message", () => process.stdout.write("running\n"));
	descendant.on("exit", (code) => process.exit(code ?? 1));
}
