import { Context } from "effect";

export class PotStorage extends Context.Service<PotStorage, { readonly tableName: string; readonly initialized: object[] }>()(
	"@shivaedev/sql/shared-pots/Storage",
) {}
