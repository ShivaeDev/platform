# @shivaedev/identity

Request identity for Effect RPC servers: who is calling, through which transport, with which permissions. Shared contracts declare the middleware, the server resolves sessions through a provider and an Origin policy, and handlers read a typed `Identity`.

## Why you want this

Every RPC that touches a user's data needs the same answers before its handler runs: is there a session, may this origin use it, does the user hold the permission this operation needs. Writing those checks per handler spreads authentication across the codebase and makes one forgotten check a security hole. Here the contract declares the requirement once and the type system refuses a handler that reads `Identity` without it.

```ts
import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Identity } from "@shivaedev/identity/identity.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";

export const Account = RpcGroup.make(Rpc.make("WhoAmI", { success: Schema.String })).middleware(Authenticated);

export const Handlers = Account.toLayer({
	WhoAmI: () =>
		Effect.gen(function* () {
			const identity = yield* Identity;
			return identity.id;
		}),
});
```

The browser imports `Account` as it is; the server supplies the session middleware, and the client's failure type gains `Unauthorized`, `AuthUnavailable` and `Forbidden`.

## Using it

### How to think about it

There are three parts to an authenticated RPC boundary:
1. **The shared contract** names the middleware tags (`Authenticated`, `MaybeAuthenticated`, `AuthenticatedUser`, permission middleware) and the request-local services they provide. These modules are browser-safe, because the client imports the contract.
2. **The server composition** implements the tags with Layers from `server/`. A session provider resolves a session; an Origin policy decides whether its request may reach that provider; request tracing supplies a request id and diagnostic context.
3. **The feature handler** reads `Identity`, `OptionalIdentity`, `SessionUser` or `RequestId` and runs application code. Authentication supplies a user id. Authorization still decides whether that user may perform this operation.

An **Origin policy** is a function of the transport request's origin, headers and RPC name. A **session provider** returns `Option<Session>` or fails with `AuthUnavailable`; a session carries `user.id`. These are application inputs, not a second authentication framework. Better Auth is the supported provider, mounted through `server/better-auth/`.

### Once per application: contracts and session policy

Declare the RPC group in a shared module:

```ts
import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { Identity } from "@shivaedev/identity/identity.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";

export const Account = RpcGroup.make(
	Rpc.make("ReadOwn", {
		error: Forbidden,
		payload: { userId: Schema.String },
		success: Schema.String,
	}),
).middleware(Authenticated);

export const Handlers = Account.toLayer({
	ReadOwn: ({ userId }) =>
		Effect.gen(function* () {
			const identity = yield* Identity;
			if (identity.id !== userId) {
				return yield* new Forbidden({ message: "Not your account" });
			}
			return identity.id;
		}),
});
```

The middleware declaration makes `Identity` available to guarded handlers and adds `Unauthorized`, `AuthUnavailable` and `Forbidden` to the client's failure type. An unguarded handler that requires `Identity` cannot become a service-free handler Layer. Keep the group declaration in the shared module and the handler implementation on the server when organizing application files.

Supply a provider and an explicit Origin policy as the host's `sessions` input. For a Better Auth provider, adapt its existing session lookup:

```ts
import { betterAuthSessions } from "@shivaedev/identity/server/adapters/betterAuthSessions.ts";
import { trustedOrigins } from "@shivaedev/identity/server/origin.ts";
import { auth } from "./auth.ts";

export const sessions = {
	origin: trustedOrigins({ allow: ["http://localhost:3000"], missing: "allow" }),
	provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
};
```

`trustedOrigins({ allow, missing })` accepts an exact allowlist and supports `missing: "reject"` or `"allow"`; a custom `OriginPolicy` can decide from the RPC name or transport headers. A denied policy fails with `Forbidden` before provider lookup. The host's HTTP guard also checks Origin against the local request's Host.

To also accept the transport guard's same-origin requests, pass `sameOrigin: { trustedProxy }`, with the same proxy IP addresses or CIDR ranges as the host. This admits direct loopback HTTP and the forwarded HTTP or HTTPS authority only from a matching transport peer. Session resolution supplies that peer from the HTTP request, including the WebSocket upgrade; RPC message headers cannot supply it. Missing Origins still follow `missing`. Leave `sameOrigin` absent when an explicit public-origin allowlist should be the only authority.

The application's `auth` owns its storage and session configuration. A null lookup becomes a missing session. When the lookup returns Better Auth’s `session.expiresAt` as a `Date`, identity also rejects the session at or after that instant using Effect’s current clock. A thrown or rejected lookup is logged in redacted form and fails with the generic `AuthUnavailable` message. It remains a failure even on an RPC with optional authentication.

### Mount Better Auth

`betterAuthMount(options)` returns the Better Auth instance and a native route Layer for `/api/auth/*`. It accepts Better Auth options, including application plugins and session policy. Merge `routes` into the HTTP host and use `auth.api.getSession` with `betterAuthSessions` for the application's RPC session provider.

```ts
import { Effect } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";

const authentication = Effect.gen(function* () {
	const database = yield* betterAuthDatabase();
	return yield* betterAuthMount({
		database,
		emailAndPassword: { enabled: true },
		session: { cookieCache: { enabled: false } },
	});
});
```

`betterAuthDatabase()` reads the application’s `SqlClient` and reserves connections from its PostgreSQL pool. Build it inside `appHost`’s `application` Effect, or provide sql’s `postgresLayer` for a standalone process. Set `maxConnections` and `applicationName` on the application SQL Layer. Generate frozen numbered auth migrations as described below. Create the database adapter inside a SQL transaction when auth writes must commit or roll back with application writes. The application SQL Layer owns shutdown.

Run this Effect in the host's scope; the application SQL Layer manages its connections. A rejected auth handler returns HTTP 503 with `Authentication is temporarily unavailable`.

The mount reads `BETTER_AUTH_SECRET` unless options supply `secret`. `PUBLIC_URL` supplies the default base URL, trusted origin and HTTPS secure-cookie setting. With it unset, `baseURL.allowedHosts` defaults to `["127.0.0.1:*", "localhost:*"]` over HTTP and `trustedOrigins` defaults to `["http://127.0.0.1:*", "http://localhost:*"]`, accepting both loopback names on any port through a development proxy. Explicit `baseURL` (including `baseURL.allowedHosts`) and `trustedOrigins` options each replace their corresponding default; their lists are not merged. RPC Origin policy remains an application choice.

`AUTH_RATE_LIMIT_ENABLED` is a Config boolean that defaults to true and takes precedence over `options.rateLimit.enabled`. Each mount owns scoped in-memory buckets when `storage` is unset or `"memory"`. Application `customStorage`, `"database"` and `"secondary-storage"` selections pass through; Better Auth chooses the rules and client-IP keys.

The mount also requires the current account password on `/change-email`. Send it as `password` beside `newEmail` in the JSON body. Missing, empty, non-string, overlong and incorrect passwords are refused with HTTP 400 and `INVALID_PASSWORD`; accounts without a credential password are also refused. The check uses Better Auth's configured password verifier and applies to cookie and signed bearer sessions before an email can change or a verification email can be sent. Better Auth still owns email verification and the rest of the email-change flow.

```ts
await fetch("/api/auth/change-email", {
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify({ newEmail, password: currentPassword }),
});
```

Better Auth's typed `changeEmail` method does not declare the extra `password` field; send this request through HTTP. To use a different account-verification policy, explicitly pass `{ hardening: { requirePasswordForEmailChange: false } }` as the second argument to `betterAuthMount`. Passwordless applications must make this choice before enabling email changes.

Password resets revoke existing sessions by default. Set `emailAndPassword.revokeSessionsOnPasswordReset: false` in the Better Auth options to retain them explicitly. These defaults sit alongside the mount's rate limiting; application plugins and the provider's email-change settings remain in effect.

`TRUSTED_PROXY` supplies the same address and CIDR policy used by the host. An untrusted transport peer loses `x-forwarded-for` and the configured client-IP header before Better Auth sees the request. `AUTH_CLIENT_IP_HEADER` defaults to `x-forwarded-for`. Without a trusted proxy, auth rate limiting uses the connection peer address, so different peers have separate buckets and Better Auth receives a client IP without a missing-IP warning. A trusted peer's configured forwarded header takes precedence over the peer address.

The auth HTTP server span records the resolved rate-limit address in `auth.rate_limit.address` and its source in `auth.rate_limit.address_source`: `forwarded` for the trusted proxy's configured header, or `peer` for the connection address. These attributes accompany counted sign-in attempts and HTTP 429 refusals, so operators can inspect the choice directly. The recorded address follows Better Auth's normalization, including IPv6 subnet grouping; a trusted peer without a forwarded header records `peer`.

For email sign-in through `appHost`, the session record's `ipAddress` follows the same rule. With a trusted peer, `AUTH_CLIENT_IP_HEADER=x-real-ip` stores `X-Real-IP` even if `X-Forwarded-For` supplies a different address; the default header selects the rightmost untrusted address in the `X-Forwarded-For` chain, ignoring trusted proxy hops on the right. With an untrusted peer, neither header can supply the stored address. Sign-in attempts from an untrusted peer share one bucket per path; with a trusted peer and `x-real-ip`, changing `X-Forwarded-For` does not change the bucket, while changing `X-Real-IP` does.

#### Application database hooks

Pass Effect hooks in the mount's second argument under `databaseHooks`. The shape, arguments and successful results match Better Auth's database hooks; each callback returns an Effect instead of a Promise. `BetterAuthDatabaseHooks` and the structural `BetterAuthHookError` type live in `@shivaedev/identity/server/better-auth/databaseHooks.ts`.

```ts
import type { BetterAuthOptions } from "better-auth";
import { Context, Effect } from "effect";
import type { BetterAuthHookError } from "@shivaedev/identity/server/better-auth/databaseHooks.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";

class SessionAdmission extends Context.Service<
	SessionAdmission,
	{
		readonly check: (userId: string) => Effect.Effect<void, BetterAuthHookError>;
	}
>()("app/SessionAdmission") {}

const authentication = (options: BetterAuthOptions) =>
	betterAuthMount(options, {
		databaseHooks: {
			session: {
				create: {
					before: (session) => Effect.flatMap(SessionAdmission, ({ check }) => check(session.userId)),
				},
			},
		},
	});
```

Provide the hook's services when building the mount. Mounted HTTP requests run hooks with the request's services, spans, log annotations and cancellation signal; request services override the mount's services. A direct call through `auth.api` uses the mount's services and the endpoint request's signal when present.

Fail a `before` hook with `{ code: "MEMBERS_ONLY", message: "Membership is required" }`, or an application tagged error with those fields, to refuse the operation with HTTP 403 and that code and message. Defects remain defects in the mounted request, even when Better Auth catches the callback rejection. Hooks follow Better Auth's lifecycle: use `before` to refuse a write; `after` runs after the write and does not undo it.

Native callbacks in the first argument run before the corresponding Effect callbacks. A native `before` returning `false` stops the Effect callback too. Data changes compose in order. Identity's sign-in policy still runs after the application's session hook.

### Role assignments

Pass `{ defaultRole: "member", roles: AppAccess }` as the second argument to `betterAuthMount`. Identity adds `/admin/set-role`, `/admin/update-user` and `/admin/create-user` to the disabled HTTP paths and sets the Better Auth admin plugin's `adminRoles` to `[]`. Existing disabled paths remain in effect. The admin Users page remains the application path for role changes.

Seeds and trusted operator commands use the same transactional write and last-role-assigner guard as the Users page:

```ts
import { assignRole } from "@shivaedev/identity/server/better-auth/assignRole.ts";

yield* assignRole(AppAccess, userId, "owner");
```

Supply the application's `SqlClient` Layer. `assignRole` uses the existing Reactivity service when present and supplies its own when absent, so server-only apps need no Users page or Reactivity Layer. This trusted server verb has no caller authorization check; authorize operator access before calling it. It returns whether the role changed, fails with `NotFound` for a missing user, and refuses to remove the final holder of `AssignRoles` (`roles.assign`) with `LastRoleAssigner`. Both declarations live in `@shivaedev/access/roles.ts`. Writes serialize through the same PostgreSQL transaction lock and invalidate the Users list after commit. The Users page adds its caller permission check and audit log.

For named provider accounts, declare the role once and pass a configured `accountRoleSeed` to the mount:

```ts
import { Config } from "effect";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { AssignRoles } from "@shivaedev/access/roles.ts";
import { accountRoleSeed } from "@shivaedev/identity/server/better-auth/accountRoleSeed.ts";
import { ProviderAccounts } from "@shivaedev/identity/server/better-auth/allowedAccounts.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";

const Member = role("member", []);
const Operator = role("operator", [AssignRoles]);
const AppAccess = roleSet(Member, Operator);
const operators = Config.schema(ProviderAccounts, "AUTH_OPERATOR_ACCOUNTS").pipe(Config.withDefault([]));

const mounted = yield* betterAuthMount(authOptions, {
	defaultRole: Member.name,
	roles: AppAccess,
	roleSeed: accountRoleSeed(AppAccess, Operator.name, operators),
});
```

Set `AUTH_OPERATOR_ACCOUNTS=github:1001,github:1002` using stable provider account IDs. `ProviderAccounts` shares the parser and account-ID validation of `AllowedAccounts`, while accepting an empty list. `Config.withDefault([])` also accepts an unset variable. Both grant nothing. Invalid entries fail boot with `ConfigError`.

The mount runs the seed at boot for existing users and before creating sign-in sessions, including the first provider sign-in. A listed account that has never signed in is ignored until it does. Assignments go through `assignRole`, including its last-role-assigner guard and commit invalidation. The seed uses the application's SQL Layer and default Better Auth PostgreSQL tables.

The seed only grants: removing an account from config does not restore its previous role. To demote it, first remove the account from config and restart the server, then assign the desired role through the Users page or a trusted `assignRole` command. Keep another holder of `AssignRoles` before demoting the last administrator. A still-listed account receives the configured role again on sign-in or boot.

### Administer signed-in sessions

Merge `Sessions` from `@shivaedev/identity/sessions.ts` into the application's RPC group and provide `sessionsHandlers` from `@shivaedev/identity/server/better-auth/sessionsHandlers.ts`. Install `permissionLayer(SessionsPermission, sessions)` using `SessionsPermission` from `@shivaedev/identity/sessionPermissions.ts` and the mounted session policy. Supply the application's Effect `SqlClient`; the handlers use the default Better Auth PostgreSQL user and session tables.

Grant `ManageSessions` (`sessions.manage`) from `sessionPermissions.ts` to the roles that manage sessions. The starter grants it to admin and owner. Both operations use the same permission middleware and `Forbidden` refusal as the admin Users page. They require no Better Auth admin plugin.

`identity.sessions.list({ limit, cursor? })` returns `{ sessions, next }`, where `next` is an `Option` containing the next cursor. Limits are 1–100. Pass the returned cursor unchanged to read the next page; removing an earlier session does not shift later pages. Only unexpired sessions appear, ordered by last activity descending, then session id descending. Each session has `id`, `user: { id, name, email }`, and native Effect UTC `startedAt`, `lastActivityAt` and `expiresAt` values. Last activity is the provider's stored session `updatedAt`, so its precision follows the application's Better Auth session-refresh policy. Pages read current storage rather than a frozen snapshot.

`identity.sessions.revoke({ id })` deletes just that session and returns `NotFound` when the id is unknown. Its next protected request is unauthorized, and its open live subscriptions end at the configured session revalidation interval. Other sessions for the same user continue working. This uses database-backed sessions and the same storage-removal and revalidation path as `revokeUnadmitted`; secondary session storage is outside this SQL administration path.

### Bundled native clients

For a Capacitor or similar WebView whose page is served from the app bundle, opt in with the auth host mount's `bearerSessions` option. It installs Better Auth's own `bearer({ requireSignature: true })` plugin from the existing dependency; do not add a second bearer plugin. The option is absent by default. List only bundled-client origins here, and include them in Better Auth's `trustedOrigins` as well.

```ts
const nativeOrigins = ["capacitor://localhost", "https://localhost"];
const mounted = yield* betterAuthMount(
  {
    database,
    trustedOrigins: [publicOrigin, ...nativeOrigins],
    session: { cookieCache: { enabled: false } },
    emailAndPassword: { enabled: true },
  },
  { bearerSessions: { origins: nativeOrigins } },
);
const sessions = {
  origin: trustedOrigins({ allow: [publicOrigin, ...nativeOrigins], missing: "allow" }),
  provider: mounted.admittedSessions((headers) => mounted.auth.api.getSession({ headers })),
};
const host = appHost({ group, handlers, routes: mounted.routes, sessions, nativeOrigins });
```

Always wrap the session lookup in `admittedSessions`, even without a sign-in policy: it applies the mount's credential selection to the same request-local identity, profile and role middleware used by cookies. A same-origin request or a request without an Origin carrying the session cookie uses only that cookie, even if invalid or revoked; its bearer header cannot switch accounts or rescue it. Otherwise the signed bearer is resolved by Better Auth. Missing, unsigned, tampered, expired and revoked bearer sessions produce `Unauthorized` at protected RPCs.

A native client signs in through `/api/auth/sign-in/email` with `credentials: "omit"` and its bundled Origin, reads the signed credential from the `set-auth-token` response header, and sends that exact value as `Authorization: Bearer <credential>` with `credentials: "omit"` on later auth and RPC requests. Persist it only in OS-backed secure storage, such as iOS Keychain or Android Keystore-backed storage; never use localStorage, sessionStorage or IndexedDB. Browser responses keep HttpOnly cookies and omit the plugin's token header and JSON token fields. Clients without a bundled Origin receive cookie responses.

Native sign-out revokes the stored session. Signing in again while sending the current bearer replaces it and revokes the old session after successful sign-in. Streams keep their original request headers, so the old session ends with `Unauthorized` on the next revalidation; it never adopts the replacement. Keep cookie caching disabled for database-backed revocation and choose `streamRevalidationInterval` for the required delivery window.

`appHost`'s `nativeOrigins` option admits those exact origins through the RPC transport guard and the auth routes. Wildcards, patterns and URLs with paths are rejected at startup. Keep the list aligned with `bearerSessions.origins`, Better Auth's `trustedOrigins` and the RPC session origin policy: the later origin policies alone cannot open the transport guard. Without the option, the transport guard keeps its same-origin policy.

The host answers native preflights with POST for RPC, GET and POST for auth, and only `Authorization` and `Content-Type` headers. Native responses echo the allowed origin exactly with `Vary: Origin`; auth responses expose `set-auth-token`. The host never enables CORS credentials. It strips cookies from admitted native requests before auth or RPC session resolution, so only the signed bearer session can authenticate them. This prevents native access from opening a cookie CSRF path, even if a caller sends a cookie. Resource authorization remains app-owned.

Use the WebView's own fetch with `credentials: "omit"` for incremental NDJSON change streams and abort its request to release server work. A buffering native HTTP bridge cannot deliver that streaming behavior. The host still validates trusted proxy peers and forwarded authority, enforces NDJSON and body limits, uses only transport credentials, redacts diagnostics and authorizes sessions. Native HTTP callers without an Origin can exercise bearer RPC with an origin policy that explicitly permits missing Origins.

### Decide who may sign in

Give the mount a sign-in policy as its second argument, and resolve RPC sessions through `admittedSessions` so a removal ends access on the next request:

```ts
import { Effect } from "effect";
import { allowedAccounts } from "@shivaedev/identity/server/better-auth/allowedAccounts.ts";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { trustedOrigins } from "@shivaedev/identity/server/origin.ts";

const authentication = Effect.gen(function* () {
	const database = yield* betterAuthDatabase();
	const mounted = yield* betterAuthMount(
		{ database, session: { cookieCache: { enabled: false } }, socialProviders: { github } },
		{ signIn: { accounts: allowedAccounts, recheckInterval: "5 minutes", rule: inOrganization } },
	);
	yield* mounted.revokeUnadmitted;
	const sessions = {
		origin: trustedOrigins({ allow: ["https://app.example"], missing: "reject" }),
		provider: mounted.admittedSessions((headers) => mounted.auth.api.getSession({ headers })),
	};
	return { ...mounted, sessions };
});
```

`github` is the application's GitHub client settings. `inOrganization` is the application's rule, `(account: ProviderAccountValue) => Effect<boolean, E, R>`, which asks the provider whether that account belongs to its organization; the mount requires the rule's `R`, and its failures stay typed. Both parts are optional, and a user is admitted when one of their provider accounts is on the list and the rule admits that account.

`allowedAccounts` reads `AUTH_ALLOWED_ACCOUNTS` through Effect Config and decodes it with the `AllowedAccounts` Schema: comma-separated `providerId:accountId` entries, such as `github:1001,github:1002` for two GitHub user IDs. GitHub account IDs must contain decimal digits only; a login such as `github:octocat` stops the mount with a `ConfigError` naming the entry and expected form. Providers without a known format accept any non-empty account ID. Whitespace around providers and IDs is trimmed. A malformed or empty list stops the mount with a `ConfigError`. For another variable name, pass `Config.schema(AllowedAccounts, "NAME")` as `accounts`.

At sign-in the mount installs the policy into Better Auth's own hooks. `user.validateUserInfo` checks the provider account from the provider's verified profile before Better Auth creates a user, so a refused sign-up leaves no user behind. Sign-ups without a provider account, such as email and password, are refused while a policy is set. `databaseHooks.session.create.before` checks the stored accounts of a returning user before Better Auth creates the session. A refused OAuth sign-in redirects to the error URL with `error=sign_in_refused`, and a refused API call answers HTTP 403 with code `sign_in_refused`. When the rule fails, the sign-in is refused with `sign_in_unavailable` and no user is created. The application's own `databaseHooks.session.create.before` runs before the policy's, and a session it refuses stays refused.

A removal takes effect on the user's next request through `admittedSessions`: the list is read from Config at every check, the user is refused with `Unauthorized`, and Better Auth's internal adapter deletes every stored session of that user. With environment variables, the list changes when the application restarts with the new value; a Config provider whose values change at runtime applies a removal without a restart. The rule's answer for each provider account is reused for `recheckInterval`, five minutes by default, so a rule that turns false refuses the user on their first request after that interval. A failing rule, or a list that no longer decodes, answers `AuthUnavailable` and keeps the session.

`revokeUnadmitted` checks every stored user against the current policy, deletes the sessions of each user it no longer admits and succeeds with `{ users, sessions }`, the number of users and sessions it revoked. Run it at startup, as above, or from an administrative command. It fails with the rule's error or with a `ConfigError`.

Without `signIn`, the mount installs no sign-in policy hooks and `revokeUnadmitted` revokes nothing. `admittedSessions(lookup)` returns an Effect `SessionProvider`; use it directly as `sessions.provider`. Its policy check runs in the request fiber, preserving request spans, log annotations and interruption. `mounted.sessions` supplies this provider with the mount's roles and the default Better Auth lookup. Supply the application's Config provider to the server Layer so request-time account checks read the same configuration as startup.

### Once per feature: identity and typed refusals

Use `Authenticated` when the operation needs `Identity`, and `MaybeAuthenticated` with `maybeAuthenticatedLayer(policy)` when it reads `OptionalIdentity`:

```ts
import { Effect, Option, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { OptionalIdentity } from "@shivaedev/identity/identity.ts";
import { MaybeAuthenticated } from "@shivaedev/identity/middleware.ts";

export const Greetings = RpcGroup.make(Rpc.make("Greeting", { success: Schema.String })).middleware(MaybeAuthenticated);

export const GreetingHandlers = Greetings.toLayer({
	Greeting: () =>
		Effect.map(OptionalIdentity, (identity) =>
			Option.match(identity, {
				onNone: () => "hello anonymous",
				onSome: ({ id }) => `hello ${id}`,
			}),
		),
});
```

A missing session produces `Option.none()` here. The same policy still rejects forbidden origins and distinguishes provider failure from an anonymous caller. Signed-in authenticated requests annotate the user's id on logs as `userId` and spans as `user.id`.

For an HTTP RPC server that serves only the local machine, wrap its HTTP effect with `localRpcGuard` from `@shivaedev/identity/server/local.ts`. Provide the native `HttpServerRequest` and `RpcSerialization` services around the returned effect, using the same serialization as the RPC server. No session provider is required.

By default, the guard returns HTTP 403 before running the effect unless the transport reports a loopback peer address, the Host is a loopback host, any Origin matches the HTTP Host, and the content type matches the serialization. An absent peer address is rejected, and a DNS-rebinding Host on a loopback connection is refused. The optional second argument, `localRpcGuard(effect, trustedProxy)`, enables the same address and range forwarding policy as `appHost`.

The same module exports `loopbackOnly(handler)` for local page routes and `sameOrigin(request)` for an HTTP Origin check. `loopbackOnly` checks Host and any known peer address; it permits an absent peer address so embedded Fetch page handlers remain usable. It does not check Origin or content type.

`trustedProxyPeer(trustedProxy?)` compiles the guard's proxy address list into an `(address: string) => boolean` predicate. Use it with the transport's remote address when another route needs the same proxy trust decision. It supports the same IP addresses, CIDR ranges and IPv4-mapped IPv6 peers as `appHost`; absent or malformed configuration matches no peer. It does not read forwarded headers.

`trustedProxyRanges(trustedProxy?)` from `@shivaedev/identity/server/trustedProxyRanges.ts` returns the equivalent IP addresses and CIDR ranges used by that matcher. Mapped IPv6 addresses and CIDRs become IPv4 entries: `::ffff:127.0.0.0/104` becomes `127.0.0.0/8`, including hexadecimal mapped forms. Broader IPv6 ranges retain both native IPv6 and mapped IPv4 coverage. Missing or malformed configuration returns an empty list. Pass these ranges to a forwarded-header integration after checking the transport with `trustedProxyPeer`.

Declare expected refusals with the shared tagged error schemas from [`@shivaedev/errors`](https://github.com/ShivaeDev/platform/tree/main/packages/errors#readme). They work with native RPC without authentication middleware.

### Reading the signed-in user

When a handler needs the current user's name and email, declare `AuthenticatedUser` and read `SessionUser`. `Identity` keeps its `{ id }` shape; `AuthenticatedUser` supplies both services for that invocation. Its provider must return `user: { id, name, email }`, described by `UserSessionShape`.

```ts
import { Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { authenticatedUserLayer } from "@shivaedev/identity/server/session.ts";

export const Account = RpcGroup.make(
	Rpc.make("Whoami", {
		success: Schema.Struct({ id: Schema.String, name: Schema.String, email: Schema.String }),
	}),
).middleware(AuthenticatedUser);

export const AccountHandlers = Account.toLayer({
	Whoami: () => Effect.map(SessionUser, (user) => user),
});

export const AccountServer = Layer.merge(AccountHandlers, authenticatedUserLayer(sessions));
```

Here `sessions` is the application's policy from the previous example, with a Better Auth lookup that returns all three user fields. Merge `authenticatedUserLayer(sessions)` alongside the handler Layer when using `appHost`; the host continues to supply its id-only and optional middleware. A missing session fails with typed `Unauthorized`; rejected origins fail with `Forbidden`, and provider failures remain `AuthUnavailable`. The profile contains id, name and email, plus an optional role when the provider supplies it, without exposing the rest of the provider's user record. Handlers do not query the provider's user table.

#### Reading provider account IDs

Pass Better Auth's account lookup as the second argument to the mount's `admittedSessions` to combine provider accounts with its sign-in policy and credential selection. Without a mount, `betterAuthSessions` accepts the same two lookups. Declare `AuthenticatedUserWithProviderAccounts` on account-reading RPCs and merge `authenticatedUserWithProviderAccountsLayer(sessions)` alongside their handlers. This boundary requires a provider whose user has a `providerAccounts` Effect; a provider without the second lookup does not satisfy that type.

```ts
import { SessionUserWithProviderAccounts } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUserWithProviderAccounts } from "@shivaedev/identity/middleware.ts";
import { AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { authenticatedUserWithProviderAccountsLayer } from "@shivaedev/identity/server/session.ts";

const sessions = {
	origin: trustedOrigins({ allow: ["https://app.example"], missing: "reject" }),
	...mounted.sessions,
	provider: mounted.admittedSessions(
		(headers) => mounted.auth.api.getSession({ headers }),
		(headers) => mounted.auth.api.listUserAccounts({ headers }),
	),
};

const githubAccount = Effect.gen(function* () {
	const user = yield* SessionUserWithProviderAccounts;
	const accounts = yield* user.providerAccounts;
	return accounts.find((account) => account.providerId === "github");
});
```

Declare `Schema.Union([AuthUnavailable, Unauthorized])` in the account-reading RPC's `error` schema: lookup failures come from the handler's Effect. An outage fails with `AuthUnavailable`; a session that expires before the lookup fails with `Unauthorized`. Neither failure exposes provider exception details.

The lookup uses the same transport headers and runs only when the handler evaluates `user.providerAccounts`. The boundary memoizes a successful result in that invocation's Effect context, including concurrent reads, without sharing it across requests or users. A failed lookup is not retained: the next read tries again. Identity-only handlers never run the accounts lookup. `SessionUserWithProviderAccountsValue.providerAccounts` is a required `Effect<readonly ProviderAccountValue[], AuthUnavailable | Unauthorized>`. Each result contains only `{ providerId: string, accountId: string }`; for example, GitHub's numeric user ID is the string `"123"`, not Better Auth's account-row id. `SessionUser` and `SessionUserValue` contain the base profile without accounts.

A custom session provider supplies `user.providerAccounts` as a lazy Effect with that same result and failure type, described by `ProviderAccountsSessionShape`. The boundary owns request-local memoization and the reduction to public IDs; custom providers need not cache or project the returned account objects.

### Reading other users' public profiles

Use `userProfiles(auth, userIds)` in server code to display the names of users who made changes. Pass the `auth` instance returned by `betterAuthMount` and a list of user IDs.

```ts
import { userProfiles } from "@shivaedev/identity/server/better-auth/userProfiles.ts";

const profiles = yield* userProfiles(auth, changedByUserIds);
```

The Effect returns an array of `{ id, name, image }`, with `image: null` when unset and unknown IDs omitted. It reads duplicate IDs once in one storage query through Better Auth's adapter, honoring the application's model and field mappings. An empty list returns an empty array without querying storage. Each lookup reads the current profile, including names changed through Better Auth. The result never includes email, role, session or account data. A storage failure logs its cause in redacted form and fails with a generic `AuthUnavailable`, without exposing provider exception details to the caller.

### Requiring a permission

Declare application roles with `@shivaedev/access`. Each user row stores one declared role string. Supply the role set once through the existing auth configuration and reuse its returned session policy:

```ts
import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";

const UseTools = permission("tools.use");
const Access = roleSet(role("member", []), role("operator", [UseTools]));
const mounted = yield* betterAuthMount(authOptions, { defaultRole: "member", roles: Access });
const sessions = { ...mounted.sessions, origin: trustedOrigins({ allow: ["https://app.example.com"], missing: "reject" }) };
```

For another session provider, put `roles: Access` alongside `provider` and `origin` in the host's existing `sessions` policy. The provider must read the current stored role on every invocation. `betterAuthMount`'s returned provider and its existing `/api/auth/get-session` endpoint bypass the cookie cache. That endpoint adds `user.permissions`, an array of `{ name, strength }` grants, and the request-local `SessionUser` exposes the same decoded role and grants. A missing or null stored role refuses access with `Forbidden` (HTTP 403 at the session endpoint) and logs the fix: generate and apply a frozen migration with `defaultRole`, then use `assignRole` for administrators. An undeclared non-null stored role fails as a defect naming that role. RPC request tracing logs it as a defect; `/api/auth/get-session` returns HTTP 500. Correct the stored role or restore its application declaration. Provider outages remain `AuthUnavailable`.

### Frozen auth migrations

Generate each auth migration once, review its SQL and commit the generated module. `generateBetterAuthMigration(options, roleOptions?)` reads the current PostgreSQL schema through `SqlClient` and returns a TypeScript migration module. It does not apply the migration. The module imports only native Effect and executes fixed SQL on the migrator's transaction connection. Later auth option changes and Better Auth upgrades cannot change its SQL.

Start with a disposable PostgreSQL database containing only your previously shipped migrations. For the first auth migration that means an empty auth schema. In a scoped generation script with `postgresLayer` and Node services provided:

```ts
import { FileSystem } from "effect";
import { generateBetterAuthMigration } from "@shivaedev/identity/server/better-auth/migrations/generate.ts";

const fs = yield* FileSystem.FileSystem;
const source = yield* generateBetterAuthMigration({ emailAndPassword: { enabled: true } });
yield* fs.writeFileString("src/server/migrations/0001_auth.ts", source, { flag: "wx" });
```

Apply `0001_auth` through `migratePostgres`. When options change, such as adding `user.additionalFields.role`, keep `0001_auth` unchanged. Generate a new file against a database with the previous migrations applied:

```ts
const source = yield* generateBetterAuthMigration({
	emailAndPassword: { enabled: true },
	user: { additionalFields: { role: { type: "string", required: true, defaultValue: "member" } } },
});
yield* fs.writeFileString("src/server/migrations/0002_auth_roles.ts", source, { flag: "wx" });
```

Review and commit `0002_auth_roles`, then apply it with the other numbered migrations. If the app uses Quality, register each reviewed generated file in `boundaries/auth-sql`'s `options.owners` in its `quality.config.ts`; the generated file owns auth DDL, while application queries continue to use identity. For identity-managed roles, pass `{ defaultRole: "member" }` as the second argument instead of configuring the field yourself; its generated SQL also freezes the default, null backfill and NOT NULL constraint.

A numbered migration calling `getMigrations(authOptions)` live is **not frozen**, even if it copies the options into that file: the installed Better Auth version still decides the DDL. `migrateBetterAuth` is also live; use it for disposable test setup, not shipped migrations. It executes compiled DDL on the native SQL connection. Generated modules use a PostgreSQL `DO` block to execute the compiled statements together on that connection.

After applying all numbered migrations in an isolated story database, check them against the current options:

```ts
import { assertBetterAuthSchema } from "@shivaedev/identity/server/better-auth/assertSchema.ts";

yield* assertBetterAuthSchema(authOptions, { defaultRole: "member" });
```

`assertBetterAuthSchema` fails with `BetterAuthSchemaDrift`, whose `missing` entries name missing tables, columns and configured indexes, incompatible column types and missing NOT NULL constraints. It also reports an optional field whose existing non-null column has neither a database default nor an auth field default. With identity role options it checks the role default. A newly added `user.role` reports `column user.role` until the next migration is generated **and applied**. Generation follows Better Auth's additive migration planner; type and nullability changes may require reviewed, application-authored SQL in a new migration. The check does not compare arbitrary application constraints or detect changes to default functions.

The starter ships checked-in SQL for its auth migrations and checks all numbered migrations against current auth options in its PostgreSQL stories.

### Adopting stored roles with existing users

Identity declares `user.additionalFields.role` when the mount has `roles` and `defaultRole`. Choose a default from your application's role set, such as `member`. It is a required string and cannot be supplied by sign-up input. No `additionalFields` entry or Better Auth `admin()` plugin is needed.
1. Generate a new numbered application migration with `generateBetterAuthMigration(authOptions, { defaultRole: "member" })`, following the frozen workflow above. Run it before deploying the mount with roles. PostgreSQL fills existing users when the column is added; identity also fills null roles when adopting a nullable role column. Both fresh and upgraded schemas finish with a `text NOT NULL DEFAULT 'member'` column. The migration keeps existing non-null roles.
2. Mount with `betterAuthMount(authOptions, { defaultRole: "member", roles: Access })`, using the same default as the migration. New users get that role. Remove any app-owned role field configuration and the admin plugin if you used it only for roles.
3. In a trusted server-side bootstrap process, call `assignRole(Access, existingUserId, "admin")` to make the first administrator. Provide the application's SQL Layer, as for other role changes. Alternatively, configure `accountRoleSeed` on the mount for named provider accounts. `Access` must declare `admin` with the permissions that administrator needs, including `AssignRoles` to manage other users. Do not expose the bootstrap process as an unauthenticated endpoint.

```ts
import { assignRole } from "@shivaedev/identity/server/better-auth/assignRole.ts";
import { generateBetterAuthMigration } from "@shivaedev/identity/server/better-auth/migrations/generate.ts";

const migrationSource = yield* generateBetterAuthMigration(authOptions, { defaultRole: "member" });

const changed = yield* assignRole(Access, existingUserId, "admin");
```

Use a numbered migration for schema adoption and a separate bootstrap command for the assignment. Existing sessions read the stored role on their next request. In an isolated story database, `const storage = yield* authTestDatabase; yield* storage.migrate(authOptions)` builds the schema without a role field when the options omit it; store users through `signedInUser`, then call `storage.migrate(authOptions, { defaultRole: "member" })` to exercise adoption without writing SQL against auth tables.

### Permission middleware

Declare a native middleware service for each required permission and provide its Layer beside the handlers:

```ts
import { Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { permissionMiddleware } from "@shivaedev/identity/permission.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";

class ToolsPermission extends permissionMiddleware<ToolsPermission>()("app/ToolsPermission", UseTools) {}
const Tools = RpcGroup.make(Rpc.make("tools", { success: Schema.String }).middleware(ToolsPermission));
const handlers = Tools.toLayer({ tools: () => Effect.map(SessionUser, (user) => user.email) }).pipe(
	Layer.provideMerge(permissionLayer(ToolsPermission, sessions)),
);
```

The middleware resolves and checks the session on every request before invoking the handler. It provides `Identity` and `SessionUser`, rejects signed-out callers with `Unauthorized`, and rejects missing grants with `Forbidden` in its declared error channel. Access evaluates an exact permission name: an `any` grant covers an `own` check, while an `own` grant does not cover an `any` check. Open streams recheck their required permission at the session revalidation interval and end with `Forbidden` after its removal.

For HTTP routes, use `permissionRoute(sessions, UseTools)` around the handler. It uses the same transport session and Origin policy, returns 401 for missing sessions, 403 for missing grants or refused Origins, and 503 for `AuthUnavailable`. Those rejections carry `Cache-Control: private, no-store`. The handler's response and typed failures pass through unchanged.

```ts
import { HttpRouter, HttpServerResponse } from "effect/http";
import { permissionRoute } from "@shivaedev/identity/server/permissions.ts";

const routes = HttpRouter.use((router) =>
	router.add(
		"GET",
		"/tools",
		permissionRoute(sessions, UseTools)(() => Effect.map(SessionUser, (user) => HttpServerResponse.text(user.email))),
	),
);
```

An operation on one record reads that record's owner and uses the application's access policy. With a request-local user, `const { role } = yield* Access.resolve(user.role)` recovers the application's closed role type; `yield* Access.requireAccess({ id: user.id, role }, UseTools, record.ownerId)` then permits an explicit `any` grant or an `own` grant for that owner. Keep these resource decisions in the handler or domain service. Browser interfaces can use `hasPermission(user, permission)` from `@shivaedev/identity/permission.ts` over the client session's grants; the server always resolves its own grants. To enforce a grant in a handler, import `requirePermission` from `@shivaedev/access/requirePermission.ts` and call `yield* requirePermission(yield* SessionUser, permission)`.

### Session-scoped contract keys

For self-only features, declare `contract("preferences", { keyScope: "session", queries, commands }).middleware(Authenticated)`. `List` and `Item` remain the dependency shapes; the account scope is an additional dimension derived from request-local `Identity.id`. Handlers continue to read their owner from `Identity`, and payloads need no owner field just to key reads or invalidations. Other sessions of that account receive its changes; other accounts receive no invalidation hint for those writes.

The host's generated `$changes` handler accepts `{ queries: [{ query: "get", payload: { id: "theme" } }] }`, resolves the declared query dependencies during that subscription invocation, and passes the authenticated scope to the change stream. It does not accept physical subscription keys or a caller-selected scope. Missing request-local `Identity` on a session-scoped subscription is a configuration defect, with no unscoped fallback.

`authenticatedLayer`, `authenticatedUserLayer`, `authenticatedUserWithProviderAccountsLayer` and `permissionLayer` run scoped command invalidation inside the authenticated invocation. Successful commands publish their scoped keys after the handler returns and omit keys the handler's transactions already published. Keys that must commit atomically with a write come from the stored model's `bucket()` fields and the repository, rather than command `invalidates`. A rejected transaction publishes no keys.

Declared-key publication retries twice, after 50 ms and 100 ms, without rerunning the handler. Exhausted retries preserve the committed result. On a database-backed host, they mark local live streams for Resync and attempt a broadcast Resync on the PostgreSQL change channel. If that broadcast also fails, the server logs that other hosts may remain stale. There is no durable replay: a remote host whose listener remains healthy cannot discover a notification that never reached PostgreSQL. Reconnect or listener recovery reconciles its streams.

Hosted applications use `Api.application.toLayer(...)` and let `appHost` own `$changes`. A custom change handler accepts query references and resolves them inside `Stream.unwrap`, after authentication has provided `Identity`:

```ts
import { Effect, Stream } from "effect";
import { resolveChanges } from "@shivaedev/identity/server/sessionKeys.ts";

const changesRpc = Api.requests.get("preferences.$changes")!;
const handlers = Api.toLayer({
	"preferences.$changes": ({ queries }) =>
		Stream.unwrap(Effect.map(resolveChanges(changesRpc, queries), ({ subscription, context }) => changes.subscribe(subscription, context))),
	"preferences.get": getPreference,
	"preferences.save": savePreference,
});
```

Here `changes` is the application's `makeLiveServer` service. Pass the native RPC definition to `resolveChanges` so its typed failures and required services follow the policies declared by that contract. Keep `resolveChanges` in the invocation; resolving it while building a shared Layer would lose request identity. Pass the authorized subscription and context to `changes.subscribe`; it uses the query scopes to identify affected references and rechecks the same policies before hints leave.

Custom authentication middleware supplies the same boundary by validating the transport session, then wrapping scoped commands with `commandChanges` before providing `Identity`:

```ts
import { Effect, Layer, Option } from "effect";
import { authorizeReads } from "@shivaedev/contract/readPolicy.ts";
import { Identity } from "@shivaedev/identity/identity.ts";
import { commandChanges } from "@shivaedev/identity/server/commandChanges.ts";

const authentication = Layer.succeed(MyAuthentication, (effect, { headers, rpc, payload }) =>
	Effect.gen(function* () {
		const session = yield* requireTransportSession(headers, rpc);
		return yield* authorizeReads(commandChanges(effect, rpc, payload), { rpc, payload }, Option.some({ id: session.user.id })).pipe(
			Effect.provideService(Identity, { id: session.user.id }),
		);
	}),
);
```

`MyAuthentication` declares `provides: Identity`, its authentication errors and `MissingReadPolicy` and `QueryReadDenied` from `@shivaedev/contract/readPolicyErrors.ts`. Query policies receive the session viewer through `authorizeReads`. `requireTransportSession` is the application's session validation; use `transportHeaders` or `resolveSession` to read HTTP or WebSocket transport credentials. The identity comes from that validated session on each invocation. `requestTracingLayer` publishes only unscoped contract invalidations; custom auth middleware must apply `commandChanges` for scoped commands. If a transaction explicitly announces scoped dependencies, use `invalidationKeys(keys, { scope: identity.id })` with `invalidateOnCommit` inside `transact` so automatic command invalidation can deduplicate the same physical keys.

### Session freshness in streams

`authenticatedLayer`, `authenticatedUserLayer`, `authenticatedUserWithProviderAccountsLayer`, the role layers and signed-in `maybeAuthenticatedLayer` calls revalidate live RPC streams every 30 seconds by default, using the original transport headers. A signed-out, revoked or expired session ends the stream with `Unauthorized`, including an idle stream and a subscription receiving a change hint. A signed-in viewer whose query read policy now refuses ends the subscription with `QueryReadDenied`. Session intervals use Effect’s Clock, so advancing `TestClock` drives revalidation; batched session lookups do not need another clock advance. With a session store that reflects sign-out immediately, delivery can continue for up to that interval plus the session lookup time after sign-out. Provider cookie caching or secondary storage can add their own delay; keep Better Auth's cookie cache disabled for database-backed revocation.

Set `SessionPolicy.streamRevalidationInterval` to an Effect `Duration.Input` to change the interval for middleware using that policy:

```ts
const sessions = {
	origin: trustedOrigins({ allow: ["https://app.example.com"], missing: "reject" }),
	provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
	streamRevalidationInterval: "5 seconds",
};
```

An `AuthUnavailable` failure during revalidation ends the stream with `AuthUnavailable`. Initial session lookup failures also reject the subscription. Unary calls resolve their session once per call. `MaybeAuthenticated` streams that start anonymous continue without a session monitor; a signed-in optional stream ends with `Unauthorized` when its session is removed. Callers can subscribe again to continue anonymously.

### Transport headers and request ids

Session resolution reads `HttpServerRequest`: the HTTP POST or WebSocket upgrade request. Credentials and Origin supplied inside an RPC message cannot replace those transport headers. An application-owned middleware can use `transportHeaders(rpcHeaders)` for the same source of headers.

Tracing uses the RPC headers for correlation. `requestTracingLayer()` accepts `x-request-id`; `{ header: "x-correlation-id" }` changes the name. Missing, malformed or oversized values receive generated 32-character lowercase hexadecimal ids. A request id reaches the `RequestId` service, log annotations as `requestId`, and the server span as `request.id`; the RPC method reaches both as `rpc.method`.

Caller-chosen request ids are correlation data. Keep authorization tied to the authenticated identity.

The app host of `@shivaedev/server` adds this tracing to its RPC group and continues the caller's W3C trace; react's [action tracing](https://github.com/ShivaeDev/platform/blob/main/packages/react/README.md#trace-an-action-across-rpcs) follows one browser action through RPC, SQL and a queued job.

### Reference users from app tables

App tables reference users by foreign key. Import `userReference` for the default Better Auth user table and id column, and use native Effect SQL identifiers in the app's migration:

```ts
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { userReference } from "@shivaedev/identity/server/better-auth/userReference.ts";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table notes (
		id serial primary key,
		user_id text not null references ${sql(userReference.table)} (${sql(userReference.column)}) on delete cascade,
		title text not null
	)`;
});
```

Run the auth schema migration before the app migration. Use `ON DELETE CASCADE` to delete owned rows with their user, or a nullable `user_id` and `ON DELETE SET NULL` to retain rows without an owner. `userReference` describes the default PostgreSQL mapping, so an application that customizes Better Auth's user table or id column must use its own mapping. Account reads and writes still go through identity; the foreign key grants no access to auth data. Quality's `boundaries/auth-sql` accepts these references while rejecting other auth SQL outside the configured owners.

### Signed-in story preconditions

Use `testUtils()` from `better-auth/plugins` in a test-only Better Auth instance with the host's database, secret and cookie policy. Keep the plugin out of production auth options.

Use `authTestDatabase` from `@shivaedev/identity/server/better-auth/testDatabase.ts` when a story needs observations or faults in the default Better Auth PostgreSQL schema. It returns Effect readouts `users` (IDs and emails) and `sessions` (IDs, user IDs and emails), plus `migrate(options, roleOptions?)`, `roleColumn` (PostgreSQL type, nullability and default), `userRoles` (emails and roles), and the test-only faults `expireSessions(userId?)`, `omitImageColumn` and `omitRole(userId)`. The last fault makes a role nullable and clears that user's role to model a partial migration. Pass a user id to expire only that user's sessions, or call `expireSessions()` to expire every session. It never returns tokens, password hashes or provider credentials. These fixtures assume the default table and column mappings and read `SqlClient` from the Effect environment; use only an isolated test database. Application stories keep their auth SQL in this provider-owned boundary.

`authTestDatabase` also exposes `sessionsFor(userId)`, returning that user’s stored sessions as `{ id, expiresAt, expired }`. `expiresAt` is a native Effect UTC value; `expired` compares it with Effect’s current clock. Expired sessions remain visible until removed. Revocation deletes a session, so its id disappears from this readout; it keeps no revocation history. For expiry stories, advance `TestClock` to the minted session’s expiry instead of rewriting storage timestamps. Identity’s Better Auth session provider, session administration list and expired-session sweep use Effect’s clock. Sessions minted by `signedInUser` take their expiry from Effect’s Clock and Better Auth’s configured session lifetime. Better Auth’s own auth endpoints, direct `testUtils` calls and session refresh still use the provider’s clock.

```ts
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { Effect } from "effect";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";

const testAuth = betterAuth({
	...options,
	plugins: [...(options.plugins ?? []), testUtils()],
});
const { user, headers, cookies } = await Effect.runPromise(
	signedInUser(testAuth, {
		email: "member@example.test",
		name: "Member",
		providerAccounts: [{ providerId: "github", accountId: "123" }],
		role: "user,admin",
	}),
);
```

`options` is the application's auth configuration. `signedInUser` saves the supplied user fields, creates each optional `providerAccounts` entry for that user through Better Auth's internal adapter, and mints one session through Better Auth's `testUtils`, without OAuth or password hashing. The accounts carry no tokens or password. Omitting `providerAccounts` creates only the user and session. It returns an Effect containing Better Auth's login result: the user, session, signed request headers, browser cookies and token. In a story, call `yield* signedInUser(auth, fields)` so minting uses that story's TestClock. If the story also calls Better Auth's auth endpoints, start its TestClock at the present because those endpoints still check the provider's wall clock. The starter’s app and cookie story kits select that default; stories can still pass an explicit `clock`. To mint users with roles, use the auth instance returned by `betterAuthMount(options, { defaultRole: "member", roles: Access })`. Send `headers` to the real host, or pass `cookies` to test-story's `seedCookies` in a DOM story after setting its host location with `domFetch`. Keep a real sign-in story for each sign-in flow; feature stories start from the minted precondition.

`passwordUser(auth, { email, password, ...fields })` from the same testing module saves a user and a credential account using Better Auth's configured password hasher, and returns an Effect containing the user without minting a session. Use it for the one story that signs in through `/api/auth/sign-in/email`; keep feature stories on `signedInUser` so they avoid password hashing.

Call `yield* signInAgain(auth, userId)` from `server/better-auth/testing.ts` to mint a fresh session for an existing user after a long story clock jump. It returns the same login shape as `signedInUser` and sets expiry from the caller’s Effect Clock and the configured session lifetime. Replace the visitor’s request headers or seed the returned browser cookies.

Use `storedProviderAccounts(auth, userId)` to observe credential storage through Better Auth's internal adapter. It returns account and provider IDs with `hasAccessToken`, `hasRefreshToken`, `hasIdToken` and `hasPassword` booleans. It never returns token values, passwords or password hashes. A DOM story kit that exposes its test auth instance and a session readout can use both helpers:

```ts
import { Effect } from "effect";
import { expect } from "vitest";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";
import { signedInUser, storedProviderAccounts } from "@shivaedev/identity/server/better-auth/testing.ts";

const member = app.trait("account", "a member starts signed in with GitHub", function* ({ auth }) {
	const { cookies } = yield* signedInUser(auth, {
		email: "member@example.test",
		name: "Member",
		providerAccounts: [{ providerId: "github", accountId: "123" }],
	});
	yield* seedCookies(cookies);
});

app.it("the member's provider account stores no credentials", [member], function* ({ session, story }) {
	const { user } = yield* session();
	const accounts = yield* Effect.promise(() => storedProviderAccounts(story.engine.auth, user.id));
	expect(accounts).toEqual([
		{
			providerId: "github",
			accountId: "123",
			hasAccessToken: false,
			hasRefreshToken: false,
			hasIdToken: false,
			hasPassword: false,
		},
	]);
});
```

With database-backed sessions and cookie caching disabled, revocation rejects that same minted session on the next protected HTTP or RPC request. Cookie caching and secondary storage can change revocation timing.

### Deliver typed auth emails

Give `betterAuthMount` one `emails` configuration instead of four Better Auth callbacks. The application supplies absolute route URLs and a delivery Effect; it owns the transport and message text.

```ts
const mounted = yield* betterAuthMount(options, {
  emails: {
    routes: {
      ConfirmAccount: "https://app.example/confirm-account",
      ApproveEmailChange: "https://app.example/approve-email-change",
      ConfirmNewAddress: "https://app.example/confirm-new-address",
      ResetPassword: "https://app.example/reset-password",
      AccountAlreadyExists: "https://app.example/sign-in",
    },
    deliver: (message) => mailer.deliver(message),
    window: "1 minute",
  },
});
```

`AuthEmail` from `server/better-auth/emails.ts` is a union discriminated by `_tag`: `ConfirmAccount`, `ApproveEmailChange`, `ConfirmNewAddress`, `ResetPassword` and `AccountAlreadyExists`. Each message carries `user` and `url`. All except `AccountAlreadyExists` carry `token`; both change messages also carry `newEmail`, decoded inside identity for the reused verification callback. The new-address message's `user.email` is the destination address. The app URL preserves its own query parameters and receives the token in a `token` query parameter. A confirmation route passes that token to Better Auth's verification API; a reset page submits it with the new password to its reset API.

The wiring replaces the four delivery callbacks and preserves the other Better Auth settings. Enable the flows through native options: `emailAndPassword.enabled`, `emailVerification.sendOnSignUp` or `emailAndPassword.requireEmailVerification`, and `user.changeEmail.enabled`. Better Auth calls `onExistingUserSignUp` only with its generic duplicate-signup response enabled, such as with `requireEmailVerification`.

Each mount reserves one delivery attempt per account id and message kind for one minute by default. `window` accepts an Effect Duration input. Different accounts and different kinds have separate windows; changing the destination address does not change the account key. Concurrent requests share the reservation, and another delivery is allowed at expiry. Suppressed requests return normally. A failed delivery keeps its reservation until expiry. The window uses the Effect Clock, lives in the mount's scope, and is held in memory; separate processes or mounts have separate windows. It complements Better Auth's request rate limits. Delivery Effects use the same `BetterAuthHookError` and request runtime as database hooks.

### Sweep expired sessions in a worker

Better Auth removes an expired session when it is presented. Use `sweepExpiredSessions` from `@shivaedev/identity/server/better-auth/sweepExpiredSessions.ts` to remove expired rows that are never presented again. The Effect reads the application's `SqlClient`, deletes sessions whose `expiresAt` is at or before Effect's current time, and returns the number removed. It preserves live sessions and needs no Better Auth mount or auth pool. It assumes the default Better Auth PostgreSQL table and column mappings.

Register the Effect with a worker schedule, as the starter does at midnight UTC. SQL and result-decoding failures stay in the Effect's error channel.

### API

Import the module that defines the name; there is no package-root entry. Paths below follow `@shivaedev/identity/`.

| Module                                       | Names and purpose                                                                                                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity.ts`                                | `RequestId`, `Identity`, `OptionalIdentity`, `SessionUser`, `SessionUserWithProviderAccounts`, `SessionUserSchema`: request-local services and the shared user schema.                                                      |
| `middleware.ts`                              | `RequestTracing`, `Authenticated`, `AuthenticatedUser`, `AuthenticatedUserWithProviderAccounts`, `MaybeAuthenticated`, `IdentityFailures`: native RPC middleware declarations and their shared failure schema.              |
| `server/providerFailure.ts`                  | `providerFailure(cause)`: log a redacted provider failure and fail with `AuthUnavailable`.                                                                                                                                  |
| `permission.ts`                              | `permissionMiddleware`, `hasPermission`: native permission middleware declarations and predicates over resolved grants.                                                                                                     |
| `server/permissions.ts`                      | `permissionLayer`, `permissionRoute`: permission middleware Layers and HTTP route guards.                                                                                                                                   |
| `server/session.ts`                          | `authenticatedLayer`, `maybeAuthenticatedLayer`, `authenticatedUserLayer`, `authenticatedUserWithProviderAccountsLayer`, `withSessionUser`, `resolveSession`: session middleware implementations and the identity boundary. |
| `server/adapters/betterAuthSessions.ts`      | `betterAuthSessions(getSession, getProviderAccounts?)`: a session provider from Better Auth lookups.                                                                                                                        |
| `server/origin.ts`                           | `trustedOrigins({ allow, missing })`: an exact Origin allowlist.                                                                                                                                                            |
| `server/local.ts`                            | `localRpcGuard`, `loopbackOnly`, `sameOrigin`, `trustedProxyPeer`: loopback and proxy guards.                                                                                                                               |
| `server/trustedProxyRanges.ts`               | `trustedProxyRanges(trustedProxy?)`: normalized proxy ranges.                                                                                                                                                               |
| `server/proxyRanges.ts`                      | `proxyRanges(value)`: parse configured proxy ranges.                                                                                                                                                                        |
| `server/transportHeaders.ts`                 | `transportHeaders(rpcHeaders)`: the headers used for a transport-level decision.                                                                                                                                            |
| `server/tracing.ts`                          | `requestTracingLayer({ header?, sensitive? })`: the `RequestTracing` implementation.                                                                                                                                        |
| `server/sessionKeys.ts`                      | `resolveChanges`: session-scoped change subscriptions for custom change handlers.                                                                                                                                           |
| `server/commandChanges.ts`                   | `commandChanges(effect, rpc, payload)`: scoped command invalidation for custom authentication middleware.                                                                                                                   |
| `server/better-auth/mount.ts`                | `betterAuthMount(options, { emails?, signIn?, bearerSessions?, roles?, defaultRole?, roleSeed? })`, returning `{ auth, routes, sessions, admittedSessions, revokeUnadmitted }`: native auth routes and the sign-in policy.  |
| `server/better-auth/adapters/database.ts`    | `betterAuthDatabase()`: Better Auth storage on the application PostgreSQL client.                                                                                                                                           |
| `server/better-auth/emails.ts`               | `AuthEmail`, `BetterAuthEmails`: typed delivery messages, app routes and per-account delivery windows for the mount.                                                                                                        |
| `server/better-auth/allowedAccounts.ts`      | `ProviderAccounts`, `AllowedAccounts`, `allowedAccounts`: provider-account list Schemas and the non-empty `AUTH_ALLOWED_ACCOUNTS` Config.                                                                                   |
| `server/better-auth/accountRoleSeed.ts`      | `accountRoleSeed(access, role, accounts)`: grant a configured role at boot and sign-in through `assignRole`.                                                                                                                |
| `server/better-auth/signInGate.ts`           | `SignInPolicy`: the `accounts`, `rule` and `recheckInterval` of a sign-in policy.                                                                                                                                           |
| `server/better-auth/revokeUnadmitted.ts`     | `RevokedSessions`: the `{ users, sessions }` counts of a revocation.                                                                                                                                                        |
| `server/better-auth/userProfiles.ts`         | Public profile lookups for other users.                                                                                                                                                                                     |
| `server/better-auth/sweepExpiredSessions.ts` | `sweepExpiredSessions`: delete expired sessions through the application's SQL client and return the number removed.                                                                                                         |
| `server/better-auth/userReference.ts`        | `userReference`: the default auth user table and id column for application foreign keys.                                                                                                                                    |
| `server/better-auth/testDatabase.ts`         | `authTestDatabase`: test-only identity/session readouts and faults for the default PostgreSQL auth schema.                                                                                                                  |
| `server/better-auth/testing.ts`              | `signedInUser(auth, fields)`, `passwordUser(auth, fields)`, `storedProviderAccounts(auth, userId)`: test-only users, minted sessions and credential storage observations.                                                   |

### Install, setup and limits

Install `@shivaedev/identity` with `effect` as its peer. Everything outside `server/better-auth/` works with only `effect` installed, including the Promise-based `betterAuthSessions` adapter. Better Auth mounts and test fixtures need the optional peer `better-auth` and the application’s PostgreSQL `SqlClient`; `sweepExpiredSessions` needs only the application's Effect SQL client. Browser code imports only `identity.ts`, `middleware.ts` and `permission.ts`.
- The package needs Node 24 or newer.
- Keep the auth provider's configuration, cookie settings and resource authorization in the application. The session adapter takes a session lookup and an optional provider-account lookup and returns a session result; it does not write provider refresh cookies into RPC responses.
- Without an `HttpServerRequest`, `transportHeaders` falls back to the supplied RPC headers. An application using another transport must decide what headers it can trust.
- When composing a native RPC server directly, add `RequestTracing` last on the group so it wraps authentication too; see the [native-server example](https://github.com/ShivaeDev/platform/blob/main/docs/framework/request-context.md#request-id-identity-and-logging). Middleware outside that tracing boundary is responsible for its own diagnostics.

The [framework request-context guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/request-context.md) explains the browser and native-client Origin choices.
