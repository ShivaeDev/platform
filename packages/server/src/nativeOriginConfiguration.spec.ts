import { Cause, Config } from "effect";
import { expect } from "vitest";
import { nativeOriginList } from "#test/app-host/nativeOriginList.ts";
import { host, startupFails } from "#test/app-host/story.ts";

for (const origin of ["*", "https://*.example", "capacitor://localhost/path", "https://localhost/path", "https://localhost?query", "null"]) {
	host.it(`rejects a native allow list containing ${origin}`, [startupFails, nativeOriginList([origin])], ({ bootFailure }) => {
		expect(Cause.squash(bootFailure())).toBeInstanceOf(Config.ConfigError);
	});
}
