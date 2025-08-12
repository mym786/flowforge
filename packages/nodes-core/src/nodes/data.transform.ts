import { defineNode } from "@flowforge/sdk";
import { z } from "zod";

export default defineNode({
  kind: "action",
  name: "data.transform",
  version: "1.0.0",
  inputs: ["in"],
  outputs: ["out"],
  schema: z.object({
    op: z.enum(["map","filter"]).default("map"),
    expression: z.string() // JS expression using item
  }),
  async execute(ctx, cfg, input){
    const arr = Array.isArray(input) ? input : (Array.isArray(input?.items) ? input.items : []);
    const fn = new Function("item","index","return (" + cfg.expression + ")");
    const out = cfg.op==="map" ? arr.map((x,i)=>fn(x,i)) : arr.filter((x,i)=>!!fn(x,i));
    return { output: out, next: { out: true } };
  }
});
