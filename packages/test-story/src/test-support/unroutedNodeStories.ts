import { containedNode } from "./outboundNetwork.ts";

containedNode.it("handles an unrouted provider request", [], function* ({ requestsProvider }) {
	yield* requestsProvider();
});
