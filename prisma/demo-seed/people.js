// Organization, roles, departments and users (with BetterAuth credentials).

const { faker } = require("@faker-js/faker");
const { PLAN_LIMITS } = require("./config");
const { SYSTEM_ROLES } = require("./roles");
const { uuid, pick, daysBefore, padNumber } = require("./util");

/** Years of history the tenant pretends to have. */
const HISTORY_DAYS = 3 * 365;

/** @returns {import("@prisma/client").Prisma.OrganizationCreateManyInput} */
function buildOrganization(ctx) {
  const { def, orgId, anchor } = ctx;
  const limits = PLAN_LIMITS[def.plan];
  return {
    id: orgId,
    name: def.name,
    slug: def.slug,
    description: def.description,
    isActive: true,
    plan: def.plan,
    maxAssets: limits.maxAssets,
    maxUsers: limits.maxUsers,
    createdAt: daysBefore(anchor, HISTORY_DAYS),
    updatedAt: anchor,
  };
}

function buildRoles(ctx) {
  /** @type {import("@prisma/client").Prisma.RoleCreateManyInput[]} */
  const rows = [];
  const idByKey = {};
  for (const [key, role] of Object.entries(SYSTEM_ROLES)) {
    const id = uuid();
    idByKey[key] = id;
    rows.push({
      id,
      name: role.name,
      description: role.description,
      permissions: [...role.permissions],
      isSystem: true,
      organizationId: ctx.orgId,
      createdAt: daysBefore(ctx.anchor, HISTORY_DAYS),
    });
  }
  return { rows, idByKey };
}

function buildDepartments(ctx) {
  const idByName = {};
  /** @type {import("@prisma/client").Prisma.DepartmentCreateManyInput[]} */
  const rows = [];
  // Parents are listed before their children in the config.
  for (const dept of ctx.def.departments) {
    const id = uuid();
    idByName[dept.name] = id;
    rows.push({
      id,
      name: dept.name,
      parentId: dept.parent ? idByName[dept.parent] : null,
      organizationId: ctx.orgId,
      createdAt: daysBefore(ctx.anchor, HISTORY_DAYS),
    });
  }
  return { rows, idByName };
}

function buildUserRow(ctx, { handle, email, isAdmin, departmentId }) {
  const firstname = faker.person.firstName();
  const lastname = faker.person.lastName();
  const created = daysBefore(
    ctx.anchor,
    faker.number.int({ min: 30, max: HISTORY_DAYS - 30 }),
  );
  return {
    userid: uuid(),
    username: `${ctx.def.key}.${handle}`,
    isadmin: isAdmin,
    canrequest: true,
    firstname,
    lastname,
    email,
    // Legacy column; BetterAuth reads accounts.password.
    password: ctx.passwordHash,
    organizationId: ctx.orgId,
    departmentId,
    creation_date: created,
    authProvider: "local",
    isActive: true,
    emailVerified: true,
    twoFactorEnabled: false,
    updatedAt: created,
  };
}

/**
 * One admin, the configured number of managers and standard users. Each user
 * gets a credential account (providerId "credential", accountId = user id)
 * sharing one pre-computed bcrypt hash, exactly as writeCredentialPassword in
 * src/lib/auth-utils.ts stores it.
 */
function buildPeople(ctx, departmentIds, roleIds) {
  const { def } = ctx;
  const departmentList = Object.values(departmentIds);
  const itDepartment = departmentIds.IT ?? departmentList[0];
  const specs = [
    {
      handle: "admin",
      email: `admin@${def.domain}`,
      isAdmin: true,
      roleKey: "admin",
      departmentId: itDepartment,
    },
  ];
  for (let index = 1; index <= def.counts.managers; index += 1) {
    specs.push({
      handle: `manager${index}`,
      email: `manager${index}@${def.domain}`,
      isAdmin: false,
      roleKey: "manager",
      departmentId: pick(departmentList),
    });
  }
  for (let index = 1; index <= def.counts.users; index += 1) {
    specs.push({
      handle: `user${padNumber(index, 2)}`,
      email: `user${padNumber(index, 2)}@${def.domain}`,
      isAdmin: false,
      roleKey: "user",
      departmentId: pick(departmentList),
    });
  }

  /** @type {import("@prisma/client").Prisma.userCreateManyInput[]} */
  const users = [];
  /** @type {import("@prisma/client").Prisma.accountsCreateManyInput[]} */
  const accounts = [];
  /** @type {import("@prisma/client").Prisma.UserRoleCreateManyInput[]} */
  const userRoles = [];
  const logins = [];

  for (const spec of specs) {
    const user = buildUserRow(ctx, spec);
    users.push(user);
    accounts.push({
      id: uuid(),
      userId: user.userid,
      accountId: user.userid,
      providerId: "credential",
      password: ctx.passwordHash,
      createdAt: user.creation_date,
      updatedAt: user.creation_date,
    });
    userRoles.push({
      id: uuid(),
      userId: user.userid,
      roleId: roleIds[spec.roleKey],
      grantedAt: user.creation_date,
    });
    logins.push({ email: user.email, role: spec.roleKey });
  }

  const people = {
    admin: users[0],
    managers: users.slice(1, 1 + def.counts.managers),
    standard: users.slice(1 + def.counts.managers),
    all: users,
  };
  return { users, accounts, userRoles, logins, people };
}

module.exports = {
  HISTORY_DAYS,
  buildOrganization,
  buildRoles,
  buildDepartments,
  buildPeople,
};
