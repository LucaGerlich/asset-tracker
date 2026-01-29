import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { authConfig } from "./auth.config";

// Login schema validation
const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          // Validate input
          const { username, password } = loginSchema.parse(credentials);

          // Find user in database
          const user = await prisma.user.findUnique({
            where: { username },
            select: {
              userid: true,
              username: true,
              email: true,
              firstname: true,
              lastname: true,
              isadmin: true,
              canrequest: true,
              password: true,
              organizationId: true,
              departmentId: true,
            },
          });

          if (!user) {
            console.log("User not found:", username);
            // Audit failed login attempt
            await createAuditLog({
              userId: null,
              action: AUDIT_ACTIONS.LOGIN_FAILED,
              entity: AUDIT_ENTITIES.USER,
              entityId: null,
              details: { username, reason: "User not found" },
            });
            return null;
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(password, user.password);

          if (!isValidPassword) {
            console.log("Invalid password for user:", username);
            // Audit failed login attempt
            await createAuditLog({
              userId: user.userid,
              action: AUDIT_ACTIONS.LOGIN_FAILED,
              entity: AUDIT_ENTITIES.USER,
              entityId: user.userid,
              details: { username, reason: "Invalid password" },
            });
            return null;
          }

          // Audit successful login
          await createAuditLog({
            userId: user.userid,
            action: AUDIT_ACTIONS.LOGIN,
            entity: AUDIT_ENTITIES.USER,
            entityId: user.userid,
            details: { username },
          });

          // Return user object (password excluded)
          return {
            id: user.userid,
            name: `${user.firstname} ${user.lastname}`,
            email: user.email,
            username: user.username,
            isAdmin: user.isadmin,
            canRequest: user.canrequest,
            firstname: user.firstname,
            lastname: user.lastname,
            organizationId: user.organizationId || undefined,
            departmentId: user.departmentId || undefined,
          };
        } catch (error) {
          console.error("Authorization error:", error);
          return null;
        }
      },
    }),
  ],
});
