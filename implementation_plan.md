# Nalanda L&D Platform - Development Plan

This document outlines the detailed, high-level development plan for the Nalanda Learning & Development web application. The platform will be built with a "Frontend-First" approach followed by backend integration, local testing, and finally, cloud deployment.

## 1. Architecture & Tech Stack

- **Frontend**: Next.js (React), Tailwind CSS (for modern/futuristic UI styling), Framer Motion (for micro-animations and dynamic interactions), Zustand/Redux (State Management).
- **Backend**: Node.js with Next.js API Routes (or Express.js if decoupling is preferred), Prisma ORM.
- **Database**: SQLite (Local Testing) -> PostgreSQL (Cloud/Production).
- **Hosting/Cloud**: Vercel (Frontend & Serverless Backend), Supabase/Neon (Cloud Database).

## 2. UI/UX Design & Aesthetic (Modern & Futuristic)

- **Theme**: Dark mode by default with a sleek "Glassmorphism" effect (translucent backgrounds, soft borders).
- **Color Palette**: Deep space backgrounds (dark blues/blacks) with vibrant neon accents (cyan, purple, emerald green) for interactive elements and data visualizations.
- **Typography**: Clean, modern sans-serif fonts like _Inter_ or _Outfit_.
- **Interactions**: Hover states on all interactive elements, smooth page transitions, and animated charts for skill analysis.
- **User Settings**: Profile management, theme toggles, notification preferences, and accessibility settings.

---

## 3. Phase 1: Frontend Development (UI & Mock Data)

In this phase, all screens will be built using mock data to ensure the UX is fully realized before backend logic is introduced.

### 3.1 Authentication & User Settings

- Login/Signup screens with modern input fields and validation.
- Forgot Password & OTP verification flows.
- User Settings Dashboard (Profile, Preferences).

### 3.2 Employee Portal (Learner View)

- **Dashboard**: Overview of assigned courses, progress bars, and recent activity.
- **Course Catalog/View**: List of total courses assigned (Assessment details hidden initially).
- **Chapter Player**: Video/PDF viewer for up to 99 chapters per course.
- **Feedback & Assessment UI**: Forms for mandatory chapter feedback and chapter-end assessments.
- **Skill Analysis Dashboard**: Radar charts and bar graphs displaying ratings in each skill and AI-driven suggestions for development areas.

### 3.3 Manager Portal (Creator & Assigner View)

- _Note: Managers have all Employee views plus Manager views._
- **Team Dashboard**: Monitor team learning activities and skill development.
- **Course Builder**: Drag-and-drop interface to create courses, add up to 99 chapters, and build assessments.
- **Assignment Module**: Select employees and assign courses.
- **Approval Workflow UI**: Button/Status indicators to submit courses to Admin for approval.

### 3.4 Admin Portal (System Overview)

- **Global Dashboard**: Platform-wide metrics.
- **User Management**: View and edit manager/employee data and adjust access levels (Role-Based Access Control).
- **Content Moderation**: Review, approve, or reject courses, chapters, and assessments submitted by Managers.

---

## 4. Phase 2: Backend Development & Integration

In this phase, the database schema is created, APIs are built, and the frontend is connected to the real backend.

### 4.1 Database Schema Design (Prisma)

- `User` (id, role [Admin, Manager, Employee], skills, settings)
- `Course` (id, title, status [Draft, Pending Approval, Approved], creatorId)
- `Chapter` (id, courseId, sequence, content)
- `Assessment` (id, chapterId, questions)
- `Enrollment` (userId, courseId, progress, status)
- `Feedback` (userId, chapterId, rating, comments)
- `SkillRating` (userId, skillName, score)

### 4.2 API Route Development

- **Auth API**: JWT-based authentication and role verification.
- **User API**: CRUD operations for users, settings, and skill analytics logic.
- **Course API**: Logic for Managers to create content and Admins to approve content.
- **Learning API**: Logic for tracking employee progress, submitting feedback, and grading assessments.

### 4.3 Frontend-Backend Integration

- Replace mock data with `fetch`/`axios` calls to the API routes.
- Implement state management to handle loading states, errors, and caching.

---

## 5. Phase 3: Testing & Local Deployment

- **Local Database**: Seed SQLite database with dummy Admin, Manager, and Employee accounts.
- **Unit & Integration Testing**: Test assessment grading logic, RBAC (Role-Based Access Control) restrictions, and course approval workflows.
- **Local Hosting**: Run the app locally (`npm run dev`) to simulate the full user journey (Manager creates -> Admin approves -> Manager assigns -> Employee completes).

---

## 6. Phase 4: Cloud Hosting & Database Integration

- **Cloud Database Setup**: Provision a PostgreSQL database on Neon or Supabase. Update Prisma schema to point to the production database URL.
- **Environment Variables**: Securely store JWT secrets and database URIs in the hosting platform.
- **Deployment**: Deploy the Next.js application to Vercel.
- **Post-Launch Verification**: Perform end-to-end testing on the live URL to ensure cloud database reads/writes are functioning correctly.

---

> [!IMPORTANT]
> **User Review Required**
> Please review this high-level plan. Once approved, we will begin executing Phase 1 (Frontend Development) starting with the project setup and Authentication UI.

> [!NOTE]
> **Open Questions**
>
> 1. Do you have a specific frontend framework preference (e.g., Next.js vs Vite/React)?
> 2. For the cloud database, do you prefer a specific provider (e.g., Supabase, AWS RDS, MongoDB)?
