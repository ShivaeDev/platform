import { Data } from "effect";

export class TrustedProxyRequired extends Data.TaggedError("TrustedProxyRequired") {
	override readonly message =
		"A non-loopback session host requires proxy trust. Set TRUSTED_PROXY to your proxy's peer IP addresses or CIDR ranges, or set config.trustedProxy. The starter's Railway configuration supplies TRUSTED_PROXY automatically.";
}
