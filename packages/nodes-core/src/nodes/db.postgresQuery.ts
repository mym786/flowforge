import { defineNode } from "@flowforge/sdk";
import { z } from "zod";
import pg from "pg";

export default defineNode({
  kind: "action",
  name: "db.postgresQuery",
  version: "1.0.0",
  inputs: ["in"],
  outputs: ["out","error"],
  schema: z.object({
    query: z.string(),
    params: z.array(z.any()).default([])
  }),
  async execute(ctx, cfg){
    const creds = ctx.credentials?.postgres;
    if (!creds) throw new Error("Missing postgres credentials scope");
    const pool = new pg.Pool({ connectionString: creds.url });
    try{
      const r = await pool.query(cfg.query, cfg.params);
      await pool.end();
      return { output: { rows: r.rows, rowCount: r.rowCount }, next: { out: true } };
    }catch(e:any){
      await pool.end();
      ctx.log("error","pg query error",{ error: e?.message });
      return { output: { error: String(e) }, next: { error: true } };
    }
  }
});
