import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import type { BoardReport } from "#board/schema.ts";
import { reportBoard } from "#host/reportBoard.ts";
import { reportDiffFiles } from "#host/reportDiff.ts";
import { makeReportPublication } from "#host/reportPublication.ts";
import { FleetFailure } from "#policy.ts";
import { codexTaskDiff } from "#providers/codexTaskDiff.ts";
import type { SessionReceipt } from "#session/schema.ts";
import { authFolder, FUTURE_EXPIRY, syntheticToken } from "#test/codexCloud.ts";

export const TEXT_FILE = "Evidence from the workspace.\n";
export const BINARY_FILE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128, 0]);
export const REPORT_FILES = { "capture.png": BINARY_FILE, "findings.txt": new TextEncoder().encode(TEXT_FILE) };

export function expectReportAttachments(root: string, report: BoardReport, attachments: boolean, output: string) {
	const content = readFileSync(join(root, report.sourcePath), "utf8");
	expect(content).toContain(output);
	if (!attachments) {
		expect(readdirSync(join(root, "responses"))).toEqual([`${report.itemId}.md`]);
		expect(content.endsWith(output)).toBe(true);
		return;
	}
	const folder = join(root, report.sourcePath.replace(/\.md$/u, ".attachments"));
	const files = readdirSync(folder);
	expect(files).toHaveLength(2);
	for (const [name, bytes] of Object.entries(REPORT_FILES)) {
		const saved = files.find((file) => file.endsWith(`-${name}`));
		expect(saved).toBeDefined();
		expect(readFileSync(join(folder, saved ?? ""))).toEqual(Buffer.from(bytes));
		expect(content).toContain(name);
	}
}

export function attachmentDiff(files = REPORT_FILES) {
	const folder = mkdtempSync(join(tmpdir(), "report-diff-"));
	try {
		return Object.entries(files)
			.map(([name, bytes]) => {
				writeFileSync(join(folder, name), bytes);
				const result = spawnSync("git", ["diff", "--no-index", "--binary", "--", "/dev/null", name], { cwd: folder, encoding: "utf8" });
				if (result.status !== 1) {
					throw new Error("Could not create the synthetic attachment diff");
				}
				return result.stdout;
			})
			.join("");
	} finally {
		rmSync(folder, { force: true, recursive: true });
	}
}

export const taskDownload = Effect.fn("ReportStory.taskDownload")(function* (diff: string) {
	const token = syntheticToken("report", FUTURE_EXPIRY);
	const authFile = yield* authFolder(token);
	const requests: { readonly path: string; readonly authenticated: boolean; readonly accountSelected: boolean }[] = [];
	let receipt: SessionReceipt = { sessionId: "synthetic-task", turnId: "synthetic-turn" };
	const server = createServer((request, response) => {
		requests.push({
			accountSelected: request.headers["chatgpt-account-id"] === "synthetic-account",
			authenticated: request.headers.authorization === `Bearer ${token}`,
			path: request.url ?? "",
		});
		response.setHeader("Content-Type", "application/json");
		response.end(
			JSON.stringify({
				"current_assistant_turn": { id: receipt.turnId, "output_items": diff ? [{ diff, type: "output_diff" }] : [] },
				"current_diff_task_turn": null,
			}),
		);
	});
	yield* Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)));
	yield* Effect.addFinalizer(() => Effect.promise(() => new Promise<void>((resolve) => server.close(() => resolve()))));
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die(new Error("No synthetic task backend address"));
	}
	const read = codexTaskDiff({ authFile }, 5000, `http://127.0.0.1:${address.port}/backend-api/`);
	return {
		read,
		requests,
		setReceipt: (value: SessionReceipt) => {
			receipt = value;
		},
	};
});

export function attachmentBoard(
	root: string,
	download: Effect.Success<ReturnType<typeof taskDownload>>,
	published: "branch" | "pr" | "none" = "none",
) {
	const requests: string[] = [];
	const check = makeReportPublication((endpoint) => {
		requests.push(endpoint);
		if (endpoint.includes("matching-refs")) {
			return Effect.succeed(
				JSON.stringify([
					[{ ref: "refs/heads/synthetic/research-extra" }, ...(published === "branch" ? [{ ref: "refs/heads/synthetic/research" }] : [])],
				]),
			);
		}
		if (endpoint.includes("/pulls?")) {
			return Effect.succeed(JSON.stringify([[], published === "pr" ? [{ "html_url": "https://github.com/example/project/pull/1" }] : []]));
		}
		return Effect.fail(new FleetFailure({ message: "Unexpected GitHub read", reason: "integration" }));
	});
	const board = reportBoard(
		root,
		(work) => check("example/project", `synthetic/${work.workId}`),
		(receipt) => {
			download.setReceipt(receipt);
			return Effect.scoped(download.read(receipt).pipe(Effect.flatMap(reportDiffFiles)));
		},
	).pipe(Layer.provide(markdownBoard(root)), Layer.provide(NodeServices.layer));
	return { board, requests };
}
