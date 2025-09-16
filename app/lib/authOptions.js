import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions = {
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.identifier },
              { username: credentials.identifier },
            ],
          },
        });

        if (!user) return null;

        let valid = false;
        const value = user.password || "";
        if (value.startsWith("$2")) {
          valid = await bcrypt.compare(credentials.password, value);
        } else {
          valid = credentials.password === value;
        }
        if (!valid) return null;

        return {
          id: user.userid,
          name: `${user.firstname} ${user.lastname}`.trim(),
          email: user.email,
          isadmin: user.isadmin,
          canrequest: user.canrequest,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.isadmin = user.isadmin;
        token.canrequest = user.canrequest;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.isadmin = token.isadmin;
        session.user.canrequest = token.canrequest;
      }
      return session;
    },
  },
};

