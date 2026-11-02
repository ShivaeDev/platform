import { once } from "node:events";
import { createServer } from "node:http";
import { Effect } from "effect";
import { afterAll, afterEach, beforeAll } from "vitest";
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
