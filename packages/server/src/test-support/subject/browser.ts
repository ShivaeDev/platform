import * as NodeWs from "@effect/platform-node/NodeWS";
import { type Context, Effect, Layer } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Hydration from "effect/reactivity/Hydration";
import type * as Reactivity from "effect/reactivity/Reactivity";
import * as Socket from "effect/socket/Socket";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { answered, errorWords } from "@shivaedev/test-story/server/answers.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { CannotActForAccount, Delegated } from "#test/subject/feature.ts";

// A browser's WebSocket takes only subprotocols, so the client must authenticate with its first frame and send nothing on the upgrade.
function browserWebSocket(opened: string[]) {
	return Layer.succeed(Socket.WebSocketConstructor, (url, protocols) => {
		if (protocols !== undefined && typeof protocols !== "string" && !Array.isArray(protocols)) {
			throw new Error("A browser cannot set upgrade headers");
		}
		opened.push(url);
		return new NodeWs.WebSocket(url, protocols);
	});
}

export const openBrowser = Effect.fnUntraced(function* (url: string, actor: string) {
	const opened: string[] = [];
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const client = makeClient(Delegated, { bearerToken: actor, url: `${url}/rpc`, webSocketConstructor: browserWebSocket(opened) });
	function run<A, E>(effect: Effect.Effect<A, E, Context.Service.Identifier<typeof client.Client> | Reactivity.Reactivity>) {
		return AtomRegistry.getResult(registry, client.runtime.atom(effect).pipe(Atom.setIdleTTL(0)));
	}
	return { client, opened, registry, run };
});

export type Browser = Effect.Success<ReturnType<typeof openBrowser>>;

export function refusalWords(error: unknown) {
	return error instanceof CannotActForAccount ? `cannot act for ${error.account}` : errorWords(error);
}

export function shownTitle(result: AsyncResult.AsyncResult<string, unknown>): string {
	if (AsyncResult.isInitial(result)) {
		return "loading";
	}
	if (AsyncResult.isSuccess(result)) {
		return result.waiting ? `${result.value} while loading` : result.value;
	}
	return `failed with ${refusalWords(result.cause.reasons.find((reason) => reason._tag === "Fail")?.error)}`;
}

// The registry removes an idle query on its own schedule; a retained result exists only once that removal has run.
function nodeRemoved(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<unknown>, unmount: () => void) {
	return Effect.callback<void>((resume) => {
		const before = registry.onNodeRemoved;
		registry.onNodeRemoved = (node) => {
			before?.(node);
			if (node.atom === atom) {
				registry.onNodeRemoved = before;
				resume(Effect.void);
			}
		};
		unmount();
	});
}

export function browserVerbs(state: { readonly url: string }, story: { readonly tell: (line: string) => void }) {
	const browsers = new Map<string, Browser>();
	function browser(actor: string) {
		const existing = browsers.get(actor);
		if (existing !== undefined) {
			return Effect.succeed(existing);
		}
		return Effect.tap(openBrowser(state.url, actor), (opened) => Effect.sync(() => browsers.set(actor, opened)));
	}
	function titleQuery(
		opened: Browser,
		subject: string | undefined,
		options: { readonly serializationKey?: string; readonly authorization?: string } = {},
	) {
		return opened.client.api.title.query(undefined, {
			...(subject === undefined ? {} : { subject }),
			...(options.serializationKey === undefined ? {} : { serializationKey: options.serializationKey }),
			...(options.authorization === undefined ? {} : { headers: { authorization: options.authorization } }),
		});
	}
	function answeredTitle(
		opened: Browser,
		subject: string | undefined,
		options?: Parameters<typeof titleQuery>[2],
		answers: (shown: string) => boolean = (shown) => !shown.includes("loading"),
	) {
		return until(AtomRegistry.toStream(opened.registry, titleQuery(opened, subject, options)), (result) => answers(shownTitle(result)), {
			name: `${subject ?? "own"} title answered`,
		}).pipe(Effect.map(shownTitle));
	}
	return {
		browserLeavesAndOpens: (actor: string, left: string, opened: string) => {
			story.tell(`${actor} closes ${left}'s view and opens ${opened}'s, then returns to ${left}'s`);
			return Effect.flatMap(browser(actor), (current) =>
				Effect.gen(function* () {
					const leftView = titleQuery(current, left);
					const unmount = current.registry.mount(leftView);
					yield* answeredTitle(current, left);
					yield* nodeRemoved(current.registry, leftView, unmount);
					return {
						[`${opened} first`]: shownTitle(current.registry.get(titleQuery(current, opened))),
						[`${left} again`]: shownTitle(current.registry.get(leftView)),
					};
				}),
			);
		},
		browserRetitles: (actor: string, title: string, subject?: string) => {
			story.tell(`${actor} renames ${subject ?? "their own account"} to ${title} from a browser`);
			return Effect.flatMap(browser(actor), (opened) =>
				answered(
					opened
						.run(opened.client.api.rename.run({ title }, subject === undefined ? {} : { subject }))
						.pipe(Effect.map(({ subject: renamed, title: saved }) => `${renamed} is ${saved}`)),
					refusalWords,
				),
			);
		},
		browserSocketsOpened: (actor: string) => Effect.map(browser(actor), (opened) => opened.opened.length),
		browserWatches: (actor: string, subject?: string) => {
			story.tell(`${actor} watches ${subject ?? "their own"} title live from a browser`);
			return Effect.flatMap(browser(actor), (opened) => {
				opened.registry.mount(titleQuery(opened, subject));
				return answeredTitle(opened, subject);
			});
		},
		browserWatchesWithForgedAuthorization: (actor: string, forged: string, subject: string) => {
			story.tell(`${actor} watches ${subject}'s title from a browser with a message claiming ${forged}'s authorization`);
			return Effect.flatMap(browser(actor), (opened) => {
				opened.registry.mount(titleQuery(opened, subject, { authorization: forged }));
				return answeredTitle(opened, subject, { authorization: forged });
			});
		},
		hydratedTitles: (actor: string, subjects: readonly string[]) => {
			story.tell(`a server render for ${actor} serializes ${subjects.join(" and ")}'s titles under one serialization key and a page hydrates them`);
			return Effect.gen(function* () {
				const rendered = yield* browser(actor);
				for (const subject of subjects) {
					rendered.registry.mount(titleQuery(rendered, subject, { serializationKey: "titles" }));
					yield* answeredTitle(rendered, subject, { serializationKey: "titles" });
				}
				const page = yield* Effect.acquireRelease(
					Effect.sync(() => AtomRegistry.make()),
					(current) => Effect.sync(() => current.dispose()),
				);
				Hydration.hydrate(page, Hydration.dehydrate(rendered.registry));
				return Object.fromEntries(
					subjects.map((subject) => [subject, shownTitle(page.get(titleQuery(rendered, subject, { serializationKey: "titles" })))]),
				);
			});
		},
		shownTitle: (actor: string, subject?: string) =>
			Effect.flatMap(browser(actor), (opened) =>
				opened.run(opened.client.sync).pipe(Effect.andThen(Effect.sync(() => shownTitle(opened.registry.get(titleQuery(opened, subject)))))),
			),
		titleRevalidationPasses: (actor: string, subject: string) => {
			story.tell("the session revalidation interval passes");
			return Effect.flatMap(browser(actor), (opened) =>
				untilTimer("30 seconds").pipe(
					Effect.andThen(
						passes(
							"30 seconds",
							answeredTitle(opened, subject, {}, (shown) => shown.startsWith("failed")),
						),
					),
				),
			);
		},
	};
}
