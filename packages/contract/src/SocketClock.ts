import { Clock, Context } from "effect";

export const SocketClock = Context.Reference<Clock.Clock>("@shivaedev/contract/SocketClock", {
	defaultValue: () => Clock.Clock.defaultValue(),
});
