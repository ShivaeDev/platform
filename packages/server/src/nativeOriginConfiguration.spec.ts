import { expect } from "vitest";
import { nativeOriginList } from "#test/app-host/nativeOriginList.ts";
import { host, startupFails } from "#test/app-host/story.ts";

for (const origin of ["*", "https://*.example", "capacitor://localhost/path", "https://localhost/path", "https://localhost?query", "null"]) {
	host.it(
		`a native origin allow list containing ${origin} fails startup with a config error`,
		[startupFails, nativeOriginList([origin])],
		function* ({ startup }) {
			expect(yield* startup()).toBe("failed with config error");
		},
	);
}
