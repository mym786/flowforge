import { defineNode } from "@flowforge/sdk";
import { z } from "zod";

export default defineNode({
  kind: "action",
  name: "http.request",
  version: "1.0.0",
  inputs: ["in"],
  outputs: ["success","error"],
  schema: z.object({
    method: z.string().default("GET"),
    url: z.string().url(),
    headers: z.record(z.string()).default({}),
    body: z.any().optional(),
    responseType: z.enum(["json","text","raw"]).default("json"),
    timeoutMs: z.number().int().min(0).default(60000)
  }),
  async execute(ctx, cfg, input){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort("timeout"), cfg.timeoutMs);
    try{
      const res = await ctx.fetch(cfg.url, {
        method: cfg.method,
        headers: cfg.headers,
        body: ["GET","HEAD"].includes(cfg.method.toUpperCase())?undefined:(typeof cfg.body==="string"?cfg.body:JSON.stringify(cfg.body)),
        signal: ctrl.signal
      });
      const data = cfg.responseType==="json" ? await res.json().catch(()=>null)
                 : cfg.responseType==="text" ? await res.text()
                 : await res.arrayBuffer();
      ctx.log("info", "http.request completed", { status: res.status });
      return { output: { status: res.status, headers: Object.fromEntries(res.headers.entries()), data }, next: { success: res.ok, error: !res.ok } };
    } catch(e:any){
      ctx.log("error","http.request failed",{ error: e?.message });
      return { output: { error: String(e) }, next: { error: true } };
    } finally { clearTimeout(t); }
  }
});
