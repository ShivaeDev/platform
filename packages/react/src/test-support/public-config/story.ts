import { ConfigProvider, Context, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { appHost } from "@shivaedev/platform/server/appHost.ts";
import { publicConfigLayer } from "@shivaedev/platform/server/rpc-server/publicConfigLayer.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { Screen } from "#test/Screen.ts";
import { PublicConfigDeclaration } from "./Declaration.ts";
import { configView } from "./view.ts";

interface State {
	screen: Screen;
	url?: string;
	view?: Rendered;
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
			observe: (line: string, check: () => void) => state.screen.observe(line, check),
			*open() {
				story.tell("open a component that reads public configuration through useQuery");
				if (state.url === undefined) {
					throw new Error("The platform host is not listening");
				}
				state.view = yield* state.screen.open(configView(state.url));
			},
			*serve(env: Record<string, string>) {
				story.tell("start a real platform host with public configuration");
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
			},
			view: () => {
				if (state.view === undefined) {
					throw new Error("The configuration screen is not open");
				}
				return state.view.container;
			},
		};
	},
});
