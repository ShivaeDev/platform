import { NodeServices } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { boardDocuments } from "#board/documents.ts";
import { markdownBoard } from "#board/markdown.ts";
import { Fleet } from "#fleet.ts";
import { BoardGateway } from "#policy.ts";
import { createEngine } from "#test/createEngine.ts";
import { finishWorkers } from "#test/engine.ts";
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
			checksFailure: false,
			checksGate: Effect.suspend(() =>
				validation.editBrief ? fs.writeFileString(`${root}/one.md`, `${source}\nChanged during validation.\n`).pipe(Effect.orDie) : Effect.void,
			),
			denyDelivery: true,
			noChange: false,
		};
		const { fixture, fleetLayer } = yield* createEngine(options, boardLayer);
		const fleet = Context.get(yield* Layer.build(fleetLayer), Fleet);
		return { fixture, fleetLayer, fs, options, root, runtime: { fleet }, source, validation };
	},
	layer,
	name: "fleet Board decisions",
	runIf: postgresEnabled,
	stages: ["board"],
	verbs: ({ fixture, fleetLayer, fs, root, runtime, source, validation }, story) => ({
		changeBriefWhenChecksFinish: () => {
			validation.editBrief = true;
		},
		dispatch: () => runtime.fleet.dispatch("one"),
		editBrief: () => fs.writeFileString(`${root}/one.md`, `${source.replace("fleet: approved", "fleet: draft")}\nRequire another validation.\n`),
		finishWorkers: () => {
			story.tell("the provider completes its active turns");
			finishWorkers(fixture);
		},
		forgetReceipts: () =>
			Effect.gen(function* () {
				const receipts = (yield* fs.readDirectory(`${root}/responses`)).filter((name) => name.startsWith("request-receipt."));
				if (receipts.length === 0) {
					return yield* Effect.die("No request receipts to forget");
				}
				for (const name of receipts) {
					yield* fs.remove(`${root}/responses/${name}`);
				}
			}),
		legacyAutomaticRouting: () =>
			Effect.gen(function* () {
				const current = (yield* runtime.fleet.get("one")).value;
				yield* fixture.replaceRecord({ ...current, supersededDecisions: undefined });
			}),
		prepare: () =>
			runtime.fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src/one.ts"] }), prompt: "Implement one", workId: "one" }),
		publishedDocuments: () => boardDocuments(root, root).pipe(Effect.provide(NodeServices.layer)),
		readSource: (file: string) => fs.readFileString(`${root}/${file}`),
		reassign: (decisionId: string, owner: "orchestrator" | "maintainer") => runtime.fleet.reassign("one", decisionId, owner),
		reconcile: () => runtime.fleet.reconcile("one"),
		reopenBoard: () =>
			Effect.gen(function* () {
				const board = Context.get(yield* Layer.build(Layer.fresh(markdownBoard(root))).pipe(Effect.provide(NodeServices.layer)), BoardGateway);
				return yield* board.get("one");
			}),
		restart: () =>
			Effect.gen(function* () {
				runtime.fleet = Context.get(yield* Layer.build(Layer.fresh(fleetLayer)), Fleet);
			}),
		restorePublication: (file: string, content: string) => fs.writeFileString(`${root}/${file}`, content),
		reviseBrief: () => fs.writeFileString(`${root}/one.md`, `${source}\nApproved revised scope.\n`),
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

export const failedChecks = fleetBoardStory.trait("board", "required checks fail", ({ options }) => {
	options.checksFailure = true;
});
