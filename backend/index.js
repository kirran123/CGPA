const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const User = require('./models/User');
const Department = require('./models/Department');
const Regulation = require('./models/Regulation');

// Load environment variables
dotenv.config();

const app = express();

// Middlewares
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
      'https://cgpa.ritrjpm.ac.in',
      'http://cgpa.ritrjpm.ac.in',
    ];
    // Allow any Vercel deployment URL automatically
    if (
      allowed.includes(origin) ||
      /\.vercel\.app$/.test(origin) ||
      /\.onrender\.com$/.test(origin)
    ) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/gpa', require('./routes/gpa'));
app.use('/api/cgpa', require('./routes/cgpa'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/regulations', require('./routes/regulations'));
app.use('/api/grade-settings', require('./routes/gradeSettings'));

// Enforce seed data on startup
const seedDatabase = async () => {
  try {
    // Drop the old Subject code_1_department_1 index if it exists to allow regulation-scoped subjects
    const mongoose = require('mongoose');
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections({ name: 'subjects' }).toArray();
      if (collections.length > 0) {
        const indexes = await db.collection('subjects').indexes();
        const hasOldIndex = indexes.some(idx => idx.name === 'code_1_department_1');
        if (hasOldIndex) {
          await db.collection('subjects').dropIndex('code_1_department_1');
          console.log('Successfully dropped old subjects index code_1_department_1.');
        }
      }
      
      // Drop older gparecords unique indexes to allow batch-scoped records
      const collectionsGpa = await db.listCollections({ name: 'gparecords' }).toArray();
      if (collectionsGpa.length > 0) {
        const indexesGpa = await db.collection('gparecords').indexes();
        
        const hasOldGpaIndex1 = indexesGpa.some(idx => idx.name === 'registerNo_1_semester_1');
        if (hasOldGpaIndex1) {
          await db.collection('gparecords').dropIndex('registerNo_1_semester_1');
          console.log('Successfully dropped old gparecords index registerNo_1_semester_1.');
        }
        
        const hasOldGpaIndex2 = indexesGpa.some(idx => idx.name === 'registerNo_1_semester_1_department_1');
        if (hasOldGpaIndex2) {
          await db.collection('gparecords').dropIndex('registerNo_1_semester_1_department_1');
          console.log('Successfully dropped old gparecords index registerNo_1_semester_1_department_1.');
        }
      }

      // Drop older gradesettings unique index regulation_1_semester_1
      const collectionsGrades = await db.listCollections({ name: 'gradesettings' }).toArray();
      if (collectionsGrades.length > 0) {
        const indexesGrades = await db.collection('gradesettings').indexes();
        const hasOldGradesIndex = indexesGrades.some(idx => idx.name === 'regulation_1_semester_1');
        if (hasOldGradesIndex) {
          await db.collection('gradesettings').dropIndex('regulation_1_semester_1');
          console.log('Successfully dropped old gradesettings index regulation_1_semester_1.');
        }
      }
    } catch (e) {
      console.log('Index drop check skipped or not needed:', e.message);
    }

    // 1. Seed Super Admin
    const adminEmail = 'kirranvijay@gmail.com';
    const adminPassword = 'Kirranst@14';

    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      await User.create({
        name: 'Kirran S T',
        email: adminEmail,
        password: adminPassword,
        role: 'super_admin',
        department: '',
        status: 'Active',
        permissions: ['FULL_ACCESS']
      });
      console.log('Super Admin \'Kirran S T\' seeded successfully.');
    } else {
      admin.name = 'Kirran S T';
      admin.password = adminPassword;
      admin.role = 'super_admin';
      admin.status = 'Active';
      admin.permissions = ['FULL_ACCESS'];
      await admin.save();
      console.log('Super Admin \'Kirran S T\' verified and updated.');
    }

    // 1b. Migrate existing permissions to new standards (FULL_ACCESS / DEPT_ACCESS)
    const allUsers = await User.find({});
    for (const u of allUsers) {
      let modified = false;
      if (u.role === 'super_admin') {
        if (!u.permissions.includes('FULL_ACCESS')) {
          u.permissions = ['FULL_ACCESS'];
          modified = true;
        }
      } else if (u.role === 'dept_admin') {
        const hasOldFull = u.permissions.includes('DEPT_FULL_ACCESS') || 
                           u.permissions.includes('DEPARTMENT_FULL_ACCESS') || 
                           u.permissions.includes('FULL_ACCESS');
        if (hasOldFull && !u.permissions.includes('DEPT_ACCESS')) {
          u.permissions = u.permissions.filter(p => p !== 'DEPT_FULL_ACCESS' && p !== 'DEPARTMENT_FULL_ACCESS' && p !== 'FULL_ACCESS');
          u.permissions.push('DEPT_ACCESS');
          modified = true;
        }
      }
      if (modified) {
        await u.save();
        console.log(`Migrated user permissions: ${u.name} (${u.email}) -> ${JSON.stringify(u.permissions)}`);
      }
    }

    // 2. Seed default departments
    const defaultDepts = [
      { name: 'Computer Science and Engineering', code: 'CSE', description: 'Department of Computer Science & Engineering' },
      { name: 'Information Technology', code: 'IT', description: 'Department of Information Technology' },
      { name: 'Electronics and Communication Engineering', code: 'ECE', description: 'Department of Electronics & Communication Engineering' },
      { name: 'Electrical and Electronics Engineering', code: 'EEE', description: 'Department of Electrical & Electronics Engineering' },
      { name: 'Mechanical Engineering', code: 'MECH', description: 'Department of Mechanical Engineering' },
      { name: 'Civil Engineering', code: 'CIVIL', description: 'Department of Civil Engineering' },
      { name: 'Artificial Intelligence and Data Science', code: 'AI&DS', description: 'Department of Artificial Intelligence & Data Science' },
      { name: 'Cyber Security', code: 'CYBER', description: 'Department of Cyber Security' }
    ];

    for (const d of defaultDepts) {
      const existing = await Department.findOne({ code: d.code });
      if (!existing) {
        await Department.create({
          name: d.name,
          code: d.code,
          description: d.description,
          hodName: 'Pending Appointment',
          email: `${d.code.toLowerCase()}hod@rit.edu.in`,
          status: 'Active'
        });
        console.log(`Seeded department: ${d.code}`);
      }
    }
    
    // 3. Seed default regulations
    const defaultRegs = ['R2021', 'R2025'];
    for (const r of defaultRegs) {
      const existing = await Regulation.findOne({ name: r });
      if (!existing) {
        await Regulation.create({ name: r });
        console.log(`Seeded regulation: ${r}`);
      }
    }

    // 4. Sync HOD details — runs every startup to keep Department docs current
    const { syncAllHods } = require('./services/hodSync');
    await syncAllHods();

    console.log('Database seed check complete.');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
connectDB().then(async () => {
  await seedDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Database connection failed:', err.message);
  process.exit(1);
});
