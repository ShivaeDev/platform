import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { BadRequest, Conflict, Forbidden, NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";
import { prepared } from "#test/preparation.ts";
import { readyScheduledHost } from "#test/scheduledHost.ts";
import { unavailableMain } from "#test/unavailableMain.ts";

host.it(
	"clients retain missing, invalid, denied and stale errors in the error channel",
	[boardWork({}, { intervalSeconds: 60 }), readyScheduledHost],
	function* (daemon) {
		daemon.writeBoard("one.md", task("one", "approved"));
		const missing = yield* daemon.request("fleet.get", { workId: "missing" }).pipe(Effect.flip);
		expect(missing).toBeInstanceOf(NotFound);
		expect(missing.message).toBe("Unknown Board work missing");
		yield* daemon.request("fleet.prepare", { cwd: "/synthetic", preparation: prepared(), prompt: "Work", workId: "one" });
		const invalid = yield* daemon.request("fleet.continue", { message: "", workId: "one" }).pipe(Effect.flip);
		expect(invalid).toBeInstanceOf(BadRequest);
		expect(invalid.message).toBe("Continuation needs a message");
		const denied = yield* daemon.request("fleet.continue", { message: "Continue", workId: "one" }).pipe(Effect.flip);
		expect(denied).toBeInstanceOf(Forbidden);
		expect(denied.message).toBe("Continue requires terminal waiting or done work");
		const stale = yield* daemon
			.request("fleet.reassign", { attentionOwner: "orchestrator", decisionId: "old-decision", workId: "one" })
			.pipe(Effect.flip);
		expect(stale).toBeInstanceOf(Conflict);
		expect(stale.message).toBe("The waiting decision changed");
	},
);

host.it(
	"daemon dispatch records refresh failure after acknowledging acceptance",
	[boardWork({}, { intervalSeconds: 60 }), unavailableMain],
	function* (daemon) {
		daemon.writeBoard("one.md", task("one", "approved"));
		const accepted = yield* daemon.request("daemon.dispatch", { workId: "one" });
		expect(accepted.status).toBe("pending");
		const failure = yield* daemon.dispatchOutcome("one");
		expect(failure).toMatchObject({ error: "Git observation unavailable", id: accepted.id, status: "failed" });
	},
);
