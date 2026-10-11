import { NodeFileSystem } from "@effect/platform-node";
import { Effect, FileSystem, Layer, PlatformError } from "effect";
import { FetchHttpClient, HttpClient, HttpClientError, HttpClientRequest } from "effect/unstable/http";
import { expect } from "vitest";
import { GitHub } from "#GitHub.ts";
import { GitHubHttp } from "#GitHubHttp.ts";
import { StateFile } from "#StateFile.ts";
import { effectApp } from "#test/services.ts";
import { Watcher } from "#Watcher.ts";

function services(fs: FileSystem.FileSystem, http: HttpClient.HttpClient) {
	return Watcher.layer.pipe(
		Layer.provide(Layer.mergeAll(StateFile.layer, GitHub.layer.pipe(Layer.provide(GitHubHttp.layer)))),
		Layer.provide(Layer.mergeAll(Layer.succeed(FileSystem.FileSystem)(fs), Layer.succeed(HttpClient.HttpClient)(http))),
		Layer.fresh,
	);
}
effectApp("injected FileSystem and HttpClient own the synthetic-server observation and durable state", function* (h) {
	const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(NodeFileSystem.layer));
	const client = yield* HttpClient.HttpClient.pipe(Effect.provide(FetchHttpClient.layer));
	const reads: string[] = [];
	const replacements: string[] = [];
	const urls: string[] = [];
	const recorded = FileSystem.makeNoop({
		...fs,
		readFileString: (path) => {
			reads.push(path);
			return fs.readFileString(path);
		},
		rename: (from, to) => {
			replacements.push(to);
			return fs.rename(from, to);
		},
	});
	const http = HttpClient.mapRequest(client, (request) => {
		urls.push(request.url);
		return request;
	});
	const layer = services(recorded, http);
	yield* h.cycle.pipe(Effect.provide(layer));
	h.setPull(1, { merged: true, state: "closed" });
	yield* h.cycle.pipe(Effect.provide(layer));
	expect(reads).toEqual([h.options.stateFile, h.options.stateFile]);
	expect(replacements).toEqual([h.options.stateFile, h.options.stateFile]);
	expect(urls).toHaveLength(h.requests.length);
	expect(urls.every((url) => url.startsWith(h.options.apiUrl))).toBe(true);
	expect(JSON.parse(yield* fs.readFileString(h.options.stateFile)).prs["1"].merged).toBe(true);
	expect((yield* fs.stat(h.options.stateFile)).mode & 0o777).toBe(0o600);
});
effectApp.each(["read", "write", "rename"])("native $item failures stay typed and preserve the last saved snapshot", function* (operation, h) {
	yield* h.cycle;
	h.setPull(1, { merged: true, state: "closed" });
	const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(NodeFileSystem.layer));
	const http = yield* HttpClient.HttpClient.pipe(Effect.provide(FetchHttpClient.layer));
	const failure = Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: operation, module: "FileSystem" }));
	const failing = FileSystem.makeNoop({
		...fs,
		readFileString: (path) => (operation === "read" ? failure : fs.readFileString(path)),
		rename: (from, to) => (operation === "rename" ? failure : fs.rename(from, to)),
		writeFileString: (path, text, options) => (operation === "write" ? failure : fs.writeFileString(path, text, options)),
	});
	const result = yield* Effect.result(h.cycle.pipe(Effect.provide(services(failing, http))));
	expect(result._tag).toBe("Failure");
	if (result._tag === "Failure") {
		expect(result.failure._tag).toBe("WatchError");
	}
	expect(JSON.parse(yield* fs.readFileString(h.options.stateFile)).prs["1"].merged).toBe(false);
});
effectApp("native HTTP transport failures stay typed without inferring any transition", function* (h) {
	yield* h.cycle;
	h.setPull(1, { merged: true, state: "closed" });
	const count = h.requests.length;
	const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(NodeFileSystem.layer));
	const client = yield* HttpClient.HttpClient.pipe(Effect.provide(FetchHttpClient.layer));
	const http = HttpClient.transform(client, () =>
		Effect.fail(
			new HttpClientError.HttpClientError({
				reason: new HttpClientError.TransportError({ cause: new Error("Unavailable"), request: HttpClientRequest.get(h.options.apiUrl) }),
			}),
		),
	);
	const result = yield* Effect.result(h.cycle.pipe(Effect.provide(services(fs, http))));
	expect(result._tag).toBe("Failure");
	if (result._tag === "Failure") {
		expect(result.failure._tag).toBe("WatchError");
	}
	expect(h.requests).toHaveLength(count);
	expect(h.lines).toEqual([]);
});
effectApp("redirect responses are refused before sending credentials to another endpoint", function* (h) {
	h.set("/pulls/1", { body: {}, headers: { location: `${h.options.apiUrl}/redirected` }, status: 302 });
	const result = yield* Effect.result(h.cycle);
	expect(result._tag).toBe("Failure");
	expect(h.requests.some((request) => request.path === "/redirected")).toBe(false);
	expect(h.lines).toEqual([]);
});
