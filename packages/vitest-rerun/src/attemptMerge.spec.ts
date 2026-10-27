import { expect } from "vitest";
import { collectionFailsOnce, failsThenSkipped, failsTimes, gainsTest, losesTest, passesThenFails, rerunStory } from "#test/kit.ts";

const FLAKY = "checkout > recovers only in a fresh process";

rerunStory.it("a failed test that passes in the next attempt is flaky and keeps both durations", [failsTimes(1)], function* ({ attempts }) {
	const first = yield* attempts.record();
	const second = yield* attempts.record();
	const firstDuration = attempts.duration(first, "recovers only in a fresh process") ?? 0;
	const secondDuration = attempts.duration(second, "recovers only in a fresh process") ?? 0;
	const merged = attempts.merge(first, second);
	expect(attempts.states(merged)).toMatchObject({ "flaky.spec.ts": "pass", "flaky.spec.ts > recovers only in a fresh process": "pass" });
	expect(merged.flaky).toStrictEqual([
		{ attempts: 2, classname: "flaky.spec.ts", file: "flaky.spec.ts", messages: ["Attempt 1 leaves module state behind"], name: FLAKY },
	]);
	expect(merged.failures).toStrictEqual({});
	expect(merged.summary).toStrictEqual([`- Flaky: flaky.spec.ts — ${FLAKY}`]);
	expect(attempts.duration(merged, "recovers only in a fresh process")).toBe(firstDuration + secondDuration);
});

rerunStory.it("a failure history grows with every attempt until the test passes", [failsTimes(2)], function* ({ attempts }) {
	const first = yield* attempts.record();
	const second = attempts.merge(first, yield* attempts.record());
	expect(attempts.states(second)).toMatchObject({ "flaky.spec.ts": "fail" });
	expect(second.flaky).toStrictEqual([]);
	expect(Object.values(second.failures)).toStrictEqual([
		{ attempts: 2, messages: ["Attempt 1 leaves module state behind", "Attempt 2 leaves module state behind"] },
	]);
	const third = attempts.merge(second, yield* attempts.record());
	expect(third.failures).toStrictEqual({});
	expect(third.flaky).toMatchObject([
		{ attempts: 3, messages: ["Attempt 1 leaves module state behind", "Attempt 2 leaves module state behind"], name: FLAKY },
	]);
});

rerunStory.it("a test that passed in the first attempt keeps that result", [passesThenFails()], function* ({ attempts }) {
	const first = yield* attempts.record();
	const merged = attempts.merge(first, yield* attempts.record());
	expect(attempts.states(merged)).toStrictEqual({ "settled.spec.ts": "pass", "settled.spec.ts > settles in the first attempt": "pass" });
	expect(merged.flaky).toStrictEqual([]);
	expect(merged.failures).toStrictEqual({});
});

rerunStory.it("a failed test that the next attempt skips stays failed and is not flaky", [failsThenSkipped()], function* ({ attempts }) {
	const first = yield* attempts.record();
	const merged = attempts.merge(first, yield* attempts.record());
	expect(attempts.states(merged)).toStrictEqual({ "skipped.spec.ts": "fail", "skipped.spec.ts > is skipped by the rerun": "fail" });
	expect(merged.flaky).toStrictEqual([]);
	expect(merged.failures).toStrictEqual({});
});

rerunStory.it("a file that only failed to load is recorded when it recovers", [collectionFailsOnce()], function* ({ attempts }) {
	const first = yield* attempts.record();
	const merged = attempts.merge(first, yield* attempts.record());
	expect(attempts.states(merged)).toMatchObject({ "collected.spec.ts": "pass" });
	expect(merged.flaky).toStrictEqual([
		{ attempts: 2, classname: "collected.spec.ts", file: "collected.spec.ts", messages: ["Collection fails once"], name: "file failed to load" },
	]);
	expect(merged.summary).toStrictEqual(["- Flaky: collected.spec.ts — collection failure"]);
});

rerunStory.it("a next attempt with a test the first one did not collect is rejected", [gainsTest()], function* ({ attempts }) {
	const first = yield* attempts.record();
	const second = yield* attempts.record();
	expect(() => attempts.merge(first, second)).toThrow("Rerun collected an unexpected test: appears in the rerun");
});

rerunStory.it("a next attempt that misses a test of the first one is rejected", [losesTest()], function* ({ attempts }) {
	const first = yield* attempts.record();
	const second = yield* attempts.record();
	expect(() => attempts.merge(first, second)).toThrow("Rerun did not collect every original test");
});
