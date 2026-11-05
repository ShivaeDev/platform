import { Context, type Ref } from "effect";

export class Shared extends Context.Service<Shared, { readonly build: number; readonly computations: Ref.Ref<number> }>()(
	"@shivaedev/server/test/request/Shared",
) {}
