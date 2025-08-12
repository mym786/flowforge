import { Worker, Job } from "bullmq";
import pino from "pino";
import { PrismaClient } from "@prisma/client";
import { WorkflowSchema, expBackoff, redactSecrets } from "@flowforge/common";
import * as nodesCore from "@flowforge/nodes-core";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const prisma = new PrismaClient();
const connection = { connection: { host: process.env.REDIS_HOST || "redis", port: Number(process.env.REDIS_PORT||6379) } };

type Registry = Record<string, any>;
const registry: Registry = {};
function registerModule(mod: any){ const spec = mod.default || mod; registry[spec.name] = spec; }
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

function topoSort(nodes: any[], edges: any[]) {
  const incoming = new Map<string, number>();
  for (const n of nodes) incoming.set(n.id, 0);
  for (const e of edges) incoming.set(e.to.node, (incoming.get(e.to.node)||0) + 1);
  const q = nodes.filter(n=> (incoming.get(n.id)||0)===0);
  const order: any[] = [];
  while (q.length) {
    const n = q.shift()!;
    order.push(n);
    for (const e of edges.filter(x=>x.from.node===n.id)) {
      const v = e.to.node;
      incoming.set(v, (incoming.get(v)||0) - 1);
      if ((incoming.get(v)||0)===0) q.push(nodes.find(x=>x.id===v)!);
    }
  }
  return order;
}

async function runNode(spec: any, node: any, input: any, abortSignal: AbortSignal) {
  const logs: any[] = [];
  const ctx = {
    env: process.env,
    signal: abortSignal,
    log: (level: any, msg: string, data?: any)=>{ logs.push({ ts: new Date().toISOString(), level, msg, data: redactSecrets(data) }); },
    fetch,
    credentials: {}, // TODO: scope per node
    checkpoint: async (_:any)=>{},
    getCheckpoint: async ()=>null
  };
  let attempt = 0;
  const maxAttempts = node.retry?.maxAttempts ?? 0;
  const base = node.retry?.backoffMs ?? 1000;
  while(true){
    try{
      const res = await spec.execute(ctx as any, node.config, input);
      return { res, logs };
    }catch(e:any){
      attempt++;
      ctx.log("warn","node failed attempt",{ attempt, error: e?.message });
      if (attempt>maxAttempts) throw { error: e, logs };
      const delay = node.retry?.backoffStrategy==="fixed" ? base : expBackoff(attempt, base);
      await new Promise(res=>setTimeout(res, delay));
    }
  }
}

const worker = new Worker("runs", async (job: Job)=>{
  const { workflowId, runId, input } = job.data;
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) throw new Error("workflow not found");
  const def = WorkflowSchema.parse(wf.definition);
  await prisma.run.update({ where: { id: runId }, data: { status: "RUNNING", startedAt: new Date() } });
  const order = topoSort(def.nodes, def.edges);
  const results: Record<string,any> = {};
  for (const node of order){
    const spec = registry[node.type];
    if (!spec) throw new Error("unknown node: " + node.type);
    const inEdges = def.edges.filter(e=>e.to.node===node.id);
    const upstream = inEdges.length===0 ? input : results[inEdges[0].from.node];
    const ctrl = new AbortController();
    const timeout = setTimeout(()=>ctrl.abort("timeout"), node.timeoutMs ?? 60000);
    const { res, logs } = await runNode(spec, node, upstream, ctrl.signal).catch(async (err)=>{
      clearTimeout(timeout);
      await prisma.run.update({ where: { id: runId }, data: { status: "FAILED", finishedAt: new Date(), error: String(err.error||err) } });
      throw err;
    });
    clearTimeout(timeout);
    results[node.id] = res.output;
    await prisma.run.update({ where: { id: runId }, data: { logs: logs } });
  }
  await prisma.run.update({ where: { id: runId }, data: { status: "SUCCEEDED", finishedAt: new Date(), output: results } });
  return { ok: true };
}, connection);

worker.on("completed", (job)=> logger.info({ jobId: job.id }, "run completed"));
worker.on("failed", (job, err)=> logger.error({ jobId: job?.id, err }, "run failed"));
