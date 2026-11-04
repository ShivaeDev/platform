import { Schema } from "effect";
import { contract } from "#contract.ts";
import { stream } from "#operation.ts";

export const HostVersion = contract("platform.hostVersion", {
	streams: [stream("watch", { reads: () => [], success: Schema.String })],
});
