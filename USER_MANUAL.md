# 📘 Complete User Guide & Operating Manual
## Ramco Institute of Technology — GPA & CGPA Calculation Portal

Welcome to the official User Manual for the **RIT GPA & CGPA Portal**. This guide is written in clear, simple, and friendly English to help students, faculty members, Department Heads (HODs / Dept Admins), and Super Administrators easily navigate and make full use of our portal.

---

## 📋 Table of Contents
1. [System Overview & Key Features](#-1-system-overview--key-features)
2. [PART 1: Public Website & Student Guide](#-part-1-public-website--student-guide)
   - [1.1 Quick Semester GPA Calculator](#11-quick-semester-gpa-calculator)
   - [1.2 Cumulative CGPA Calculator](#12-cumulative-cgpa-calculator)
   - [1.3 Downloading Student PDF Reports](#13-downloading-student-pdf-reports)
3. [PART 2: Department Head (HOD / Dept Admin) Manual](#-part-2-department-head-hod--dept-admin-manual)
   - [2.1 Logging In & Department Data Isolation](#21-logging-in--department-data-isolation)
   - [2.2 Managing Student Batches & Rosters](#22-managing-student-batches--rosters)
   - [2.3 Managing Department Staff & Faculty Accounts](#23-managing-department-staff--faculty-accounts)
   - [2.4 Configuring Subject Curricula & Total Credits](#24-configuring-subject-curricula--total-credits)
   - [2.5 Calculating & Overwriting Department GPA / CGPA Results](#25-calculating--overwriting-department-gpa--cgpa-results)
   - [2.6 Managing Results (Viewing, Editing, Deleting, Department Defaults)](#26-managing-results-viewing-editing-deleting-department-defaults)
   - [2.7 Generating Department Rank Lists & Official PDFs](#27-generating-department-rank-lists--official-pdfs)
4. [PART 3: Faculty / Staff Operating Manual](#-part-3-faculty--staff-operating-manual)
   - [3.1 Staff Access & Department Focus](#31-staff-access--department-focus)
   - [3.2 Single Student GPA & CGPA Calculation](#32-single-student-gpa--cgpa-calculation)
   - [3.3 Bulk GPA Calculation for Student Batches](#33-bulk-gpa-calculation-for-student-batches)
   - [3.4 Temporary Grade & Credit Adjustments](#34-temporary-grade--credit-adjustments)
   - [3.5 Saving Results to the Department Portal](#35-saving-results-to-the-department-portal)
5. [PART 4: Super Administrator Manual](#-part-4-super-administrator-manual)
   - [4.1 Institutional Oversight & IT Department Default](#41-institutional-oversight--it-department-default)
   - [4.2 Switching Between Departments](#42-switching-between-departments)
   - [4.3 System-Wide Analytics & Maintenance](#43-system-wide-analytics--maintenance)
6. [💡 Frequently Asked Questions (FAQ) & Troubleshooting](#-frequently-asked-questions-faq--troubleshooting)

---

## 🌐 1. System Overview & Key Features

The RIT GPA & CGPA Portal is a modern, high-precision academic analytics system engineered under **Anna University R2021 & Custom Regulations**.

### 🌟 Core Capabilities:
- **Automatic Credit Fetching**: Automatically retrieves exact subject names and credit weights from the department curriculum database.
- **Credit-Weighted Calculation Formula**:
  $$\text{GPA} = \frac{\sum (\text{Subject Credits} \times \text{Grade Point})}{\sum \text{Subject Credits}}$$
- **Role-Based Security & Department Isolation**: Department Admins and Staff strictly view and manage records within their assigned department (e.g., Information Technology, Computer Science, Mechanical, etc.).
- **Automatic Overwrite & Zero Duplicates**: Re-calculating a student's GPA or CGPA updates their existing record without creating duplicate entries.
- **Unified Student PDF Reports**: Clicking the PDF button downloads a consolidated report containing **all calculated semesters** for that student.

---

## 🎓 PART 1: Public Website & Student Guide

Students and external visitors can access public calculators directly from the homepage without needing an account login.

### 1.1 Quick Semester GPA Calculator
**Goal**: Calculate your semester GPA by selecting your Department, Regulation, and Semester.

1. **Open the Homepage**: Go to the main portal website.
2. **Select Academic Setup**:
   - **Regulation**: Choose your regulation (e.g., `R2021`).
   - **Department**: Choose your department (e.g., `Information Technology (IT)`).
   - **Semester**: Choose the semester number (e.g., `Semester 5`).
3. **Subject Roster Auto-Load**:
   - The system automatically populates all subjects registered for that semester along with their official credit values.
4. **Enter Your Grades**:
   - Select the letter grade achieved for each subject (`O`, `A+`, `A`, `B+`, `B`, `C`, `U/RA`).
5. **View Live Results**:
   - The **Semester GPA** updates instantly at the top of the screen as you select grades.
6. **Download Report**:
   - Click **`Download PDF Report`** to get an official summary copy.

---

### 1.2 Cumulative CGPA Calculator
**Goal**: Calculate your overall CGPA across multiple semesters.

1. **Navigate to CGPA Calculator**: Click **CGPA Calculator** from the top menu or homepage card.
2. **Setup Department & Regulation**: Select your department and regulation.
3. **Auto-Fetched Semester Credits**:
   - The system automatically loads official total credits for each semester slot.
4. **Enter Semester GPAs**:
   - Type in your GPA score for each completed semester (`Sem 1`, `Sem 2`, `Sem 3`, etc.).
5. **Adding / Removing Semesters**:
   - Click **`+ Add Semester`** to add the next numerical semester (up to 8 semesters).
   - Click the **Trash / Delete** icon to remove a semester.
6. **Live CGPA Computation**:
   - The portal computes your credit-weighted CGPA automatically and displays your overall academic performance status (e.g., *Outstanding 🏆*, *Excellent ⭐*, *Very Good 👍*).

---

### 1.3 Downloading Student PDF Reports
- On any public calculator page, click **`Download PDF Report`**.
- The portal produces a clean, high-resolution PDF document formatted with official Ramco Institute of Technology headers, subject details, grade breakdowns, and totals.

---

## 🏛️ PART 2: Department Head (HOD / Dept Admin) Manual

Department Admins (HODs) have full administrative control over their department's student roster, faculty accounts, subject regulations, and academic grade results.

### 2.1 Logging In & Department Data Isolation
1. Click **`Staff / Admin Login`** on the top right.
2. Enter your authorized login credentials.
3. **Automatic Scope**:
   - Upon logging in, the portal automatically locks your active view to your assigned department (e.g., `IT`).
   - You will only see students, staff members, subject settings, and GPA/CGPA results belonging to your department.

---

### 2.2 Managing Student Batches & Rosters
- **Path**: `Dashboard > Student Roster`
- **Adding Students**:
  - Click **`+ Add Student`**.
  - Enter **Student Name**, **Register Number**, **Department**, and **Batch** (e.g., `2023-2027`).
- **Batch Filtering**:
  - Filter students by batch using the dropdown at the top of the roster.
- **Bulk Upload**:
  - Upload CSV/Excel files containing student registration details to import entire classes in seconds.

---

### 2.3 Managing Department Staff & Faculty Accounts
- **Path**: `Dashboard > Staff Management`
- **Create Staff Account**:
  - Click **`+ Add Staff Member`**.
  - Fill in Name, Email, Staff ID, and Assign Password.
  - The staff member will automatically inherit access **only** to your department.
- **Disable / Remove Staff**:
  - HODs can edit details or deactivate staff accounts at any time.

---

### 2.4 Configuring Subject Curricula & Total Credits
- **Path**: `Dashboard > Grade Settings / Total Credits`
- **Setting Up Subjects**:
  - Specify subject codes, subject titles, credit weights (e.g., 3, 4, 1.5), and elective options per regulation.
- **Semester Credit Configurations**:
  - Verify total credit allocations for Semesters 1 through 8 to ensure smooth CGPA calculations across all batches.

---

### 2.5 Calculating & Overwriting Department GPA / CGPA Results

#### A. Single Student Calculation
1. Go to `Dashboard > GPA Calculation` or `Dashboard > CGPA Calculation`.
2. **Select Student**: Choose a batch and pick a student from the dropdown menu (e.g., `953623205001 - ABINAYA G M`).
3. **Auto-Fetch History**:
   - The portal automatically loads any previously saved semester GPA records for that student into sequential order (`Sem 1`, `Sem 2`, `Sem 3`, ...).
4. **Enter/Update Grades & Click Save**:
   - Click **`Save to Database`**.
   - **Important**: If results for that student and semester already exist, the portal automatically **overwrites the existing record** with the new values. **No duplicate entries will ever be created.**

#### B. Bulk GPA Calculation for Entire Batches
1. Go to `Dashboard > Bulk GPA Calculation`.
2. Select **Department**, **Batch**, **Semester**, and **Regulation**.
3. Upload the batch grade sheet or enter grades.
4. Click **`Process & Save Batch Results`**. All calculated results immediately store into the department database.

---

### 2.6 Managing Results (Viewing, Editing, Deleting, Department Defaults)

- **Path**: `Dashboard > GPA Results` & `Dashboard > CGPA Results`
- **Default Department View**:
  - The page loads records strictly for your department.
- **Unified Action Control Set**:
  - Each student row features a single set of action controls:
    - 📄 **`PDF`**: Downloads the complete student report containing **all calculated semesters** for that student.
    - ✏️ **`Edit`**: Opens an edit modal to modify grades or temporary subject credits.
    - 🗑️ **`Delete`**: Permanently deletes the selected semester record upon confirmation.

---

### 2.7 Generating Department Rank Lists & Official PDFs
- **Path**: `Dashboard > GPA Results / Rank Lists`
- Click **`Export Department Rank List PDF`** to generate an official ordered leaderboard (Rank 1 to 100) based on GPA/CGPA for academic awards and departmental reviews.

---

## 👩‍🏫 PART 3: Faculty / Staff Operating Manual

Staff accounts allow faculty members to quickly calculate, review, and record student performance.

### 3.1 Staff Access & Department Focus
- When a staff member logs in, the system automatically scopes all actions to their assigned department.
- Staff members can calculate single student GPAs/CGPAs, process bulk class spreadsheets, and save records to the main database.

---

### 3.2 Single Student GPA & CGPA Calculation
1. Open `Dashboard > GPA Calculation` (or `CGPA Calculation`).
2. Select your student from the **Select Registered Student** dropdown.
3. The student's academic profile and calculated semester history automatically load.
4. Enter grades and click **`Save to Database`**. The calculated result updates the department database immediately.

---

### 3.3 Bulk GPA Calculation for Student Batches
1. Open `Dashboard > Bulk GPA Calculation`.
2. Select your class batch and upload the student grade matrix.
3. Click **`Calculate and Store Batch`**. The system verifies grade codes (`O`, `A+`, `A`, `B+`, `B`, `C`, `U/RA`) and saves all student scores simultaneously.

---

### 3.4 Temporary Grade & Credit Adjustments
*Need to test "what-if" scenarios for a student without changing the institution database?*
- While calculating on the GPA page, you can temporarily edit subject credits or subject names.
- **Note**: These adjustments remain temporary for the current calculation session and will **not** alter the master subject curriculum in the database.

---

### 3.5 Saving Results to the Department Portal
- Whenever you click **`Save to Database`**, the result is recorded under your department.
- All department HODs and fellow staff members will instantly see the updated GPA/CGPA results in the **GPA Results** and **CGPA Results** dashboards.

---

## 👑 PART 4: Super Administrator Manual

Super Administrators have full system-wide governance over all departments, global settings, and user permissions.

### 4.1 Institutional Oversight & IT Department Default
- **Default View**: When Super Admins open the **GPA Results** or **CGPA Results** dashboard, the system defaults to displaying the **Information Technology (IT)** department to maintain clean performance and focus.
- **Full Scope**: Super Admins can access and modify records across all academic departments.

---

### 4.2 Switching Between Departments
- Super Admins can use the **Department Dropdown Filter** at the top of any dashboard page to switch between departments (e.g., `IT`, `CSE`, `ECE`, `EEE`, `MECH`, `CIVIL`).

---

### 4.3 System-Wide Analytics & Maintenance
- **Path**: `Dashboard > Analytics`
- Monitor total student count, batch-wise performance metrics, department-wide pass percentages, and total PDF report downloads across Ramco Institute of Technology.

---

## 💡 Frequently Asked Questions (FAQ) & Troubleshooting

#### Q1: What happens if I calculate GPA for a student who already has a record for that semester?
> **Answer**: The system automatically **overwrites** the previous record with the newly calculated GPA. No duplicate entries will be created.

#### Q2: Why does the PDF download button say `PDF` instead of `PDF S5`?
> **Answer**: Clicking the **`PDF`** button downloads a complete Student GPA Report compiling **all calculated semesters** available for that student in one clean document.

#### Q3: Why don't Staff members see students from other departments?
> **Answer**: The system enforces **Departmental Data Isolation**. Staff and Dept Admins can only view and manage students within their assigned department to protect data privacy.

#### Q4: How are letter grades converted to grade points?
> Under Regulation R2021:
> - **O (Outstanding)** = 10
> - **A+ (Excellent)** = 9
> - **A (Very Good)** = 8
> - **B+ (Good)** = 7
> - **B (Average)** = 6
> - **C (Satisfactory)** = 5
> - **U / RA (Re-appear)** = 0

---
*Generated for Ramco Institute of Technology — Academic Credit & Grade Point Portal.*
