import { relative } from "node:path";
import { Clock, Effect } from "effect";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { publish } from "@shivaedev/work-board/responses/publish.ts";
import { questionFrom, questionId, questionMarkdown, revisionOf } from "@shivaedev/work-board/responses/records.ts";
import type { BoardDocument } from "#board/documents.ts";
import type { BoardDecision } from "#board/schema.ts";
import { BoardFailure, type BoardWork, type Decision } from "#policy.ts";

function quoted(text: string): string {
	const fence = "~".repeat(Math.max(3, ...Array.from(text.matchAll(/~+/gu), (match) => match[0].length + 1)));
	return `${fence}\n${text}\n${fence}`;
}

function linked(text: string): string {
	if (!URL.canParse(text)) {
		return quoted(text);
	}
	const url = new URL(text);
	return url.protocol === "https:" || url.protocol === "http:" ? `<${url.href.replaceAll("<", "%3C").replaceAll(">", "%3E")}>` : quoted(text);
}

function decisionSource(itemId: string, work: BoardWork, input: Decision): string {
	const metadata = {
		attention: [
			{
				id: input.id,
				kind: "decision",
				managed: true,
				reason: input.reason,
				"response_from": ["maintainer"],
				state: "open",
				unblocks: [work.workId],
			},
		],
		id: itemId,
		kind: "decision",
		relationships: [{ kind: "relates_to", target: work.workId }],
	};
	return `---\n${JSON.stringify(metadata)}\n---\n# Fleet decision for ${work.workId}\n\n## Decision\n\n${quoted(input.reason)}\n\n## Recommendation\n\n${quoted(input.recommendation)}\n\n## Relevant links\n\n${input.links.map(linked).join("\n\n")}\n\n::::question{id="fleet-action" select="one"}\n### How should Fleet proceed?\n\n:::option{id="retry"}\nRetry after the blocker is resolved under trusted runtime policy.\n:::\n\n:::option{id="release"}\nSafely release this work's ownership if execution and delivery permit it.\n:::\n::::\n\n## Reviewed Board work\n\n${quoted(work.context)}\n`;
}

export function publishBoard(root: string, realRoot: string, documents: Effect.Effect<readonly BoardDocument[], BoardFailure>) {
	return Effect.fn("FleetBoard.decision")(function* (work: BoardWork, input: Decision): Effect.fn.Return<BoardDecision, BoardFailure> {
		const workSourcePath = relative(realRoot, work.sourcePath);
		const itemId = `decision.${revisionOf(JSON.stringify([work.workId, work.revision, workSourcePath, input.id, input.reason, input.recommendation, input.links]))}`;
		const context = decisionSource(itemId, work, input);
		if (new TextEncoder().encode(context).length > 256 * 1024 || metadataParse(context).diagnostics.length > 0) {
			return yield* Effect.fail(new BoardFailure({ message: "Fleet decision context exceeds Board limits or contains invalid attention metadata." }));
		}
		const sourcePath = `responses/${itemId}.md`;
		const revision = revisionOf(context);
		const id = questionId(itemId, input.id, revision, sourcePath);
		const receipt = {
			itemId,
			questionId: id,
			request: input.id,
			revision,
			sourcePath,
			workId: work.workId,
			workRevision: work.revision,
			workSourcePath,
		};
		yield* publish(root, realRoot, itemId, context).pipe(
			Effect.mapError(() => new BoardFailure({ message: "Fleet decision source could not be recorded on Board." })),
		);
		const all = yield* documents;
		if (all.some((document) => questionFrom(document)?.id === id)) {
			return receipt;
		}
		const registeredAt = yield* Clock.currentTimeMillis;
		const question = {
			context,
			id,
			question: {
				deadline: registeredAt + 48 * 60 * 60 * 1000,
				item: itemId,
				reason: input.reason,
				registeredAt,
				request: input.id,
				reviewedRevision: revision,
				source: sourcePath,
			},
		};
		yield* publish(root, realRoot, id, questionMarkdown(question)).pipe(
			Effect.mapError(() => new BoardFailure({ message: "Fleet decision question could not be registered on Board." })),
		);
		return receipt;
	});
}
