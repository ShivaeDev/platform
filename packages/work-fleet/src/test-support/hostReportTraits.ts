import { host } from "#test/hostStory.ts";
import { attachmentBoard, turnDownload } from "#test/reportAttachments.ts";

export const REPORT_SOURCE = "---\nid: research\nkind: task\nfleet: approved\ndelivers: report\n---\n# Research\n";
export function reportDownload(items: readonly unknown[], published: "branch" | "pr" | "none" = "none", reject = false) {
	return host.trait("configuration", "the report worker exposes turn attachments", function* (engine) {
		const server = yield* turnDownload(items, reject);
		engine.attachmentDownload = server;
		engine.board = (fixture) => {
			const collector = attachmentBoard(fixture.host.boardDir, server, published);
			engine.publicationRequests = collector.requests;
			return collector.board;
		};
	});
}
