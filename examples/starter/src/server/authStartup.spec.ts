import { expect } from "vitest";
import { authStartup } from "#test-support/authStartup.ts";

authStartup.it(
	"authentication finishes schema validation before its database scope closes",
	[],
	function* ({ closeAuthenticationScope, schemaValidation }) {
		yield* closeAuthenticationScope();

		expect(yield* schemaValidation()).toBe("completed");
	},
);
