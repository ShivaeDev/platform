#!/usr/bin/env node
import process from "node:process";

const action = process.argv[2];
if (action === "archive") {
	const entry = await import("#server/archive/run.ts");
	entry.runArchive();
} else if (action === "migrate") {
	const entry = await import("#server/migration/runMigrate.ts");
	entry.runMigrate();
} else if (action === "mcp") {
	const entry = await import("#server/mcp/run.ts");
	entry.runMcp();
} else if (action === "wait" || action === "response" || action === "question" || action === "responses") {
	try {
		const entry: typeof import("#server/responses/agent-cli.ts") = await import(new URL("../../assets/agent.js", import.meta.url).href);
		await entry.runAgent(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${String(error)}\n`);
		process.exitCode ??= 1;
	}
} else {
	const entry = await import("./serve-cli.ts");
	entry.runServe();
}
