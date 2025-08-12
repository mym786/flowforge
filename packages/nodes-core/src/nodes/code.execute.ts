import { defineNode } from "@flowforge/sdk";
import { z } from "zod";
import ivm from "isolated-vm";

export default defineNode({
  kind: "action",
  name: "code.execute",
  version: "1.0.0",
  inputs: ["in"],
  outputs: ["out","error"],
  schema: z.object({
    code: z.string(), // async function main(ctx, input) { ...; return { foo: 1 } }
    timeoutMs: z.number().int().min(100).max(60000).default(5000)
  }),
  async execute(ctx, cfg, input){
    const isolate = new ivm.Isolate({ memoryLimit: 64 }); // MB
    const context = await isolate.createContext();
    const jail = context.global;
    await jail.set("global", jail.derefInto());
    const bootstrap = `
      function __run(userCode, payload) {
        const module = { exports: {} };
        const exports = module.exports;
        // eslint-disable-next-line no-new-func
        const fn = new Function("module","exports", userCode);
        fn(module, exports);
        if (typeof module.exports.main !== "function") throw new Error("Export an async function main(ctx, input)");
        return module.exports.main(payload.ctx, payload.input);
      }
    `;
    await context.eval(bootstrap);
    const run = await context.global.get("__run");
    const script = cfg.code;
    const res = await run.apply(undefined, [ script, { ctx: { env: ctx.env }, input } ], { timeout: cfg.timeoutMs } as any).catch((e:any)=>({ __error: String(e) }));
    if (res && !res.__error) {
      ctx.log("info", "code.execute ok");
      return { output: res, next: { out: true } };
    } else {
      ctx.log("error", "code.execute error", { error: res.__error });
      return { output: { error: res.__error }, next: { error: true } };
    }
  }
});
