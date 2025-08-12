import { defineNode } from "@flowforge/sdk";
import { z } from "zod";
import nodemailer from "nodemailer";

export default defineNode({
  kind: "action",
  name: "email.smtpSend",
  version: "1.0.0",
  inputs: ["in"],
  outputs: ["sent","error"],
  schema: z.object({
    from: z.string(),
    to: z.string(),
    subject: z.string(),
    text: z.string().optional(),
    html: z.string().optional()
  }),
  async execute(ctx, cfg){
    const creds = ctx.credentials?.smtp;
    if (!creds) throw new Error("Missing smtp credentials scope");
    const transporter = nodemailer.createTransport({
      host: creds.host, port: creds.port, secure: creds.secure,
      auth: creds.user ? { user: creds.user, pass: creds.password } : undefined
    });
    try{
      const info = await transporter.sendMail({ from: cfg.from, to: cfg.to, subject: cfg.subject, text: cfg.text, html: cfg.html });
      ctx.log("info","email sent",{ messageId: info.messageId });
      return { output: { messageId: info.messageId }, next: { sent: true } };
    } catch(e:any){
      ctx.log("error","email failed",{ error: e?.message });
      return { output: { error: String(e) }, next: { error: true } };
    }
  }
});
