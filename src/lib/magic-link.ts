import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email/service";
import { emailTemplates, renderTemplate } from "@/lib/email/templates";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";

export async function sendSetPasswordLink(params: {
  userId: string;
  email: string;
  userName: string;
  organizationName?: string;
}): Promise<boolean> {
  const { userId, email, userName, organizationName } = params;

  const token = crypto.randomUUID();

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  await prisma.verification.create({
    data: {
      identifier: `set-password:${userId}`,
      value: token,
      expiresAt,
    },
  });

  const baseUrl = getBaseUrl();
  const setPasswordUrl = `${baseUrl}/set-password/${token}`;

  try {
    const subject = renderTemplate(emailTemplates.setPassword.subject, {});
    const html = renderTemplate(emailTemplates.setPassword.html, {
      userName,
      organizationName: organizationName || "Asset Tracker",
      setPasswordUrl,
    });

    const result = await sendEmail({ to: email, subject, html });
    if (!result.success) {
      logger.warn("Failed to send set-password email", {
        userId,
        error: result.error,
      });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("Failed to send set-password email", { userId, error });
    return false;
  }
}
