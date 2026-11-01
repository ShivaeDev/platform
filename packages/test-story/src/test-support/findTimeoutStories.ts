import { expect } from "vitest";
import { pendingSignal, waitScreen } from "./waitScreen.tsx";

waitScreen.it("a missing button times out", [pendingSignal], function* ({ find }) {
	yield* find({ name: "Missing", role: "button" }, { timeout: 30 });
});

waitScreen.it("the next story renders and responds to a click", [pendingSignal], function* ({ click, text }) {
	yield* click({ name: "Reveal", role: "button" });

	expect(text(".ready")).toBe("Ready now");
});
