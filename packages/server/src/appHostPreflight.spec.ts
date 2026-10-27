import { Cause, Result } from "effect";
import { expect } from "vitest";
import { AppId, PreflightFailure, preflight } from "#test/app-host/preflight.ts";
import { environment, host, startupFails } from "#test/app-host/story.ts";

for (const mode of ["http", "migrate", "check", "wait"] as const) {
	for (const deferred of mode === "http" ? [false] : [false, true]) {
		const label = `${mode}${deferred ? " with deferred construction" : ""}`;
		host.it(
			`${label} stops on a typed preflight failure before migrations or application startup`,
			[preflight(mode, deferred), environment({ "APP_ID": "" }), startupFails],
			({ bootFailure, lifecycle }) => {
				const failure = Cause.findError(bootFailure());
				expect(Result.isSuccess(failure) && failure.success).toBeInstanceOf(PreflightFailure);
				expect(lifecycle()).toEqual(["preflight"]);
			},
		);
		host.it(
			`${label} shares preflight services with the host and releases them on shutdown`,
			[preflight(mode, deferred), environment({ "APP_ID": "valid-app" })],
			function* ({ ping, hasService, lifecycle, close }) {
				expect(yield* ping()).toBe("valid-app");
				expect(yield* hasService(AppId)).toBe(true);
				expect(lifecycle()).toEqual([
					"preflight",
					...(mode === "http" ? [] : ["loading"]),
					...(mode === "migrate" ? ["migrated"] : []),
					...(deferred ? ["constructing"] : []),
					"started",
				]);
				yield* close();
				expect(lifecycle().at(-1)).toBe("released");
			},
		);
	}
}
