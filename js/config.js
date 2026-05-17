// ═══════════════════════════════════════════════
// js/config.js
// Global DB state, Firebase config, init, refs
// Load order: FIRST — before utils.js, core.js, db.js
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════
let DB = {
  users:[],
  meals:{},
  bazar:[],
  others:[],      // NEW: অন্যান্য খরচ
  transactions:[], // NEW: জমা/উত্তোলন {id,date,uname,type:'deposit'/'withdraw',amount,note,by}
  managers:{},    // {"YYYY-MM": [uname,...]}
  mealRates:{},   // {"YYYY-MM": finalRate}
  cfg:{def:{b:0.75,l:1.5,d:0.75}, byDate:{}},
  controllers:[],
  siteNote: 'আশুগঞ্জ, ব্রাহ্মণবাড়িয়া',
  notice: {text:'', popupEnabled:false},
  officeMealRates:{},  // {"YYYY-MM": rate}  — আলাদা রেট
  officeMealNotes:[],  // [{id,date,text,by}]  — নোট ইতিহাস
};
let CU = null;
let admBuf = {};
let mealDate = '';
let currentDetailUser = '';
let currentDetailMemTab = 'meals';

const LS_USER = 'mq7u';


// ═══════════════════════════════════════════════
// FIREBASE CONFIG & INIT
// ═══════════════════════════════════════════════
const firebaseConfig = {
  apiKey: 'AIzaSyDqHnuTefG_v2KJ5rFVmsPO1P0KQvH40OU',
  authDomain: 'midlandquarter-c516b.firebaseapp.com',
  databaseURL: 'https://midlandquarter-c516b-default-rtdb.firebaseio.com/',
  projectId: 'midlandquarter-c516b',
  storageBucket: 'midlandquarter-c516b.firebasestorage.app',
  messagingSenderId: '899146057513',
  appId: '1:899146057513:web:636a096affb5dd40a3d938',
  measurementId: 'G-CNXVF9KG9Y'
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const dbRef     = database.ref('messData');        // migration/fallback only
const globalRef  = database.ref('messData/global');  // users, cfg, controllers, notice, siteNote, rules, shortfall, prevBalances, handoverDone
const monthsRef  = database.ref('messData/months');  // per-mess-month: meals, bazar, others, transactions, managers, mealRates, officeMealRates, officeMealNotes, cookBills
let currentMonthRef = null;
let currentMonthKey = '';

const GLOBAL_FIELDS = ['users','cfg','controllers','siteNote','notice','rules','shortfall','prevBalances','handoverDone'];
const MONTH_FIELDS  = ['meals','bazar','others','transactions','managers','mealRates','officeMealRates','officeMealNotes','cookBills'];

const auth = firebase.auth();
