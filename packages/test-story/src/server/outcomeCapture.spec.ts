import { expect } from "@effect/vitest";
import { outcomeCapture } from "#test/outcomeCapture.ts";

outcomeCapture.it("keeps the successful read's value", [], function* ({ read }) {
	const value = { title: "Native outcomes" };

	const answer = yield* read(value);

	expect(answer).toBe(value);
});

outcomeCapture.it("renders an expected refusal with its reason", [], function* ({ refuse }) {
	const answer = yield* refuse("the session expired");

	expect(answer).toBe("read refused: the session expired");
});

outcomeCapture.it("renders a defect separately from an expected refusal", [], function* ({ crash }) {
	const answer = yield* crash("invalid reader state");

	expect(answer).toBe("reader crashed: invalid reader state");
});

outcomeCapture.it("renders interruption separately from a defect", [], function* ({ cancel }) {
	const answer = yield* cancel();

	expect(answer).toBe("read cancelled");
});

outcomeCapture.it("keeps the expected refusal when the cause also contains a defect", [], function* ({ failWithDefect }) {
	const answer = yield* failWithDefect("the session expired");

	expect(answer).toBe("read refused: the session expired");
});

outcomeCapture.it("renders a defect even when the read was also interrupted", [], function* ({ crashWhileCancelled }) {
	const answer = yield* crashWhileCancelled("invalid reader state");

	expect(answer).toBe("reader crashed: invalid reader state");
});
