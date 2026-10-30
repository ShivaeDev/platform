import { expect } from "vitest";
import { signingKeyMissing, startup } from "#test/startup.ts";

startup.it("a missing signing key reaches application startup as a ConfigError failure", [signingKeyMissing], function* ({ buildHost }) {
	expect(yield* buildHost()).toEqual([expect.stringMatching(/^configuration failed: ConfigError:.*WEBHOOK_SECRET/su)]);
});
