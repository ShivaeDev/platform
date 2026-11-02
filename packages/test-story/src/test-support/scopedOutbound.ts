import { Effect, Exit, Scope } from "effect";
import { fakeHttpService } from "#fakeHttpService.ts";
import { routeOutbound } from "#routeOutbound.ts";
import { storyKit } from "#storyKit.ts";

type Provider = "first" | "second";

const acquireProvider = Effect.fnUntraced(function* (name: Provider, hostname: string) {
	const scope = yield* Scope.fork(yield* Scope.Scope);
	yield* Effect.gen(function* () {
		const service = yield* fakeHttpService({
			routes: { identity: { path: "/identity", reply: () => ({ body: { provider: name } }) } },
		});
		yield* routeOutbound({ [hostname]: service.url });
	}).pipe(Effect.provideService(Scope.Scope, scope));
	return scope;
});

export const scopedOutbound = storyKit({
	clock: "live",
	create: () => ({ providers: new Map<Provider, Scope.Closeable>() }),
	inspect: ({ providers }) => [...providers.keys()],
	name: "scoped outbound",
	stages: ["ready"],
	verbs: ({ providers }, story) => ({
		closes: (name: Provider) => {
			story.tell(`the ${name} provider's scope closes`);
			const scope = providers.get(name);
			if (scope === undefined) {
				throw new Error(`Acquire the ${name} provider before closing it.`);
			}
			return Scope.close(scope, Exit.void);
		},
		replyFrom: (hostname: string) => {
			story.tell(`the application requests https://${hostname}/identity`);
			return Effect.promise(async () => {
				const response = await fetch(`https://${hostname}/identity`);
				const body: { readonly provider: string } = await response.json();
				return body.provider;
			});
		},
	}),
});

export const separateProviders = scopedOutbound.trait("ready", "two providers register separate hosts", function* ({ providers }) {
	providers.set("first", yield* acquireProvider("first", "first.test"));
	providers.set("second", yield* acquireProvider("second", "second.test"));
});

export const overlappingProviders = scopedOutbound.trait("ready", "two providers register the same host", function* ({ providers }) {
	providers.set("first", yield* acquireProvider("first", "shared.test"));
	providers.set("second", yield* acquireProvider("second", "shared.test"));
});

export const concurrentProviders = scopedOutbound.trait("ready", "two providers register concurrently", function* ({ providers }) {
	const [first, second] = yield* Effect.all([acquireProvider("first", "first.test"), acquireProvider("second", "second.test")], {
		concurrency: "unbounded",
	});
	providers.set("first", first);
	providers.set("second", second);
});
