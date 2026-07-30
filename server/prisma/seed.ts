import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { PrismaClient, type RoleName } from "@prisma/client";
import { hashPassword } from "../src/services/passwords.js";

const users = [
  ["maya", "maya-builds", "Maya Chen", "MC", "INK", "maya@kommunity.local"],
  ["omar", "omar-secures", "Omar Haddad", "OH", "SAGE", "omar@kommunity.local"],
  ["priya", "priya-learns", "Priya Nair", "PN", "PLUM", "priya@kommunity.local"],
  ["noah", "noah-maintains", "Noah Williams", "NW", "BLUE", "noah@kommunity.local"],
  ["amara", "amara-research", "Amara Okafor", "AO", "ORANGE", "amara@kommunity.local"],
  ["lena", "lena-designs", "Lena Ortiz", "LO", "CORAL", "lena@kommunity.local"],
  ["diego", "diego-operates", "Diego Santos", "DS", "VIOLET", "diego@kommunity.local"],
  ["samira", "samira-speaks", "Samira Khan", "SK", "SAGE", "samira@kommunity.local"],
  ["jon", "jon-builds", "Jon Bell", "JB", "BLUE", "jon@kommunity.local"],
  ["aisha", "aisha-ships", "Aisha Rahman", "AR", "ORANGE", "aisha@kommunity.local"],
  ["liam", "liam-observes", "Liam Murphy", "LM", "INK", "liam@kommunity.local"],
  ["fatima", "fatima-writes", "Fatima Al Mansoori", "FA", "PLUM", "fatima@kommunity.local"],
] as const;

const communities = [
  {
    id: "c1",
    slug: "kodekommunity",
    name: "KodeKommunity",
    description:
      "A generous Dubai-based space for people who build and operate technology.",
    visibility: "PUBLIC" as const,
  },
  {
    id: "c2",
    slug: "design-circle",
    name: "Design Circle",
    description:
      "Designers and researchers sharing craft, critique, and the work behind the work.",
    visibility: "PUBLIC" as const,
  },
  {
    id: "c3",
    slug: "web-builders",
    name: "Web Builders",
    description:
      "Learn in public, ship focused experiments, and help other builders grow.",
    visibility: "PUBLIC" as const,
  },
  {
    id: "c4",
    slug: "indie-makers-dxb",
    name: "Indie Makers DXB",
    description:
      "Small bets, honest progress, and friendly accountability in Dubai.",
    visibility: "PUBLIC" as const,
  },
  {
    id: "c5",
    slug: "climate-builders",
    name: "Climate Builders",
    description: "People applying their skills to practical climate action.",
    visibility: "PUBLIC" as const,
  },
  {
    id: "c6",
    slug: "words-and-meaning",
    name: "Words & Meaning",
    description:
      "Writers, editors, and curious readers making technical ideas clearer.",
    visibility: "PUBLIC" as const,
  },
];

const events = [
  {
    id: "e1",
    communityId: "c2",
    slug: "designing-for-trust",
    title: "Designing for trust",
    description:
      "A practical talk about consent, clarity, and trustworthy product experiences.",
    startsAt: new Date("2026-08-06T14:30:00.000Z"),
    endsAt: new Date("2026-08-06T16:00:00.000Z"),
    location: "Foundry Hall · Downtown Dubai",
    createdById: "lena",
  },
  {
    id: "e2",
    communityId: "c3",
    slug: "build-night-tiny-tools",
    title: "Build night: tiny tools",
    description:
      "Ship one focused tool alongside friendly local builders and reviewers.",
    startsAt: new Date("2026-08-09T12:00:00.000Z"),
    endsAt: new Date("2026-08-09T15:00:00.000Z"),
    location: "Workshop 14 · Al Quoz",
    createdById: "jon",
  },
  {
    id: "e3",
    communityId: "c1",
    slug: "coffee-curious-minds",
    title: "Coffee & curious minds",
    description:
      "A relaxed morning for meeting people and exchanging useful ideas.",
    startsAt: new Date("2026-08-12T04:30:00.000Z"),
    endsAt: new Date("2026-08-12T06:00:00.000Z"),
    location: "The Courtyard · Alserkal Avenue",
    createdById: "samira",
  },
  {
    id: "e4",
    communityId: "c1",
    slug: "maintainers-circle",
    title: "Open-source maintainers circle",
    description:
      "A candid roundtable about sustainable maintenance and contributor care.",
    startsAt: new Date("2026-08-15T13:30:00.000Z"),
    endsAt: new Date("2026-08-15T15:00:00.000Z"),
    location: "Online · Link after RSVP",
    createdById: "maya",
  },
];

const memberships = [
  ["c1", "maya"],
  ["c1", "omar"],
  ["c1", "priya"],
  ["c1", "noah"],
  ["c1", "diego"],
  ["c1", "samira"],
  ["c1", "jon"],
  ["c1", "aisha"],
  ["c1", "liam"],
  ["c1", "fatima"],
  ["c2", "maya"],
  ["c2", "amara"],
  ["c2", "lena"],
  ["c2", "samira"],
  ["c2", "fatima"],
  ["c3", "maya"],
  ["c3", "jon"],
  ["c3", "aisha"],
  ["c4", "omar"],
  ["c4", "noah"],
] as const;

const privilegedAssignments = [
  ["maya", "ROOT", "PLATFORM", null, null],
  ["omar", "ROOT", "PLATFORM", null, null],
  ["priya", "MAINTAINER", "PLATFORM", null, null],
  ["noah", "MAINTAINER", "PLATFORM", null, null],
  ["priya", "SUPER_ADMIN", "COMMUNITY", "c1", null],
  ["amara", "SUPER_ADMIN", "COMMUNITY", "c2", null],
  ["lena", "ADMIN", "COMMUNITY", "c2", null],
  ["diego", "ADMIN", "COMMUNITY", "c1", null],
  ["lena", "PRESENTER", "EVENT", null, "e1"],
  ["samira", "PRESENTER", "EVENT", null, "e3"],
] as const;

const directKeyFor = (
  communityId: string,
  firstUserId: string,
  secondUserId: string,
) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        communityId,
        participants: [firstUserId, secondUserId].sort(),
      }),
    )
    .digest("hex");

export const seedDatabase = async (
  prisma: PrismaClient,
  sharedPassword: string,
) => {
  if (sharedPassword.length < 12 || sharedPassword.length > 128) {
    throw new Error("SEED_COMMON_PASSWORD must contain 12 to 128 characters");
  }

  for (const [id, handle, displayName, initials, avatarTone, email] of users) {
    await prisma.user.upsert({
      where: { id },
      create: {
        id,
        handle,
        displayName,
        initials,
        avatarTone,
        email,
        status: "ACTIVE",
      },
      update: {
        handle,
        displayName,
        initials,
        avatarTone,
        email,
        status: "ACTIVE",
      },
    });
  }
  await prisma.user.upsert({
    where: { id: "disabled-demo" },
    create: {
      id: "disabled-demo",
      handle: "disabled-demo",
      displayName: "Disabled Demo",
      initials: "DD",
      avatarTone: "SAGE",
      email: "disabled@kommunity.local",
      status: "DISABLED",
    },
    update: { status: "DISABLED" },
  });

  for (const community of communities) {
    await prisma.community.upsert({
      where: { id: community.id },
      create: community,
      update: community,
    });
  }
  for (const [communityId, userId] of memberships) {
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId, userId } },
      create: { communityId, userId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
  }
  for (const event of events) {
    await prisma.event.upsert({
      where: { id: event.id },
      create: event,
      update: { ...event, deletedAt: null },
    });
  }

  for (const [id] of users) {
    await prisma.roleAssignment.upsert({
      where: { id: `ra_${id}_user` },
      create: {
        id: `ra_${id}_user`,
        userId: id,
        role: "USER",
        scope: "PLATFORM",
      },
      update: {
        userId: id,
        role: "USER",
        scope: "PLATFORM",
        communityId: null,
        eventId: null,
      },
    });
  }
  for (const [userId, role, scope, communityId, eventId] of privilegedAssignments) {
    const id = `ra_${userId}_${role.toLowerCase()}_${communityId ?? eventId ?? "platform"}`;
    const existing = await prisma.roleAssignment.findFirst({
      where: { userId, role, scope, communityId, eventId },
      select: { id: true },
    });
    if (existing) {
      await prisma.roleAssignment.update({
        where: { id: existing.id },
        data: { scope, communityId, eventId },
      });
    } else {
      await prisma.roleAssignment.create({
        data: { id, userId, role, scope, communityId, eventId },
      });
    }
  }

  for (const [userId] of users) {
    const passwordHash = await hashPassword(sharedPassword);
    await prisma.passwordCredential.upsert({
      where: { userId },
      create: {
        userId,
        passwordHash,
      },
      update: {
        passwordHash,
      },
    });
  }

  const groups = [
    {
      id: "g1",
      communityId: "c1",
      slug: "platform-operations",
      name: "Platform Operations",
      description:
        "SREs and platform engineers trading practical notes on reliable systems.",
      visibility: "PUBLIC" as const,
      createdById: "priya",
    },
    {
      id: "g2",
      communityId: "c1",
      slug: "accessibility-guild",
      name: "Accessibility Guild",
      description:
        "Builders reviewing interfaces, documentation, and tools for inclusive use.",
      visibility: "PUBLIC" as const,
      createdById: "diego",
    },
    {
      id: "g3",
      communityId: "c1",
      slug: "maintainers-room",
      name: "Maintainers’ Room",
      description:
        "A private peer group for sustainable open-source maintenance.",
      visibility: "PRIVATE" as const,
      createdById: "maya",
    },
    {
      id: "g4",
      communityId: "c2",
      slug: "research-practice",
      name: "Research Practice",
      description:
        "Researchers comparing interview plans, synthesis methods, and ethical practice.",
      visibility: "PUBLIC" as const,
      createdById: "amara",
    },
  ];
  for (const group of groups) {
    await prisma.group.upsert({
      where: { id: group.id },
      create: group,
      update: { ...group, deletedAt: null },
    });
  }
  for (const [groupId, userId] of [
    ["g1", "priya"],
    ["g1", "maya"],
    ["g1", "omar"],
    ["g1", "noah"],
    ["g1", "diego"],
    ["g2", "diego"],
    ["g2", "jon"],
    ["g2", "aisha"],
    ["g3", "maya"],
    ["g3", "priya"],
    ["g4", "amara"],
    ["g4", "lena"],
    ["g4", "fatima"],
  ] as const) {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
  }

  const posts = [
    {
      id: "p1",
      communityId: "c1",
      groupId: null,
      authorId: "priya",
      body: "What small operational habit saved your team time this month? Ours was putting rollback ownership directly into every release checklist.",
    },
    {
      id: "p2",
      communityId: "c1",
      groupId: "g2",
      authorId: "jon",
      body: "We published the first keyboard-navigation report for our component docs. The clearest bugs were the ones we could reproduce without special tooling.",
    },
    {
      id: "p3",
      communityId: "c1",
      groupId: "g1",
      authorId: "noah",
      body: "Today’s incident review separated contributing conditions from causes. That small language change made the discussion much more useful.",
    },
    {
      id: "p4",
      communityId: "c2",
      groupId: "g4",
      authorId: "amara",
      body: "Sharing our consent-script template for remote interviews. It now explains recording, retention, and withdrawal in plain language.",
    },
    {
      id: "p5",
      communityId: "c1",
      groupId: null,
      authorId: "fatima",
      body: "A good technical announcement answers three questions early: what changed, who is affected, and what action is expected.",
    },
  ];
  for (const post of posts) {
    await prisma.post.upsert({
      where: { id: post.id },
      create: post,
      update: { ...post, deletedAt: null },
    });
  }

  const broadcasts = [
    {
      id: "b1",
      communityId: "c1",
      authorId: "priya",
      title: "August community briefing",
      body: "A concise update on upcoming events, moderation coverage, and the next maintainer office hours.",
      status: "SCHEDULED" as const,
      startsAt: new Date("2026-08-03T14:00:00.000Z"),
    },
    {
      id: "b2",
      communityId: "c1",
      groupId: "g1",
      authorId: "diego",
      title: "Release readiness room",
      body: "Platform owners will review scope, rollback ownership, support coverage, and the final go/no-go decision.",
      status: "SCHEDULED" as const,
      startsAt: new Date("2026-08-05T12:30:00.000Z"),
    },
    {
      id: "b3",
      communityId: "c2",
      authorId: "amara",
      title: "Designing for trust: attendee notes",
      body: "Practical arrival, accessibility, recording, and question-submission details for attendees.",
      status: "SCHEDULED" as const,
      startsAt: new Date("2026-08-04T10:00:00.000Z"),
    },
  ];
  for (const broadcast of broadcasts) {
    await prisma.broadcast.upsert({
      where: { id: broadcast.id },
      create: broadcast,
      update: { ...broadcast, deletedAt: null },
    });
  }

  const conversations = [
    {
      id: "m1",
      communityId: "c1",
      groupId: null,
      directKey: null,
      slug: "general",
      title: "KodeKommunity general",
      description: "Introductions, useful links, and community-wide conversation.",
      type: "COMMUNITY" as const,
      visibility: "PUBLIC" as const,
      createdById: "maya",
      participants: ["maya", "omar", "priya", "noah", "diego", "samira", "jon", "aisha", "liam", "fatima"],
    },
    {
      id: "m2",
      communityId: "c1",
      groupId: "g1",
      directKey: null,
      slug: "platform-operations",
      title: "Platform Operations",
      description: "Reliability reviews, release coordination, and incident learning.",
      type: "GROUP" as const,
      visibility: "PRIVATE" as const,
      createdById: "priya",
      participants: ["priya", "maya", "omar", "noah", "diego"],
    },
    {
      id: "m3",
      communityId: "c2",
      groupId: "g4",
      directKey: null,
      slug: "research-practice",
      title: "Research Practice",
      description: "Planning, synthesis, and research ethics.",
      type: "GROUP" as const,
      visibility: "PUBLIC" as const,
      createdById: "amara",
      participants: ["amara", "lena", "fatima"],
    },
    {
      id: "dm_maya_priya",
      communityId: "c1",
      groupId: null,
      directKey: directKeyFor("c1", "maya", "priya"),
      slug: null,
      title: "Maya Chen & Priya Nair",
      description: "Private direct conversation",
      type: "DIRECT" as const,
      visibility: "PRIVATE" as const,
      createdById: "maya",
      participants: ["maya", "priya"],
    },
  ];
  for (const conversation of conversations) {
    const { participants, ...record } = conversation;
    await prisma.conversation.upsert({
      where: { id: record.id },
      create: record,
      update: { ...record, deletedAt: null },
    });
    for (const userId of participants) {
      await prisma.conversationParticipant.upsert({
        where: {
          conversationId_userId: {
            conversationId: record.id,
            userId,
          },
        },
        create: { conversationId: record.id, userId },
        update: {},
      });
    }
  }

  const messages = [
    ["x1", "m1", "priya", "Welcome! What useful thing are you building or learning this week?", "2026-07-29T08:00:00.000Z"],
    ["x2", "m1", "jon", "A small accessibility checker for our component documentation.", "2026-07-29T08:04:00.000Z"],
    ["x3", "m1", "maya", "Share it when there is something we can test. Friendly feedback creates momentum.", "2026-07-29T08:07:00.000Z"],
    ["x4", "m1", "fatima", "I can help make the report language clearer for non-specialists.", "2026-07-29T08:09:00.000Z"],
    ["x5", "m2", "noah", "The staging rollback rehearsal completed in seven minutes.", "2026-07-29T10:00:00.000Z"],
    ["x6", "m2", "diego", "I added the missing database owner and customer-support checkpoint.", "2026-07-29T10:03:00.000Z"],
    ["x7", "m2", "priya", "Great. Please link the checklist before tomorrow’s readiness review.", "2026-07-29T10:06:00.000Z"],
    ["x8", "m3", "amara", "The revised interview guide now starts with consent and withdrawal.", "2026-07-29T11:00:00.000Z"],
    ["x9", "m3", "lena", "I will test it in tomorrow’s pilot and note any confusing language.", "2026-07-29T11:04:00.000Z"],
    ["x10", "dm_maya_priya", "maya", "Could you review the August briefing before it is scheduled?", "2026-07-29T12:00:00.000Z"],
    ["x11", "dm_maya_priya", "priya", "Yes. I will check the dates, owners, and member actions this afternoon.", "2026-07-29T12:05:00.000Z"],
    ["x12", "m1", "aisha", "I am hosting a tiny-tools demo after build night if anyone wants a five-minute slot.", "2026-07-29T13:00:00.000Z"],
  ] as const;
  for (const [id, conversationId, authorId, body, createdAt] of messages) {
    await prisma.message.upsert({
      where: { id },
      create: {
        id,
        conversationId,
        authorId,
        body,
        createdAt: new Date(createdAt),
      },
      update: {
        conversationId,
        authorId,
        body,
        createdAt: new Date(createdAt),
        deletedAt: null,
      },
    });
  }

  for (const eventId of ["e1", "e3"]) {
    await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId: "maya" } },
      create: { eventId, userId: "maya", status: "GOING" },
      update: { status: "GOING" },
    });
  }

  const groupedRoles = await prisma.roleAssignment.groupBy({
    by: ["role"],
    _count: { userId: true },
  });
  const roleCounts: Record<RoleName, number> = {
    ROOT: 0,
    MAINTAINER: 0,
    SUPER_ADMIN: 0,
    ADMIN: 0,
    PRESENTER: 0,
    USER: 0,
  };
  for (const role of groupedRoles) roleCounts[role.role] = role._count.userId;

  const [
    activeUsers,
    credentials,
    groupCount,
    postCount,
    broadcastCount,
    conversationCount,
    messageCount,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.passwordCredential.count({
      where: { user: { status: "ACTIVE" } },
    }),
    prisma.group.count({ where: { deletedAt: null } }),
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.broadcast.count({ where: { deletedAt: null } }),
    prisma.conversation.count({ where: { deletedAt: null } }),
    prisma.message.count({ where: { deletedAt: null } }),
  ]);

  return {
    activeUsers,
    credentials,
    groups: groupCount,
    posts: postCount,
    broadcasts: broadcastCount,
    conversations: conversationCount,
    messages: messageCount,
    roleCounts,
  };
};

const runFromCli = async () => {
  const password = process.env.SEED_COMMON_PASSWORD;
  if (!password) {
    throw new Error(
      "SEED_COMMON_PASSWORD is required; it is never committed or defaulted",
    );
  }
  const prisma = new PrismaClient();
  try {
    const summary = await seedDatabase(prisma, password);
    console.info(
      `Seeded ${summary.activeUsers} active users, ${summary.groups} groups, ${summary.posts} posts, ${summary.broadcasts} broadcasts, ${summary.conversations} conversations, and ${summary.messages} messages.`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runFromCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    process.exitCode = 1;
  });
}
