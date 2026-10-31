type Joined<TUnion> = (TUnion extends unknown ? (value: TUnion) => void : never) extends (value: infer TJoined) => void ? TJoined : never;

// Spreading verb modules lets a later module silently replace an earlier verb of the same name; joining them refuses the collision instead.
export function distinctVerbs<const TModules extends readonly object[]>(...modules: TModules): Joined<TModules[number]>;
export function distinctVerbs(...modules: readonly object[]) {
	const joined = {};
	for (const module of modules) {
		for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(module))) {
			if (Object.hasOwn(joined, name)) {
				throw new Error(`Two story verb modules both define ${name}; rename one of them`);
			}
			Object.defineProperty(joined, name, descriptor);
		}
	}
	return joined;
}
