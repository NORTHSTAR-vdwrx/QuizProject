# NORTHSTAR Eval

A testing platform developed for low level use cases.

## Running locally

Install dependencies with `npm install`, start the Vite development server with
`npm run dev`, and run a production build with `npm run build`. The frontend
expects the API at `http://localhost:5000/api`; the API must allow credentialed
requests from the frontend origin.

## Main flows

- Register and log in at `/register/` and `/login/`. New accounts are directed
  to `/onboarding/` after their first login.
- Onboarding loads institutes and the signed-in profile. A missing extended
  profile is treated as first-time setup and created with `PUT
  /api/extended-users/me`; existing profiles can be edited. Profile fields
  include the account name, institute, member number, phone, and time zone.
  Institute selection can be skipped by deferring onboarding.
- `/home/` renders a student, teacher, or administrator workspace from the
  signed-in account role. Students can open scheduled sessions. Teachers can
  create quizzes, assign them to multiple groups they manage, browse institute
  public groups, and create groups with students found by name, username, email,
  or university UID. Open a quiz from the library to author questions, organize
  sections, set delivery/scoring settings, reuse bank questions, review versions,
  set rubrics, regrade submissions, and import/export JSON, CSV, or QTI.
  Group creation is scoped to the teacher's institute; institute profiles need
  a university UID during onboarding. Administrators can
  create institutes and browse/search/filter the `/api/admin/users` account
  directory. Administrators can create accounts, update usernames/emails/roles,
  create or edit account profiles, and delete other accounts. The current
  administrator cannot demote or delete their own account.
- `/quiz/` lists available sessions or opens a session with
  `/quiz/?session_id=<id>`. Answers are saved to the active attempt as questions
  are answered, and the final submit flow stores the attempt log and submits it.
- `/results/` lists the signed-in student's attempts. Add `?attempt_id=<id>` to
  view one attempt.

The admin account directory and management dialog use the administrator-only
account endpoints. Account creation requires username, email, password, and
role; profile fields are edited separately from sign-in and access details.