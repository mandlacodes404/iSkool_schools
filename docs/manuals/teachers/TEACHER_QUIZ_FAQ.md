# iSkool Quiz System - FAQs & Troubleshooting Guide
## Common Teacher Questions Answered

---

## GENERAL QUIZ QUESTIONS

### Q: What's the difference between a Quiz and an Assignment?

**A:** 
| Feature | Quiz | Assignment |
|---------|------|-----------|
| **Duration** | Time-limited (10-120 min) | No time limit usually |
| **Format** | Structured questions | Open-ended (essay, project) |
| **Grading** | Auto-graded (MCQ/FITB) | Manual grading |
| **Feedback** | Instant for MCQ | Delayed (teacher grades) |
| **Use case** | Knowledge checks, tests | Projects, essays, submissions |
| **Best for** | Quick formative assessments | Comprehensive evaluations |

**When to use Quiz**: "Did students understand Chapter 3?"
**When to use Assignment**: "Can students write a 5-page research paper?"

---

### Q: Can I mix different question types in one quiz?

**A:** YES, absolutely! Example:
```
Quiz: "Chapter 5 Test"
├─ Questions 1-10: MCQ (multiple choice)
├─ Questions 11-15: FITB (fill in the blank)
└─ Questions 16-18: Open-ended (essays)
```

**IMPORTANT**: If you include even ONE open-ended question:
- You CANNOT check "Publish Marks" automatically
- You must grade open-ended responses manually
- Then publish marks after grading

If you ONLY use MCQ + FITB:
- "Publish Marks" can be enabled
- Marks appear to students immediately after submission

---

### Q: Can I change a quiz after students have started taking it?

**A:** ⚠️ **NOT RECOMMENDED** 

If students already started attempting the quiz:
- Changing questions will confuse students who already answered
- Grading becomes inconsistent
- Some students get easier/harder versions

**BEST PRACTICE**: 
1. Create quiz
2. Let a few trusted students test it
3. Make changes BEFORE opening to whole class
4. Once live, avoid changes mid-assessment

If you MUST change something:
- Consider closing that quiz
- Creating a new version with updates
- Informing all students of the change

---

### Q: Do all students in the class have to take the quiz at the same time?

**A:** Depends on Status:

**Status: SCHEDULED**
- Quiz opens at specific time (e.g., 9:00 AM)
- Students can start anytime after that
- Once they start, they have [Duration] minutes
- Example: Starts 9:00 AM, student can start at 9:00, 9:15, or 9:45
- Each student gets their own [Duration] timer from when THEY start

**Status: OPEN**
- Available 24/7
- Students can take it whenever they want
- Perfect for homework or self-paced practice

**Status: CLOSED**
- Not available at all
- Students can see it in list but can't click it

**To make ALL students start simultaneously**:
- Set Status: SCHEDULED
- Set start time: Specific date and time (e.g., Wed 2:00 PM)
- During class, have them all open it at same moment
- Note: Server time controls it, not client device time

---

### Q: What if a student's internet drops during the quiz?

**A:** 
- Their quiz attempt is saved
- If they have multiple attempts left, they can retake it
- Their previous attempt still counts and shows in history

**What teachers see**: All their attempts visible, can review each

**Student's perspective**: Can see all previous attempt scores

**Best practice for high-stakes exams**:
- Set Attempt Limit = 1 (no retake option)
- So if internet drops: they're done
- Or set Attempt Limit = 2 (one retry if tech failure)

---

## SETUP & CONFIGURATION QUESTIONS

### Q: I created a quiz with 10 questions worth 5 points each = 50 total points. But the marks show 100 out of 100. Why?

**A:** Most likely: The system converted to a percentage scale.

**What's happening**:
- Student got all 10 questions (10 × 5 = 50 points)
- Quiz total = 50 points
- 50/50 = 100%
- System displays as: "100/100" (percentage form)

**To verify**: Check quiz details
- Scroll down in the results view
- Should show breakdown per question
- Should show 5 pts, 5 pts, 5 pts, etc.

**Not a problem**: System is working correctly. Marks are calculated fairly.

---

### Q: I want students to retake the quiz to improve, but I don't want to see their worst attempts. Can I do that?

**A:** 
System shows ALL attempts (all are visible in gradebook).

**However**, you have options:

**Option 1**: Set Status based on phase
- First week: Status = Open, Attempt = 3 (practice phase)
- After practice week: Status = Closed (turns off)
- Then: Status = Open again (final assessment, Attempt = 1)
- Results: Old attempts archived, new attempt = real grade

**Option 2**: Manual review
- You can choose to grade the BEST attempt for each student
- Or take average of all attempts
- Document your grading policy clearly

**Option 3**: Communicate policy upfront
- Tell students: "I will take your best attempt score"
- Or: "I will average all attempts"
- Clear expectations prevent confusion

---

### Q: Can I create a quiz for one student only?

**A:** 

**Short answer**: Not per-student, but per-class.

**How it works**:
- Quiz belongs to a CLASS
- ALL students in that class can see it
- If you want differentiated quizzes:
  - Create Quiz 1 → Assign to Class A
  - Create Quiz 2 → Assign to Class B
  - (Same students in both classes? Both quizzes visible)

**Workaround for individual students**:
- Create quiz in a smaller class (if student is alone in that class)
- Or use manual quiz creation (manual_add_quiz.php) for individuals
- Assign to that student manually via grades section

---

### Q: I want to republish marks. Will that change the student's score?

**A:** 

If marks are already published:
- Student can see score
- If you UN-publish marks (hide them) and then RE-publish
- Score doesn't change (it's the same calculated number)
- Student just sees it appear, then disappear, then appear again
- Might confuse the student

**Instead**: 
- Contact admin to modify/reset quiz if score is wrong
- Or: Leave marks published and email student an explanation
- Or: If it's wrong due to YOUR grading error, ask admin to override

---

### Q: Can I assign different quiz settings to different classes?

**A:** 

**No**: A quiz belongs to ONE class and has ONE set of settings.

**But**: You can create similar quizzes for different classes
```
Example:
├─ "Chapter 3 Test - Class A" → 50 questions, 90 min
├─ "Chapter 3 Test - Class B" → 50 questions, 60 min
│  (Class B is younger, needs less time)
└─ "Chapter 3 Test - Class C" → 50 questions, 90 min
```

Each quiz has its own settings, but belongs to one class only.

---

## QUESTION TYPE QUESTIONS

### Q: What's the difference between "Free Type" and "Word Bank" for Fill-in-Blank?

**A:** 

**Free Type** (Student types whatever they want):
```
Q: "The chemical formula for salt is {blank}"
Student types: "NaCl"
How graded: Matched against list: ["NaCl", "NaCl", "sodium chloride"]
✅ Student typed "NaCl" → Correct!
❌ Student typed "salt" → Wrong (not on accepted list)
```
- Student has to remember and spell correctly
- Good for: Vocabulary, formulas, technical terms
- Testing: Memory + accuracy

**Word Bank** (Student selects from a list):
```
Q: "The chemical formula for salt is {blank}"
Options shown to student: [NaCl] [H2O] [CO2] [O2]
                         ↑ Correct answer
                         Other 3 are distractors
Student selects: NaCl
How graded: ✅ Correct!
```
- Student chooses from options (multiple choice variation)
- Good for: ESL, vocabulary building, hint support
- Testing: Recognition, understanding (not pure memory)

**Which to use?**
- **Free Type**: High school/college, you want to test spelling
- **Word Bank**: Elementary/ESL, you want to support learning
- **Free Type**: Math/science (equations must be precise)
- **Word Bank**: Language learning (students choosing helps confidence)

---

### Q: Can I allow multiple correct answers for an MCQ?

**A:** 

**Short answer**: Not in current system.

**How current system works**:
- MCQ = ONE correct answer only
- FITB = Can have multiple accepted variations

**Workaround if you have 2+ correct answers**:
```
Instead of marking both as "correct":
Mark one as correct, one as partially correct

Then in FITB instead:
Q: "Which of these is a valid approach to solving this problem?"
- Blank 1: "Method A"
- Blank 2: "Method B"
- Both worth points if selected
(FITB allows more flexibility)
```

Or: Use open-ended question where you evaluate student's reasoning

---

### Q: For Fill-in-Blank with multiple blanks, what's the difference between "Partial" and "All-or-Nothing"?

**A:** 

**EXAMPLE QUESTION**:
```
"The chemical equation: H2 + O2 → {blank1} + {blank2}"
Blank 1 correct answer: H2O
Blank 2 correct answer: energy
```

**Scenario A: Student gets Blank 1 right, Blank 2 wrong**

**If you chose PARTIAL scoring**:
- 1 blank correct out of 2 blanks
- Score: 50% of max points
- Example: 10 pts × 50% = 5 points awarded

**If you chose ALL-OR-NOTHING scoring**:
- Even though 1 is right, requirement is "all or nothing"
- Score: 0% of max points
- Example: 10 pts × 0% = 0 points awarded

**When to use each**:

**PARTIAL** (Better for learning):
```
Formative quizzes
Practice assessments
Younger students
When you want to reward effort
When partial understanding is valuable
```

**ALL-OR-NOTHING** (Better for high-stakes):
```
Summative exams
High school/college
Final assessments
When complete accuracy matters
When you want to set high bar
```

**Example: History essay incomplete sentence**
```
Q: "The Battle of {blank1} in {blank2} marked the turning point of the war."
Correct: blank1="Gettysburg", blank2="1863"

Partial Mode:
- Student: "Gettysburg" + "July 1863" 
- Gets 50% (one blank exactly right)

All-or-Nothing Mode:
- Same student: Gets 0% (second blank has extra word "July")
```

---

### Q: Can I use images in questions?

**A:** 

**YES**! 

**When creating a question**:
- Enter question text
- Option: Upload image
- Supported formats: JPG, PNG, GIF, WEBP
- Max size: 5 MB

**Example uses**:
```
Q: "What is this element?" [Shows periodic table image]
Q: "Identify the structure:" [Shows anatomy diagram]
Q: "What happens in this scene?" [Shows map/chart]
```

**Best practices**:
- Use clear, high-contrast images
- Compress images (5 MB max)
- Label important parts if needed
- Test on mobile (students might take on phones)

---

## GRADING & MARKS QUESTIONS

### Q: Why can't I publish marks for my quiz?

**A:** 

Most likely: Quiz contains **open-ended questions**

**Rule**: If quiz has ANY open-ended questions:
- System forces "Publish Marks" to OFF
- You cannot turn it on
- Because: You need to grade those manually first

**Solution**:
1. **Option A**: Remove all open-ended questions (delete them)
   - Then "Publish Marks" becomes available
   
2. **Option B**: Keep open-ended, but grade manually
   - Grade all open responses yourself
   - Assign points to each student manually
   - Then manually publish marks
   - Takes more work but allows depth

3. **Option C**: Use different question types
   - Instead of open-ended, use:
   - MCQ with multiple options
   - FITB for short answers
   - These auto-grade

---

### Q: A student retook the quiz and scored lower the second time. Which attempt do I grade?

**A:** 

**System shows ALL attempts** - you decide how to handle it.

**Three common policies**:

**Policy 1: BEST ATTEMPT (Most lenient)**
- Grade: 95% (first attempt)
- Ignore: 78% (second attempt)
- Best for: Learning-focused, formative quizzes
- Message to students: "I'll take your best score"

**Policy 2: MOST RECENT (Most common)**
- Grade: 78% (most recent attempt)
- Ignore: 95% (old attempt)
- Best for: Shows their current understanding
- Message to students: "Your most recent attempt counts"

**Policy 3: AVERAGE (Fair compromise)**
- Grade: (95% + 78%) / 2 = 86.5%
- Both attempts count equally
- Best for: Shows overall performance across attempts
- Message to students: "I average all attempts"

**IMPORTANT**: Tell students your policy UPFRONT before they take quiz
- Students need to know: "Which attempt counts?"
- Makes grading fair and transparent
- Prevents complaints

---

### Q: Can I give partial credit for an MCQ?

**A:** 

**Built-in system**: NO

MCQ is binary:
- Correct = Full points
- Incorrect = 0 points

**Workaround if you want partial credit**:
1. **Use Open-Ended instead**:
   - "Explain your thinking about this problem"
   - You manually grade and can give partial credit

2. **Use FITB**:
   - Break concept into sub-parts
   - Each blank can be correct or wrong
   - With "Partial" scoring: partial credit is awarded

3. **Manual override**:
   - Grade quiz normally
   - Then contact admin
   - Admin can manually adjust a student's score
   - You explain why (e.g., "Credit for partial work")

---

### Q: A student disputes their mark on an MCQ. They say their answer was correct even though the quiz marked it wrong. What do I do?

**A:** 

**Step 1**: Review the question
- Go to: Teacher Dashboard → Quizzes → View this quiz
- Check: What answer did you mark as correct?

**Step 2**: Check the student's submission
- View their attempt
- See exactly what they submitted

**Step 3**: Evaluate
- **If you marked wrong answer as correct**:
  - Contact admin
  - Ask them to correct the answer key
  - All student submissions will be re-graded automatically

- **If student's answer is valid but unlisted**:
  - Contact admin
  - Request to add that answer to accepted list
  - All students' submissions re-graded
  - Offer retroactive credit to all students (fairness)

- **If student's answer is truly wrong**:
  - Show them the reasoning
  - Your marked answer was correct per textbook/curriculum
  - Stand firm on grading

**Key principle**: If you made error, own it and fix it fairly

---

## LINEAR MODE (NO GOING BACK) QUESTIONS

### Q: My quiz is set to Linear Mode but the student says they scrolled back. Is that possible?

**A:** 

**No, not possible** in Linear Mode.

**How Linear Mode works**:
- Server-side architecture prevents previous questions
- Client-side (browser) disables back buttons
- Questions stored in sequence
- Can't access question 5 after moving to question 6

**What probably happened**:
1. Student reloaded page
   - Took them back to last submitted question
   - Confused them
   - Thought they "went back" mid-quiz

2. Student used browser Back button
   - Took them out of quiz entirely
   - When they resumed, quiz continued from where they left off

3. Student misunderstood progression
   - Thought next page = back when actually forward
   - Confusion about navigation

**What to do**: 
- Reassure student: "Linear mode prevents going back, so your attempt was fair"
- Explain: Reloading page doesn't violate linear mode
- Show them their submitted answer: "See, your answer was recorded"
- If they're still concerned: Review their specific answers

**Technical note for teachers**: 
If you're concerned about a specific student's attempt, you can:
- Ask admin to check server logs
- Verify when questions were submitted
- Confirm student didn't somehow cheat the system

---

### Q: Is Linear Mode stressful for anxious students?

**A:** 

**YES, it can be.**

**Why**:
- No review before submitting
- Can't go back to check work
- Must commit to each answer
- Creates pressure

**When to use Linear Mode anyway**:
- High-stakes exams (integrity required)
- Professional testing environments
- When cheating prevention is priority
- Exams with multiple students in same room

**When to avoid Linear Mode**:
- Anxious student populations
- Younger elementary students
- Formative/practice quizzes
- Self-paced learning

**If you must use Linear Mode**:
- Give students practice quiz first (single page) so they see format
- Prepare them mentally: "You'll see one question at a time"
- Provide study materials so they feel confident
- Be kind in feedback after

---

## ATTEMPT LIMIT QUESTIONS

### Q: I set attempt limit to 1, but I want to give one more chance to a struggling student. Can I do that?

**A:** 

**Once set, attempt limit applies to all students equally.**

**You cannot**:
- Change limit just for one student
- Retroactively add another attempt

**Options**:

**Option 1**: Create new quiz for that student
- Create separate quiz: "Make-up Quiz for [StudentName]"
- Assign to single student or class
- Student takes as new attempt

**Option 2**: Manual override
- Contact admin
- Request: "Reset attempts for student X"
- Admin can reset their attempt counter
- Student can retake

**Option 3**: Update quiz for everyone
- Change Attempt Limit from 1 to 2
- All students now can retake (not just struggling one)
- Fair but affects grading for everyone

**Option 4**: Manual mark entry
- Let student retake via another method (verbal, paper)
- You manually enter score in gradebook

**Best practice going forward**:
- For high-stakes: Attempt = 1 (firm)
- For medium-stakes: Attempt = 2 (one retry allowed)
- For practice: Attempt = Unlimited

---

## SHUFFLING & SECURITY QUESTIONS

### Q: I shuffled the questions, but when I took the quiz myself, I got the same order as Student A. Did shuffle break?

**A:** 

**No, shuffle is working fine.**

**How shuffle works**:
- Each new ATTEMPT gets new order
- Same student, same attempt = same order
- Different student = different order
- Different attempt = different order

**Example**:
```
You (teacher) take it: See Q3, Q1, Q5, Q2, Q4
Student A, Attempt 1: Sees Q2, Q4, Q3, Q1, Q5 (different)
Student A, Attempt 2: Sees Q4, Q5, Q2, Q3, Q1 (different from attempt 1)
Student B, Attempt 1: Sees Q1, Q2, Q3, Q4, Q5 (different from Student A)
```

**Why orders might look same**:
- Could be coincidence (randomization landed on same order)
- You took quiz after student A (different time = seed)
- Browser cached something (clear cache and retake)

**To verify shuffle works**:
- Have 2 students take quiz SIMULTANEOUSLY
- Compare their question orders
- Should be different

---

### Q: Is Linear Mode + Shuffle the best security setup?

**A:** 

**YES**. This is the most secure setup:

```
SECURITY LEVELS:

LEAST SECURE:
┌─ Single Page + No Shuffle
│  └─ Students see same order, can copy
│     all answers are identical across room
└─ Problem: Group cheating easy

MEDIUM SECURE:
┌─ Single Page + Shuffle
│  └─ Different order, but can still review
│     and students can collaborate
└─ Problem: Students can compare "What's Q5 for you?"

MORE SECURE:
┌─ Multi-Page (Linear) + No Shuffle
│  └─ Linear prevents review
│     but same order makes copying easier
│     (students memorize answers)
└─ Problem: Slight cheating risk

MOST SECURE:
┌─ Multi-Page (Linear) + Shuffle
│  └─ One at a time + different order
│     Can't review, can't copy, can't compare
│     Maximum integrity
└─ Best for: Final exams, high-stakes

RECOMMENDATION FOR EXAMS:
Linear Mode + Shuffle = Industry standard
Like: SAT, ACT, professional certifications
```

---

## TECHNICAL ISSUES

### Q: Quiz shows "Quiz Unavailable" message even though it's supposed to be Open. Why?

**A:** 

**Possible reasons**:

**Reason 1: Status is actually "Closed"**
- Check: Teacher Dashboard → Quizzes → Click quiz details
- If Status = "Closed" → Change to "Open"
- Save changes
- Wait 1-2 minutes for database update
- Have student refresh page

**Reason 2: Start time hasn't arrived yet**
- Quiz status = "Scheduled"
- Start time is still in the future
- Example: Start time = Tomorrow 9:00 AM, but it's still 5:00 PM today
- Solution: Change status to "Open" if you want immediate availability
- Or wait until start time arrives

**Reason 3: Server time is wrong**
- Check: Bottom of admin dashboard → Server time display
- If way off: Contact your hosting provider
- Very rare but possible if server isn't synced

**Reason 4: Student not in class**
- Student isn't registered in that class's roster
- So quiz doesn't show up at all (different error)
- Check: Class roster → Is student listed?

**Quick fix**:
1. Change Status to "Open"
2. Have student refresh browser
3. Should appear and be clickable

---

### Q: I see a student's attempt shows 0 points even though they answered correctly. Why?

**A:** 

**Possible reasons**:

**Reason 1: Auto-save didn't work**
- Student answered question but didn't click Next/Submit properly
- Attempt saved (system recorded an attempt)
- But answers weren't saved
- Shows 0 because no answers submitted

**Solution**: Have student retake if attempts remain

**Reason 2: FITB all-or-nothing mode**
- Quiz has FITB with multiple blanks
- Scoring mode = All-or-Nothing
- Student got 1 blank right, 1 blank wrong
- Scored: 0 points (not "all" correct)
- But this would show 0 for that question, not whole quiz

**Reason 3: System glitch**
- Rare but possible
- Attempt was recorded, but answers lost mid-submission
- Contact admin to investigate logs
- May be able to recover answers from database

**What to do**:
1. Show student their attempt
2. Verify: Did they answer the questions?
3. If yes but shows 0: Contact admin, explain issue
4. Admin can either:
   - Manually adjust score
   - Reset attempt so student can retake
   - Check server logs to understand issue

---

### Q: Multiple students report getting "Attempt limit reached" even though they only took quiz once. Why?

**A:** 

**Possible causes**:

**Cause 1: Partial submission counted as attempt**
- Student started quiz
- Hit submit button
- Lost internet mid-submission
- System recorded attempt (incomplete)
- Student sees attempt limit reached
- But they never finished first attempt

**Cause 2: Attempt limit set to 0 (interpreted as no attempts allowed)**
- Double-check your setting
- 0 = No attempts allowed
- 1 = 1 attempt allowed
- 2+ = That many attempts

**Cause 3: Quiz was reset by you/admin for some students, not others**
- You asked admin to reset attempts for one student
- But database issue caused reset for multiple
- Or you changed attempt limit mid-quiz (all students affected)

**What to do**:
1. Check quiz settings: What's Attempt Limit currently set to?
2. If wrongly set:
   - Change it to correct number
   - Contact admin to reset attempts for affected students
   - Send apology email explaining situation
   - Let students retake
3. If correctly set:
   - Contact admin
   - Have them check server logs
   - Investigate why false limit reached

---

## STUDENT EXPERIENCE QUESTIONS

### Q: Do students see which questions they got wrong immediately?

**A:** 

**Depends on your quiz setup**:

**If Publish Marks = YES**:
- ✅ Students see results immediately after submit
- They see: Score (e.g., 18/20 = 90%)
- They see: Which questions marked correct/incorrect
- They see: Their submitted answers vs. correct answer
- **Feedback is instant**

**If Publish Marks = NO**:
- ❌ Students see: "Attempt submitted"
- They see: Nothing yet (scores hidden)
- After you publish: Then they see marks
- Feedback is delayed

**For Open-Ended Questions**:
- Always hidden until you grade and publish
- You manually assign points
- Then student sees their score + your feedback

**Best for learning**: Publish Marks YES
- Students learn faster with immediate feedback
- See what they got wrong while topic is fresh
- But only works if quiz has no open-ended questions

---

### Q: Can students retake a quiz after the due date?

**A:** 

**Depends on Status + Attempt Limit**:

```
Scenario 1: Status = CLOSED
- No
- Students see "Quiz Unavailable"
- Cannot click it
- Cannot retake after closing

Scenario 2: Status = OPEN, Attempt Limit = 2
- Yes
- Quiz stays open forever
- Students can retake anytime if attempts remain
- No due date enforcement in system

Scenario 3: Status = SCHEDULED, Start date = June 10
- Yes
- Once start time passes, quiz available until you change status
- You can manually close it when done
```

**To enforce a due date**:
1. Use Status = SCHEDULED (specific start date)
2. When due date arrives: Change Status to CLOSED
3. Students can no longer retake

**OR**: Keep Status = OPEN but tell students (via email/announcement):
- "Due date is Friday"
- "I will only count submissions before Friday"
- System doesn't enforce it, you manually check timestamps
- Relies on student honesty + your follow-up

**Best practice for exams**: Use Status = CLOSED after deadline

---

## COMMON WORKFLOWS & SOLUTIONS

### Workflow 1: "I want students to self-study before the real test"

```
GOAL: Let students practice without grades counting

SETUP:
├─ Create "Chapter 3 Practice Quiz"
│  ├─ Duration: 30 min (same as real test)
│  ├─ Attempt: Unlimited
│  ├─ Layout: Single Page (less stress)
│  ├─ Shuffle: YES (mirrors real test)
│  ├─ Publish Marks: YES (immediate feedback helps learning)
│  ├─ Summative: NO ← Key point (practice only)
│  └─ Questions: 20 MCQ (same type as real test)

THEN (few days later):
├─ Create "Chapter 3 Test" (Real assessment)
│  ├─ Duration: 30 min
│  ├─ Attempt: 1
│  ├─ Layout: Multi-Page (Linear)
│  ├─ Shuffle: YES
│  ├─ Summative: YES
│  ├─ Weight: 15%
│  └─ Status: Scheduled (specific date)

RESULT:
- Students practice as much as they want (no pressure)
- Real test is high-stakes (integrity controls)
- Different questions so memorization doesn't help
- Students better prepared
```

---

### Workflow 2: "I want to grade responses, give feedback, then publish marks"

```
GOAL: Manual review before students see marks

SETUP:
├─ Create quiz with Open-Ended questions
│  ├─ Questions: Mix MCQ + Open responses
│  ├─ Publish Marks: NO (system forces this)
│  └─ Status: Scheduled or Open

STUDENT TAKES QUIZ:
├─ Submits answers
├─ Sees: "Thank you, submission received"
├─ Does NOT see: Their score yet (marks are hidden)

YOU GRADE:
├─ Go to: Results → Review each submission
├─ Read their open responses
├─ Assign points for open-ended
├─ Type feedback comment
├─ Save

YOU PUBLISH:
├─ After all students graded
├─ Click: "Publish Marks" button
├─ All students now see: Scores + Your feedback

STUDENTS RECEIVE:
├─ Notification: "Marks published in [Quiz Name]"
├─ See: Final score breakdown
├─ See: Your written feedback comments
```

---

### Workflow 3: "Some students got low scores and want to retake"

```
ORIGINAL QUIZ SETTINGS:
├─ Attempt Limit: 1
├─ Status: Closed (you closed it after assessment)

STUDENT ASKS: "Can I retake to improve?"

YOUR OPTIONS:

Option A: Stay firm (1 chance only)
├─ Response: "Unfortunately, the quiz is closed with 1 attempt allowed"
├─ Why: High-stakes policy, fairness to others
└─ Appropriate for: Final exams, summative tests

Option B: Create a make-up quiz
├─ Create new quiz: "Chapter 3 Make-up Quiz"
├─ Assign to: That student or whole class
├─ They can take it anew
├─ You decide: Does make-up score replace original? Or average?
└─ Appropriate for: Formative quizzes, legitimate hardship

Option C: Change the original quiz (affects everyone)
├─ Change Attempt Limit from 1 to 2
├─ Status: Open
├─ All students can now retake
├─ Pro: Fair to everyone
├─ Con: Changes grading for everyone (might lower your overall)
└─ Use only if you're OK with everyone retaking

Option D: Manual override
├─ Ask admin: "Reset attempts for [Student Name]"
├─ Admin resets counter
├─ Student can retake original quiz
├─ Their previous score remains visible
└─ Appropriate for: Technical issues, special circumstances
```

---

## BEST PRACTICES CHECKLIST

Before you publish quiz, verify:

- [ ] **Duration realistic?** (Can students finish in time?)
- [ ] **Questions clear?** (Did you proofread for typos?)
- [ ] **Answer key correct?** (Especially for open-ended rubric)
- [ ] **Test yourself?** (Take your own quiz first)
- [ ] **Point values logical?** (Do total points make sense?)
- [ ] **Status correct?** (Scheduled for right date? Closed when you meant Open?)
- [ ] **Class correct?** (Assigned to right group of students?)
- [ ] **Start time set?** (If Scheduled, when should it open?)
- [ ] **Attempt limit appropriate?** (1 for exams, unlimited for practice?)
- [ ] **Summative weight set?** (If it counts, what percent?)
- [ ] **Publish Marks thought through?** (Open-ended? Can't auto-publish)
- [ ] **Shuffle decided?** (Same room? Turn ON)
- [ ] **Layout chosen carefully?** (Linear = scary, Single = friendly)
- [ ] **Test instructions provided?** (Will students understand what to do?)

---

## STILL STUCK?

If this FAQ doesn't answer your question:

1. **Check the full manual**: TEACHER_QUIZ_MANUAL.md
2. **Use the cheat sheet**: TEACHER_QUIZ_CHEATSHEET.md
3. **Follow decision guide**: TEACHER_QUIZ_DECISION_GUIDE.md
4. **Contact your admin/tech coordinator**: They can help with technical issues

---

**Good luck with your quizzes! Teaching is better with good assessment tools. 📝✨**
