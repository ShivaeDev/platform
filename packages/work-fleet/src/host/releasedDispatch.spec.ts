import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import { releaseWork } from "#host/releaseWork.ts";
import { dispatchWork } from "#test/dispatchWork.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { askWorker } from "#test/workerQuestion.ts";

postgresTests("live")("release then dispatch restarts a waiting item with an existing worker session under the same ID", function* () {
	yield* withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
		Effect.gen(function* () {
			const first = yield* dispatchWork(fixture.host, "one", fixture.parts);
			yield* askWorker(fixture.provider).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
			const [released] = yield* releaseWork(fixture.host, ["one"], fixture.parts);
			expect(released?.value.step).toBe("released");
			const dispatched = yield* dispatchWork(fixture.host, "one", fixture.parts);
			expect(dispatched.value.step).toBe("working");
			expect(dispatched.value.history?.[0]?.step).toBe("released");
			expect(dispatched.value.history?.[0]?.responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
			expect(dispatched.value.attempts[0]?.receipt?.sessionId).not.toBe(first.value.attempts[0]?.receipt?.sessionId);
			expect(dispatched.value.boardRevision).toBe(first.value.boardRevision);
			expect(fixture.provider.launched).toHaveLength(2);
			const current = yield* Fleet.pipe(
				Effect.flatMap((fleet) => fleet.get("one")),
				Effect.provide(hostLayer(fixture.host, fixture.parts)),
			);
			expect(current.value.step).toBe("working");
		}),
	);
});
