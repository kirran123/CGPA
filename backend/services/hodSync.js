const Department = require('../models/Department');
const User = require('../models/User');

const syncAllHods = async () => {
  try {
    const departments = await Department.find();
    for (const dept of departments) {
      // Find an active dept_admin for this department code
      const hod = await User.findOne({
        role: 'dept_admin',
        department: dept.code,
        status: 'Active'
      });

      if (hod) {
        if (dept.hodName !== hod.name || dept.email !== hod.email) {
          dept.hodName = hod.name;
          dept.email = hod.email;
          await dept.save();
          console.log(`[HOD Sync] Synced ${dept.code} HOD to ${hod.name} <${hod.email}>`);
        }
      } else {
        const defaultEmail = `${dept.code.toLowerCase()}hod@rit.edu.in`;
        if (dept.hodName !== 'Pending Appointment' || dept.email !== defaultEmail) {
          dept.hodName = 'Pending Appointment';
          dept.email = defaultEmail;
          await dept.save();
          console.log(`[HOD Sync] Reset ${dept.code} HOD to Pending Appointment`);
        }
      }
    }
  } catch (error) {
    console.error('[HOD Sync] Error during HOD sync:', error);
  }
};

module.exports = { syncAllHods };
