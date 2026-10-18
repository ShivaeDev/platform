### Breaking

- Every module's import path is now its path under `src/`, and `server/internal/` stays private. Server modules gain a `server/` prefix and keep their file names, for example `server/adapter.ts`, `server/EffectProcedureBuilder.ts`, `server/rejectionFormatter.ts`, `server/requestServices.ts`, `server/RequestSignal.ts` and `server/testing/AnyTestLayer.ts`. `client/rejection.ts` becomes `rejectionDecoding.ts`.
