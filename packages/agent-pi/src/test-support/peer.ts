import { join } from "node:path";
import type { CreateAgentSessionOptions, DefaultResourceLoader, ModelRuntime } from "@earendil-works/pi-coding-agent";
import { Queue } from "effect";
import { vi } from "vitest";
import { scriptedSession } from "#test/scriptedSession.ts";

type DefaultResourceLoaderOptions = NonNullable<ConstructorParameters<typeof DefaultResourceLoader>[0]>;
type CatalogModel = Awaited<ReturnType<ModelRuntime["getAvailable"]>>[number];
interface Peer {
	abortFails: boolean;
	directory: string;
	handled: string | undefined;
	held: boolean;
	models: CatalogModel[];
	noSessionFile: boolean;
	prompted: Queue.Queue<void>;
	refusal: "rejected" | "unknown" | undefined;
	resources: { options: DefaultResourceLoaderOptions; reloaded: boolean }[];
	sessions: ReturnType<typeof scriptedSession>[];
}
export function makePeer(directory: string, prompted: Queue.Queue<void>): Peer {
	return {
		abortFails: false,
		directory,
		handled: undefined,
		held: false,
		models: [
			{
				api: "anthropic-messages",
				baseUrl: "https://model.invalid",
				contextWindow: 100,
				cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
				id: "fast",
				input: ["text"],
				maxTokens: 10,
				name: "Fast",
				provider: "acme",
				reasoning: true,
			} satisfies CatalogModel,
		],
		noSessionFile: false,
		prompted,
		refusal: undefined,
		resources: [],
		sessions: [],
	};
}
const boundary = vi.hoisted((): { peer: Peer | undefined } => ({ peer: undefined }));
function current() {
	if (boundary.peer === undefined) {
		throw new Error("no scripted Pi peer is installed");
	}
	return boundary.peer;
}
export function installPeer(peer: Peer) {
	boundary.peer = peer;
}

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
	const sdk = await importOriginal<typeof import("@earendil-works/pi-coding-agent")>();
	return {
		...sdk,
		createAgentSession: (options: CreateAgentSessionOptions) => {
			const peer = current();
			const opened = scriptedSession(options, {
				abortFails: peer.abortFails,
				handled: peer.handled,
				held: peer.held,
				persisted: !peer.noSessionFile,
				prompted: () => {
					Queue.offerUnsafe(peer.prompted, undefined);
				},
				refusal: peer.refusal,
			});
			current().sessions.push(opened);
			return Promise.resolve({ session: opened.session });
		},
		DefaultResourceLoader: class {
			readonly loaded;
			constructor(options: DefaultResourceLoaderOptions) {
				this.loaded = { options, reloaded: false };
				current().resources.push(this.loaded);
			}
			reload() {
				this.loaded.reloaded = true;
				return Promise.resolve();
			}
		},
		ModelRuntime: { create: () => Promise.resolve({ getAvailable: () => Promise.resolve(current().models) }) },
		SessionManager: {
			create: (cwd: string) => sdk.SessionManager.create(cwd, join(current().directory, "sessions")),
			open: sdk.SessionManager.open,
		},
	};
});
