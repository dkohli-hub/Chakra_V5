export const GITA = [
  {ch:1,name:'My Battlefield',essence:'The courage to face what must be faced.',teaching:'Before every great action, there is doubt. The Gita begins here — not with answers, but with paralysis. This is your starting point too.',color:'#8B1A1A'},
  {ch:2,name:'My Clarity',essence:'The soul is eternal. Act from knowledge, not fear.',teaching:'You are not the body, not the mind, not the role. You are the witness. When you know this, action becomes clean.',color:'#B87800'},
  {ch:3,name:'My Work',essence:'Do your work. Do not withhold action from the world.',teaching:'Act without attachment to the fruit. The action is yours. The result belongs to Krishna.',color:'#1A6B5A'},
  {ch:4,name:'My Learning',essence:'The wise see action in inaction and inaction in action.',teaching:'Knowledge is the boat that carries you across the ocean of karma. Seek it without ego.',color:'#2E7D32'},
  {ch:5,name:'My Peace',essence:'True renunciation is inner, not outer.',teaching:'The one who acts without claiming the action as theirs — that is true freedom while still in the world.',color:'#A07828'},
  {ch:6,name:'My Health',essence:'The body is the vehicle. Tend it with discipline.',teaching:'Let food be medicine. Let sleep be restoration. The undisciplined body is the undisciplined mind.',color:'#1A6B5A'},
  {ch:7,name:'My Faith',essence:'I am in everything. Everything is in Me.',teaching:'The one who knows Me truly — in nature, in events, in people — walks without fear.',color:'#3A6B8A'},
  {ch:8,name:'My Transition',essence:'What you think at the last moment shapes what follows.',teaching:'Live so consciously that even the end is a conscious act.',color:'#5A5A7A'},
  {ch:9,name:'My Devotion',essence:'Offer everything to Me. I will carry it.',teaching:'Even the smallest offering — a leaf, a flower, a moment of pure attention — reaches Me when given with love.',color:'#6A3A8A'},
  {ch:10,name:'My Source',essence:'I am the origin of everything.',teaching:"Your unique gift is a Vibhuti — a divine expression. Use it fully. Withholding your gift is withholding Krishna's work.",color:'#8B6914'},
  {ch:11,name:'My Planning',essence:'See the whole field before you act.',teaching:'Arjuna saw the full cosmic form — everything simultaneously. Planning is your attempt at that same comprehensive seeing.',color:'#2E7D32'},
  {ch:12,name:'My People',essence:'Love without condition. Serve without expectation.',teaching:'The one who bears no ill will toward any being — friendly and compassionate — that one is dear to Me.',color:'#B87800'},
  {ch:13,name:'My Home',essence:'Know the field. Know the knower of the field.',teaching:'Your home, your body, your immediate environment — these are your Kshetra. Tend them as sacred ground.',color:'#8B1A1A'},
  {ch:14,name:'My Nature',essence:'Rise above the three qualities. Be the witness.',teaching:'Rajas drives. Tamas holds. Sattva illuminates. You are the one watching all three.',color:'#1A6B5A'},
  {ch:15,name:'My Legacy',essence:'The eternal Ashwattha — the undying tree of life.',teaching:'What will remain when you are gone? Not your possessions. Your light. Your words. The lives you changed.',color:'#2E7D32'},
  {ch:16,name:'My Character',essence:'Fearlessness, purity of heart, generosity — divine qualities.',teaching:'The divine qualities do not announce themselves. They are simply the residue of right living, accumulated over time.',color:'#A07828'},
  {ch:17,name:'My Financial',essence:'Even faith has a quality. Choose Sattvic faith.',teaching:'Where you give, where you spend, what you eat — all of this reveals what you truly believe.',color:'#1A6B5A'},
  {ch:18,name:'My Completions',essence:'Surrender, completion, and the freedom that follows right action.',teaching:'Abandon all varieties of dharma and simply surrender unto Me. I shall deliver you from all sinful reactions. Do not fear. — BG 18.66',color:'#6A3A8A'}
]

export const TABS = [
  {id:'today',  icon:'🔋', label:'Today'},
  {id:'gather', icon:'🔮', label:'Gather'},
  {id:'time',   icon:'⏱',  label:'Time'},
  {id:'karma',  icon:'⚡', label:'Karma'},
  {id:'gita',   icon:'📖', label:'Gita'},
  {id:'soul',   icon:'✦',  label:'Soul'},
  {id:'bt',     icon:'🧠', label:'Brain Twin'},
  {id:'data',   icon:'📊', label:'Data'},
  {id:'score',  icon:'🏆', label:'Score'}
]

export const BUCKETS = [
  {name:'Karya™',     key:'Karya',     sub:'The work that is yours to do',                    css:'bk-karya',     col:'#A07828'},
  {name:'Dhairya™',   key:'Dhairya',   sub:'Dignified waiting — not yet in my hands',         css:'bk-dhairya',   col:'#B87800'},
  {name:'Vishram™',   key:'Vishram',   sub:'Conscious rest — timing not right yet',            css:'bk-vishram',   col:'#5A5A7A'},
  {name:'Manan™',     key:'Manan',     sub:'Deep contemplation — life-altering decisions',     css:'bk-manan',     col:'#8B6914'},
  {name:'Manthan™',   key:'Manthan',   sub:'Churning — let it reveal itself',                  css:'bk-manthan',   col:'#3A6B8A'},
  {name:'Tyaga™',     key:'Tyaga',     sub:'Conscious release with honour',                    css:'bk-tyaga',     col:'#2E7D32'},
  {name:'Prarabdha™', key:'Prarabdha', sub:'Destiny in motion — witness only',                 css:'bk-prarabdha', col:'#6A3A8A'}
]

export const TIME_GROUPS = [
  {key:'today',    label:'Today',              sub:'Due now',            cls:'time-today',  types:['today']},
  {key:'week',     label:'This Week',          sub:'Next 7 days',        cls:'time-week',   types:['thisWeek']},
  {key:'next',     label:'Next Week',          sub:'Days 8–14',          cls:'time-next',   types:['nextWeek']},
  {key:'month',    label:'Next Month',         sub:'Within 30 days',     cls:'time-month',  types:['thisMonth']},
  {key:'q',        label:'Q3 / Q4 2026',       sub:'July–December',      cls:'time-q',      types:['Q3','Q4']},
  {key:'year',     label:'This Year / Beyond', sub:'Annual and multi-year',cls:'time-year', types:['thisYear','1year','2years']},
  {key:'park',     label:'Parking Lot',        sub:'No timeline',        cls:'time-park',   types:['parkingLot']}
]

export const W_LABEL = {W1:'5 min',W2:'30 min',W3:'1 hr',W4:'½ day',W5:'full day'}
export const W_MAP   = {W1:1,W2:2,W3:3,W4:4,W5:5}

export const BUCKET_COLORS = {
  Karya:'#A07828', Dhairya:'#B87800', Vishram:'#5A5A7A',
  Manan:'#8B6914', Manthan:'#3A6B8A', Tyaga:'#2E7D32', Prarabdha:'#6A3A8A'
}

export const WEIGHT_COLORS = {W1:'#2E7D32',W2:'#A07828',W3:'#3A6B8A',W4:'#B87800',W5:'#8B1A1A'}

export const CAL_SLOTS = [
  'Mon 9:00 AM','Mon 11:00 AM','Mon 2:00 PM',
  'Tue 8:30 AM','Tue 3:00 PM',
  'Wed 10:00 AM','Wed 4:00 PM',
  'Thu 9:30 AM','Thu 1:00 PM',
  'Fri 11:00 AM','Fri 3:00 PM'
]

export const KRISHNA_VERSES = [
  "Do your duty without attachment to results. — Gita 3.19",
  "The soul is never born nor dies at any time. — Gita 2.20",
  "Let right deeds be thy motive, not the fruit which comes from them. — Gita 2.47",
  "Yoga is skill in action. — Gita 2.50",
  "The mind is restless but it is subdued by practice. — Gita 6.35",
  "You have a right to perform your prescribed duties, but never to the fruits. — Gita 2.47",
  "Better is one's own dharma, imperfectly performed, than another's well performed. — Gita 3.35",
  "Through selfless service you will always be fruitful. — Gita 3.10",
  "Abandon all varieties of dharma and simply surrender unto Me. — Gita 18.66",
  "A person not disturbed by the incessant flow of desires can alone achieve peace. — Gita 2.70"
]

export const CAL_KEYWORDS = {
  itc:        ['itc','kumud','enterprise','consulting','larry','jason','kendi','milwaukee','deepankar','bhavya','hardware','visteon','hsa','mark gellings','underwriter'],
  picturizze: ['picturizze','shoot','reel','photography','photo','katie','shruti','rajiv','livy','dallas','vikram','gayatri','rohit','iant','pugs','india bazaar','rania','kavya','vinod','sai','priya','apsara'],
  personal:   ['sonia','dhruv','disha','mila','riya','mom','family','health','mounjaro','dexcom','b-12','b12','doctor','dr.','neeraj','india','tirth','sudhir','annuity','hcl','macbook','insurance','fbar','tax','f-bar']
}
