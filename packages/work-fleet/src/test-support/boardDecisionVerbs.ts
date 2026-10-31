import { Effect } from "effect";
import type { DraftInput } from "@shivaedev/work-board/server/integration/responses.ts";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { migrate } from "@shivaedev/work-board/server/migration/migrate.ts";
import { questionFrom } from "@shivaedev/work-board/server/responses/records.ts";
import type { BoardDecision, BoardDecisionAcknowledgement } from "#board/schema.ts";
import type { BoardGateway, BoardWork } from "#policy.ts";
import { boardAskFiles, boardHttp, type boardHttpFiles } from "./boardHttp.ts";
import { decisionState } from "./decisionState.ts";
import { migrationDecision } from "./migrationDecision.ts";
import { refusal } from "./refusal.ts";

export const DENIED_DELIVERY = {
	id: "fleet.denied",
	links: ["https://example.test/pr/1"],
	reason: "Delivery authority is denied",
	recommendation: "Update trusted runtime policy, then retry.",
};

export const MIGRATED = { id: "task.one.1", links: [], reason: "Choose the next step", recommendation: "Release" };

export interface MaintainerResponse {
	readonly body?: string;
	readonly id: string;
	readonly selected?: readonly string[];
	readonly supersedes?: string;
	readonly text?: string;
	readonly type: DraftInput["type"];
}

export function boardDecisionVerbs(
	root: string,
	current: () => typeof BoardGateway.Service,
	files: ReturnType<typeof boardHttpFiles>,
	tell: (line: string) => void,
) {
	let recordedAt = 1000;
	function draft(decision: BoardDecision, response: MaintainerResponse): DraftInput {
		const answers =
			response.type === "answer" ? [{ prompt: "fleet-action", selected: [...(response.selected ?? [])], text: response.text ?? "" }] : undefined;
		return {
			...(answers === undefined ? {} : { answers }),
			author: "maintainer",
			body: response.body ?? "",
			id: response.id,
			question: decision.questionId,
			...(response.supersedes === undefined ? {} : { supersedes: response.supersedes }),
			type: response.type,
		};
	}
	return {
		acknowledge: (decision: BoardDecision, disposition: BoardDecisionAcknowledgement["disposition"], responseId?: string) => {
			recordedAt += 1;
			tell(`Fleet acknowledges ${decision.request} as ${disposition}${responseId === undefined ? "" : ` with ${responseId}`}`);
			return refusal(current().acknowledgeDecision({ decision, disposition, recordedAt, ...(responseId === undefined ? {} : { responseId }) }));
		},
		answerBody: (decision: BoardDecision) =>
			current()
				.readDecision(decision)
				.pipe(Effect.map((reading) => (reading._tag === "Response" ? reading.response.body : undefined))),
		closeFinishedDecisions: () => {
			tell("Fleet closes its finished decisions on Board");
			const close = current().closeFinishedDecisions;
			return close === undefined ? Effect.die("Board has no decision close path") : close();
		},
		decisionState: (decision: BoardDecision) => current().readDecision(decision).pipe(Effect.map(decisionState)),
		inbox: (decision: BoardDecision) =>
			boardAskFiles(root).pipe(Effect.map((asks) => (asks.includes(decision.sourcePath) ? "asked in the inbox" : "not in the inbox"))),
		inboxLanes: Effect.fn("Story.inboxLanes")(function* () {
			const { client } = yield* boardHttp(root);
			const inbox = yield* Effect.tryPromise(() => client.run(client.api.inbox.run(undefined)));
			return { agents: inbox.agents.length, answered: inbox.answered.length, resolved: inbox.resolved.length, you: inbox.you.length };
		}, Effect.scoped),
		migrateLegacyDecision: Effect.fn("Story.migrateLegacyDecision")(function* (receipted: "receipted" | "unreceipted") {
			const published = yield* current().decision("task.one", MIGRATED);
			const legacy = migrationDecision(published, files.read(published.sourcePath), receipted === "receipted");
			tell(`an ${receipted} legacy decision answered with release is written and the Board folder is migrated`);
			for (const [file, source] of Object.entries(legacy.files)) {
				files.write(file, source);
			}
			yield* migrate(root);
			return legacy.decision;
		}),
		publishDecision: (decision: Parameters<typeof BoardGateway.Service.decision>[1] = DENIED_DELIVERY, original?: BoardWork) => {
			tell(`Fleet publishes decision ${decision.id} for task.one`);
			return current().decision("task.one", decision, original);
		},
		publishedQuestion: (decision: BoardDecision) =>
			Effect.sync(() => {
				const file = `responses/${decision.questionId}.md`;
				const question = questionFrom({ file, parsed: metadataParse(files.read(file)) })?.question;
				const source = files.read(decision.sourcePath);
				return {
					item: question?.item,
					options: [...source.matchAll(/:::option\{id="(?<id>[^"]+)"\}/gu)].map((match) => match.groups?.id),
					questionReason: question?.reason,
					source,
				};
			}),
		questionPreview: Effect.fn("Story.questionPreview")(function* (decision: BoardDecision) {
			tell(`a Board reader previews the question for ${decision.request}`);
			const { client } = yield* boardHttp(root);
			const preview = yield* Effect.tryPromise(() => client.run(client.responses.question.run({ item: decision.itemId, request: decision.request })));
			return { question: preview.id, revision: preview.reviewedRevision, source: preview.source };
		}, Effect.scoped),
		receiptRecords: () => Effect.sync(() => files.receipts().map((file) => metadataParse(files.read(file)).fields.requestReceipt)),
		recordedResponses: Effect.fn("Story.recordedResponses")(function* (decision: BoardDecision) {
			const { client } = yield* boardHttp(root);
			const document = yield* Effect.tryPromise(() => client.run(client.api.document.run({ url: `/${decision.sourcePath}` })));
			return document.requests?.find((request) => request.id === decision.request)?.responses?.map((response) => response.id) ?? [];
		}, Effect.scoped),
		registerQuestion: Effect.fn("Story.registerQuestion")(function* (decision: BoardDecision) {
			tell(`a Board reader registers the question for ${decision.request}`);
			const { client } = yield* boardHttp(root);
			const registered = yield* Effect.tryPromise(() =>
				client.mutate(client.responses.registerQuestion.run({ item: decision.itemId, request: decision.request, revision: decision.revision })),
			);
			return registered.id;
		}, Effect.scoped),
		respond: Effect.fn("Story.respond")(function* (decision: BoardDecision, response: MaintainerResponse) {
			tell(`the maintainer records ${response.type} ${response.id} through Board HTTP`);
			const { client } = yield* boardHttp(root);
			return yield* refusal(
				Effect.tryPromise({ catch: (error) => error, try: () => client.mutate(client.responses.recordResponse.run(draft(decision, response))) }),
			);
		}, Effect.scoped),
		respondLink: Effect.fn("Story.respondLink")(function* (decision: BoardDecision) {
			tell(`a Board reader opens the respond link for ${decision.request}`);
			const { url } = yield* boardHttp(root);
			const page = yield* Effect.tryPromise(() =>
				fetch(`${url}/_board/respond?item=${decision.itemId}&request=${decision.request}`, { redirect: "manual" }),
			);
			return { location: page.headers.get("location"), status: page.status };
		}, Effect.scoped),
		settledDecision: Effect.fn("Story.settledDecision")(function* (decision: BoardDecision) {
			tell("a Board reader reads the inbox, which archives settled decisions");
			yield* boardAskFiles(root);
			const settled = metadataParse(files.read(`.board-settled/${decision.itemId}.md`));
			return { attention: settled.fields.attention, body: settled.body, status: settled.fields.status };
		}, Effect.scoped),
	};
}
