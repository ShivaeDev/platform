import { waitScreen } from "./waitScreen.tsx";

waitScreen.it("names a removal that never happens", [], function* ({ gone }) {
	yield* gone(".notice", { timeout: 30 });
});

waitScreen.it("names text that never appears", [], function* ({ findText }) {
	yield* findText("Missing message", { timeout: 30 });
});

waitScreen.it("names a redirect that never happens", [], function* ({ navigatedAway }) {
	yield* navigatedAway("https://identity.test/authorize", { timeout: 30 });
});
