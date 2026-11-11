const DEEP = "4 deep checks (biome scanner half, effect/boundary typed half, effect/service-parameters, suppressions/no-double-cast typed half)";

export const FAST_RUN = `quality: fast run skipped ${DEEP}; CI runs them. Run \`quality lint --full\` to check now.`;
export const FULL_RUN = `quality: full run ran ${DEEP}.`;
