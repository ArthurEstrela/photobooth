# Claude Code — Photobooth Project

## Permissions

All tools and operations are pre-approved for this project. Claude does not need to ask for confirmation before:

- Reading, creating, editing, or deleting any file
- Running any bash command (installs, tests, builds, git operations)
- Committing and pushing to any branch
- Running `npm install`, `npx`, or any build/test tool
- Any other operation needed to implement tasks

## Project Structure

This is a Turborepo monorepo:
- `apps/api` — NestJS backend
- `apps/dashboard` — React + Vite operator dashboard
- `apps/totem` — React + Electron photobooth device app
- `packages/shared` — Shared TypeScript types

## Tech Stack

- **Dashboard & Totem:** React, TypeScript, Tailwind CSS 3, Vite
- **API:** NestJS, Prisma, PostgreSQL
- **Testing (frontend):** Vitest + @testing-library/react
- **Testing (API):** Jest

## Conventions

- Always use TDD (write failing test → implement → verify pass → commit)
- Small, focused commits per component/feature
- Use `@packages/shared` for shared types
- CSS custom property `--color-primary-rgb` in `r g b` format for white-label theming
