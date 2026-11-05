import { Layer } from "effect";
import { Digest, SecureRandom } from "effect/crypto";

export const clientCrypto = Layer.merge(SecureRandom.layerWebCrypto, Digest.layerWebCrypto);
