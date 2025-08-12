import { PrismaClient } from "@prisma/client";
import { WorkflowSchema } from "@flowforge/common";

const prisma = new PrismaClient();

async function main(){
  const demo: any = {
    nodes: [
      { id: "cron1", type: "trigger.cron", inputs: [], outputs: ["tick"], config: { cron: "* * * * *", timezone: "UTC" } },
      { id: "http1", type: "http.request", inputs: ["in"], outputs: ["success","error"], config: { method:"GET", url:"https://httpbin.org/get" } },
      { id: "delay1", type: "util.delay", inputs: ["in"], outputs:["out"], config: { ms: 500 } },
      { id: "code1", type: "code.execute", inputs: ["in"], outputs:["out","error"], config: { code: "module.exports.main = async (ctx, input)=>({ ping: 'pong', got: input?.data });" } }
    ],
    edges: [
      { id:"e1", from:{node:"cron1",port:"tick"}, to:{node:"http1",port:"in"} },
      { id:"e2", from:{node:"http1",port:"success"}, to:{node:"delay1",port:"in"} },
      { id:"e3", from:{node:"delay1",port:"out"}, to:{node:"code1",port:"in"} }
    ],
    concurrency: 5
  };
  WorkflowSchema.parse(demo);
  await prisma.workflow.upsert({
    where: { slug: "demo-cron-http" },
    create: { name: "Demo Cron -> HTTP -> Delay -> Code", slug: "demo-cron-http", definition: demo },
    update: { definition: demo }
  });
  console.log("Seeded demo workflow.");
}
main().finally(()=>prisma.$disconnect());
