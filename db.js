const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

const PALETTE = ['#E0392E', '#F0B429', '#4C6EF5', '#20A39E', '#C77B4E', '#8B92A0', '#A24DBF', '#2F9E44'];

function defaultData() {
  return {
    teams: [
      { id: 1, name: 'Akshar Universe', mentor_name: 'Atmiya Anil Boricha', initials: 'AU', color: '#F0B429' },
      { id: 2, name: 'Gunatit Lions', mentor_name: 'Darshan Pravin Parmar', initials: 'GL', color: '#8B92A0' },
      { id: 3, name: 'Narayani Sena', mentor_name: 'Ankit Hitesh Rathod', initials: 'NS', color: '#C77B4E' },
    ],
    yuvaks: [
      { id: 1, name: 'Bhavya A Kakkad', team_id: 1, points: 135000 },
      { id: 2, name: 'Alakh R Chauhan', team_id: 1, points: 125000 },
      { id: 3, name: 'Dhruv J Parmar', team_id: 3, points: 125000 },
    ],
    admins: [
      { id: 1, username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10) },
    ],
    rulebook: {
      intro: 'How to earn points and climb the leaderboard.',
      pointsTable: [
        { id: 1, activity: 'Present in Sabha', description: 'Step-up points: 25,000 → 30,000 → 40,000', points: 20000 },
        { id: 2, activity: 'Reach Sabha before 9:15', description: 'In-time bonus — be seated before 9:15 and earn extra points', points: 10000 },
        { id: 3, activity: 'Bring new friend to Sabha', description: 'Referral bonus — first visit only', points: 40000 },
        { id: 4, activity: 'New friend attends every Sabha', description: 'Step-up points: 35,000 → 40,000 → 50,000', points: 30000 },
        { id: 5, activity: 'Attend Get-Together', description: 'If present in Sabha', points: 20000 },
        { id: 6, activity: 'Bonus', description: 'Attend all Sabha episodes', points: 50000 },
        { id: 7, activity: 'Team Bonus', description: '70% team attendance in Sabha', points: 70000 },
      ],
      getTogetherRules: [
        'To be organized team-wise.',
        'To be conducted at least once every two weeks.',
        'Points will be given as per the Points Table.',
      ],
      importantNotes: [
        "Referral Bonus is valid only on the friend's first Sabha.",
        'Team Bonus only when 70% or 100% of your team attends Sabha.',
        'Regular participation increases your chances of winning.',
      ],
    },
    pointCategories: [
      { id: 1, name: 'Sabha Attendance', amount: 6720000 },
      { id: 2, name: 'New Yuvak', amount: 40000 },
      { id: 3, name: 'S1 In Time · 13 July', amount: 320000 },
    ],
    spotlightTeamId: null,
    nextTeamId: 4,
    nextYuvakId: 4,
    nextAdminId: 2,
    nextRuleId: 8,
    nextCategoryId: 4,
    event: { name: 'Nimit Bhulku', date: '2026-07-20' },
  };
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    save(defaultData());
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  // Backfill fields for DBs created before this update
  const defaults = defaultData();
  if (!data.rulebook) data.rulebook = defaults.rulebook;
  if (!data.pointCategories) data.pointCategories = defaults.pointCategories;
  if (data.spotlightTeamId === undefined) data.spotlightTeamId = null;
  if (!data.nextRuleId) data.nextRuleId = 1;
  if (!data.nextCategoryId) data.nextCategoryId = 1;
  return data;
}

function save(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { load, save, PALETTE };
