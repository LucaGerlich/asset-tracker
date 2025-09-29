import { PrismaClient } from "@prisma/client";
// let prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
    //console.log("prisma", prisma);
  }
  prisma = global.prisma;
}

export default prisma;
