import { Context, type Effect } from "effect";
import type { Socket } from "effect/socket";

export class GatewayTransport extends Context.Service<
	GatewayTransport,
	{
		readonly open: (url: string) => Effect.Effect<Socket.Socket>;
	}
>()("@shivaedev/discord/GatewayTransport") {}
