import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { applicationPolicyStory, nativePolicyStory } from "#test/nativePolicyStory.ts";

for (const host of [nativePolicyStory, applicationPolicyStory]) {
	host.it("a false read policy returns QueryReadDenied over HTTP without running the handler", [], function* ({ read, handlerCalls }) {
		const answer = yield* read();

		yield* outcomes([
			["HTTP answer", () => Effect.succeed(answer), "failed with read denied"],
			["handler calls", () => handlerCalls(), 0],
		]);
	});

	host.it("each allowed HTTP request evaluates its policy once", [], function* ({ allowRead, read, policyChecks }) {
		yield* allowRead();

		const first = yield* read();

		yield* outcomes([
			["first answer", () => Effect.succeed(first), "A note"],
			["policy checks", () => policyChecks(), 1],
		]);

		const second = yield* read();

		yield* outcomes([
			["second answer", () => Effect.succeed(second), "A note"],
			["policy checks", () => policyChecks(), 2],
		]);
	});

	host.it("each denied HTTP request evaluates its policy once", [], function* ({ read, policyChecks }) {
		const first = yield* read();

		yield* outcomes([
			["first denial", () => Effect.succeed(first), "failed with read denied"],
			["policy checks", () => policyChecks(), 1],
		]);

		const second = yield* read();

		yield* outcomes([
			["second denial", () => Effect.succeed(second), "failed with read denied"],
			["policy checks", () => policyChecks(), 2],
		]);
	});
}
