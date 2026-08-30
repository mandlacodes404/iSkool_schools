# iSkool Teacher's Complete Quiz Manual
## A Comprehensive Guide to Creating, Managing, and Understanding Quizzes

---

## Table of Contents
1. [Overview: What Are Quizzes?](#overview)
2. [Getting Started: Creating Your First Quiz](#getting-started)
3. [Quiz Configuration Options](#quiz-configuration)
4. [Question Types Explained](#question-types)
5. [Layout Modes: Choosing the Right Format](#layout-modes)
6. [Advanced Features](#advanced-features)
7. [Best Practices by Assessment Type](#best-practices)
8. [Troubleshooting Common Issues](#troubleshooting)
9. [Practical Examples](#examples)

---

## Overview: What Are Quizzes? {#overview}

**Quizzes** are automated assessments that allow you to:
- Test student understanding of class content
- Provide immediate feedback on MCQ questions
- Create formative (practice) or summative (graded) assessments
- Track student progress across multiple attempts
- Differentiate between high-stakes exams and quick formative checks

### Key Differences: Quizzes vs. Assignments
- **Quizzes**: Time-limited, automatically graded (MCQ), immediate results
- **Assignments**: Usually longer, may include submissions, manual grading
- **Quizzes** are ideal for: Knowledge checks, vocabulary, quick understanding tests
- **Assignments** are ideal for: Projects, essays, problem-solving

---

## Getting Started: Creating Your First Quiz {#getting-started}

### Step-by-Step Creation Process

1. **Navigate to Quizzes Section**
   - Log in as a teacher
   - Go to Teacher Dashboard > Quizzes
   - Click "Create New Quiz"

2. **Fill in Basic Information**
   - **Quiz Title**: Use a clear, descriptive name
     - ✅ Good: "Chapter 3: Photosynthesis Quiz"
     - ❌ Poor: "Quiz 1"
   
3. **Select Target Class**
   - Choose the class this quiz is for
   - A quiz belongs to one class only
   - All students in that class can access it (if it's Open status)

4. **Set Quiz Duration**
   - Time allowed in minutes (1-180 minutes)
   - **Why this matters**:
     - Formative quizzes: 5-15 minutes (quick checks)
     - Standard assessments: 20-60 minutes (moderate depth)
     - High-stakes exams: 60-180 minutes (comprehensive coverage)

5. **Set Start Time**
   - When the quiz becomes available to learners
   - **Important**: This is server-side controlled (cannot be bypassed)

6. **Choose Status**
   - **Scheduled**: Quiz opens at specified start time
   - **Open**: Quiz available immediately (regardless of start time)
   - **Closed**: Quiz cannot be taken (useful for archiving)
   - **When to use each**:
     - Scheduled: When you want all students to start at same time
     - Open: For practice quizzes or ongoing availability
     - Closed: After assessment period ends

7. **Select Summative (Optional)**
   - Check this if the quiz counts toward the term mark
   - **What this means**: The score contributes to the learner's overall grade
   - **Un-checked**: Quiz is formative (practice only)

8. **If Summative: Set Weight Percentage**
   - How much this quiz contributes to the term mark
   - Example: If weight is 10%, this quiz = 10% of term grade
   - **Tip**: All summative assessments should total 100%

---

## Quiz Configuration Options {#quiz-configuration}

### 1. Quiz Timing

#### Duration
- **Minimum**: 1 minute (for ultra-quick checks)
- **Maximum**: 180 minutes (3 hours - for comprehensive exams)
- **Real-world examples**:
  - Vocabulary check: 5 minutes
  - Chapter review: 15 minutes
  - Mid-term exam: 60 minutes
  - Final exam: 120-180 minutes

**Why duration matters**:
- Too short: Students feel rushed, may skip thinking
- Too long: Student fatigue, reduced concentration
- Just right: Students have time to think but stay focused

#### Start Time
- Controls when quiz becomes available
- Uses server time (cannot be bypassed by changing device time)
- **Best practice**: Set start time 5-10 minutes before class to ensure technical issues don't delay start

**Scenario**: Your class has high school students doing a timed exam
- Set status: **Scheduled**
- Set start time: Exactly 9:00 AM (exam start)
- Set duration: 120 minutes
- All students see "Quiz Not Available" until 9:00 AM
- At 9:00 AM sharp, all can begin simultaneously

---

### 2. Status Management

| Status | Visible? | Can Attempt? | Use Case |
|--------|----------|--------------|----------|
| **Open** | ✅ Yes | ✅ Yes | Practice quizzes, ongoing assignments |
| **Scheduled** | ✅ Yes | Only after start time | Time-controlled assessments |
| **Closed** | ✅ Yes | ❌ No | After assessment ends, archive |

**Workflow Example**:
1. Create quiz as **Closed** (students can't see it's ready)
2. Change to **Open** when you want students to practice
3. Change to **Closed** after due date (students can still see it, just can't take it)

---

### 3. Attempt Management

#### Attempt Limit
- **0** = Unlimited attempts (students can retake as many times as they want)
- **1** = Single attempt only (no retakes)
- **2-10** = Specific number of attempts

**When to use each**:
- **Unlimited**: Formative quizzes (practice), learning objectives
- **1 attempt**: High-stakes summative assessments, exams
- **2-5 attempts**: Medium-stakes assessments with revision allowed
- **10+ attempts**: Vocabulary or skill-building where repetition helps

**Example Scenarios**:

*Scenario A: High School Final Exam*
- Attempt limit: **1**
- Status: **Scheduled**
- Publish marks: **Yes** (after grading open-ended if any)
- Reasoning: Students get one shot; controls test integrity

*Scenario B: ESL Vocabulary Quiz*
- Attempt limit: **Unlimited**
- Status: **Open**
- Publish marks: **No** (let them practice without judgment)
- Reasoning: Students learn better when they can retry

*Scenario C: Chapter Review Quiz*
- Attempt limit: **3**
- Status: **Open**
- Publish marks: **Yes** (auto-grade MCQ)
- Reasoning: Students study harder knowing they can improve after first attempt

---

### 4. Summative vs. Formative

#### Summative Quizzes (Count toward Grade)
- ✅ Checkbox: "Counts toward term mark"
- You specify a **Weight Percent** (e.g., 15%)
- Score is included in learner's final grade
- **Use for**: Major assessments, chapter tests, exams

#### Formative Quizzes (Practice Only)
- ❌ Unchecked (default)
- Does NOT affect learner's final grade
- **Use for**: Daily warm-ups, skill checks, homework

**Important Rule**: If your quiz has **open-ended questions**, you CANNOT publish marks automatically. You must grade responses manually first.

---

## Question Types Explained {#question-types}

Your quiz can include three different types of questions, each with different grading behavior.

### Type 1: Multiple Choice (MCQ)

#### What It Is
Students select ONE correct answer from multiple options.

#### Structure
```
Question: "What is the capital of France?"
Options:
  A) London
  B) Paris  ✓ (Correct answer)
  C) Berlin
  D) Madrid
```

#### Auto-Grading
- ✅ Automatic (instant feedback)
- Correct: Full points
- Incorrect: 0 points (no partial credit)

#### When to Use
- Factual recall ("Who wrote Hamlet?")
- Conceptual understanding ("Why do plants need photosynthesis?")
- Quick knowledge checks
- Objective assessments

#### Pros
- Instant grading (learners see results immediately)
- No teacher effort for grading
- Objective (no bias)

#### Cons
- Can't capture complex thinking
- Students can guess
- Limited depth of understanding

#### Configuration
- Enter question text
- Add 2+ answer choices
- Mark ONE as correct
- Assign points (1-100)
- Can add image to illustrate question

#### Example: Good MCQ
```
Question: "In the equation 2x + 5 = 15, what is the value of x?"
A) 5
B) 7.5
C) 10  ✓
D) 20
Points: 2
```

#### Example: Poor MCQ
```
Question: "Is climate change real?"
A) Yes  ✓
B) No
Points: 5
```
❌ **Why it's poor**: Question is too subjective; better to ask "What evidence shows climate change?" with science-based options.

---

### Type 2: Open-Ended Questions

#### What It Is
Students provide free-text answers (short essay, paragraph, explanation, short answer).

#### Structure
```
Question: "Explain why the French Revolution happened. (5-10 sentences)"
Student answers in: Text box
Learner sees: [Large text field to type]
```

#### Grading
- ❌ **NOT Automatic** - YOU must manually grade
- You read each response and assign points (0 to max points)
- Can be subjective but allows depth

#### When to Use
- "Why" and "how" questions
- Opinion-based discussions with rubric
- Complex problem-solving
- Critical thinking demonstrations
- Creative responses

#### Pros
- Captures complex thinking
- Shows understanding depth
- Allows for partial credit
- Encourages thoughtful responses

#### Cons
- Requires manual grading (time-intensive)
- Subjective (consistency important)
- No instant feedback
- **Cannot auto-publish marks** if quiz contains open-ended

#### Configuration
- Enter question text (no choices needed)
- Assign maximum points
- Students see large text box for typing
- You grade each response individually after quiz closes

#### Important Rules
1. **No auto-grading**: You must manually grade all responses
2. **Mark publication blocked**: System prevents auto-publishing marks when open-ended questions exist (you must grade first)
3. **Points assignment**: You can give 0-100 for each response
4. **Feedback**: You can type feedback for each student's answer

#### Example: Good Open-Ended Question
```
Question: "Analyze the relationship between supply and demand in the coffee market during last year's shortage. Consider at least three factors affecting prices."
Max Points: 10
Student answer type: Paragraph (200-400 words expected)
Grading: You read, evaluate understanding, assign points (0-10)
```

#### Example: Poor Open-Ended Question
```
Question: "What do you think about poetry?"
Max Points: 5
```
❌ **Why it's poor**: Too vague; no clear criteria for grading. Better: "Choose a poem from our unit and explain how the author used metaphor to convey emotion. Cite 2-3 specific examples."

---

### Type 3: Fill in the Blank (FITB)

#### What It Is
Students complete sentences/passages with missing words. Highly flexible for various assessment types.

#### Structure
```
Question: "Photosynthesis is the process by which {blank} use light to convert {blank} into glucose."
Student answers:
- First blank: "plants"
- Second blank: "water and carbon dioxide"
Blanks are auto-graded based on accepted answers you specify
```

#### Auto-Grading
- ✅ **Automatic** (instant feedback)
- Graded by matching student input against accepted answers
- Can be case-sensitive or case-insensitive
- Supports partial credit modes

#### When to Use
- Vocabulary completion ("The process of blood circulation is called {blank}")
- Factual recall with spelling requirements
- Sentence structure ("The subject of the sentence is {blank}")
- Math answers ("If 3x = 15, then x = {blank}")
- Language learning (conjugations, translations)

#### Pros
- Automatic grading
- Tests specific knowledge
- Students see exact requirements
- Flexible with multiple accepted answers

#### Cons
- Can be tricky to grade spelling/variations
- Doesn't test complex thinking
- Requires good planning of accepted answers

#### FITB Configuration: Two Sub-Types

##### **Option A: Free Type**
Students type their answer freely.
```
Question: "The currency of Japan is the {blank}"
Accepted answers: ["yen", "Yen", "Japanese yen"]
Case sensitive: No (both "yen" and "Yen" accepted)
```
- Students type what they think
- Compared to list of acceptable answers you provide
- Good for: vocabulary, simple facts
- Tip: Provide multiple variations (singular/plural, uppercase/lowercase)

##### **Option B: Word Bank**
Students select answer from a list of words (including distractors).
```
Question: "The cell {blank} contains DNA."
Word bank: [nucleus, mitochondria, ribosome, cytoplasm]
                    ↑ Correct
              Correct answer plus 3 distractors
```
- Students choose from dropdown or buttons
- Includes "distractor" words (wrong answers that sound plausible)
- Good for: reducing random guessing, ESL, confidence building
- Tip: Distractors should be related but clearly wrong to assessment level

#### FITB Scoring Modes

**When you have 2+ blanks in one question**, choose how to award points:

##### **Partial Scoring**
```
Question: "The {blank1} is in {blank2}"
Correct answers: blank1="nucleus", blank2="cell"

Scenario: Student gets blank1 correct, blank2 wrong
Scoring: 50% of points awarded (1 out of 2 blanks correct)
```
- Student effort partially rewarded
- Encourages completing the question
- Points awarded: Points × (Blanks Correct / Total Blanks)
- **Best for**: Building confidence, formative quizzes

##### **All-or-Nothing Scoring**
```
Same question and student response above
Scoring: 0% of points awarded (didn't get BOTH blanks)
Total: 0 points (even though 1 blank was correct)
```
- All blanks must be correct to earn points
- Stricter grading
- **Best for**: High-stakes summative assessments, exact knowledge required

#### Real-World Example: Language Class
```
Question: "Je suis {blank1} et je {blank2} être professeur."
Blank 1 Accepted: ["français", "français", "French"]
Blank 2 Accepted: ["veux", "want"]

Scoring Mode: All-or-Nothing (you want complete sentences)
Student response: "français" and "veux"
Result: ✅ 10 points (both correct)

Student response: "français" and "vois" (wrong verb)
Result: ❌ 0 points (one blank incorrect in all-or-nothing mode)
```

---

## Layout Modes: Choosing the Right Format {#layout-modes}

When students take your quiz, they see questions in one of two layouts. This choice affects user experience and test integrity.

### Mode 1: Single Page (All Questions at Once)

#### What Students See
- All questions visible on ONE screen
- Student can scroll to see all questions
- **Can navigate freely**: Jump between questions, review, change answers
- Can see which questions they haven't answered

#### When to Use
- **Formative quizzes** (practice, no stakes)
- **Short quizzes** (5-10 questions)
- **Low-risk assessments**
- Learning and exploration
- When you want students to review before submitting

#### Pros
- Less stressful for learners
- Can review before submitting
- Better for self-paced learning
- Good for younger students (less intimidating)
- Students can use time efficiently (skip hard question, come back)

#### Cons
- Students might copy from neighbors in physical classroom
- Easy to cheat (skip ahead, look at answers, go back)
- Not ideal for high-stakes exams
- Doesn't prevent test-taking shortcuts

#### Example Scenario: Middle School Math Quiz
```
Setup:
- Mode: Single Page
- Duration: 20 minutes
- Attempt limit: Unlimited
Purpose: Practice before test
Learner experience:
1. Sees all 20 math problems at once
2. Can answer question 5, then question 15, then go back
3. Can review and change answers before submitting
4. Auto-grading gives feedback immediately
Result: Students learn from mistakes, build confidence
```

---

### Mode 2: Multi-Page (Linear Progression / One Question Per Page)

#### What Students See
- **ONE question per screen**
- Must answer before moving to next question
- **Cannot go backward** (no review, no changing answers)
- Shows progress bar: "Question 3 of 20"
- **Forced progression**: Next button only appears after answering current question

#### When to Use
- **High-stakes exams** (tests, final exams)
- **Standardized assessments** (where you need integrity)
- **Summative quizzes** (graded quizzes)
- **Large classes** (reduces cheating)
- When you want to prevent changing answers

#### Pros
- **Reduces cheating**: Can't look ahead or check answers
- **Prevents second-guessing**: Encourages committed thinking
- **Test integrity**: Standard testing format
- **Professional**: Matches real exam conditions
- **Prevents erasure**: Students can't change previous answers

#### Cons
- More stressful for learners (no safety net)
- Can't review before submitting
- Harder for anxious students
- Less suitable for learning/practice contexts
- Can't escape difficult questions

#### Important Rule About Linear Mode
- Students CANNOT go back
- Once they click Next, they can NEVER see that question again
- They can't change their answer
- This is permanent throughout the quiz

#### Example Scenario: High School Final Exam
```
Setup:
- Mode: Multi-Page (Linear)
- Duration: 120 minutes
- Attempt limit: 1
- Status: Scheduled (strict timing)
Purpose: Final summative assessment
Learner experience:
1. Quiz starts, sees ONLY Question 1 (of 50)
2. Must answer question 1 and click Next
3. Now sees ONLY Question 2 - cannot go back to Q1
4. Continues through all 50 questions
5. No review possible
6. Once submitted, cannot retake (attempt limit = 1)
Result: Standard exam conditions, high integrity
```

---

### Comparison Chart

| Feature | Single Page | Multi-Page (Linear) |
|---------|-------------|--------------------|
| All questions visible? | ✅ Yes | ❌ No (one at a time) |
| Can skip questions? | ✅ Yes | ❌ No (linear order) |
| Can review answers? | ✅ Yes | ❌ No |
| Can change answers? | ✅ Yes | ❌ No |
| Test integrity | Low | ⭐⭐⭐ High |
| Student stress | Low | High |
| Cheating risk | High | Low |
| Best for | Practice | Exams |

---

## Advanced Features {#advanced-features}

### Feature 1: Shuffle Questions

#### What It Does
Randomizes the order of questions for each student attempting the quiz.

#### Why This Matters
```
Without Shuffle:
- Student A sees: Q1, Q2, Q3, Q4, Q5
- Student B sees: Q1, Q2, Q3, Q4, Q5
- Copying answers is easy ("What did you get for Q3?")

With Shuffle:
- Student A sees: Q3, Q1, Q5, Q2, Q4
- Student B sees: Q2, Q4, Q1, Q3, Q5
- Harder to copy (different question order)
```

#### When to Use
- **Large classes** (high cheating risk)
- **Classroom assessments** (students sitting near each other)
- **High-stakes summative quizzes**
- **MCQ assessments** (most vulnerable to copying)

#### When NOT to Use
- **Formative practice quizzes** (order helps learning)
- **Quizzes with dependent questions** (Q4 depends on Q2 answer)
- **Progressive difficulty** (where you want easier questions first)

#### How It Works With Other Features
- **Shuffle + Single Page + Unlimited Attempts**: 
  - Each attempt shows questions in different random order
  - Students see all, but different order each time
  - Reduces direct copying but keeps single-page ease

- **Shuffle + Multi-Page + 1 Attempt**:
  - Questions appear in different order
  - One at a time, can't go back
  - Maximum integrity for high-stakes exams

#### Example: Large Secondary School Biology Class
```
Setup:
- Shuffle: ✅ Enabled
- Single Page: ✅ Yes
- Attempt limit: 2
Class has 50 students, quiz has 25 questions
Result:
- First attempt: Student A sees Q3, Q7, Q1, ...
- First attempt: Student B sees Q15, Q2, Q9, ...
- Can't simply compare answers ("What's your Q7?")
- Different order makes copying harder
```

---

### Feature 2: Publish Marks

#### What It Does
Controls whether student scores appear automatically.

#### Important Rules
1. **Can only be enabled if quiz has NO open-ended questions**
   - MCQ only → ✅ Can publish marks
   - MCQ + Fill-in-Blank → ✅ Can publish marks
   - MCQ + Open-Ended → ❌ Cannot publish marks
2. When enabled: Marks appear to students immediately after submission
3. When disabled: Marks hidden until you manually publish or select individual scores to show

#### When to Enable "Publish Marks"
- Formative practice quizzes (instant feedback is pedagogically better)
- All-MCQ quizzes (no manual grading needed)
- Assessment is meant to be learning experience (feedback helps)

#### When to Disable "Publish Marks"
- Summative high-stakes exams (you may want to review first)
- Quizzes with open-ended questions (must grade manually first)
- When you want to provide feedback before showing marks
- When you want to moderate marks across class

---

### Feature 3: Attempt Tracking

#### How Attempts Work
```
Quiz with Attempt Limit = 3

First Attempt:
- Student takes quiz, answers all questions
- Submits
- Score recorded: 85%

Second Attempt (Week later):
- Student takes same quiz again
- Different questions (if shuffle enabled)
- Submits
- Score recorded: 92%

Third Attempt:
- Student takes quiz final time
- Submits
- Score recorded: 88%

After 3 attempts: System says "No more attempts available"
```

#### How Teachers See It
- Can view all attempts for each student
- Can see improvement (or lack thereof)
- Can review answers from each attempt
- Most recent attempt usually counts

#### Learner View
- See "Attempt 2 of 3" counter
- See previous attempt scores
- Know exactly how many attempts remain

---

## Best Practices by Assessment Type {#best-practices}

### Scenario 1: Formative Daily Warm-Up Quiz

**Goal**: Quick check of understanding, build confidence

| Setting | Choice | Why |
|---------|--------|-----|
| Duration | 5-10 min | Quick, not intimidating |
| Attempt Limit | Unlimited | Students learn by retrying |
| Layout | Single Page | Low stress, allows review |
| Question Type | MCQ + FITB | Auto-graded, instant feedback |
| Shuffle | No | Order helps learning |
| Publish Marks | Yes | Immediate feedback motivates |
| Status | Open | Available all week |
| Summative | No | Purely formative |

**Example Setup:**
```
Title: "Monday Vocab Warm-up: Chapter 5"
Duration: 8 minutes
Attempt Limit: Unlimited
Layout: Single Page
Status: Open
Questions: 10 vocab MCQ
Publish Marks: Yes
```

---

### Scenario 2: Unit Review Quiz (Before Test)

**Goal**: Help students prepare, identify weak areas

| Setting | Choice | Why |
|---------|--------|-----|
| Duration | 20-30 min | Enough time to think |
| Attempt Limit | 2-3 | Can learn from first attempt |
| Layout | Single Page | Encourages strategic thinking |
| Question Type | MCQ + Open-ended | Variety of thinking levels |
| Shuffle | Yes | Mimics test conditions |
| Publish Marks | No (if open-ended) | You review first |
| Status | Scheduled | Opens specific date |
| Summative | No | Practice only |

**Example Setup:**
```
Title: "Unit 3 Review Quiz"
Duration: 25 minutes
Attempt Limit: 2
Layout: Single Page
Status: Scheduled (Opens day before test)
Questions: 5 MCQ + 3 open-ended
Shuffle: Yes
```

---

### Scenario 3: Summative Chapter Test

**Goal**: Assess mastery, grade counts toward average

| Setting | Choice | Why |
|---------|--------|-----|
| Duration | 45-90 min | Comprehensive assessment |
| Attempt Limit | 1 | Single chance, high integrity |
| Layout | Multi-Page (Linear) | Prevents cheating, no going back |
| Question Type | MCQ + FITB only | Auto-graded, objective |
| Shuffle | Yes | Different test for each student |
| Publish Marks | Yes | Auto-grade, no open-ended |
| Status | Scheduled | Specific date/time |
| Summative | Yes | Counts toward grade |
| Weight | 15-20% | Appropriate impact on final mark |

**Example Setup:**
```
Title: "Chapter 4 Summative Test"
Duration: 60 minutes
Attempt Limit: 1
Layout: Multi-Page (Linear)
Status: Scheduled (Specific date)
Questions: 25 MCQ + 5 FITB
Shuffle: Yes
Publish Marks: Yes
Summative: Yes (15% weight)
```

---

### Scenario 4: High-Stakes Final Exam

**Goal**: Comprehensive assessment of course mastery

| Setting | Choice | Why |
|---------|--------|-----|
| Duration | 120-180 min | Full exam time |
| Attempt Limit | 1 | Once only, highest stakes |
| Layout | Multi-Page (Linear) | Professional exam format |
| Question Type | MCQ + FITB only | No subjective grading |
| Shuffle | Yes | Maximum integrity |
| Publish Marks | Yes | Auto-graded immediately |
| Status | Scheduled | Exact date/time |
| Summative | Yes | Final assessment |
| Weight | 25-30% | Significant final impact |

**Example Setup:**
```
Title: "Year 11 Final Exam - Biology"
Duration: 120 minutes
Start Time: 9:00 AM sharp
Attempt Limit: 1
Layout: Multi-Page (Linear)
Status: Scheduled
Questions: 40 MCQ + 8 FITB = 100 marks
Shuffle: Yes
Publish Marks: Yes
Summative: Yes (30% weight)
```

---

## Troubleshooting Common Issues {#troubleshooting}

### Issue 1: "I Can't Publish Marks"

**Problem**: Publish Marks checkbox is disabled/greyed out

**Reason**: Your quiz contains open-ended questions

**Solution**:
1. Remove all open-ended questions (delete them), OR
2. Keep open-ended but manually grade them first, then publish

**Code Logic**:
```
if quiz contains open-ended questions:
    publish_marks = FALSE (forced)
    message: "Cannot auto-publish - must grade open-ended responses first"
else:
    publish_marks = user choice
```

---

### Issue 2: "Students Can Still Retake After Limit"

**Problem**: Attempt limit says "1" but students retook quiz

**Reason**: You haven't submitted the quiz settings (hit Save/Submit)

**Solution**:
1. Check: Did you click the Create/Save button?
2. Wait 1-2 minutes for database to update
3. Have student refresh page
4. Try again on fresh session

---

### Issue 3: "Linear Mode - Student Says They Saw Previous Question"

**Problem**: Student claims they went back and saw question 5 again

**Why This Shouldn't Happen**: Linear mode architecture prevents this
- Questions stored server-side in sequence
- Client-side can't access previous questions
- "Back" button disabled in quiz interface

**What Probably Happened**:
- Student reloaded page (took them back to last submitted question)
- Student confused question numbers
- Browser cache showing old data

**Solution**:
- Check quiz record (what question DID they answer?)
- Have them clear cache and retry
- Confirm linear mode was actually enabled when they took it

---

### Issue 4: "Why Are Marks Different Than Expected?"

**Problem**: Student got 16/20 but system shows 14/20

**Likely Reason 1**: MCQ worth different points than assumed
- If questions are 1, 1, 2, 2, 2, 2, 2, 2, 2, 2 points
- 8 questions correct but different point values → 16/20 not 8/20

**Likely Reason 2**: Fill-in-Blank scoring mode
- "All-or-Nothing" mode: All blanks in question must be correct
- Student got 1 of 2 blanks correct → 0 points for that question

**Solution**:
- Check the Points value for each question
- Check if FITB uses "Partial" or "All-or-Nothing"
- Review with student, show them the math

---

### Issue 5: "Students See Quiz But Can't Click It"

**Problem**: Quiz appears in list but can't take it

**Likely Reason**: Status is "Closed" OR start time hasn't arrived

**Solution**:
1. Check Quiz Status:
   - Open → Should work
   - Scheduled → Check start time (is it in future?)
   - Closed → Can't take (change to Open or Scheduled)

2. Check Start Time:
   - Is it in the future? → Student sees "Not available yet"
   - Is it in the past? → Should be available

3. Server Time Check:
   - Make sure server time is correct
   - Student device time doesn't matter (server-side check)

---

### Issue 6: "Student Submitted Quiz But Status Shows 'In Progress'"

**Problem**: Quiz shows as "In Progress" for one student while others show "Completed"

**Reason**: Timing out or session was interrupted before final submit

**Solution**:
- Student should retake quiz (if attempts remaining)
- You can manually mark quiz as complete in database if needed
- Check their browser console for JavaScript errors

---

### Issue 7: "Multiple Attempts Show Same Answers"

**Problem**: Student took quiz twice but both attempts have identical answers

**Why This Happens**: Shuffle is OFF, so questions appear in same order
- Without shuffle, student remembers answers from first attempt
- Copies own answers (not learning)

**Solution**:
- Enable Shuffle (if not already)
- Accept that student will perform similarly if questions are identical
- For FITB with Word Bank, words might be shown in same order (depends on database)

---

## Practical Examples {#examples}

### Example 1: Science Class - Photosynthesis Quiz

#### Your Goal
Quick formative check after teaching photosynthesis lesson. You want students to recall key terms and understand the process, with opportunity to retry if needed.

#### Your Setup
```
Title: "Photosynthesis: Do You Know It?"
Class: Grade 9 Biology
Duration: 10 minutes
Attempt Limit: Unlimited (students can retry to improve)
Layout: Single Page (no stress, review before submitting)
Start Time: Today (Open immediately)
Status: Open
Shuffle: No (order matches lesson flow)
Publish Marks: Yes (instant feedback)
Summative: No (just learning)

Questions:
1. [MCQ] "What is the main input for photosynthesis?"
   A) Oxygen and glucose
   B) Water and carbon dioxide ← Correct
   C) Nitrogen and phosphorus
   D) Sunlight and sugar
   Points: 1

2. [FITB] "Photosynthesis occurs in the {blank} of plant cells"
   Word Bank: [nucleus, chloroplast, vacuole, ribosome]
   Correct: chloroplast
   Points: 1

3. [FITB - Free Type] "The process of water being taken up by roots is called {blank}"
   Accepted answers: [osmosis, water uptake]
   Case sensitive: No
   Points: 1

4. [MCQ] "Which wavelength of light is LEAST important for photosynthesis?"
   A) Blue
   B) Red
   C) Green ← Correct (least absorbed)
   D) Orange
   Points: 1

5. [FITB - Free Type] "The equation for photosynthesis: 6CO2 + 6H2O + light → {blank} + 6O2"
   Accepted: [C6H12O6, glucose, sugar]
   Points: 2
```

#### Expected Learner Experience
```
Session 1 (First Attempt):
- Student sees all 5 questions
- Answers: Gets 1, 2, 3, 4 correct; misses 5 (glucose equation)
- Score: 4 out of 6 points = 67%
- Feedback: Instant (shows which were wrong)
- Time taken: 7 minutes

Session 2 (Retake - 30 min later):
- Same quiz, same question order (shuffle off)
- Student now remembers and studies in between
- Answers all correctly
- Score: 6 out of 6 = 100%
- Student now confident, understands the concept
```

#### Why This Works
- ✅ Low-stakes (formative only)
- ✅ Immediate feedback helps learning
- ✅ Unlimited attempts = less anxiety
- ✅ Single page = easy to use
- ✅ Mix of MCQ and FITB = assesses different types of knowledge

---

### Example 2: Math Class - Chapter 7 Test (High-Stakes)

#### Your Goal
Assessment of chapter 7 content (Linear Equations). Counts toward grade. Need integrity and objective grading.

#### Your Setup
```
Title: "Chapter 7 Summative Test: Linear Equations"
Class: Grade 10 Mathematics
Duration: 45 minutes
Start Time: Thursday 9:00 AM
Status: Scheduled (locked to specific time)
Attempt Limit: 1 (one chance)
Layout: Multi-Page (Linear) - one question per screen, no going back
Shuffle: Yes (different order for each student)
Publish Marks: Yes (no open-ended to grade)
Summative: Yes (Counts toward grade)
Weight: 12% (of total grade)

Questions (20 questions total):

A. Solving Linear Equations [MCQ - 5 questions × 1 point each = 5 marks]
1. "Solve: 3x + 7 = 19"
   A) x = 4 ← Correct
   B) x = 5
   C) x = 3
   D) x = 2
   Points: 1

[Similar 4 more MCQ equations]

B. Graphing & Slope [FITB - 8 questions × 1 point = 8 marks]
6. "The slope of the line through (0,0) and (4,2) is {blank}"
   Accepted: [0.5, 1/2, 0.50, 0.500]
   Points: 1

[More FITB about graphs]

C. Word Problems [MCQ - 5 questions × 2 points = 10 marks]
14. "If tickets cost $15 each and you have $75, how many tickets can you buy?"
    A) 4
    B) 5 ← Correct
    C) 6
    D) 7
    Points: 2

[More word problems]

D. Systems of Equations [MCQ - 2 questions × 2 points = 4 marks]
19. "What is the solution to y=2x+1 and y=3x-2?"
    A) (3, 7) ← Correct
    B) (2, 5)
    C) (1, 3)
    D) (4, 9)
    Points: 2

Total: 20 marks
```

#### Expected Learner Experience
```
8:55 AM: Student logs in, quiz available but locked until 9:00
9:00 AM: Quiz unlocks automatically
9:01 AM: Student sees ONLY Question 1 (doesn't know what Q2 is yet)
         Must answer Q1 before seeing Q2
         Gets it right, clicks Next
9:03 AM: Now sees Q2, can't go back to Q1 even if unsure
         This continues for all 20 questions
9:46 AM: After Q20, final Submit button appears
9:47 AM: Submits, gets instant score: 18/20 = 90%
         Because all MCQ and FITB, auto-graded
```

#### Why This Works
- ✅ Linear mode prevents cheating/changing answers
- ✅ Shuffle means different test for each student
- ✅ Scheduled = synchronized assessment
- ✅ 1 attempt = stakes and integrity
- ✅ MCQ/FITB only = no manual grading needed
- ✅ Marks published = students see results immediately
- ✅ Summative weight = appropriate impact on final grade

---

### Example 3: English Class - Essay Response Quiz (Mixed)

#### Your Goal
Assess both comprehension (objective) and critical thinking (subjective). Some marks auto-graded, some manually graded.

#### Challenge
Quiz contains open-ended questions, so **cannot auto-publish marks**.

#### Your Setup
```
Title: "Pride and Prejudice: Comprehension & Analysis"
Class: Grade 11 English Literature
Duration: 90 minutes
Attempt Limit: 1
Layout: Single Page (students can review before final submit)
Shuffle: No (questions in logical reading progression)
Publish Marks: NO (due to open-ended questions)
Summative: Yes (15% weight)

Questions:

A. Objective Comprehension [MCQ - 10 questions × 2 points = 20 marks]
1. "In what year does Pride and Prejudice begin?"
   A) 1811
   B) 1797
   C) 1815
   D) 1805
   Points: 2

[More MCQ about facts from the novel]

B. Character Understanding [FITB + MCQ - 5 questions × 2 points = 10 marks]
11. "Elizabeth Bennet's best friend is {blank}"
    Accepted: [Charlotte Lucas, Charlotte]
    Points: 2

12. "Why does Darcy initially withdraw from social interaction?"
    A) He is naturally proud and reserved
    B) He is unhappy with the Bennet family
    C) He is secretly betrothed to another
    D) Wickham has slandered him
    Points: 2

[More]

C. Critical Analysis [Open-Ended - 2 questions × 15 points = 30 marks]
16. "Analyze how Austen uses irony in the opening statement: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.' What is the actual truth, and how does this relate to Elizabeth's journey? (5-8 sentences)"
    Points: 15
    Student must provide thoughtful textual analysis

17. "Compare and contrast Elizabeth and Lydia Bennet. How do their choices reflect Austen's views on female independence? (4-6 sentences)"
    Points: 15
    Student must provide analytical comparison

D. Final Reflection [Open-Ended - 1 question × 10 points = 10 marks]
18. "Which character do you find most compelling and why? Support with specific examples."
    Points: 10

Total: 70 marks
```

#### Your Workflow
```
STEP 1 (Day 1): Students take quiz during class
- Single page, so they can review before submitting
- Submit after 90 minutes
- Auto-graded portion (Sections A & B) = 30 marks calculated automatically
- Open-ended portion (Sections C & D) = 40 marks pending your grading

STEP 2 (Day 1-2): You grade open-ended responses
- Read each student's responses to questions 16, 17, 18
- Assign points (0-15 for Q16, 0-15 for Q17, 0-10 for Q18)
- Provide written feedback on quality of analysis

STEP 3 (After Grading): You publish marks
- System displays final scores to students
- Example: Student A: 28/30 (objective) + 38/40 (subjective) = 66/70 = 94%

STEP 4: Students receive feedback
- See their scores
- See teacher's written feedback on their essays
- Understand what they did well and where to improve
```

#### Why This Works
- ✅ Mix of objective + subjective assessment
- ✅ Tests comprehension AND critical thinking
- ✅ Single page allows student review before submit
- ✅ Single attempt appropriate for high-stakes assessment
- ✅ Your manual grading allows nuanced evaluation
- ✅ Feedback guides student learning
- ✅ Marks can't be published until you grade (system prevents accidental premature publishing)

#### Important Caveat
```
❌ Do NOT check "Publish Marks" when creating this quiz
The system will prevent you from doing so automatically.
After you finish grading all open-ended responses,
THEN you can manually publish marks through the grading interface.
```

---

### Example 4: ESL Language Class - Vocabulary & Grammar Quiz

#### Your Goal
Build vocabulary and grammar skills with immediate feedback. Students struggle with spelling and verb conjugations, so use word bank where appropriate and allow case-insensitive matching.

#### Your Setup
```
Title: "Unit 4: Past Tense Verbs & Vocabulary"
Class: ESL Intermediate
Duration: 20 minutes
Attempt Limit: 3 (students can retry, especially important for language learning)
Layout: Single Page
Shuffle: No (keeps related questions together)
Start Time: Now (Open)
Publish Marks: Yes (instant feedback helps language learning)
Summative: No (formative practice)

Questions:

A. Past Tense Conjugation [FITB - Free Type - 6 questions × 1 point = 6 marks]
1. "Yesterday, I {blank} to the store." [Correct answer: went]
   Accepted: [went, go (to store)]
   Case sensitive: No
   Points: 1

2. "She {blank} dinner when I called." [Correct answer: was making]
   Accepted: [was making, were making (alternative conjugation), was making]
   Case sensitive: No
   Points: 1

[4 more verb conjugation FITB]

B. Vocabulary - Word Bank [FITB - Word Bank - 5 questions × 1 point = 5 marks]
7. "I don't like {blank} in cold water."
   Word bank: [swimming, running, studying, dancing]
   Correct: swimming
   Distractors: running, studying, dancing (all -ing forms but different meanings)
   Points: 1

8. "She gave me {{blank}} advice about the job interview."
   Word bank: [helpful, helpless, hopeful, harmful]
   Correct: helpful
   Distractors: helpless, hopeful, harmful (all -ful forms, sound similar)
   Points: 1

[3 more word bank questions]

C. Grammar Matching [MCQ - 4 questions × 1 point = 4 marks]
12. "Which sentence is grammatically correct?"
    A) I has gone to school
    B) I have went to school
    C) I have gone to school ← Correct
    D) I am gone to school
    Points: 1

[3 more grammar MCQ]

D. Spelling Challenge [FITB - Free Type - 5 questions × 1 point = 5 marks]
(These test common spelling mistakes in English)
16. "The word meaning 'very bad' is spelled: {blank}"
    Accepted: [terrible, terrable (common misspelling - but NOT accepted)]
    Case sensitive: No
    Points: 1
    Note: This forces correct spelling, not approximations

Total: 20 marks
```

#### Expected Learner Experience
```
First Attempt:
- Student answers 20 questions in ~18 minutes
- Gets 14/20 (70%)
- Sees immediately which items missed
- Realizes: Past tense is weak, spelling good, vocabulary okay

Between Attempts (3-5 days later, after studying):
- Student reviews past tense conjugation rules
- Practices with textbook

Second Attempt (Same quiz, different attempt):
- Same 20 questions, same order (shuffle off)
- But now student knows what to expect
- Gets 17/20 (85%)
- Progress is visible to student
- Confidence increases

Third Attempt (End of week):
- Gets 19/20 (95%)
- Shows clear learning progression
- Ready to move to Unit 5
```

#### Why This Works for Language Learning
- ✅ Multiple attempts = necessary for language skill building
- ✅ Immediate feedback = crucial for language correction
- ✅ Word banks = support students while building vocabulary
- ✅ Free type FITB = tests actual spelling (not just recognition)
- ✅ Single page = less intimidating for language learners
- ✅ Case insensitive = focuses on spelling, not capitalization
- ✅ Formative = no grade pressure, pure learning

---

## Summary: Quick Reference Guide

### Quick Setup Template

```
FOR FORMATIVE QUIZZES:
Duration: 5-20 min
Attempt Limit: Unlimited
Layout: Single Page
Publish Marks: Yes
Summative: No

FOR SUMMATIVE ASSESSMENTS:
Duration: 30-90 min
Attempt Limit: 1
Layout: Multi-Page (Linear)
Publish Marks: Yes (if no open-ended)
Summative: Yes
Shuffle: Yes
```

### Question Type Quick Reference
- **MCQ**: Objective, auto-graded, good for recall
- **FITB**: Auto-graded, good for vocabulary/specific answers
- **Open-Ended**: Subjective, manual grading, good for deep thinking

### When to Choose Each Layout
- **Single Page**: Learning, practice, formative, low-stakes
- **Multi-Page (Linear)**: Exams, high-stakes, summative, cheat prevention

### Key Rules to Remember
1. Open-ended questions = Cannot publish marks automatically
2. Linear mode = No going back (ever)
3. Shuffle = Different question order for each student/attempt
4. Summative weight = Should total ~100% across all assessments
5. Attempt limit = 0 means unlimited; 1 means final attempt

---

## Still Have Questions?

Reach out to your school's academic coordinator or tech support for:
- Technical issues with quiz creation
- Pedagogical advice on assessment design
- Help troubleshooting student issues
- Customization requests

---

**This manual was created to help you use iSkool's quiz feature effectively. Quizzes are a powerful tool for assessment and learning when configured appropriately for your goals.**

**Happy quizzing! 📝**
