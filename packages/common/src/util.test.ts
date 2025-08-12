import { expect, test } from "vitest";
import { redactSecrets } from "./util";

test("redactSecrets masks secret fields", () => {
  const obj = { apiKey: "123", nested: { password: "abc", other: "ok" } };
  const redacted = redactSecrets(obj);
  expect(redacted.apiKey).toBe("****");
  expect(redacted.nested.password).toBe("****");
  expect(redacted.nested.other).toBe("ok");
});

test("redactSecrets handles circular references", () => {
  const obj: any = { token: "123" };
  obj.self = obj;
  const redacted = redactSecrets(obj);
  expect(redacted.self).toBe("[Circular]");
});
