# Email-System Investigation Handoff

## Purpose

This file preserves the email investigation context for the next agent. Do not
put SMTP passwords, API keys, reset tokens, or other secrets in this document.

## Current user-reported behaviour

- Learners do **not** receive teacher-triggered emails when the teacher selects
  "Also send email" for announcements, assignments, evaluations, or resources.
- Registration welcome emails and password-reset emails are reported to work on
  the live server.
- The site domain changed from `iskool.online` to `iskool.xyz`, while hosting
  remains on the former hosting provider/server.

## Important conclusion

Do not assume that the live SMTP service is globally broken.

Registration and reset flows use the same SMTP environment variables as the
teacher notification endpoints. If those two email types work from the same
live deployment, the immediate cause of teacher-email failure is more likely:

1. no learner recipients match the class/current-academic-year query; or
2. teacher notification delivery fails per recipient, but the endpoint hides
   that failure and still reports success.

Local SMTP connection tests are not proof of live-server behaviour. The local
`.env` and/or local network may differ from the deployed environment.

## SMTP configuration structure

`config.php` reads the root `.env` file and exposes values through `getenv()`.

Required keys:

```env
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
SMTP_PORT=465
SMTP_FROM=
```

All email senders use PHPMailer and normally configure SMTP authentication plus
implicit TLS (`PHPMailer::ENCRYPTION_SMTPS`) on the configured port.

Never echo, commit, log, or copy `.env` secret values into this file.

## Domain and TLS finding

The local configuration used `iskool.xyz` as the SMTP host on port 465. A
connection to that public host/port was reachable, but PHPMailer could not
complete TLS because the server certificate did not match `iskool.xyz`.

The reverse DNS name `business182-1.web-hosting.com` matched the certificate
and successfully completed a non-sending SMTPS connection on port 465. The
current credentials did not authenticate during a non-sending test against
that server.

This must **not** be applied blindly to production. First confirm the exact
production `.env` and hosting-provider mail settings. A working production
registration/reset flow indicates its effective SMTP setup may differ from the
local one.

Preferred long-term configuration is a valid certificate for `mail.iskool.xyz`
and an SMTP host name that matches that certificate. Do not disable TLS
certificate verification as a workaround.

## Teacher checkbox wiring is correct

The browser does pass `force_email=1` when the checkbox is selected:

- `assets/js/teacher/assignments.js`
- `assets/js/teacher/announcements.js`
- `assets/js/teacher/evaluations.js`
- `assets/js/teacher/resources.js`

The relevant PHP endpoints read that value and call `PHPMailer->send()`:

- `api/teacher/create_assignment.php`
- `api/teacher/create_announcement.php`
- `api/teacher/create_evaluation.php`
- `api/teacher/upload_resource.php`

Therefore, the checkbox itself is not the known failure point.

## Most likely application-level failure

Each teacher endpoint selects recipients from the active academic year. For
example, assignments require all of the following:

```sql
users.role = 'learner'
class_students.class_id = selected class
class_students.academic_year_id = current academic year
```

If the school has learners linked to a class without the active
`academic_year_id`, the recipient loop is empty and no email is attempted.
Announcements may additionally target parents when `send_to = 'parents'`.

Every endpoint catches PHPMailer exceptions, calls `error_log()`, then returns
success for the content creation. This means the teacher sees success even when
there were zero recipients or all email sends failed.

## Recommended next implementation

Add safe delivery diagnostics to each teacher notification endpoint. Do not
return SMTP passwords, SMTP command transcripts, or raw exception details to
the browser.

Suggested response fields for authorised teachers:

```json
{
  "success": true,
  "recipients_found": 28,
  "emails_attempted": 28,
  "emails_sent": 0,
  "email_failures": 28,
  "email_notice": "Some notifications could not be delivered."
}
```

Suggested implementation rules:

1. Initialise counters before the recipient loop.
2. Increment `recipients_found` after each selected recipient.
3. Increment `emails_attempted` immediately before `send()`.
4. Increment `emails_sent` only when `send()` returns successfully.
5. Increment `email_failures` in the exception handler.
6. Log a generic endpoint/event/recipient identifier plus PHPMailer error
   information server-side, without exposing secrets to the client.
7. Return the counters after the loop.
8. If `recipients_found` is zero, return a clear message that no learners in
   the selected class/current academic year were eligible.

Start with `api/teacher/create_announcement.php` and
`api/teacher/create_assignment.php`, then apply the same pattern to evaluations
and resources. Test on the `dev` branch/server before production.

## Related behaviour

- Quiz emails differ: `create_quiz.php` sends email when push fails or when
  forced.
- Assignment, announcement, evaluation, and resource emails are only sent
  when `force_email` is selected; they are not push-failure fallbacks.
- Learner-created discussions currently send push notifications only. Their
  endpoint imports PHPMailer and builds an email template but never sends it.
- Guardian email and parent-linking data are stored/linked only; they do not
  trigger email.

## Validation already performed

- The relevant PHP files linted successfully.
- PHPUnit passed: 2 tests, 2 assertions.
- No real email was sent during the investigation.

## Existing workspace state

An earlier requested change replaced active `iskool.online` references with
`iskool.xyz` across application code, email templates, documentation, demos,
superadmin setup, and deployment workflow paths. Archived/legacy/vendor paths
were intentionally excluded. Review those working-tree changes before
committing, especially the sandbox deployment directory.
