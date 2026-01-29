import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      username?: string;
      isAdmin?: boolean;
      canRequest?: boolean;
      firstname?: string;
      lastname?: string;
      organizationId?: string;
      departmentId?: string;
      permissions?: string[];
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id?: string;
    username?: string;
    isAdmin?: boolean;
    canRequest?: boolean;
    firstname?: string;
    lastname?: string;
    organizationId?: string;
    departmentId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    isAdmin?: boolean;
    canRequest?: boolean;
    firstname?: string;
    lastname?: string;
    organizationId?: string;
    departmentId?: string;
    permissions?: string[];
  }
}
