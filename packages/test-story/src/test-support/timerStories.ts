import { timers } from "./timers.ts";

timers.it("leaves a timer start unconsumed", [], function* ({ starts, timePasses }) {
	yield* starts("earlier delivery", ["1 second"]);
	yield* timePasses("1 second");
});

timers.it("names a timer that never starts", [], function* ({ waitForTimer }) {
	yield* waitForTimer("1 second", { timeout: "30 millis" });
});
