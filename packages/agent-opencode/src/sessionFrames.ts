import { Option, Schema } from "effect";
import { GlobalFrame, SessionScoped } from "#protocol.ts";

const decodeFrame = Schema.decodeUnknownOption(GlobalFrame);
const decodeScoped = Schema.decodeUnknownOption(SessionScoped);
const decodeMessage = Schema.decodeUnknownOption(Schema.Struct({ info: SessionScoped }));
const decodePart = Schema.decodeUnknownOption(Schema.Struct({ part: SessionScoped }));
function sessionOf(properties: unknown) {
	return decodeScoped(properties).pipe(
		Option.orElse(() => Option.map(decodeMessage(properties), ({ info }) => info)),
		Option.orElse(() => Option.map(decodePart(properties), ({ part }) => part)),
	);
}
export interface SessionFrame {
	readonly properties?: unknown;
	readonly type: string;
}
export function frameFor(sessionId: string, frame: unknown): Option.Option<SessionFrame> {
	return Option.flatMap(decodeFrame(frame), ({ payload }) =>
		Option.match(sessionOf(payload.properties), {
			onNone: () => Option.none(),
			onSome: (scoped) => (scoped.sessionID === sessionId ? Option.some(payload) : Option.none()),
		}),
	);
}
