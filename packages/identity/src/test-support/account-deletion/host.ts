import { testUtils } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { contract } from "@shivaedev/contract/contract.ts";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { Store } from "@shivaedev/rate-limit/Store.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { RepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { ChangeObserver } from "@shivaedev/sql/transact.ts";
import { Account } from "#Account.ts";
import { Account as AccountClient } from "#generated/Account.ts";
import { SessionUser, SessionUserSchema } from "#identity.ts";
import { AuthenticatedUser } from "#middleware.ts";
import { accountDeletion } from "#server/better-auth/accountDeletion.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/migrate.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedUserLayer } from "#server/session.ts";
import { HandOverPlan } from "#test/account-deletion/HandOverPlan.ts";
import { ProjectHandOver } from "#test/account-deletion/service.ts";
import { recordPublished } from "#test/recordPublished.ts";
import { ORIGIN } from "#test/rpc/harness.ts";

const Profile = contract("profile", {
	commands: [command("note", { invalidates: () => [], payload: { title: Schema.String } })],
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: SessionUserSchema })],
}).middleware(AuthenticatedUser);

export type SessionStorage = "database" | "cookie cache" | "secondary storage";

// Better Auth keeps sessions only here when secondary storage is configured, so the map stands in for a shared cache such as Redis.
function memorySecondaryStorage() {
	const entries = new Map<string, string>();
	return {
		delete: (key: string) => {
			entries.delete(key);
		},
		get: (key: string) => entries.get(key) ?? null,
		set: (key: string, value: string) => {
			entries.set(key, value);
		},
	};
}

function sessionOptions(storage: SessionStorage) {
	const session = { cookieCache: { enabled: storage === "cookie cache" }, disableSessionRefresh: true };
	return storage === "secondary storage" ? { secondaryStorage: memorySecondaryStorage(), session } : { session };
}
const ServedApi = Account.merge(Profile);
const Api = AccountClient.merge(Profile);

export const accountDeletionHost = Effect.fnUntraced(function* (plan: HandOverPlan["Service"], announced: unknown[], storage: SessionStorage) {
	const options = {
		"baseURL": ORIGIN,
		database: yield* betterAuthDatabase(),
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		plugins: [admin(), testUtils()],
		secret: "account-deletion-story-secret-with-32-characters",
		...sessionOptions(storage),
		user: { changeEmail: { enabled: true }, deleteUser: { enabled: true } },
	};
	yield* migrateBetterAuth({ options });
	const store = Layer.succeed(Store, yield* Store.pipe(Effect.provide(memoryStore)));
	const mounted = yield* betterAuthMount({ options }).pipe(Effect.provide(store));
	const sql = yield* SqlClient.SqlClient;
	const story = Layer.mergeAll(
		Layer.succeed(SqlClient.SqlClient, sql),
		Layer.succeed(RepositoryModels, yield* RepositoryModels),
		Layer.succeed(ChangeObserver, recordPublished(announced)),
		store,
	);
	const application = Layer.merge(
		moduleHandlers(Account).pipe(
			Layer.provide(accountDeletion({ options }, { handOver: ProjectHandOver })),
			Layer.provide(ProjectHandOver.layer.pipe(Layer.provide(Layer.succeed(HandOverPlan, plan)))),
		),
		Profile.application.toLayer({
			"profile.note": ({ title }) =>
				Effect.gen(function* () {
					const { id } = yield* SessionUser;
					yield* sql`insert into notes (title, share_token, user_id) values (${title}, ${`${title}-token`}, ${id})`;
				}).pipe(Effect.orDie),
			"profile.read": () => SessionUser,
		}),
	);
	const live = yield* LiveServer.pipe(Effect.provide(liveServerLayer));
	const handlers = hostChanges(ServedApi).pipe(Layer.provideMerge(application), Layer.provide(Layer.succeed(LiveServer, live)));
	const rpc = RpcServer.layerHttp({ group: ServedApi, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([handlers, authenticatedUserLayer(), RpcSerialization.layerNdjson]),
		Layer.provide(story),
	);
	const app = HttpRouter.toWebHandler(
		Layer.merge(mounted.routes, rpc).pipe(
			Layer.provide(Reactivity.layer),
			Layer.provide(Layer.succeed(SessionPolicy, { ...mounted.sessions, origin: () => true })),
		),
		{ disableLogger: true },
	);
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	function fetch(path: string, init: RequestInit = {}) {
		return Effect.promise(() => app.handler(new Request(`${ORIGIN}${path}`, init)));
	}
	return {
		auth: mounted.auth,
		// A browser keeps the session data cookie a session check sets, which is what Better Auth's cookie cache reads.
		cachedSession: (headers: Headers) =>
			fetch("/api/auth/get-session", { headers }).pipe(
				Effect.map((response) => {
					const cookies = new Map((headers.get("cookie") ?? "").split("; ").map((pair) => [pair.split("=")[0] ?? "", pair] as const));
					for (const cookie of response.headers.getSetCookie()) {
						const pair = cookie.split(";")[0] ?? "";
						cookies.set(pair.split("=")[0] ?? "", pair);
					}
					return new Headers({ ...Object.fromEntries(headers), cookie: [...cookies.values()].join("; ") });
				}),
			),
		client: (headers: Headers) =>
			RpcClient.make(Api).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(Object.fromEntries(headers))),
						url: `${ORIGIN}/rpc`,
					}).pipe(
						Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
						Layer.provide(Layer.succeed(FetchHttpClient.Fetch, (input, init) => app.handler(new Request(input, init)))),
					),
				),
			),
		fetch,
	};
});

export type AccountDeletionHost = Effect.Success<ReturnType<typeof accountDeletionHost>>;
