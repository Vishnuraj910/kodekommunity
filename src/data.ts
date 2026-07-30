export type Person = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  headline: string;
  color: string;
  mutual?: number;
};

export type EventItem = {
  id: string;
  title: string;
  day: string;
  month: string;
  date: string;
  time: string;
  venue: string;
  community: string;
  attendees: number;
  capacity?: number;
  category: string;
  color: string;
  going: boolean;
};

export type MessageItem = {
  id: string;
  author: string;
  initials: string;
  color: string;
  body: string;
  time: string;
  own: boolean;
};

const isBoundedString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.length <= maxLength;

export const isMessageArray = (value: unknown): value is MessageItem[] =>
  Array.isArray(value) &&
  value.length <= 5_000 &&
  value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      isBoundedString((item as MessageItem).id, 128) &&
      isBoundedString((item as MessageItem).author, 256) &&
      isBoundedString((item as MessageItem).initials, 16) &&
      isBoundedString((item as MessageItem).color, 32) &&
      isBoundedString((item as MessageItem).body, 4_000) &&
      isBoundedString((item as MessageItem).time, 64) &&
      typeof (item as MessageItem).own === "boolean",
  );

export const people: Person[] = [
  {
    id: "p1",
    name: "Lena Ortiz",
    handle: "lena-ortiz-designs",
    initials: "LO",
    headline: "Product designer · Design Circle",
    color: "coral",
    mutual: 6,
  },
  {
    id: "p2",
    name: "Jon Bell",
    handle: "jon-bell-builds",
    initials: "JB",
    headline: "Frontend engineer · Web Builders",
    color: "blue",
    mutual: 4,
  },
  {
    id: "p3",
    name: "Priya Nair",
    handle: "priya-nair-learns",
    initials: "PN",
    headline: "Community builder · KodeKommunity",
    color: "plum",
    mutual: 11,
  },
  {
    id: "p4",
    name: "Omar Haddad",
    handle: "omar-haddad-ships",
    initials: "OH",
    headline: "Indie maker · Dubai",
    color: "amber",
    mutual: 3,
  },
];

export const events: EventItem[] = [
  {
    id: "e1",
    title: "Designing for trust",
    day: "Thu",
    month: "AUG",
    date: "06",
    time: "6:30 PM – 8:00 PM",
    venue: "Foundry Hall · Downtown",
    community: "Design Circle",
    attendees: 42,
    capacity: 60,
    category: "Talk",
    color: "violet",
    going: true,
  },
  {
    id: "e2",
    title: "Build night: tiny tools",
    day: "Sat",
    month: "AUG",
    date: "09",
    time: "4:00 PM – 7:00 PM",
    venue: "Workshop 14 · Al Quoz",
    community: "Web Builders",
    attendees: 28,
    capacity: 40,
    category: "Workshop",
    color: "orange",
    going: false,
  },
  {
    id: "e3",
    title: "Coffee & curious minds",
    day: "Tue",
    month: "AUG",
    date: "12",
    time: "8:30 AM – 10:00 AM",
    venue: "The Courtyard · Alserkal",
    community: "KodeKommunity",
    attendees: 19,
    category: "Social",
    color: "sage",
    going: false,
  },
  {
    id: "e4",
    title: "Open-source maintainers circle",
    day: "Fri",
    month: "AUG",
    date: "15",
    time: "5:30 PM – 7:00 PM",
    venue: "Online · Meet link after RSVP",
    community: "KodeKommunity",
    attendees: 55,
    capacity: 100,
    category: "Roundtable",
    color: "blue",
    going: false,
  },
];

export const communities = [
  {
    id: "c1",
    name: "KodeKommunity",
    members: "1.2k",
    description: "A generous space for people who make things with technology.",
    glyph: "K",
    color: "ink",
    joined: true,
    tags: ["Technology", "Open source"],
  },
  {
    id: "c2",
    name: "Design Circle",
    members: "684",
    description: "Designers sharing craft, critique, and the work behind the work.",
    glyph: "◒",
    color: "violet",
    joined: true,
    tags: ["Design", "Creative"],
  },
  {
    id: "c3",
    name: "Web Builders",
    members: "932",
    description: "A place to learn in public, ship experiments, and help each other grow.",
    glyph: "W",
    color: "orange",
    joined: true,
    tags: ["Development", "Learning"],
  },
  {
    id: "c4",
    name: "Indie Makers DXB",
    members: "316",
    description: "Small bets, honest progress, and friendly accountability in Dubai.",
    glyph: "↗",
    color: "sage",
    joined: false,
    tags: ["Startups", "Local"],
  },
  {
    id: "c5",
    name: "Climate Builders",
    members: "248",
    description: "People applying their skills to practical climate action.",
    glyph: "✦",
    color: "blue",
    joined: false,
    tags: ["Climate", "Impact"],
  },
  {
    id: "c6",
    name: "Words & Meaning",
    members: "407",
    description: "Writers, editors, and curious readers making ideas clearer.",
    glyph: "A",
    color: "coral",
    joined: false,
    tags: ["Writing", "Culture"],
  },
];

export const conversations = [
  {
    id: "m1",
    name: "Design Circle",
    initials: "◒",
    color: "violet",
    preview: "Lena: I added the notes from today…",
    time: "10:42",
    unread: 3,
    type: "group",
  },
  {
    id: "m2",
    name: "Jon Bell",
    initials: "JB",
    color: "blue",
    preview: "That sounds perfect. See you there!",
    time: "Yesterday",
    unread: 0,
    type: "dm",
  },
  {
    id: "m3",
    name: "Tiny tools · event chat",
    initials: "TT",
    color: "orange",
    preview: "Omar: Is everyone bringing a laptop?",
    time: "Mon",
    unread: 1,
    type: "event",
  },
  {
    id: "m4",
    name: "Priya Nair",
    initials: "PN",
    color: "plum",
    preview: "Thank you for the introduction!",
    time: "Sun",
    unread: 0,
    type: "dm",
  },
];

export const initialMessages: MessageItem[] = [
  {
    id: "x1",
    author: "Lena Ortiz",
    initials: "LO",
    color: "coral",
    body: "Morning all! I added the critique notes from yesterday to our shared board.",
    time: "10:16 AM",
    own: false,
  },
  {
    id: "x2",
    author: "Jon Bell",
    initials: "JB",
    color: "blue",
    body: "The point about designing the empty state first really stuck with me.",
    time: "10:23 AM",
    own: false,
  },
  {
    id: "x3",
    author: "Maya Chen",
    initials: "MC",
    color: "ink",
    body: "Same here. It makes the value proposition much harder to dodge.",
    time: "10:31 AM",
    own: true,
  },
  {
    id: "x4",
    author: "Lena Ortiz",
    initials: "LO",
    color: "coral",
    body: "Exactly! I added the notes from today too — would love your thoughts when you have a minute.",
    time: "10:42 AM",
    own: false,
  },
];
