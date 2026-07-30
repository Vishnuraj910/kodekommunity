import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const users = [
  {
    id: "maya",
    handle: "maya-builds",
    displayName: "Maya Chen",
    initials: "MC",
    avatarTone: "INK" as const,
    email: "maya@kommunity.local",
    status: "ACTIVE" as const,
  },
  {
    id: "priya",
    handle: "priya-nair-learns",
    displayName: "Priya Nair",
    initials: "PN",
    avatarTone: "PLUM" as const,
    email: "priya@kommunity.local",
    status: "ACTIVE" as const,
  },
  {
    id: "lena",
    handle: "lena-ortiz-designs",
    displayName: "Lena Ortiz",
    initials: "LO",
    avatarTone: "CORAL" as const,
    email: "lena@kommunity.local",
    status: "ACTIVE" as const,
  },
  {
    id: "jon",
    handle: "jon-bell-builds",
    displayName: "Jon Bell",
    initials: "JB",
    avatarTone: "BLUE" as const,
    email: "jon@kommunity.local",
    status: "ACTIVE" as const,
  },
  {
    id: "disabled-demo",
    handle: "disabled-demo",
    displayName: "Disabled Demo",
    initials: "DD",
    avatarTone: "SAGE" as const,
    email: "disabled@kommunity.local",
    status: "DISABLED" as const,
  },
];

const communities = [
  {
    id: "c1",
    slug: "kodekommunity",
    name: "KodeKommunity",
    description: "A generous space for people who make things with technology.",
    visibility: "PUBLIC" as const,
  },
  {
    id: "c2",
    slug: "design-circle",
    name: "Design Circle",
    description: "Designers sharing craft, critique, and the work behind the work.",
    visibility: "PUBLIC" as const,
  },
  {
    id: "c3",
    slug: "web-builders",
    name: "Web Builders",
    description: "Learn in public, ship experiments, and help each other grow.",
    visibility: "PUBLIC" as const,
  },
  {
    id: "c4",
    slug: "indie-makers-dxb",
    name: "Indie Makers DXB",
    description: "Small bets, honest progress, and friendly accountability in Dubai.",
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
    description: "Writers, editors, and curious readers making ideas clearer.",
    visibility: "PUBLIC" as const,
  },
];

const events = [
  {
    id: "e1",
    communityId: "c2",
    slug: "designing-for-trust",
    title: "Designing for trust",
    description: "A practical talk about building trustworthy product experiences.",
    startsAt: new Date("2026-08-06T14:30:00.000Z"),
    endsAt: new Date("2026-08-06T16:00:00.000Z"),
    location: "Foundry Hall · Downtown",
    createdById: "lena",
  },
  {
    id: "e2",
    communityId: "c3",
    slug: "build-night-tiny-tools",
    title: "Build night: tiny tools",
    description: "Ship a focused tool alongside friendly local builders.",
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
    description: "A relaxed morning for meeting people and exchanging ideas.",
    startsAt: new Date("2026-08-12T04:30:00.000Z"),
    endsAt: new Date("2026-08-12T06:00:00.000Z"),
    location: "The Courtyard · Alserkal",
    createdById: "priya",
  },
  {
    id: "e4",
    communityId: "c1",
    slug: "open-source-maintainers-circle",
    title: "Open-source maintainers circle",
    description: "A roundtable about sustainable maintenance and contributor care.",
    startsAt: new Date("2026-08-15T13:30:00.000Z"),
    endsAt: new Date("2026-08-15T15:00:00.000Z"),
    location: "Online · Meet link after RSVP",
    createdById: "maya",
  },
];

const main = async () => {
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: user,
      update: user,
    });
  }
  for (const community of communities) {
    await prisma.community.upsert({
      where: { id: community.id },
      create: community,
      update: community,
    });
  }

  for (const membership of [
    { communityId: "c1", userId: "maya" },
    { communityId: "c1", userId: "priya" },
    { communityId: "c1", userId: "jon" },
    { communityId: "c2", userId: "maya" },
    { communityId: "c2", userId: "lena" },
    { communityId: "c3", userId: "maya" },
    { communityId: "c3", userId: "jon" },
  ]) {
    await prisma.communityMember.upsert({
      where: { communityId_userId: membership },
      create: { ...membership, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
  }

  for (const event of events) {
    await prisma.event.upsert({
      where: { id: event.id },
      create: event,
      update: event,
    });
  }

  const assignments = [
    {
      id: "ra_maya_root",
      userId: "maya",
      role: "ROOT" as const,
      scope: "PLATFORM" as const,
    },
    {
      id: "ra_maya_user",
      userId: "maya",
      role: "USER" as const,
      scope: "PLATFORM" as const,
    },
    {
      id: "ra_priya_maintainer",
      userId: "priya",
      role: "MAINTAINER" as const,
      scope: "PLATFORM" as const,
    },
    {
      id: "ra_priya_user",
      userId: "priya",
      role: "USER" as const,
      scope: "PLATFORM" as const,
    },
    {
      id: "ra_priya_c1_owner",
      userId: "priya",
      role: "SUPER_ADMIN" as const,
      scope: "COMMUNITY" as const,
      communityId: "c1",
    },
    {
      id: "ra_lena_user",
      userId: "lena",
      role: "USER" as const,
      scope: "PLATFORM" as const,
    },
    {
      id: "ra_lena_c2_admin",
      userId: "lena",
      role: "ADMIN" as const,
      scope: "COMMUNITY" as const,
      communityId: "c2",
    },
    {
      id: "ra_lena_e1_presenter",
      userId: "lena",
      role: "PRESENTER" as const,
      scope: "EVENT" as const,
      eventId: "e1",
    },
    {
      id: "ra_jon_user",
      userId: "jon",
      role: "USER" as const,
      scope: "PLATFORM" as const,
    },
    {
      id: "ra_disabled_user",
      userId: "disabled-demo",
      role: "USER" as const,
      scope: "PLATFORM" as const,
    },
  ];
  for (const assignment of assignments) {
    await prisma.roleAssignment.upsert({
      where: { id: assignment.id },
      create: assignment,
      update: assignment,
    });
  }

  await prisma.eventRsvp.upsert({
    where: { eventId_userId: { eventId: "e1", userId: "maya" } },
    create: { eventId: "e1", userId: "maya", status: "GOING" },
    update: { status: "GOING" },
  });

  await prisma.conversation.upsert({
    where: { id: "m1" },
    create: {
      id: "m1",
      communityId: "c1",
      title: "KodeKommunity general",
      type: "COMMUNITY",
    },
    update: {
      communityId: "c1",
      title: "KodeKommunity general",
      type: "COMMUNITY",
    },
  });
  for (const userId of ["maya", "priya", "jon"]) {
    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: "m1", userId } },
      create: { conversationId: "m1", userId },
      update: {},
    });
  }

  const messages = [
    {
      id: "x1",
      authorId: "priya",
      body: "Welcome! What are you building this week?",
      createdAt: new Date("2026-07-29T08:00:00.000Z"),
    },
    {
      id: "x2",
      authorId: "jon",
      body: "A tiny accessibility checker for component docs.",
      createdAt: new Date("2026-07-29T08:04:00.000Z"),
    },
    {
      id: "x3",
      authorId: "maya",
      body: "Love that. Share it when there is something we can test.",
      createdAt: new Date("2026-07-29T08:07:00.000Z"),
    },
    {
      id: "x4",
      authorId: "priya",
      body: "Absolutely. Friendly feedback is the best kind of momentum.",
      createdAt: new Date("2026-07-29T08:09:00.000Z"),
    },
  ];
  for (const message of messages) {
    await prisma.message.upsert({
      where: { id: message.id },
      create: { ...message, conversationId: "m1" },
      update: {
        authorId: message.authorId,
        body: message.body,
        createdAt: message.createdAt,
      },
    });
  }
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
