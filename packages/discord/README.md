# @shivaedev/discord

Discord bot REST calls and gateway sessions for Effect applications. Keep tokens, failures and connection lifetimes in Effect instead of carrying a second asynchronous runtime in each app.

## Talk to Discord from your application

Send a message through the bot REST client and decode its response with your schema. The client waits when Discord rate limits the request.

```ts
import { Schema } from "effect";
import { request } from "@shivaedev/discord/request.ts";

const posted = request("POST", "/channels/123/messages", Schema.Struct({ id: Schema.String }), { content: "The release is ready." });
```

## Use the clients

REST and gateway are independent services sharing a redacted `DiscordToken`. Provide only the service your application uses. Application channel choices, message rendering, permissions and event handlers stay in the application.

### Bot REST

Provide `DiscordRest.layer`, a native `HttpClient` and the token:

```ts
import { Layer, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";
import { DiscordRest } from "@shivaedev/discord/DiscordRest.ts";
import { DiscordToken } from "@shivaedev/discord/DiscordToken.ts";

const restLayer = DiscordRest.layer.pipe(
	Layer.provide(FetchHttpClient.layer),
	Layer.provide(Layer.succeed(DiscordToken)(Redacted.make("bot-token"))),
);
```

`request(method, path, schema, body?)` reads the service and decodes the result. `DiscordRest.request(method, path, body?)` returns decoded JSON as `unknown`; a 204 response returns `undefined`. Paths start with `/` and are relative to Discord's API v10 base. Request bodies use native HTTP JSON encoding, and response reads use `@shivaedev/http` with a 1 MiB limit.

One service instance serializes calls for its bot. It tracks Discord's bucket ids, major channel/guild identifiers, remaining count and relative reset time. An exhausted bucket delays the next matching call. A 429 reads Discord's `retry_after` seconds and `global` flag, releases the response, waits on Effect's clock and retries up to three times. Exhaustion fails with `DiscordRateLimited`, carrying the final delay in seconds. Transport failures become `DiscordTransportError`; other HTTP statuses retain `@shivaedev/http`'s typed failures. Schema decoding failures remain in the error channel.

### Gateway sessions

Provide `DiscordGateway.layer`, the same token, `DiscordConfig` with your intents and `webSocketLayer` from `adapters/webSocketLayer.ts`. `DiscordConfig` defaults to Discord's API and gateway endpoints with zero intents; overriding it supplies all three fields: `apiUrl`, `gatewayUrl` and `intents`.

```ts
import { Effect } from "effect";
import { DiscordGateway } from "@shivaedev/discord/DiscordGateway.ts";

const listen = Effect.gen(function* () {
	const gateway = yield* DiscordGateway;
	yield* gateway.run((event) => Effect.log(event.type, event.data));
});
```

`run(handler)` owns a scoped connection until interrupted or failed. Dispatches expose `type`, `sequence` and `data`; applications decode event data with their schemas. A dropped connection waits one second, reconnects to the resume URL and sends the retained session id and last sequence. An invalid session starts a fresh identify. Fatal token and configuration closes fail with `DiscordGatewayClosed`, carrying the close code. Interruption releases the socket. Malformed gateway envelopes fail with `DiscordGatewayProtocolError`.

### Story kits and installation

The stateful provider fake is shipped by `@shivaedev/test-kits/discord/fake.ts`, outside the runtime package. Acquire `fakeDiscord()` in a scope: `server` is a loopback HTTP provider with message creation, editing, history and deletion; `gateway.transport` supplies the native socket boundary. Its controls can dispatch events, drop connections or invalidate sessions. Resume replays events emitted while disconnected. Compose it into your application's story kit and keep the real Discord services running.

Install `@shivaedev/discord` and `effect`. The built-in socket adapter uses the runtime's global WebSocket. This client runs a single gateway session; sharding and application-specific MCP tools belong to their consumers.
