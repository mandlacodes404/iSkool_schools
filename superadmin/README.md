# iSkool Superadmin — Setup Guide
# ============================================================

## What's in this package

1. `index.php`                   — The superadmin panel
2. `.htaccess`                   — Security configuration  
3. `iskool_master.sql`           — Run once to create master tracking DB
4. `iskool_new_school_template.sql` — Template for new schools (already built)

---

## Step 1 — Create the master database

Log into cPanel → MySQL Databases → Create a database called:
  iskowdbw_master

Then run iskool_master.sql in phpMyAdmin against that database.

---

## Step 2 — Download PHPMailer

Download PHPMailer from https://github.com/PHPMailer/PHPMailer
Upload the /src/ folder to:
  /superadmin/PHPMailer/src/

Your folder structure should look like:
  /superadmin/
    index.php
    .htaccess
    iskool_new_school_template.sql
    PHPMailer/
      src/
        PHPMailer.php
        SMTP.php
        Exception.php

---

## Step 3 — Configure index.php

Open index.php and fill in these values at the top:

  SA_PASSWORD      → Your private panel password (make it strong)
  CPANEL_API_TOKEN → Paste your cPanel API token
  DB_PASS          → Your cPanel database password
  SMTP_PASS        → Password for support@iskool.xyz

---

## Step 4 — Upload to server

Upload the entire /superadmin/ folder to:
  /public_html/superadmin/

Also upload iskool_new_school_template.sql to:
  /public_html/superadmin/iskool_new_school_template.sql

---

## Step 5 — Secure the panel

Option A (Recommended): Edit .htaccess and add your IP address
  - Find your IP at https://whatismyip.com
  - Uncomment the IP restriction lines in .htaccess
  - Replace YOUR.IP.ADDRESS.HERE with your actual IP

Option B: The panel already has password protection built in.
  At minimum, make SA_PASSWORD very strong.

---

## Step 6 — Access the panel

Go to: https://iskool.xyz/superadmin/
Enter your SA_PASSWORD to log in.

---

## How to onboard a new school

Fill in the form:
1. School Name        → Full school name
2. Subdomain          → Short unique identifier (e.g. curro, sandtonhigh)
3. Admin First Name   → Principal or admin's first name
4. Admin Last Name    → Principal or admin's last name
5. Admin Email        → Their email address
6. Temp Password      → A temporary password (they change it after first login)

Click "Create School" — the system will:
✅ Create the database (iskowdbw_subdomain)
✅ Run the SQL template with all 41 tables
✅ Insert school name, access keys, academic year, admin account
✅ Create the subdomain (subdomain.iskool.xyz)
✅ Send branded welcome email with login details and access keys
✅ Log the school in the master database

Total time: ~30 seconds

---

## Troubleshooting

"Template SQL file not found"
→ Make sure iskool_new_school_template.sql is in the same folder as index.php

"PHPMailer not found"
→ Upload PHPMailer/src/ folder to /superadmin/PHPMailer/src/

"cPanel API error"
→ Check your API token is correct and hasn't expired
→ Make sure CPANEL_HOST is https://iskool.xyz:2083

"Master DB error"
→ Make sure you ran iskool_master.sql and created the iskowdbw_master database

---

## Security reminders

- Never share your SA_PASSWORD
- Never commit this file to GitHub with real credentials
- Rotate your cPanel API token every 6-12 months
- Add IP restriction in .htaccess when possible
- Change the superadmin folder name to something unpredictable
  e.g. /public_html/adm-7x9k2/ instead of /superadmin/

---

iSkool LMS — support@iskool.xyz — www.iskool.xyz
