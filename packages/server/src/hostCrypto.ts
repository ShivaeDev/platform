import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Layer } from "effect";
import { ColumnKey } from "@shivaedev/sql/ColumnKey.ts";

// The column key reads COLUMN_ENCRYPTION_KEY only when an encrypted field is first sealed or opened, so a host without encrypted fields needs no key.
export const hostCrypto = Layer.merge(NodeCrypto.layer, ColumnKey.fromConfig);
