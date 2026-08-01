const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const PALETTE = ['#E0392E', '#F0B429', '#4C6EF5', '#20A39E', '#C77B4E', '#8B92A0', '#A24DBF', '#2F9E44'];

const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'nimit_bhulku';
const COLLECTION = 'appstate';
const DOC_ID = 'main';

let clientPromise = null;
if (uri) {
  // family: 4 forces IPv4 for the underlying TCP connections. Some cloud hosts (Render
  // included) have flaky/misconfigured IPv6 routing that corrupts the TLS handshake with
  // Atlas, producing a generic "tlsv1 alert internal error" — forcing IPv4 avoids that path.
  const client = new MongoClient(uri, { family: 4 });
  clientPromise = client.connect().then(c => {
    console.log('Connected to MongoDB Atlas');
    return c;
  }).catch(err => {
    console.error('MongoDB connection failed:', err.message);
    throw err;
  });
} else {
  console.warn(
    'MONGODB_URI is not set — using in-memory storage only. ' +
    'Data will NOT persist across restarts. Set MONGODB_URI to connect to a real database.'
  );
}

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

function backfill(data) {
  const defaults = defaultData();
  if (!data.rulebook) data.rulebook = defaults.rulebook;
  if (!data.pointCategories) data.pointCategories = defaults.pointCategories;
  if (data.spotlightTeamId === undefined) data.spotlightTeamId = null;
  if (!data.nextRuleId) data.nextRuleId = 1;
  if (!data.nextCategoryId) data.nextCategoryId = 1;
  return data;
}

async function getCollection() {
  const client = await clientPromise;
  return client.db(DB_NAME).collection(COLLECTION);
}

// In-memory fallback so local dev works even without a MONGODB_URI set.
// NOTE: this does NOT persist — it's only so `npm start` doesn't crash without Atlas configured.
let memoryFallback = null;

async function load() {
  if (!uri) {
    if (!memoryFallback) memoryFallback = defaultData();
    return backfill(memoryFallback);
  }
  const col = await getCollection();
  let doc = await col.findOne({ _id: DOC_ID });
  if (!doc) {
    doc = { _id: DOC_ID, ...defaultData() };
    await col.insertOne(doc);
  }
  const { _id, ...data } = doc;
  return backfill(data);
}

async function save(data) {
  if (!uri) {
    memoryFallback = data;
    return;
  }
  const col = await getCollection();
  await col.replaceOne({ _id: DOC_ID }, { _id: DOC_ID, ...data }, { upsert: true });
}

module.exports = { load, save, PALETTE };
