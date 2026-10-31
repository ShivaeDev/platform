import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { shutdownHost } from "#test/app-host/shutdown.ts";

shutdownHost.it(
	"with preemptive shutdown disabled, disposing the host finalizes an open RPC stream before disposal completes and stops answering HTTP",
	[],
	function* ({ hostDisposes, httpAnswer, lifecycle, openStream }) {
		yield* openStream();
		expect(yield* lifecycle()).toEqual([]);

		yield* hostDisposes();

		yield* outcomes({
			http: [httpAnswer(), "refuses connections"],
			lifecycle: [lifecycle(), ["stream finalized", "host disposed"]],
		});
	},
);
