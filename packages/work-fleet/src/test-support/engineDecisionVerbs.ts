import { copyFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { engineBoardVerbs } from "#test/engineBoardVerbs.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { openFleetBoard } from "#test/withFleetBoard.ts";

export function engineDecisionVerbs(state: EngineStory, tell: (line: string) => void) {
	function root() {
		if (state.root === "") {
			throw new Error("No Markdown Board is configured");
		}
		return state.root;
	}
	const board = engineBoardVerbs(state, tell);
	return {
		changeBriefWhenChecksFinish: () => {
			tell("the brief will change when required checks finish");
			state.checkCompletionEdit = () => board.writeBoardWork("one.md", `${state.source}\nChanged during validation.\n`);
		},
		deleteBoardItem: (id: string) => {
			tell(`the Board item ${id} is deleted`);
			unlinkSync(join(root(), `${id}.md`));
		},
		duplicateBoardItem: (id: string) => {
			tell(`another Board item duplicates ${id}`);
			copyFileSync(join(root(), `${id}.md`), join(root(), `${id}-duplicate.md`));
		},
		editBrief: () => board.writeBoardWork("one.md", `${state.source.replace("fleet: approved", "fleet: draft")}\nRequire another validation.\n`),
		forgetReceipts: () => {
			tell("forget the decision supersession receipts");
			const responses = join(root(), "responses");
			const receipts = readdirSync(responses).filter((name) => name.startsWith("request-receipt."));
			if (receipts.length === 0) {
				throw new Error("No request receipts to forget");
			}
			for (const name of receipts) {
				unlinkSync(join(responses, name));
			}
		},
		legacyAutomaticRouting: () =>
			Effect.gen(function* () {
				tell("restore a legacy decision without explicit routing");
				const { fleet, fixture } = running(state);
				const current = (yield* fleet.get("one")).value;
				yield* fixture.replaceRecord({ ...current, supersededDecisions: undefined });
			}),
		publishedDocuments: () =>
			readdirSync(root(), { encoding: "utf8", recursive: true })
				.filter((file) => file.endsWith(".md"))
				.map((file) => ({ file, parsed: board.readBoardPublication(file) })),
		reassign: (id: string, decisionId: string, owner: "orchestrator" | "maintainer") => {
			tell(`reassign ${id}'s decision to ${owner}`);
			return running(state).fleet.reassign(id, decisionId, owner);
		},
		reopenBoard: () =>
			Effect.gen(function* () {
				tell("reopen the Markdown Board");
				const gateway = yield* openFleetBoard(root());
				return yield* gateway.get("one");
			}),
		revisePublishedBrief: () => board.writeBoardWork("one.md", `${state.source}\nApproved revised scope.\n`),
		runUpgrade: () =>
			Effect.gen(function* () {
				tell("rerun the legacy decision publication upgrade");
				unlinkSync(join(root(), ".fleet-decision-closure-v1.json"));
				const gateway = yield* openFleetBoard(root());
				yield* gateway.get("one");
			}),
		upgradeStorage: () => {
			tell("upgrade persisted attention ownership");
			return running(state).fixture.upgradeAttention;
		},
	};
}
