export interface Action {
  code: string;
  label: string;
  special: boolean;
}

export const DEFAULT_ACTIONS: Action[] = [
  {code:'1',  label:'LOGIN AND WAIT FOR ACTIONS', special:false},
  {code:'2',  label:'SPAM [ALL NOTSPAM]', special:false},
  {code:'3',  label:'SPAM [ALL NOTSPAM] >> INBOX [OPEN + ARCHIVE]', special:false},
  {code:'4',  label:'SPAM [ALL NOTSPAM] >> INBOX [OPEN + DELETE]', special:false},
  {code:'5',  label:'SPAM [ALL NOTSPAM] >> INBOX [OPEN + CLICK LINK + ARCHIVE]', special:false},
  {code:'6',  label:'SPAM [OPEN + SHOW IMAGES + CLICK LINK + REPLY + NOTSPAM]', special:false},
  {code:'7',  label:'INBOX [OPEN + ADD CONTACT + ARCHIVE]', special:false},
  {code:'8',  label:'CHECK ACCOUNTS : RESULT >> [Tools\\Result]', special:false},
  {code:'9',  label:'RANDOM ACTIONS', special:false},
  {code:'10', label:'INBOX [Mark as Read ALL + ARCHIVE]', special:false},
  {code:'11', label:'INBOX [SELECT ALL + ARCHIVE]', special:false},
  {code:'12', label:'ADD CONTACTS (Requires contacts.csv)', special:false},
  {code:'13', label:'SPAM [DELETE ALL]', special:false},
  {code:'14', label:'INBOX [DELETE ALL]', special:false},
  {code:'15', label:'CLEAN ALL [DELETE ALL]', special:false},
  {code:'16', label:'INBOX [REPLY + Archive]', special:false},
  {code:'17', label:'INBOX [OPEN + SHOW IMAGES + CLICK LINK + ARCHIVE]', special:false},
  {code:'18', label:'SPAM [OPEN + NOTSPAM]', special:false},
  {code:'19', label:'INBOX [OPEN + ARCHIVE]', special:false},
  {code:'20', label:'INBOX [Mark as Read ALL + ARCHIVE][By Page]', special:false},
  {code:'21', label:'SPAM AND INBOX [DELETE ALL PAGE by PAGE]', special:false},
  {code:'22', label:'INBOX [OPEN + ADD STAR + ARCHIVE]', special:false},
  {code:'23', label:'Change Recovery Mail', special:false},
  {code:'24', label:'INBOX [OPEN + CLICK]', special:false},
  {code:'25', label:'OpenAccount', special:true},
  {code:'26', label:'SPAM [OPEN + ADD STAR + Mark as Important + NOTSPAM]', special:false},
  {code:'27', label:'SPAM [OPEN + ADD STAR + Mark as Important + CLICK + NOTSPAM]', special:false},
  {code:'28', label:'ADD CONTACTS MANUALLY', special:false},
  {code:'29', label:'INBOX [OPEN + ADD STAR + Mark as Important + Show Image + Click + Reply + ARCHIVE]', special:false},
  {code:'30', label:'DISABLE SOCIAL & PROMOTION + ACTIVE SHOW MAKERS', special:false},
  {code:'31', label:'CHECK ACCOUNT STORAGE', special:false},
  {code:'32', label:'DELETE CONTACTS', special:false},
  {code:'33', label:'DELETE CONTACTS THEN IMPORT CONTACTS', special:false},
  {code:'34', label:'[DELETE ALL] By Search', special:false},
  {code:'35', label:'SPAM [ALL NOTSPAM] by search', special:false},
  {code:'36', label:'EMPTY TRASH', special:false},
  {code:'37', label:'INBOX [OPEN + send mails]', special:false},
  {code:'38', label:'[SHOW SPAM LABEL]', special:false},
  {code:'39', label:'[DELETE ALL PAGE by PAGE] by search', special:false},
  {code:'40', label:'CHANGE PASSWORD [with link]', special:false},
  {code:'41', label:'NOTIFICATIONS', special:false},
  {code:'42', label:'Change Recovery Mail [with link]', special:false},
  {code:'43', label:'SPAM [OPEN + Click + Reply + NOTSPAM]', special:false},
  {code:'44', label:'DELETE CONTACTS labels', special:false},
  {code:'45', label:'INBOX [OPEN + REPLY + ARCHIVE]', special:false},
  {code:'46', label:'INBOX [OPEN + ADD STAR + REPLY + ARCHIVE]', special:false},
  {code:'47', label:'CHANGE Language 2', special:false},
  {code:'48', label:'DELETE OTHER CONTACTS', special:false},
  {code:'49', label:'INBOX [OPEN + youtube subscribe] V2', special:false},
  {code:'50', label:'INBOX [OPEN + CLICK + REPLY + ARCHIVE]', special:false},
  {code:'51', label:'SPAM [ALL NOTSPAM] >> INBOX [OPEN + random + ARCHIVE]', special:false},
  {code:'52', label:'PAUSE WEB activity', special:false},
  {code:'53', label:'Delete Profiles', special:false},
  {code:'54', label:'DISABLE SOCIAL PROMOTION UPDATES FORUMS + Inbox default', special:false},
  {code:'55', label:'SPAM [OPEN + SHOW IMAGES + CLICK LINK + NOTSPAM]', special:false},
  {code:'56', label:'Add Alert Newsletters', special:false},
  {code:'57', label:'INBOX [OPEN + ADD STAR + MARK AS IMPORTANT + next MSG]', special:false},
  {code:'58', label:'SPAM [ALL NOTSPAM] >> INBOX [OPEN + ADD STAR + Important + Reply + ARCHIVE]', special:false},
  {code:'59', label:'INBOX [OPEN + send mails randomly]', special:false},
  {code:'60', label:'SHOW 100 PER PAGE', special:false},
  {code:'61', label:'SPAM [ALL NOT SPAM] >> INBOX [OPEN + ADD STAR + ARCHIVE]', special:false},
  {code:'62', label:'SPAM [OPEN + ADD STAR + Important + CLICK + REPLY + NOTSPAM]', special:false},
  {code:'63', label:'SPAM [ALL NOTSPAM] >> INBOX [OPEN + ADD STAR + Important + ARCHIVE]', special:false},
  {code:'64', label:'CHANGE PASSWORD [with link] manually', special:false},
  {code:'65', label:'INBOX [OPEN + Click + Reply]', special:false},
  {code:'66', label:'SPAM [OPEN + ADD STAR + Important + NOT SPAM] by search', special:false},
  {code:'67', label:'INBOX [PROMOTION + OPEN + CLICK + next MSG]', special:false},
  {code:'68', label:'YOUTUBE [WATCH RANDOM VIDEOS]', special:false},
  {code:'69', label:'INBOX [UPLOAD FILES IN GOOGLE DRIVE]', special:false},
  {code:'70', label:'SPAM [OPEN + SHOW IMAGES + CLICK LINK + REPLY + NOTSPAM] by search', special:false},
  {code:'71', label:'SPAM [OPEN + NOTSPAM] by search >> INBOX [OPEN + ARCHIVE]', special:false},
  {code:'72', label:'INBOX [OPEN + create channel youtube]', special:false},
  {code:'73', label:'SPAM [OPEN + NOT SPAM] by search', special:false},
  {code:'74', label:'GOOGLE SEARCH', special:false},
  {code:'75', label:'INBOX [OPEN + ADD STAR + IMPORTANT + CLICK + ARCHIVE]', special:false},
  {code:'76', label:'INBOX [OPEN + ADD STAR + IMPORTANT + ARCHIVE]', special:false},
  {code:'77', label:'SPAM [ALL NOTSPAM] >> INBOX [OPEN + random + ARCHIVE] by search', special:false},
  {code:'78', label:'SIGN UP WITH GOOGLE ACCOUNT', special:false},
  {code:'79', label:'OVERRIDE FILTERS & DONT PREDICT IMPORTANT', special:false},
  {code:'80', label:'SIGN UP WITH GOOGLE ACCOUNT [loop]', special:false},
  {code:'81', label:'SIGN UP WITH GOOGLE ACCOUNT [loop + continue]', special:false},
  {code:'82', label:'CHANGE PROFILE PHOTO', special:false},
  {code:'83', label:'DISABLE POPUP FROM BROWSER', special:false},
  {code:'84', label:'disable_forwarding + delete email', special:false},
  {code:'85', label:'INBOX [OPEN + random click,star,reply + ARCHIVE]', special:false},
  {code:'86', label:'DELETE Trash CONTACTS', special:false},
  {code:'87', label:'DELETE LABELS', special:false},
  {code:'88', label:'CHANGE ADs Settings', special:false},
  {code:'89', label:'SPAM [ALL NOTSPAM] >> INBOX [OPEN + random star,important + ARCHIVE]', special:false},
  {code:'90', label:'promotion and social click Ads', special:false},
  {code:'91', label:'INBOX [OPEN + random important,star,reply + ARCHIVE]', special:false},
  {code:'92', label:'INBOX [OPEN + switch advanced toolbar]', special:false},
  {code:'93', label:'SPAM [ALL NOTSPAM] by search >> INBOX [OPEN + ADD STAR + ARCHIVE] by search', special:false},
  {code:'94', label:'ALBUMS [CREATE ALBUM AND UPLOAD PHOTOS]', special:false},
  {code:'95', label:'STORAGE MANAGER', special:false},
  {code:'96', label:'DELETE CONTACTS labels then IMPORT CONTACTS', special:false},
  {code:'97', label:'CHECK ACTIVITY [search]', special:false},
  {code:'98', label:'CHANGE PROFILE THEME', special:false},
  {code:'99', label:'CHECK RESTRICTED ACCESS TO SERVICIES', special:false},
  {code:'100',label:'WATCH YOUTUBE SHORTS', special:false},
  {code:'101',label:'SIGN To TRENDS', special:false},
  {code:'102',label:'SEARCH FOR Account restored / disabled in myaccount', special:false},
  {code:'103',label:'SEND EMAIL TO RANDOM RECIPIENT', special:false},
  {code:'104',label:'INBOX [OPEN + WAIT + RANDOM ACTION + NEXT MSG] by search', special:false},
  {code:'105',label:'SEARCH FOR Account restored in myaccount', special:false},
  {code:'106',label:'Active Authenticator', special:false},
  {code:'107',label:'ENABLE SOCIAL & PROMOTION', special:false},
  {code:'108',label:'INBOX [OPEN + random click,star,important + ARCHIVE + NEXT] by search', special:false},
  {code:'109',label:'CHECK RESTRICTED ACCESS TO GMAIL', special:false},
  {code:'110',label:'CLICK ON GOOGLE NEWS LINKS', special:false},
  {code:'111',label:'INBOX [MOST RECENT] by search', special:false},
  {code:'112',label:'SUBSCRIBE YOUTUBE CHANNELS by search', special:false},
  {code:'113',label:'CREATE GOOGLE KEEP NOTE', special:false},
  {code:'114',label:'YOUTUBE [WATCH RANDOM VIDEOS + LIKE]', special:false},
  {code:'115',label:'RANDOM [WATCH YOUTUBE + SIGN UP + GOOGLE NEWS + TRENDS + REPLY]', special:false},
];

export const DEFAULT_FOLDERS  = ['reporting', 'temp', 'abdelaziz'];
export const DEFAULT_SERVERS  = ['144', '178', '200', '300', '400'];
export const DEFAULT_DELIVERIES = ['nv-sd07-03', 'nv-sd03-03', 'nv-seed02'];

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Robust date parser that handles:
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - Date objects
 */
export function parseSafeDate(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  
  const str = String(input).trim();
  if (!str) return null;

  // Try parsing directly first
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Handle ISO-like with T12:00:00 suffix often used in our code
  if (str.includes('T')) {
    d = new Date(str.split('T')[0] + 'T12:00:00');
    if (!isNaN(d.getTime())) return d;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    // Check if it's DD/MM/YYYY
    if (parts[2].length === 4) {
      d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
    } 
    // Check if it's YYYY/MM/DD
    else if (parts[0].length === 4) {
      d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00`);
    }
    
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export function fmtDate(str: any) {
  const d = parseSafeDate(str);
  if (!d) return '—';
  try {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch (e) {
    return '—';
  }
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function n2s(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)    return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}
