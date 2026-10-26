# Parent App: Version 1 Spec

Draft, 16 Oct 2026.

## 1. Purpose

Let a parent open the app and understand in about ten seconds whether their child is okay and whether there is anything they need to do. It is read-only, built on data the platform already holds, and designed phone-first with a simple desktop version later.

**Principles**
- Focused and simple. If a feature doesn't help a parent answer "is my child okay?", it is not in v1.
- No extra work for teachers. Reuse existing marks, assignments, quizzes and syllabus data.
- Honest and calm. Plain, soft wording.
- Parents see only the learners linked to them.

## 2. Users and access

- **Parent:** can monitor several children from one account. A child switcher is on every screen.
- **Linking:** the learner links their own parent (the existing parent link on My Class). A parent with two children appears in both learners' links and sees both under one account.
- **Visibility:** a parent sees only data for linked learners. Nothing from other learners or other classes' discussions.

## 3. v1 scope

### 3.1 Home
One screen with:
- Child switcher.
- Subject list with the current mark for each.
- Coming up (next tests and events).
- Latest announcements.

### 3.2 Progress report
The parent can see the learner's marks: the gradebook, including the progress report. Read-only.

### 3.3 Syllabus (read-only)
The same subject brief, topics and term mark breakdown that learners already see, shown for each child's class.

### 3.4 Announcements
- One feed combining **School** announcements (all parents) and **Teacher** announcements (that child's class).
- Each item is labelled School or Teacher, and teacher items show the child they relate to.
- A school-wide announcement shows once, not once per child.
- Unread marker. Filter: All / School / Teacher.
- Version 1 is announcements only. Parents lodging queries comes in a later version.

### 3.5 Upcoming events
- Tests, quizzes and assignment due dates, pulled automatically from existing data.
- School events (needs someone to create them, see open questions).
- Combined across children, with the child's name on each item.

## 4. Data and architecture notes

- Parent to learner is many-to-many (one parent, several children; one learner can have more than one parent).
- Every parent query is scoped to the learners linked to that parent.
- Announcements need a scope: school-wide or class/teacher.
- Events come from two sources: derived (assessment dates) and created (school events).
- Marks are visible to parents only once marked or published.

## 5. Not in v1

- Parents messaging or lodging queries with teachers (later).
- Fees and payments.
- Resources, discussions and learner-to-learner features.
- Attendance (only if the platform already tracks it, see open questions).

## 6. After v1

1. **Notifications:** email when an announcement is posted, plus a weekly summary. This is what makes parents actually use it.
2. **Teacher comment** on the term report.
3. **Parent queries** to teachers, with a simple workflow.
4. Attendance and permission slips, if the data exists.

## 7. Build order

1. Parent accounts, linked children, child switcher and Home shell.
2. Progress report (gradebook).
3. Announcements and events.
4. Syllabus.

## 8. Design

- Phone-first, 5 tabs: Home, Report, Syllabus, News, Events.
- Dark and light mode, matching the learner app's palette and Nunito on mobile.
- Touch targets at least 44px.

## 9. Open questions

1. Who posts school-wide announcements and events? Is there a school admin role, or does it need building?
2. Does the learner link need the parent to accept it? Can a learner unlink a parent?
3. Do marks appear to parents when entered, or only when a teacher publishes them?
4. Does the platform track attendance?

## 10. First milestone

Run it with one class, one teacher and a few parents for a full term on real data. That will show what matters before anything is polished.
