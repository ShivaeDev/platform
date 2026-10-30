import { ConfigProvider, Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { appHost } from "@shivaedev/server/appHost.ts";
import { publicConfigLayer } from "@shivaedev/server/rpc-server/publicConfigLayer.ts";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { PublicConfigDeclaration } from "./Declaration.ts";
import { configView } from "./view.ts";

interface State {
	readonly screen: Screen;
	url?: string;
	view?: Rendered;
}

function opened(state: State) {
	if (state.view === undefined) {
		throw new Error("The configuration screen is not open");
	}
	return state.view.container;
}

export const publicConfigStory = storyKit({
	clock: "live",
	create: (): State => ({ screen: new Screen(() => undefined) }),
	inspect: ({ screen }) => screen.inspect(),
	name: "public configuration screen",
	stages: ["screen"],
	verbs: (state, story) => {
		state.screen.tell = story.tell;
		return {
			installLink: () =>
				Effect.sync(() => {
					const link = opened(state).querySelector("a");
					return { href: link?.href, text: link?.textContent };
				}),
			*open() {
				story.tell("open a screen that reads public configuration through useQuery");
				if (state.url === undefined) {
					throw new Error("The platform host is not listening");
				}
				window.location.href = state.url;
				state.view = yield* state.screen.open(configView(state.url));
				yield* settleScreen(opened(state), () => opened(state).textContent === "Loading configuration", story.tell);
			},
		};
	},
});

export function hostConfigured(env: Record<string, string>) {
	return publicConfigStory.trait("screen", `a platform host runs with ${Object.keys(env).join(" and ")} in its environment`, function* (state) {
		const services = yield* Layer.build(
			appHost({
				config: { port: 0 },
				group: PublicConfigDeclaration,
				handlers: publicConfigLayer(PublicConfigDeclaration),
				policy: "loopback",
			}).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))),
		);
		const { address } = Context.get(services, HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(address)) {
			throw new Error("Expected a TCP listener");
		}
		state.url = `http://127.0.0.1:${address.port}/rpc`;
	});
}
