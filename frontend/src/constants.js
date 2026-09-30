// Arena names finalized by DK, 28-29 Sep 2026 — supersedes all earlier drafts.
export const GITA = [
  {ch:1,name:'Vishad Yoga',essence:'The paralysis before wisdom — Arjuna frozen between duty and love.',teaching:'Two armies face each other. Arjuna sees his own kin on both sides and cannot move. Every arena of life begins here — the honest freeze before the path is clear.',color:'#8B1A1A'},
  {ch:2,name:'Eternal Soul',essence:'The soul does not die with the body. Act from what is permanent, not what is passing.',teaching:'Grief over the body is grief over something that was never permanent. Know the witness inside you, and act from steadiness rather than fear.',color:'#B87800'},
  {ch:3,name:'Nishkama Karma',essence:'Do the work. Release your grip on what it earns you.',teaching:'Inaction is not actually possible — everyone acts by their own nature. The work is yours. The result belongs to something larger than you.',color:'#1A6B5A'},
  {ch:4,name:'Act with Knowledge',essence:'Real renunciation is acting with such clarity that action no longer binds you.',teaching:'Whenever dharma declines, it is restored — that renewal happens through conscious, knowing action, not through escaping the world.',color:'#2E7D32'},
  {ch:5,name:'Karma Sanyasa',essence:'Renunciation happens inside action, not by escaping it.',teaching:'Work with body and mind, but without personal claim over the result — untouched, like a lotus leaf on water.',color:'#A07828'},
  {ch:6,name:'Samatva',essence:'Equanimity — the same in heat and cold, success and failure.',teaching:'A trained mind stays even through pleasure and pain. No sincere effort toward that steadiness is ever wasted.',color:'#1A6B5A'},
  {ch:7,name:'Gyaan Vigyaan',essence:'The difference between knowing about the divine and truly realizing it.',teaching:'Most people turn toward the divine out of need. The wise turn toward it for its own sake — that is realized, not merely learned, knowledge.',color:'#3A6B8A'},
  {ch:8,name:'Akshara Brahma',essence:'What is imperishable, beyond birth and death.',teaching:'Whatever you dwell on, that is what you become. Train your attention on what does not decay.',color:'#5A5A7A'},
  {ch:9,name:'Patram Pushpam',essence:'A leaf, a flower, a little water, given with love, is enough.',teaching:'Krishna is supreme, and all roads — however roundabout — lead back to him. Devotion needs no grandeur, only sincerity.',color:'#6A3A8A'},
  {ch:10,name:'Vibhuti Yoga',essence:'Wherever there is glory or power, know it springs from him.',teaching:'The best in any category — the tallest mountain, the fiercest warrior, the brightest mind — is a spark of the same source.',color:'#8B6914'},
  {ch:11,name:'Vishwaroop',essence:'The universal form — all of creation, all of time, seen at once.',teaching:'Behind the familiar, personal form is a reality vast enough to contain everything, including outcomes already in motion.',color:'#2E7D32'},
  {ch:12,name:'Bhakti Yoga',essence:'Devotion, felt and personal, is the most direct path.',teaching:'Free of hatred, compassionate, unattached to outcomes, steady in joy and sorrow — these are the marks of a devotee dear to him.',color:'#B87800'},
  {ch:13,name:'Kshetra Yoga',essence:'You are not the field. You are the knower of the field.',teaching:'The body, mind, and circumstances are the field — observed, not owned. The awareness watching them is who you actually are.',color:'#8B1A1A'},
  {ch:14,name:'3 Gunas',essence:'Sattva, Rajas, and Tamas — the three forces that shape mood and tendency.',teaching:'Clarity, restlessness, and inertia are always mixed within a person. Real freedom is recognizing the mix, then rising above all three.',color:'#1A6B5A'},
  {ch:15,name:'The Inverted Tree',essence:'Roots above, branches below — the visible world hangs from an unseen source.',teaching:'Most people live entirely among the branches. Trace the tree back to its root, and you find what everything else depends on.',color:'#2E7D32'},
  {ch:16,name:'Daivasura Yoga',essence:'Divine and demonic natures — the qualities that lift you up or pull you down.',teaching:'Lust, anger, and greed are the three gates to self-destruction. The qualities you cultivate actively shape where your life moves.',color:'#A07828'},
  {ch:17,name:'3 Gunas of Faith',essence:'Even faith, food, and generosity carry the mark of Sattva, Rajas, or Tamas.',teaching:'Sincerity alone does not make faith pure — what colors it is the same three gunas that color everything else you do.',color:'#1A6B5A'},
  {ch:18,name:'Moksha thru Sanyasa',essence:'The final teaching — surrender every action and its outcome.',teaching:'Abandon all varieties of dharma and simply surrender unto me. I shall deliver you from all sinful reactions. Do not fear. — BG 18.66',color:'#6A3A8A'}
]

// Bucket tests — Gita principle + plain question per bucket. Locked by DK, 28 Sep 2026.
export const BUCKET_TESTS = {
  Karya:     {principle:'Act on your duty without clinging to the result', question:'Can I do this now, in a window, whatever the outcome?'},
  Dhairya:   {principle:"Steadiness — don't force what isn't ready", question:"Is the action ready but waiting on a person, event, or moment I don't control?"},
  Vishram:   {principle:'Balance between effort and rest', question:'Is this deliberately at leisure — no deadline, no guilt?'},
  Manan:     {principle:'Reflection that brings understanding (Sattvic, done in Brahma Muhurta)', question:'Do I need to think or understand before anything can be done?'},
  Manthan:   {principle:'Arjuna at the crossroads — two pulls, one resolution (Sattvic, done in Brahma Muhurta)', question:'Are two things pulling against each other so that something must be resolved?'},
  Tyaga:     {principle:'Release the fruit, keep the awareness', question:'Can I consciously let this go, without guilt?'},
  Prarabdha: {principle:'Some outcomes are already unfolding', question:'Is this already in motion and needing nothing from me now?'}
}

export const BUCKET_ORDER = ['Karya','Dhairya','Vishram','Manan','Manthan','Tyaga','Prarabdha']

// "Deadline" options — horizon labels, not dates (DK's strategy).
export const HORIZON_OPTS = [
  ['today','Today'],['thisWeek','This week'],['nextWeek','Next week'],['thisMonth','Next month'],
  ['Q3','Q3 2026'],['thisYear','This year'],['1year','1–2 years'],['parkingLot','Parking lot'],
  ['','No date (Vishram-style)']
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
  'Fri 11:00 AM','Fri 3:00 PM',
  'Sat 9:00 AM','Sat 11:00 AM','Sat 2:00 PM','Sat 4:00 PM',
  'Sun 10:00 AM','Sun 12:00 PM','Sun 3:00 PM'
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
