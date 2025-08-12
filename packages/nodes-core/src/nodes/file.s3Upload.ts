import { defineNode } from "@flowforge/sdk";
import { z } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export default defineNode({
  kind: "action",
  name: "file.s3Upload",
  version: "1.0.0",
  inputs: ["in"],
  outputs: ["out","error"],
  schema: z.object({
    bucket: z.string(),
    key: z.string(),
    content: z.union([z.string(), z.instanceof(Uint8Array).optional().transform(()=>null)]).or(z.any()),
    contentType: z.string().default("application/octet-stream")
  }),
  async execute(ctx, cfg){
    const creds = ctx.credentials?.s3;
    if (!creds) throw new Error("Missing s3 credentials scope");
    const s3 = new S3Client({
      region: creds.region || "us-east-1",
      endpoint: creds.endpoint,
      forcePathStyle: true,
      credentials: creds.accessKeyId ? { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey } : undefined
    });
    try{
      const body = typeof cfg.content === "string" ? Buffer.from(cfg.content) : (cfg.content?.data ? Buffer.from(cfg.content.data) : Buffer.from(JSON.stringify(cfg.content)));
      const out = await s3.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: cfg.key, Body: body, ContentType: cfg.contentType }));
      return { output: { etag: out.ETag }, next: { out: true } };
    } catch(e:any){
      ctx.log("error","s3 upload error",{ error: e?.message });
      return { output: { error: String(e) }, next: { error: true } };
    }
  }
});
