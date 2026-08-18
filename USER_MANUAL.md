# 📘 RIT GPA & CGPA Portal — User Interface & System Manual

This manual explains how to use the **Ramco Institute of Technology GPA & CGPA Portal**. It focuses on the User Interface (UI), showing you step-by-step what each screen, button, and dropdown does so that students, staff members, and HODs can easily use the system.

---

## 🌐 1. Public Website Interface (No Login Required)

### 1.1 Homepage & Navigation Bar
- **Top Header Bar**: Contains direct links to **Home**, **GPA Calculator**, **CGPA Calculator**, and the **Staff/Admin Login** button on the far right.
- **Hero Banner**: Gives quick access cards for *Semester GPA Calculation* and *Cumulative CGPA Calculation*.

### 1.2 Semester GPA Calculator Screen
- **Regulation Dropdown**: Select your curriculum regulation (e.g., `R2021`).
- **Department Dropdown**: Select your branch (e.g., `Information Technology (IT)`).
- **Semester Select**: Pick the semester (e.g., `Semester 5`).
- **Subject List Table**: Once you select the semester, all registered subjects for that semester automatically appear with their official credit values.
- **Grade Select Dropdowns**: For each subject, click the grade dropdown and select your grade (`O`, `A+`, `A`, `B+`, `B`, `C`, or `U/RA`).
- **Live GPA Score Box**: At the top right of the card, your calculated GPA updates instantly as you choose grades.
- **`Download PDF Report` Button**: Click this green button at the bottom of the page to download your formatted PDF grade sheet.

### 1.3 Cumulative CGPA Calculator Screen
- **Setup Dropdowns**: Choose your Regulation and Department.
- **Semester Breakdown List**: Displays semester slots (`Sem 1`, `Sem 2`, etc.) with their auto-loaded total credits.
- **GPA Input Fields**: Type your achieved GPA score into the box for each completed semester.
- **`+ Add Semester` Button**: Adds the next numerical semester slot (up to 8 semesters).
- **Trash Can Icon**: Click to remove a semester row.
- **Big CGPA Badge**: Shows your calculated CGPA out of 10.0 with a status message (e.g., *Outstanding 🏆*, *Excellent ⭐*).
- **`Download PDF Report` Button**: Generates a PDF summary of your CGPA across semesters.

---

## 🏛️ 2. Department Head (HOD / Dept Admin) Interface

HODs have complete control over their department's student roster, staff accounts, subject curriculum, and student results.

### 2.1 Login & Department Scope
1. Click **`Staff / Admin Login`** on the top right of the website.
2. Enter your HOD email and password.
3. Upon logging in, the top banner shows your **Department Name** (e.g., `Information Technology`).
4. All student lists, staff members, and results will automatically show **only** your department.

### 2.2 Student Roster Screen (`Dashboard > Student Roster`)
- **Filter Roster by Batch Dropdown**: Choose a batch (e.g., `2023-2027`) to display students in that class.
- **Search Bar**: Type a student's name or register number to quickly locate them.
- **`+ Add Student` Button**: Opens a pop-up window to enter a new student's Name, Register Number, Department, and Batch.
- **`Bulk Upload CSV` Button**: Click to upload an Excel/CSV file to add an entire class roster at once.
- **Action Buttons**:
  - ✏️ **Pencil Icon**: Edit student details.
  - 🗑️ **Trash Icon**: Remove a student from the department roster.

### 2.3 Staff Management Screen (`Dashboard > Staff Management`)
- **`+ Add Staff Member` Button**: Opens a modal to create a new faculty account. Enter Staff Name, Email, Staff ID, and Password.
- **Staff List Table**: Shows all active staff members in your department.
- **Status Toggle Switch**: Easily activate or deactivate a staff member's login access.

### 2.4 Subject Settings Screen (`Dashboard > Grade Settings / Total Credits`)
- **Subject Curriculum Table**: View and configure subject codes, subject names, credit weights, and elective categories per semester.
- **Total Credits Screen**: Review and update total semester credit totals (e.g., Sem 1 = 22, Sem 2 = 26) used for CGPA calculations.

### 2.5 GPA Calculation Screen (`Dashboard > GPA Calculation`)
- **Batch Dropdown**: Select the target class batch.
- **Select Registered Student Box**: Click to search or pick a student (e.g., `953623205001 - ABINAYA G M`).
- **Auto-Fetch Confirmation Banner**: Displays a green notice confirming student records were fetched.
- **Subject Grade Selectors**: Pick grades for each subject.
- **`Save to Database` Button**: Saves the GPA score directly into the department results table.
  - *Note*: If a result already exists for that student and semester, it **overwrites** the existing entry so there are no duplicates.

### 2.6 CGPA Calculation Screen (`Dashboard > CGPA Calculation`)
- **Select Registered Student Box**: Choose the student.
- **Auto-Fetched Semester History**: Automatically fills in previously calculated semester GPAs in sequential order (`Sem 1`, `Sem 2`, `Sem 3`, etc.).
- **`+ Add Semester` Button**: Safely adds missing semester slots without creating duplicate entries.
- **`Save to Database` Button**: Saves the student's overall CGPA and semester breakdown.

### 2.7 Bulk GPA Calculation Screen (`Dashboard > Bulk GPA Calculation`)
- **Setup Selectors**: Choose Department, Batch, Semester, and Regulation.
- **File Upload / Matrix Entry**: Upload a class mark spreadsheet or type grades directly into the grid.
- **`Process & Save Batch Results` Button**: Calculates and stores GPA records for all students in the batch simultaneously.

### 2.8 GPA Results & CGPA Results Dashboards
- **Department Filter**: Automatically locked to your department (Super Admins can switch departments).
- **Semester Filter**: Choose a specific semester (`Sem 1`, `Sem 2`, ...) or select `All Semesters`.
- **Search Bar**: Search by student name or register number.
- **Unified Action Control Set (per student row)**:
  - 📄 **`PDF` Button**: Downloads a complete Student GPA Report containing **all calculated semesters** for that student.
  - ✏️ **`Edit` Button**: Opens a pop-up modal to edit grades or temporary credits for the selected semester.
  - 🗑️ **`Delete` Button**: Deletes the semester result after confirmation.

### 2.9 Rank List Screen (`Dashboard > GPA Results / Rank Lists`)
- **Semester Select**: Pick the semester.
- **`Export Department Rank List PDF` Button**: Downloads a clean, ordered leaderboard (Rank 1 to 100) of top-performing students in the department.

---

## 👩‍🏫 3. Faculty / Staff Interface & Daily Workflow

Staff members use the portal to calculate and save student GPAs and CGPAs for their department.

### 3.1 Staff Login & Dashboard View
1. Click **`Staff / Admin Login`** on the home page.
2. Enter your staff email and password.
3. The dashboard sidebar displays your available tools: `GPA Calculation`, `CGPA Calculation`, `Bulk GPA`, `GPA Results`, and `CGPA Results`.

### 3.2 Calculating GPA for a Student (Step-by-Step UI Action)
1. Click **`GPA Calculation`** in the left menu.
2. Select your class batch from the **Filter Roster by Batch** dropdown.
3. Click **`Select Registered Student`** and choose the student's name.
4. The student's details and subjects for the chosen semester automatically load.
5. Select the letter grade (`O`, `A+`, `A`, `B+`, `B`, `C`, `U/RA`) for each subject.
6. Check the **Live GPA Display Box** to confirm the calculated score.
7. Click the green **`Save to Database`** button.
   - A success message will appear confirming the result has been stored.
   - If the student already had a result for this semester, it will be updated with the new score.

### 3.3 Calculating CGPA for a Student (Step-by-Step UI Action)
1. Click **`CGPA Calculation`** in the left menu.
2. Select the student from the **Select Registered Student** dropdown.
3. All previous semester GPAs for that student will automatically populate in order (`Sem 1`, `Sem 2`, `Sem 3`, etc.).
4. If a semester is missing, click **`+ Add Semester`**.
5. Click **`Save to Database`**.

### 3.4 Performing Bulk Batch GPA Calculations
1. Click **`Bulk GPA`** in the left menu.
2. Select the **Batch** and **Semester**.
3. Upload the batch grade spreadsheet or fill in the grade table.
4. Click **`Calculate & Store Batch`**. All student GPAs for that batch will be processed and saved.

### 3.5 Testing Temporary Grade / Credit Scenarios
- When calculating on the GPA page, staff members can edit subject names or credit numbers directly in the input boxes.
- This allows you to test "what-if" grade changes for a student.
- **Important**: These changes are temporary for the current calculation and will **not** alter the master curriculum database.

### 3.6 Checking & Exporting Results
1. Click **`GPA Results`** or **`CGPA Results`** in the left menu.
2. Use the search bar to find any student in your department.
3. Click **`PDF`** next to a student's row to download their complete multi-semester GPA report.

---

## 👑 4. Super Administrator Interface Controls

Super Administrators oversee the entire portal across all academic departments.

### 4.1 Default IT Department Access
- When a Super Admin opens **GPA Results** or **CGPA Results**, the UI defaults to displaying the **Information Technology (IT)** department to keep the interface fast and clean.

### 4.2 Department Switcher Dropdown
- Located at the top left of the dashboard screens.
- Click the dropdown to switch between any department (`IT`, `CSE`, `ECE`, `EEE`, `MECH`, `CIVIL`).
- The entire page updates instantly to display the selected department's data.

### 4.3 Analytics Overview Screen (`Dashboard > Analytics`)
- Displays overall system metrics: Total Students, Total Department Staff, Overall Pass Percentages, and System Usage statistics.

---
*Ramco Institute of Technology — Academic Credit & GPA Management System.*
