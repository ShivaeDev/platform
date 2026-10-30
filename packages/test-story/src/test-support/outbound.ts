import { once } from "node:events";
import { createServer } from "node:http";
import { Effect } from "effect";
import { afterAll, afterEach, beforeAll } from "vitest";
import { routeOutbound } from "#routeOutbound.ts";
import { storyKit } from "#storyKit.ts";
import { noteLifetime } from "./lifetimeLog.ts";

const hostFetch = fetch;

function endpoint(name: string) {
	return createServer(async (request, response) => {
		const chunks: Buffer[] = [];
		for await (const chunk of request) {
			chunks.push(Buffer.from(chunk));
		}
		response.setHeader("content-type", "application/json");
		response.end(
			JSON.stringify({ body: Buffer.concat(chunks).toString(), header: request.headers["x-story"], method: request.method, name, path: request.url }),
		);
	});
}

const fake = endpoint("fake");
const real = endpoint("real");
export const outbound: Record<string, string> = {};
let realPort = 0;

beforeAll(async () => {
	for (const server of [fake, real]) {
		server.listen(0);
		await once(server, "listening");
	}
	const fakeAddress = fake.address();
	const realAddress = real.address();
	if (fakeAddress === null || typeof fakeAddress === "string" || realAddress === null || typeof realAddress === "string") {
		throw new Error("outbound test servers need TCP addresses");
	}
	const fakeUrl = `http://127.0.0.1:${fakeAddress.port}`;
	Object.assign(outbound, { "127.0.0.1": fakeUrl, "api.github.com": fakeUrl, "github.com": fakeUrl });
	realPort = realAddress.port;
});

afterAll(async () => {
	await Promise.all(
		[fake, real].map((server) => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))),
	);
});

interface Reply {
	readonly body: string;
	readonly header: string | undefined;
	readonly method: string;
	readonly name: string;
	readonly path: string;
}

function replyFrom(url: string, init?: RequestInit): Promise<Reply> {
	return hostFetch(url, init).then((response) => response.json());
}

function routedTo(url: string) {
	return replyFrom(url).then(({ name, path }) => `the ${name} server at ${path}`);
}

function ownLoopback() {
	return `http://127.0.0.1:${realPort}/original`;
}

function notesRouting(phase: string) {
	return Effect.promise(() => routedTo(ownLoopback())).pipe(Effect.flatMap((routed) => noteLifetime(`${phase} reached ${routed}`)));
}

export function notesRoutingAfterEachStory() {
	afterEach(async () => {
		await Effect.runPromise(notesRouting("after the story"));
	});
}

export const outboundKit = storyKit({
	after: {
		built: () => notesRouting("after hook"),
	},
	around: (effect) => notesRouting("around").pipe(Effect.andThen(effect)),
	clock: "live",
	*create() {
		yield* notesRouting("create");
		yield* Effect.addFinalizer(() => notesRouting("create finalizer"));
		return {};
	},
	name: "outbound",
	outbound,
	stages: ["built"],
	verbs: (_engine, story) => ({
		localhost: (path: string) => `http://localhost:${realPort}${path}`,
		notesRouting: () => notesRouting("body"),
		reaches: (url: string) => Effect.promise(() => routedTo(url)),
		sends: (url: string, init: RequestInit) => {
			story.tell(`the story sends ${init.method ?? "GET"} ${url}`);
			return Effect.promise(() => replyFrom(url, init));
		},
	}),
});

export const thirdPartyAvailable = outboundKit.trait("built", "a third party is available", () => notesRouting("trait"));

const SLOTS = ["undici.globalDispatcher.1", "undici.globalDispatcher.2"];

interface Slot {
	readonly descriptor: PropertyDescriptor | undefined;
	readonly key: symbol;
	readonly origins: string[];
}

function dispatchThrough(slot: Slot, origin: string) {
	const current: unknown = Reflect.get(globalThis, slot.key);
	if (typeof current !== "object" || current === null || !("dispatch" in current) || typeof current.dispatch !== "function") {
		throw new Error("outbound dispatcher is missing");
	}
	current.dispatch({ origin }, {});
}

function recordingSlots() {
	return Effect.acquireRelease(
		Effect.promise(async () => {
			await hostFetch("data:,");
			return SLOTS.map((name, index): Slot => {
				const key = Symbol.for(name);
				const origins: string[] = [];
				const slot = { descriptor: Object.getOwnPropertyDescriptor(globalThis, key), key, origins };
				Object.defineProperty(globalThis, key, {
					...(slot.descriptor ?? { configurable: true, writable: true }),
					value: {
						dispatch(options: { readonly origin: string }) {
							slot.origins.push(`slot ${index + 1} sent ${options.origin}`);
							return true;
						},
					},
				});
				return slot;
			});
		}),
		(slots) =>
			Effect.sync(() => {
				for (const slot of slots) {
					if (slot.descriptor === undefined) {
						Reflect.deleteProperty(globalThis, slot.key);
					} else {
						Object.defineProperty(globalThis, slot.key, slot.descriptor);
					}
				}
			}),
	);
}

export const dispatchers = storyKit({
	*create() {
		return { slots: yield* recordingSlots() };
	},
	name: "dispatchers",
	stages: [],
	verbs: ({ slots }, story) => {
		function sends(origin: string) {
			for (const slot of slots) {
				dispatchThrough(slot, origin);
			}
		}
		return {
			lastSent: () => Effect.sync(() => slots.map((slot) => slot.origins.at(-1))),
			routesGitHubWhileScoped: (ending: "fails" | "succeeds") => {
				story.tell(`a scope routes github.com, sends to github.com and example.com, and ${ending}`);
				return Effect.scoped(
					Effect.gen(function* () {
						yield* routeOutbound({ "github.com": "http://127.0.0.1:4321" }, { passthrough: true });
						sends("https://github.com");
						sends("https://example.com");
						if (ending === "fails") {
							yield* Effect.fail("the routing scope fails");
						}
					}),
				).pipe(Effect.ignore);
			},
			sends: (origin: string) => Effect.sync(() => sends(origin)),
			sent: () => Effect.sync(() => slots.flatMap((slot) => slot.origins)),
		};
	},
});
