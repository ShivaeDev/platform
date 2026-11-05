---
"@shivaedev/vitest-rerun": minor
---

### Breaking

- Import `VitestRunner` from `/vitest-runner/service.ts` instead of `/adapters/VitestRunner.ts`, and provide `vitestRunnerLayer` from `/vitest-runner/layer.ts` instead of `VitestRunner.layer` to use the package’s Vitest runtime. Hosts using the service-only `VitestRunner.layer` must now provide `VitestRuntime` from `/VitestRuntime.ts`. Import `Selection` and `AttemptRunner` from `/VitestRuntime.ts` instead of `/adapters/VitestRunner.ts`, and `RunOptions` from `/VitestRuntime.ts` instead of `/adapters/open.ts`.
