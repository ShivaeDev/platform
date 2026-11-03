import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import process from "node:process";
import { createInterface } from "node:readline";

const socket = createConnection(process.argv[2] ?? "");
const messages = createInterface({ input: socket });
const child = spawn("git-upload-pack", process.argv.slice(3), { stdio: ["pipe", "pipe", "inherit"] });
child.stdout.pipe(process.stdout);
child.on("exit", (code) => {
	messages.once("line", () => process.exit(code ?? 1));
	socket.write("done\n");
});
process.stdin.once("data", (data) => {
	process.stdin.pause();
	messages.once("line", () => {
		child.stdin.write(data);
		process.stdin.pipe(child.stdin);
		process.stdin.resume();
	});
	socket.write("fetch\n");
});
