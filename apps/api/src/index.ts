import Fastify from "fastify";
import ws from "fastify-websocket";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { Queue, Worker, QueueEvents, JobsOptions } from "bullmq";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import pino from "pino";
import { WorkflowSchema, redactSecrets } from "@flowforge/common";
import * as nodesCore from "@flowforge/nodes-core";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const app = Fastify({ logger });
await app.register(cors, { origin: true });
await app.register(swagger, { openapi: { info: { title: "FlowForge API", version: "0.1.0" } } as any });
await app.register(swaggerUI, { routePrefix: "/docs" });
await app.register(ws);

const prisma = new PrismaClient();

const connection = { connection: { host: process.env.REDIS_HOST || "redis", port: Number(process.env.REDIS_PORT||6379) } };
const queue = new Queue("runs", connection);
const qevents = new QueueEvents("runs", connection);

type WSClient = { send: (data: string)=>void };
const runSockets = new Map<string, Set<WSClient>>();

app.get("/api/health", async ()=>({ ok: true }));
app.get("/metrics", async ()=>"# HELP flowforge_dummy 1\n# TYPE flowforge_dummy counter\nflowforge_dummy 1\n");

app.register(async (r)=>{
  // WebSocket for run events
  r.get("/ws/runs/:id", { websocket: true }, (conn, req)=>{
    const id = (req.params as any).id;
    if (!runSockets.has(id)) runSockets.set(id, new Set());
    runSockets.get(id)!.add(conn.socket as any);
    conn.socket.on("close", ()=> runSockets.get(id)?.delete(conn.socket as any));
  });
});

function emitRun(id: string, evt: any){
  const set = runSockets.get(id);
  if (!set) return;
  const payload = JSON.stringify(evt);
  for (const c of set) { try { c.send(payload); } catch {} }
}

const WorkflowBody = z.object({
  name: z.string(),
  slug: z.string(),
  definition: WorkflowSchema
});

app.get("/api/workflows", async (_req, reply)=>{
  const list = await prisma.workflow.findMany({ orderBy: { createdAt: "desc" } });
  reply.send(list);
});

app.get("/api/workflows/:id", async (req, reply)=>{
  const id = (req.params as any).id;
  const wf = await prisma.workflow.findUnique({ where: { id } });
  if (!wf) return reply.code(404).send({ error: "Not found" });
  reply.send(wf);
});

app.post("/api/workflows", async (req, reply)=>{
  const body = WorkflowBody.parse(req.body);
  const wf = await prisma.workflow.create({ data: { ...body } });
  await prisma.auditEvent.create({ data: { action: "workflow.create", entity: "workflow", entityId: wf.id } });
  reply.code(201).send(wf);
});

app.put("/api/workflows/:id", async (req, reply)=>{
  const id = (req.params as any).id;
  const body = WorkflowBody.partial().parse(req.body);
  const wf = await prisma.workflow.update({ where: { id }, data: { ...body } });
  await prisma.auditEvent.create({ data: { action: "workflow.update", entity: "workflow", entityId: wf.id } });
  reply.send(wf);
});

app.delete("/api/workflows/:id", async (req, reply)=>{
  const id = (req.params as any).id;
  await prisma.workflow.delete({ where: { id } });
  await prisma.auditEvent.create({ data: { action: "workflow.delete", entity: "workflow", entityId: id } });
  reply.code(204).send();
});

// Credentials: encrypted at rest (libsodium)
import sodium from "libsodium-wrappers";
await sodium.ready;
const KMS_KEY = Buffer.from((process.env.KMS_KEY || "dev_only_32bytes_key_dev_only_").slice(0,32));

function encrypt(obj: any){
  const nonce = randomBytes(sodium.crypto_secretbox_NONCEBYTES);
  const cipher = sodium.crypto_secretbox_easy(Buffer.from(JSON.stringify(obj)), nonce, KMS_KEY);
  return Buffer.concat([nonce, Buffer.from(cipher)]);
}
function decrypt(buf: Buffer){
  const nonce = buf.subarray(0, sodium.crypto_secretbox_NONCEBYTES);
  const box = buf.subarray(sodium.crypto_secretbox_NONCEBYTES);
  const msg = sodium.crypto_secretbox_open_easy(box, nonce, KMS_KEY);
  return JSON.parse(Buffer.from(msg).toString("utf8"));
}

app.post("/api/credentials", async (req, reply)=>{
  const schema = z.object({ name: z.string(), type: z.string(), data: z.any() });
  const { name, type, data } = schema.parse(req.body);
  const id = (await prisma.credential.create({ data: { name, type, dataEnc: encrypt(data) } })).id;
  await prisma.auditEvent.create({ data: { action: "credential.create", entity: "credential", entityId: id } });
  reply.code(201).send({ id, name, type });
});

app.get("/api/credentials", async (_req, reply)=>{
  const list = await prisma.credential.findMany();
  reply.send(list.map(c=>({ id: c.id, name: c.name, type: c.type })));
});

app.post("/api/credentials/:id/test", async (req, reply)=>{
  const id = (req.params as any).id;
  const cred = await prisma.credential.findUnique({ where: { id } });
  if (!cred) return reply.code(404).send({ error: "Not found" });
  // Dummy test hook; in real impl we'd test per type
  reply.send({ ok: true });
});

// Simple plugin registry (runtime load from nodes-core + /plugins)
const registry: Record<string, any> = {};
function registerModule(mod: any){
  const spec = mod.default || mod;
  registry[spec.name] = spec;
}
registerModule(await import("@flowforge/nodes-core/src/nodes/http.request.js"));
registerModule(await import("@flowforge/nodes-core/src/nodes/code.execute.js"));
registerModule(await import("@flowforge/nodes-core/src/nodes/email.smtpSend.js"));
registerModule(await import("@flowforge/nodes-core/src/nodes/db.postgresQuery.js"));
registerModule(await import("@flowforge/nodes-core/src/nodes/file.s3Upload.js"));
registerModule(await import("@flowforge/nodes-core/src/nodes/data.transform.js"));
registerModule(await import("@flowforge/nodes-core/src/nodes/trigger.cron.js"));
registerModule(await import("@flowforge/nodes-core/src/nodes/trigger.webhook.js"));
registerModule(await import("@flowforge/nodes-core/src/nodes/queue.redis.js"));
registerModule(await import("@flowforge/nodes-core/src/nodes/util.delay.js"));

app.get("/api/plugins", async ()=> Object.keys(registry));

// Webhook endpoint: /webhook/:workflowId/:token
app.post("/webhook/:workflowId/:token", async (req, reply)=>{
  const { workflowId, token } = req.params as any;
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) return reply.code(404).send({ error: "wf not found" });
  // token validation: HMAC of id using KMS_KEY (dev)
  const mac = createHash("sha256").update(wf.id + String(process.env.WEBHOOK_SALT || "salt")).digest();
  const ok = timingSafeEqual(Buffer.from(token, "hex"), mac.subarray(0,16));
  if (!ok) return reply.code(401).send({ error: "invalid token" });
  const input = await req.body;
  const job = await queue.add("run", { workflowId: wf.id, input, trigger: "webhook" }, { removeOnComplete: 100, removeOnFail: 100 });
  reply.send({ queued: true, jobId: job.id });
});

// Execute endpoint
app.post("/api/execute/:id", async (req, reply)=>{
  const id = (req.params as any).id;
  const wf = await prisma.workflow.findUnique({ where: { id } });
  if (!wf) return reply.code(404).send({ error: "wf not found" });
  const input = (req.body as any)?.input;
  const run = await prisma.run.create({ data: { workflowId: id, status: "PENDING", input } });
  const job = await queue.add("run", { workflowId: id, runId: run.id, input }, { removeOnComplete: 100, removeOnFail: 100 });
  reply.send({ queued: true, jobId: job.id, runId: run.id });
});

// List runs for a workflow
app.get("/api/workflows/:id/runs", async (req, reply)=>{
  const id = (req.params as any).id;
  const runs = await prisma.run.findMany({ where: { workflowId: id }, orderBy: { createdAt: "desc" } as any });
  reply.send(runs);
});

// Minimal worker inside API to stream events (real worker is in apps/worker)
qevents.on("completed", ({ jobId, returnvalue })=>{
  emitRun(jobId, { type: "completed", data: returnvalue });
});
qevents.on("failed", ({ jobId, failedReason })=>{
  emitRun(jobId, { type: "failed", error: failedReason });
});

const port = Number(process.env.PORT || 3000);
app.listen({ host: "0.0.0.0", port }).then(()=>{
  logger.info({ port }, "API listening");
});
