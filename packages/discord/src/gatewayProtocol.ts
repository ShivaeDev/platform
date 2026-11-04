import { Effect, Schema } from "effect";
import { Socket } from "effect/socket";
import { DiscordGatewayProtocolError } from "#errors.ts";

export const GatewayFrame = Schema.Struct({
	d: Schema.Unknown,
	op: Schema.Number,
	s: Schema.optional(Schema.NullOr(Schema.Number)),
	t: Schema.optional(Schema.NullOr(Schema.String)),
});
export type GatewayFrame = typeof GatewayFrame.Type;

export interface GatewayDispatch {
	readonly data: unknown;
	readonly sequence: number;
	readonly type: string;
}

export interface GatewaySession {
	resumeUrl: string | undefined;
	sequence: number | null;
	sessionId: string | undefined;
}

export function decodeFrame(frame: string | Uint8Array) {
	return Schema.decodeUnknownEffect(Schema.fromJsonString(GatewayFrame))(typeof frame === "string" ? frame : new TextDecoder().decode(frame)).pipe(
		Effect.mapError(() => new DiscordGatewayProtocolError({})),
	);
}

export const Hello = Schema.Struct({ heartbeatInterval: Schema.Number }).pipe(Schema.encodeKeys({ heartbeatInterval: "heartbeat_interval" }));
export const Ready = Schema.Struct({ resumeUrl: Schema.String, sessionId: Schema.String }).pipe(
	Schema.encodeKeys({ resumeUrl: "resume_gateway_url", sessionId: "session_id" }),
);

export function decodeData<TSchema extends Schema.ConstraintDecoder<unknown>>(schema: TSchema, data: unknown) {
	return Schema.decodeUnknownEffect(schema)(data).pipe(Effect.mapError(() => new DiscordGatewayProtocolError({})));
}

export function reconnect() {
	return Effect.fail(new Socket.SocketError({ reason: new Socket.SocketCloseError({ code: 4000 }) }));
}
