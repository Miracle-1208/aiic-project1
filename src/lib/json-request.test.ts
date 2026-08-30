import { describe, expect, it } from "vitest";

import { serializeJsonRequestBody } from "./json-request";

describe("JSON request serialization", () => {
  it("remains valid when the HTTP bridge inserts four bytes before the body", () => {
    const payload = {
      role: "品牌公关",
      industry: "新茶饮",
      companyType: "连锁消费品牌",
      category: "危机决策",
      timeMinutes: 10,
    };
    const serialized = serializeJsonRequestBody(payload);
    const declaredLength = new TextEncoder().encode(serialized).byteLength;
    const bytesOnWire = new TextEncoder().encode(`\r\n\r\n${serialized}`);
    const bytesReadByServer = bytesOnWire.slice(0, declaredLength);

    expect(JSON.parse(new TextDecoder().decode(bytesReadByServer))).toEqual(payload);
  });

  it("is still valid JSON on a normal browser connection", () => {
    const payload = { userText: "先建立共同标准，再回应两方分歧" };

    expect(JSON.parse(serializeJsonRequestBody(payload))).toEqual(payload);
  });
});
