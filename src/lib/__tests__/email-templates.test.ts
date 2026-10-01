import { describe, it, expect } from "vitest";
import { renderTemplate, renderTextTemplate } from "@/lib/email/templates";

describe("renderTemplate", () => {
  it("HTML-escapes substituted values", () => {
    const result = renderTemplate("<p>Hello {{name}}</p>", {
      name: "<script>alert(1)</script>",
    });

    expect(result).toBe("<p>Hello &lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(result).not.toContain("<script>");
  });
});

describe("renderTextTemplate", () => {
  it("does not escape substituted values", () => {
    const result = renderTextTemplate("Subject: {{name}}", {
      name: "Acme & Co <VIP>",
    });

    expect(result).toBe("Subject: Acme & Co <VIP>");
  });
});
