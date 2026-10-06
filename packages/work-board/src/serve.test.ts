import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { type Folder, folder, startBoard } from "#test/board.ts";

const cli = join(dirname(fileURLToPath(import.meta.url)), "cli.ts");

let notes: Folder | undefined;

afterEach(() => notes?.remove());

function exited(child: ReturnType<typeof spawn>): Promise<number> {
	return new Promise((resolve) => {
		const started = performance.now();
		child.on("exit", () => resolve(performance.now() - started));
	});
}

function listening(child: ReturnType<typeof spawn>): Promise<string> {
	return new Promise((resolve, reject) => {
		let output = "";
		function collect(chunk: Buffer) {
			output += chunk.toString("utf8");
			const address = /Listening on (http:\/\/\S+)/u.exec(output)?.[1];
			if (address !== undefined) {
				resolve(address);
			}
		}
		child.stdout?.on("data", collect);
		child.stderr?.on("data", collect);
		child.on("exit", (code) => reject(new Error(`work-board exited ${code}:\n${output}`)));
	});
}

describe("the server", () => {
	it("listens on 127.0.0.1 only", async () => {
		notes = folder({ "plan.md": "# Plan\n" });
		const board = await startBoard(notes.root);
		expect(board.hostname).toBe("127.0.0.1");
		await board.stop();
	});

	it("runs as one command that serves the folder with its home board", async () => {
		notes = folder({ "plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n" });
		const child = spawn(process.execPath, ["--conditions=source", cli, notes.root, "--port", "0", "--home", "plan.md"], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		try {
			const address = await listening(child);
			expect(address).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
			expect(await (await fetch(address)).text()).toContain("<span><b>1</b> to do</span>");
		} finally {
			child.kill();
		}
	});

	it("refuses to start with a clear message when the home file is missing", async () => {
		notes = folder({ "plan.md": "# Plan\n" });
		const child = spawn(process.execPath, ["--conditions=source", cli, notes.root, "--port", "0", "--home", "missing.md"], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString("utf8")));
		child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString("utf8")));
		const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
		expect(code).not.toBe(0);
		expect(output).toContain("The home file missing.md is not a markdown file in");
		expect(output).not.toContain("Listening on");
	});

	it("stops promptly on Ctrl-C while a page is listening for changes", async () => {
		notes = folder({ "plan.md": "# Plan\n" });
		const child = spawn(process.execPath, ["--conditions=source", cli, notes.root, "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
		try {
			const address = await listening(child);
			const body = (await fetch(`${address}/events`)).body;
			await body?.getReader().read();
			const stopped = exited(child);
			child.kill("SIGINT");
			expect(await stopped).toBeLessThan(3000);
		} finally {
			child.kill();
		}
	}, 10_000);
});
