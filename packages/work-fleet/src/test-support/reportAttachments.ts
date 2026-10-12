import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { markdownBoard } from "#board/markdown.ts";
import type { BoardReport } from "#board/schema.ts";
import { reportBoard } from "#host/reportBoard.ts";
import { makeReportPublication } from "#host/reportPublication.ts";
import { codexReportAttachments } from "#providers/codexReportAttachments.ts";
import { REPORT_ATTACHMENT_DIRECTORY } from "#reportAttachments.ts";
import { codexServer, type Handshake, requestCursor, WireRejection, type WireRequest } from "#test/codex.ts";
import { authFolder, FUTURE_EXPIRY, syntheticToken } from "#test/codexCloud.ts";

export const TEXT_FILE = "Evidence from the workspace.\n";
export const BINARY_FILE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128, 0]);
export const REPORT_FILES = {
	"capture.png.base64": new TextEncoder().encode(Buffer.from(BINARY_FILE).toString("base64")),
	"findings.txt": new TextEncoder().encode(TEXT_FILE),
};

export function addedAttachment(path: string, diff: string) {
	return { changes: [{ diff, kind: { type: "add" }, path: `${REPORT_ATTACHMENT_DIRECTORY}${path}` }], id: `add-${path}`, type: "fileChange" };
}
export function attachmentItems() {
	return Object.entries(REPORT_FILES).map(([name, bytes]) => addedAttachment(name, new TextDecoder().decode(bytes)));
}
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

export const turnDownload = Effect.fn("ReportStory.turnDownload")(function* (items: readonly unknown[], reject = false) {
	const token = syntheticToken("report", FUTURE_EXPIRY);
	const authFile = yield* authFolder(token);
	const requests: WireRequest[] = [];
	const handshakes: Handshake[] = [];
	const fixture = yield* codexServer((request) => {
		requests.push(request);
		if (request.method === "thread/items/list") {
			if (reject) {
				return new WireRejection("Synthetic attachment retrieval unavailable");
			}
			const start = Number(requestCursor(request) ?? 0);
			const end = start + 100;
			return { data: items.slice(start, end).map((item) => ({ item })), nextCursor: end < items.length ? String(end) : null };
		}
		return {};
	}, handshakes);
	const read = codexReportAttachments({ authFile, endpoint: fixture.endpoint }, 5000);
	return {
		authenticated: () => handshakes.length > 0 && handshakes.every((handshake) => handshake.protocols.includes(`openai-bearer.${token}`)),
		read,
		requests,
	};
});

export function attachmentBoard(
	root: string,
	download: Effect.Success<ReturnType<typeof turnDownload>>,
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
		return Effect.fail(new ServiceUnavailable({ message: "Unexpected GitHub read" }));
	});
	const board = reportBoard(root, (work) => check("example/project", `synthetic/${work.workId}`), download.read).pipe(
		Layer.provide(markdownBoard(root)),
		Layer.provide(NodeServices.layer),
	);
	return { board, requests };
}
