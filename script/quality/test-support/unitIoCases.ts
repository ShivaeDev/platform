export const unitIoCases = [
	{
		call: "node:fs.readFileSync",
		name: "a named file-system import",
		source: 'import { readFileSync } from "node:fs";\nit("reads a file", () => { readFileSync("package.json"); });',
	},
	{
		call: "node:fs/promises.readFile",
		name: "an asynchronous file-system import",
		source: 'import { readFile } from "node:fs/promises";\nit("reads a file asynchronously", async () => { await readFile("package.json"); });',
	},
	...(["node:net", "node:http", "node:https"] as const).map((module) => ({
		call: `${module}.createServer`,
		name: `a ${module} socket`,
		source: `import { createServer } from "${module}";
it("opens a socket", async () => {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, () => server.close(() => resolve())));
});`,
	})),
	{
		call: "node:child_process.spawnSync",
		name: "a child process",
		source: 'import { spawnSync } from "node:child_process";\nit("spawns a process", () => { spawnSync(process.execPath, ["-e", ""]); });',
	},
	{
		call: "node:worker_threads.Worker",
		name: "a worker constructor",
		source: `import { Worker } from "node:worker_threads";
it("starts a worker", async () => {
	await new Promise<void>((resolve, reject) => {
		const worker = new Worker("", { eval: true });
		worker.on("exit", () => resolve());
		worker.on("error", reject);
	});
});`,
	},
	{
		call: "fetch",
		name: "global fetch",
		source: 'it("calls fetch", async () => { await fetch("data:text/plain,hello"); });',
	},
	{
		call: "node:fs.readFileSync",
		name: "I/O hidden in a native ESM dependency",
		source: 'import { read } from "hidden-io";\nit("reaches I/O in an external package", () => { read(); });',
	},
	{
		call: "node:fs.readFileSync",
		name: "I/O during module initialization",
		source: 'import { readFileSync } from "node:fs";\nreadFileSync("package.json");\nit("loads an impure module", () => {});',
	},
] as const;
