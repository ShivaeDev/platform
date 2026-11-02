import { expect } from "vitest";
import { core } from "#test/core.ts";

core.it("a custom SessionPolicy supplies the caller to a native MCP tool without OAuth", [], function* ({ identify }) {
	expect(yield* identify()).toBe("alice");
});

core.it("an Origin admitted by both policies can call a tool", [], function* ({ identify }) {
	expect(yield* identify("https://app.test")).toBe("alice");
});

core.it("the session Origin gate refuses an Origin admitted by the MCP transport", [], function* ({ identify }) {
	expect(yield* identify("https://transport-only.test")).toBe("HTTP 403");
});

core.it("the MCP Origin gate refuses an Origin admitted by the session policy", [], function* ({ identify }) {
	expect(yield* identify("https://policy-only.test")).toBe("HTTP 403");
});
