import { Effect, Exit, Scope } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { httpClient } from "./httpClient.ts";

const routes = {
	contents: {
		path: "/repos/:owner/:repo/contents/:path*",
		reply: ({ params }: { readonly params: Readonly<Record<string, string>> }) => ({ body: params }),
	},
	invalidRest: { path: "/invalid/:path*/tail", reply: () => ({ status: HttpStatus.fromLiteral("OK") }) },
	items: { pages: [["paper", "ink"], ["pens"], ["staples"]], path: "/items" },
	message: { method: "POST", path: "/messages", reply: () => ({ body: { saved: true }, status: HttpStatus.fromLiteral("Created") }) },
	user: { path: "/users/:id", reply: ({ params }: { readonly params: Readonly<Record<string, string>> }) => ({ body: { id: params.id } }) },
};

function fakeHttpKit(guarded: boolean, acquisitionTell = false) {
	const name = guarded ? "fake HTTP service" : "public HTTP service";
	return storyKit({
		clock: "live",
		*create() {
			const scope = yield* Scope.fork(yield* Scope.Scope);
			let tell: ((line: string) => void) | undefined;
			const service = yield* fakeHttpService({
				...(guarded ? { guard: (request) => request.headers.authorization === "Bearer story-key" } : {}),
				routes,
				tell: (line) => tell?.(line),
			}).pipe(Effect.provideService(Scope.Scope, scope));
			const headers: Record<string, string> = {};
			return {
				connectNarration: (sink: (line: string) => void) => {
					tell = sink;
				},
				headers,
				scope,
				service,
			};
		},
		inspect: ({ service }) => service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`),
		name: acquisitionTell ? "HTTP acquisition narration" : name,
		stages: ["ready"],
		verbs: (engine, story) => {
			const { connectNarration, scope, service } = engine;
			if (acquisitionTell) {
				connectNarration(story.tell);
			} else {
				service.narrate(story.tell);
			}
			const client = httpClient(
				() => service.url,
				story.tell,
				() => ({ headers: engine.headers }),
			);
			return {
				...client,
				closesService: () => {
					story.tell("the fake HTTP service's scope closes");
					return Scope.close(scope, Exit.void);
				},
				hold: service.hold,
				received: () =>
					Effect.sync(() => service.requests.map(({ body, method, path }) => `${method} ${path}${body.length === 0 ? "" : ` "${body.toString()}"`}`)),
				requests: () => Effect.sync(() => service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`)),
				scriptFault: service.scriptFault,
			};
		},
	});
}

export const fakeHttpApp = fakeHttpKit(true);
export const publicHttpApp = fakeHttpKit(false);
export const acquisitionHttpApp = fakeHttpKit(false, true);

export function hasCredential(credential: string) {
	return fakeHttpApp.trait("ready", "the caller has an API credential", (engine) => {
		engine.headers.authorization = credential;
	});
}
