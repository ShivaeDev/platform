import { expect } from "vitest";
import { moduleWorkers } from "#test/modules/workerStory.ts";

moduleWorkers.it(
	"an app host and a worker host whose models declare no encrypted field start without COLUMN_ENCRYPTION_KEY and serve a write",
	[],
	function* ({ joinMember }) {
		expect(yield* joinMember("alice", "1 Elm Street")).toBeTypeOf("number");
	},
);
