import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { afterEach, describe, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#client/client.ts";
import { type Folder, folder, startBoard } from "#test/board.ts";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";
import { subscribe } from "#test/nativeRpc.ts";

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
			const address = /Listening on (?<address>http:\/\/\S+)/u.exec(output)?.groups?.address;
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
	it.live("listens on 127.0.0.1 only", function* () {
		notes = folder({ "plan.md": "# Plan\n" });
		const board = yield* startBoard(notes.root);
		expect(board.hostname).toBe("127.0.0.1");
		yield* board.stop();
	});

	it.live("runs as one command that serves the folder with its home board", function* () {
		notes = folder({ "plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n" });
		const child = spawn(process.execPath, ["--conditions=source", cli, notes.root, "--port", "0", "--home", "plan.md"], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		try {
			const address = yield* Effect.promise(() => listening(child));
			expect(address).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
			expect(yield* Effect.promise(async () => (await fetch(address)).text())).toContain("data-board-react-root");
		} finally {
			child.kill();
		}
	});

	it.live("selects the Inbox responder through the maintainer CLI option", function* () {
		notes = folder(inboxAudienceFixture("Casey"));
		const child = spawn(process.execPath, ["--conditions=source", cli, notes.root, "--port", "0", "--maintainer", "Casey"], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		try {
			const address = yield* Effect.promise(() => listening(child));
			const client = browserClient(address);
			try {
				const data = yield* Effect.promise(() => client.run(client.api.inbox.run(undefined)));
				expect(data.you).toHaveLength(2);
				expect(data.agents).toHaveLength(1);
			} finally {
				client.registry.dispose();
			}
		} finally {
			child.kill();
		}
	});

	it.live("refuses to start with a clear message when the home file is missing", function* () {
		notes = folder({ "plan.md": "# Plan\n" });
		const child = spawn(process.execPath, ["--conditions=source", cli, notes.root, "--port", "0", "--home", "missing.md"], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString("utf8");
			return output;
		});
		child.stderr.on("data", (chunk: Buffer) => {
			output += chunk.toString("utf8");
			return output;
		});
		const code = yield* Effect.promise(() => new Promise<number | null>((resolve) => child.on("exit", resolve)));
		expect(code).not.toBe(0);
		expect(output).toContain("The home file missing.md is not a markdown file in");
		expect(output).not.toContain("Listening on");
	});

	it.live(
		"stops promptly on Ctrl-C while a page is listening for changes",
		function* () {
			notes = folder({ "plan.md": "# Plan\n" });
			const child = spawn(process.execPath, ["--conditions=source", cli, notes.root, "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
			try {
				const address = yield* Effect.promise(() => listening(child));
				const subscription = yield* subscribe({ url: address });
				yield* subscription.next();
				const stopped = exited(child);
				child.kill("SIGINT");
				expect(yield* Effect.promise(() => stopped)).toBeLessThan(3000);
				expect(existsSync(join(notes.root, "board.sock"))).toBe(false);
				yield* subscription.close();
			} finally {
				child.kill();
			}
		},
		10_000,
	);
	it.live("removes its socket on SIGTERM", function* () {
		notes = folder({ "plan.md": "# Plan\n" });
		const child = spawn(process.execPath, ["--conditions=source", cli, notes.root, "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
		try {
			const address = yield* Effect.promise(() => listening(child));
			yield* Effect.promise(() => fetch(address));
			expect(existsSync(join(notes.root, "board.sock"))).toBe(true);
			const stopped = exited(child);
			child.kill("SIGTERM");
			yield* Effect.promise(() => stopped);
			expect(existsSync(join(notes.root, "board.sock"))).toBe(false);
		} finally {
			child.kill();
		}
	});
});
