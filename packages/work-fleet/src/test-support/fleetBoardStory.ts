import { NodeServices } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { boardDocuments } from "#board/documents.ts";
import { markdownBoard } from "#board/markdown.ts";
import { Fleet } from "#fleet.ts";
import { BoardGateway } from "#policy.ts";
import { createEngine, finishWorkers } from "#test/engine.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

const layer = Layer.merge(postgresLayer, NodeServices.layer);

export const fleetBoardStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "fleet-board-story-" });
		const source = "---\nid: one\nkind: task\nfleet: approved\n---\n# Scoped work\n\nPreserve review and required validation.\n";
		yield* fs.writeFileString(`${root}/one.md`, source);
		const boardLayer = markdownBoard(root).pipe(Layer.provide(NodeServices.layer));
		const validation = { editBrief: false };
		const options = {
			checksGate: Effect.suspend(() =>
				validation.editBrief ? fs.writeFileString(`${root}/one.md`, `${source}\nChanged during validation.\n`).pipe(Effect.orDie) : Effect.void,
			),
			denyDelivery: true,
			noChange: false,
		};
		const { fixture, fleetLayer } = yield* createEngine(options, boardLayer);
		const fleet = Context.get(yield* Layer.build(fleetLayer), Fleet);
		return { fixture, fleet, fs, options, root, source, validation };
	},
	layer,
	name: "fleet Board decisions",
	runIf: postgresEnabled,
	stages: ["board"],
	verbs: ({ fixture, fleet, fs, root, source, validation }, story) => ({
		changeBriefWhenChecksFinish: () => {
			validation.editBrief = true;
		},
		dispatch: () => fleet.dispatch("one"),
		editBrief: () => fs.writeFileString(`${root}/one.md`, `${source.replace("fleet: approved", "fleet: draft")}\nRequire another validation.\n`),
		finishWorkers: () => {
			story.tell("the provider completes its active turns");
			finishWorkers(fixture);
		},
		legacyAutomaticRouting: () =>
			Effect.gen(function* () {
				const current = (yield* fleet.get("one")).value;
				yield* fixture.replaceRecord({ ...current, supersededDecisions: undefined });
			}),
		prepare: () =>
			fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src/one.ts"] }), prompt: "Implement one", workId: "one" }),
		publishedDocuments: () => boardDocuments(root, root).pipe(Effect.provide(NodeServices.layer)),
		readSource: (file: string) => fs.readFileString(`${root}/${file}`),
		reassign: (decisionId: string, owner: "orchestrator" | "maintainer") => fleet.reassign("one", decisionId, owner),
		reconcile: () => fleet.reconcile("one"),
		reopenBoard: () =>
			Effect.gen(function* () {
				const board = Context.get(yield* Layer.build(Layer.fresh(markdownBoard(root))).pipe(Effect.provide(NodeServices.layer)), BoardGateway);
				return yield* board.get("one");
			}),
		restartAndReconcile: () => fixture.restart(Effect.flatMap(Fleet, (restarted) => restarted.reconcile("one"))),
		restoreLegacyPublication: (file: string, content: string, forgetReceipts = false) =>
			Effect.gen(function* () {
				yield* fs.writeFileString(`${root}/${file}`, content);
				if (forgetReceipts) {
					for (const name of yield* fs.readDirectory(`${root}/responses`)) {
						if (name.startsWith("request-receipt.")) {
							yield* fs.remove(`${root}/responses/${name}`);
						}
					}
				}
			}),
		runUpgrade: () =>
			Effect.gen(function* () {
				yield* fs.remove(`${root}/.fleet-decision-closure-v1.json`);
				const board = Context.get(yield* Layer.build(Layer.fresh(markdownBoard(root))).pipe(Effect.provide(NodeServices.layer)), BoardGateway);
				yield* board.get("one");
			}),
		upgradeStorage: () => fixture.upgradeAttention,
	}),
});

export const noChangeReport = fleetBoardStory.trait("board", "the worker reports that no code change is needed", ({ options }) => {
	options.noChange = true;
});
