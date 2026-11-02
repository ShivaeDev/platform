import { containedNode } from "./outboundNetwork.ts";

containedNode.it("handles an unrouted provider request", [], function* ({ requestsProvider }) {
	yield* requestsProvider();
});

containedNode.it("handles an unrouted provider after a passthrough registration", [], function* ({ allowsPassthrough, requestsProvider }) {
	yield* allowsPassthrough();
	yield* requestsProvider();
});
