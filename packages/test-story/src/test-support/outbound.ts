import { once } from "node:events";
import { createServer } from "node:http";
import { Effect } from "effect";
import { afterAll, beforeAll } from "vitest";

const hostFetch = fetch;

interface RecordedDispatcher {
	readonly dispatch: (origin: string) => void;
	readonly origins: string[];
}

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

export function outboundServers() {
	const fake = endpoint("fake");
	const real = endpoint("real");
	const outbound: Record<string, string> = {};
	let originalUrl = "";
	let otherUrl = "";
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
		originalUrl = `http://127.0.0.1:${realAddress.port}/original`;
		otherUrl = `http://localhost:${realAddress.port}/other`;
	});
	afterAll(async () => {
		await Promise.all(
			[fake, real].map((server) => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))),
		);
	});
	return { original: () => originalUrl, other: () => otherUrl, outbound };
}

export function responseFrom(url: string, options?: RequestInit) {
	return Effect.promise(async () => {
		const response = await hostFetch(url, options);
		return response.json();
	});
}

export async function withRecordingDispatchers<A>(use: (records: readonly RecordedDispatcher[]) => Promise<A>) {
	await hostFetch("data:,");
	const slots = ["undici.globalDispatcher.1", "undici.globalDispatcher.2"].map((name) => {
		const key = Symbol.for(name);
		const origins: string[] = [];
		return { descriptor: Object.getOwnPropertyDescriptor(globalThis, key), key, origins };
	});
	try {
		for (const slot of slots) {
			Object.defineProperty(globalThis, slot.key, {
				...(slot.descriptor ?? { configurable: true, writable: true }),
				value: {
					dispatch(options: { readonly origin: string }) {
						slot.origins.push(options.origin);
						return true;
					},
				},
			});
		}
		return await use(
			slots.map((slot) => ({
				dispatch(origin: string) {
					const current: unknown = Reflect.get(globalThis, slot.key);
					if (typeof current !== "object" || current === null || !("dispatch" in current) || typeof current.dispatch !== "function") {
						throw new Error("outbound dispatcher is missing");
					}
					current.dispatch({ origin }, {});
				},
				origins: slot.origins,
			})),
		);
	} finally {
		for (const slot of slots) {
			if (slot.descriptor === undefined) {
				Reflect.deleteProperty(globalThis, slot.key);
			} else {
				Object.defineProperty(globalThis, slot.key, slot.descriptor);
			}
		}
	}
}
