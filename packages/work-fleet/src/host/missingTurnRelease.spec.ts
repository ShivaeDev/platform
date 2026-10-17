import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { executing } from "#model.ts";
import { SessionTransport } from "#session/service.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { appliedAnswer, dispatchAndWait } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { missingTurnTransport } from "#test/missingTurnTransport.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

postgresTests("live")(
	"closed and open tasks release legacy lost recorded turns without starting or resuming a turn",
	() =>
		withHost({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, {}, (fixture) => {
			const missing = missingTurnTransport();
			const parts = {
				...fixture.parts,
				provider: Layer.effect(SessionTransport)(SessionTransport.pipe(Effect.map(missing.decorate))).pipe(Layer.provide(fixture.parts.provider)),
			};
			return withReadDaemon(
				fixture.host,
				(port) =>
					Effect.gen(function* () {
						const client = yield* daemonClient(port);
						for (const workId of ["one", "two"]) {
							yield* dispatchAndWait(client, workId);
							const waiting = yield* client("fleet.reconcile", { workId });
							expect(waiting.stage).toBe("needs-human");
							expect(executing(waiting)).toBe(true);
							expect(waiting.attempts[0]?.receipt).toBeDefined();
						}
						fixture.write("one.md", task("one", "approved").replace("kind: task", "kind: task\nstatus: done"));
						const closed = yield* client("fleet.reconcile", { workId: "one" });
						expect(closed.stage).toBe("released");
						expect(closed.releaseReason).toBe("Board status is done");
						expect(executing(closed)).toBe(false);
						expect((yield* client("fleet.reconcile", { workId: "two" })).stage).toBe("needs-human");
						expect(yield* Effect.promise(() => cliProcess(["answer", "--release", "two", "--port", String(port)]))).toEqual({
							code: 0,
							stdout: "two needs-human: Answer recorded; applying in the background",
						});
						const open = yield* appliedAnswer(client, "two");
						expect(open.stage).toBe("released");
						expect(executing(open)).toBe(false);
						expect(open.responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
						expect(boardHttpFiles(fixture.host.boardDir).receipts()).toHaveLength(2);
						expect(fixture.provider.settings.filter((call) => call.call === "turn")).toHaveLength(2);
						expect(fixture.provider.launched).toHaveLength(2);
						expect(missing.requests).not.toContain("turn/start");
						expect(missing.recoveries.every((input) => input.resume === undefined)).toBe(true);
					}),
				parts,
			);
		}),
	30_000,
);
