# Starting instructions for Vault Server

this repo is the backend for the vault app, a personal expense tracker

## tech stack for backend

latest versions of all packages

1. typescript + bun
2. hono as a http server(using cloudflare + wrangler)
3. prisma + postgresql(db user is postgres and password is admin for local development, neondb for hosted)
4. better-auth for authentication
5. oxlint + oxfmt for linting and formatting
6. google generative ai for gemini chat integration
7. vitest + betterauth testing module + hono test module for testing everything

## Features/main selling points

1. personal logging of expenses easily
2. setting budgets weekly or monthly
3. ability to add reoccuring purchases like subscriptions
4. ability to add quick expenses for stuff like taxi rides and what not
5. ability to talk to a chatbot for quick expense adding
6. ability to view weekly and monthly reports
7. ability to use the app offline and sync with online db when internet is available
8. should log in using email and password

## Codebase structure

```md
src/
├── api/ # ~20 route modules under /api/*
│ ├── All resources separated into folders each folder containing files for router, controller,service,test, and input validation
│ └── index.ts # Aggregates all routers
├── config/ # env, prisma, ratelimit, auth
├── utils/  
├── test/ # Test helpers
└── index.ts # Entry: imports dotenv, calls startServer()
prisma/schema.prisma
```

## General Instructions

1. use agent skills, mcps, and online search to gather context
2. no any, or hacks or workarounds
3. everything should be tested
4. if unsure about something ask
