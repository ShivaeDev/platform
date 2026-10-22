import { relative } from "node:path";
import { Clock, Effect } from "effect";
import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { decisionAnswer } from "#board/decisionAnswer.ts";
import type { BoardDocument } from "#board/documents.ts";
import { recordBoardSource, withBoardReadPass } from "#board/readPass.ts";
import { reviewedDecision } from "#board/reviewedDecision.ts";
import type { BoardDecision } from "#board/schema.ts";
import { type DecisionCopy, decisionCopy } from "#engine/decisionCopy.ts";
import { BoardFailure, type BoardWork, type Decision } from "#policy.ts";

const { publish, questionFrom, questionId, questionMarkdown, revisionOf } = responses;

function publicationFailure(message: string, cause: Error): BoardFailure {
	const details: string[] = [];
	for (let current: unknown = cause; current instanceof Error; current = current.cause) {
		details.push(current.message);
	}
	return Object.defineProperty(new BoardFailure({ message: `${message}: ${details.join("; ")}` }), "cause", { value: cause });
}

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

function decisionSource(itemId: string, work: BoardWork, input: Decision, copy: DecisionCopy): string {
	const metadata = {
		attention: [
			{
				id: input.id,
				kind: "decision",
				managed: true,
				reason: copy.reason,
				"response_from": [input.attentionOwner ?? "orchestrator"],
				state: "open",
				unblocks: [work.workId],
			},
		],
		id: itemId,
		kind: "question",
		relationships: [{ kind: "relates_to", target: work.workId }],
		scope: "task",
		status: "ready",
		urgency: "blocking",
	};
	const answer = decisionAnswer(copy);
	const review =
		input.review === undefined ? "" : `## Review\n\n[Review document](/${input.review.publication.sourcePath})\n\n${input.review.tldr}\n\n`;
	return `---\n${JSON.stringify(metadata)}\n---\n# Fleet decision for ${work.workId}\n\n## Decision\n\n${quoted(copy.reason)}\n\n## Recommendation\n\n${quoted(copy.recommendation)}\n\n## Relevant links\n\n${input.links.map(linked).join("\n\n")}\n\n${review}${answer === undefined ? "" : `${answer}\n\n`}## Reviewed Board work\n\n${quoted(work.context)}\n`;
}

export function publishBoard(root: string, realRoot: string, documents: Effect.Effect<readonly BoardDocument[], BoardFailure>) {
	return Effect.fn("FleetBoard.decision")(function* (work: BoardWork, input: Decision): Effect.fn.Return<BoardDecision, BoardFailure> {
		const workSourcePath = relative(realRoot, work.sourcePath);
		const itemId = `decision.${revisionOf(JSON.stringify([work.workId, work.revision, workSourcePath, input.id, input.reason, input.recommendation, input.links, ...(input.worker === undefined ? [] : [input.worker])]))}`;
		const existing = input.published === undefined ? undefined : (yield* documents).find((document) => document.file === input.published?.sourcePath);
		const copy = decisionCopy(input);
		const context = existing?.parsed.fields.id === itemId ? existing.source : decisionSource(itemId, work, input, copy);
		const parsed = boardApi.metadataParse(context);
		if (new TextEncoder().encode(context).length > 256 * 1024 || parsed.diagnostics.length > 0) {
			return yield* Effect.fail(new BoardFailure({ message: "Fleet decision context exceeds Board limits or contains invalid attention metadata." }));
		}
		const sourcePath = `responses/${itemId}.md`;
		if (input.published && reviewedDecision(input.published, existing, yield* documents)) {
			return input.published;
		}
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
			Effect.mapError((cause) => publicationFailure("Fleet decision source could not be recorded on Board", cause)),
		);
		yield* recordBoardSource(realRoot, sourcePath, context, parsed);
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
				reason: copy.reason,
				registeredAt,
				request: input.id,
				reviewedRevision: revision,
				source: sourcePath,
			},
		};
		const candidate = questionMarkdown(question, "blocking");
		const questionSource = yield* publish(root, realRoot, id, candidate).pipe(
			Effect.as(candidate),
			Effect.catchTag("Conflict", (cause) =>
				Effect.gen(function* () {
					const saved = (yield* withBoardReadPass(documents, { fresh: true })).find((document) => questionFrom(document)?.id === id);
					if (saved === undefined || questionFrom(saved)?.context !== context) {
						return yield* Effect.fail(cause);
					}
					return yield* publish(root, realRoot, id, saved.source).pipe(Effect.as(saved.source));
				}),
			),
			Effect.mapError((cause) => publicationFailure("Fleet decision question could not be registered on Board", cause)),
		);
		yield* recordBoardSource(realRoot, `responses/${id}.md`, questionSource);
		return receipt;
	});
}
