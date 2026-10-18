import { Effect, Schema } from "effect";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { TimestampReadout } from "./TimestampReadout.ts";
import { timestampHost } from "./timestampHost.ts";
import { timestampScreen } from "./timestampScreen.ts";

export const clockApp = storyKit({
	clock: "live",
	*create() {
		const host = yield* timestampHost;
		const context = yield* Effect.context<never>();
		const root = document.createElement("main");
		document.body.append(root);
		const screen = timestampScreen(root, host.url, Effect.runPromiseWith(context));
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				screen.close();
				root.remove();
			}),
		);
		return { ...host, root, screen };
	},
	name: "clock app",
	stages: [],
	verbs: ({ root, screen, url }, story) => ({
		...screenDriver({ pending: screen.pending, root, tell: story.tell }),
		hostReadout: () =>
			Effect.promise(async () => {
				story.tell("read the application's HTTP timestamp readout");
				const response = await fetch(url);
				return Schema.decodeUnknownSync(TimestampReadout)(await response.json());
			}),
	}),
});
