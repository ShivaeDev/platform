import { Effect } from "effect";
import { expect } from "vitest";
import { shutdownHost } from "#test/app-host/shutdown.ts";

shutdownHost.it(
	"disables preemptive shutdown so scope closure finalizes an active RPC stream before host disposal completes",
	[],
	function* ({ lifecycle, openStream, request, shutdown }) {
		yield* openStream();
		expect(lifecycle()).toEqual([]);
		yield* shutdown().pipe(Effect.timeout("5 seconds"));
		expect(lifecycle()).toEqual(["stream finalized", "host disposed"]);
		expect((yield* Effect.result(request()))._tag).toBe("Failure");
	},
);
