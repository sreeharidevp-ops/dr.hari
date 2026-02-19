// ============================================================
//  KIN Queue System — Google Apps Script Backend
//  Krishna Institute of Naturopathy — Dr. Harikrishna
// ============================================================
//
//  SETUP:
//  1. Open https://script.google.com → New Project
//  2. Paste this entire file, replacing the default code
//  3. Click "Save" (Ctrl+S)
//  4. Click "Deploy" → "New Deployment"
//     - Type: Web App
//     - Execute as: Me
//     - Who has access: Anyone
//  5. Click "Deploy" → copy the Web App URL
//  6. Paste that URL into KIN_CONFIG.SCRIPT_URL in all 3 HTML files
//  7. Done! Data now syncs across all devices.
// ============================================================

var SPREADSHEET_ID = ''; // Leave blank — script auto-creates the sheet on first run
var SHEET_TOKENS   = 'Tokens';
var SHEET_SESSIONS = 'Sessions';

// ── Auto-create spreadsheet on first run ──────────────────
function getOrCreateSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('SHEET_ID');

  if (id) {
    try { return SpreadsheetApp.openById(id); } catch(e) {}
  }

  // Create a new spreadsheet
  var ss = SpreadsheetApp.create('KIN Queue System — Dr. Harikrishna');
  props.setProperty('SHEET_ID', ss.getId());

  // Tokens sheet
  var tokSheet = ss.getActiveSheet();
  tokSheet.setName(SHEET_TOKENS);
  tokSheet.appendRow([
    'id','tokenNum','sessionId','sessionName','sessionTime',
    'date','name','phone','age','gender','condition','visitType',
    'priority','notes','estimatedTime','status','bookedAt','updatedAt'
  ]);
  tokSheet.setFrozenRows(1);
  tokSheet.getRange(1,1,1,18).setFontWeight('bold').setBackground('#1a6b4a').setFontColor('#ffffff');

  // Sessions sheet
  var sessSheet = ss.insertSheet(SHEET_SESSIONS);
  sessSheet.appendRow(['id','name','time','icon','cap','avg']);
  sessSheet.setFrozenRows(1);
  sessSheet.getRange(1,1,1,6).setFontWeight('bold').setBackground('#1a6b4a').setFontColor('#ffffff');

  // Default sessions
  var defaultSessions = [
    ['AM1','Morning Session 1','9:00 AM - 11:00 AM','bi-brightness-high-fill',30,4],
    ['AM2','Morning Session 2','11:00 AM - 1:00 PM','bi-sun-fill',25,5],
    ['PM1','Afternoon Session','2:00 PM - 4:00 PM','bi-cloud-sun-fill',25,5],
    ['PM2','Evening Session',  '4:00 PM - 6:00 PM','bi-moon-stars-fill',20,6]
  ];
  defaultSessions.forEach(function(r){ sessSheet.appendRow(r); });

  Logger.log('Spreadsheet created: ' + ss.getUrl());
  return ss;
}

function getTokenSheet()   { return getOrCreateSpreadsheet().getSheetByName(SHEET_TOKENS); }
function getSessionSheet() { return getOrCreateSpreadsheet().getSheetByName(SHEET_SESSIONS); }

// ── CORS headers ──────────────────────────────────────────
function corsResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Route GET requests ────────────────────────────────────
function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === 'getTokens')   return corsResponse(getAllTokens());
    if (action === 'getSessions') return corsResponse(getAllSessions());
    if (action === 'ping')        return corsResponse({ ok: true, ts: new Date().toISOString() });
    return corsResponse({ error: 'Unknown action: ' + action });
  } catch(err) {
    return corsResponse({ error: err.toString() });
  }
}

// ── Route POST requests ───────────────────────────────────
function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action;

    if (action === 'addToken')      return corsResponse(addToken(body.token));
    if (action === 'updateToken')   return corsResponse(updateToken(body.id, body.fields));
    if (action === 'deleteToken')   return corsResponse(deleteToken(body.id));
    if (action === 'saveSessions')  return corsResponse(saveSessions(body.sessions));
    if (action === 'bulkDeleteTokens') return corsResponse(bulkDeleteTokens(body.ids));

    return corsResponse({ error: 'Unknown action: ' + action });
  } catch(err) {
    return corsResponse({ error: err.toString() });
  }
}

// ══════════════════════════════════════════════════════════
//  TOKEN CRUD
// ══════════════════════════════════════════════════════════

var TOKEN_COLS = ['id','tokenNum','sessionId','sessionName','sessionTime',
                  'date','name','phone','age','gender','condition','visitType',
                  'priority','notes','estimatedTime','status','bookedAt','updatedAt'];

function rowToToken(row) {
  var t = {};
  TOKEN_COLS.forEach(function(k,i){ t[k] = row[i] !== undefined ? String(row[i]) : ''; });
  return t;
}

function getAllTokens() {
  var sheet = getTokenSheet();
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok:true, tokens:[] };
  var tokens = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) tokens.push(rowToToken(data[i]));
  }
  return { ok:true, tokens:tokens };
}

function addToken(token) {
  var sheet = getTokenSheet();
  token.updatedAt = new Date().toISOString();
  var row = TOKEN_COLS.map(function(k){ return token[k] || ''; });
  sheet.appendRow(row);
  return { ok:true, token:token };
}

function updateToken(id, fields) {
  var sheet = getTokenSheet();
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      fields.updatedAt = new Date().toISOString();
      Object.keys(fields).forEach(function(k){
        var ci = TOKEN_COLS.indexOf(k);
        if (ci >= 0) sheet.getRange(i+1, ci+1).setValue(fields[k]);
      });
      return { ok:true };
    }
  }
  return { ok:false, error:'Token not found: ' + id };
}

function deleteToken(id) {
  var sheet = getTokenSheet();
  var data  = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i+1);
      return { ok:true };
    }
  }
  return { ok:false, error:'Not found' };
}

function bulkDeleteTokens(ids) {
  var sheet = getTokenSheet();
  var data  = sheet.getDataRange().getValues();
  var idSet = {};
  ids.forEach(function(id){ idSet[String(id)] = true; });
  for (var i = data.length - 1; i >= 1; i--) {
    if (idSet[String(data[i][0])]) sheet.deleteRow(i+1);
  }
  return { ok:true };
}

// ══════════════════════════════════════════════════════════
//  SESSION CRUD
// ══════════════════════════════════════════════════════════

var SESS_COLS = ['id','name','time','icon','cap','avg'];

function getAllSessions() {
  var sheet = getSessionSheet();
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok:true, sessions:[] };
  var sessions = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      var s = {};
      SESS_COLS.forEach(function(k,ci){ s[k] = data[i][ci]; });
      s.cap = parseInt(s.cap) || 25;
      s.avg = parseInt(s.avg) || 5;
      sessions.push(s);
    }
  }
  return { ok:true, sessions:sessions };
}

function saveSessions(sessions) {
  var sheet = getSessionSheet();
  // Clear all data rows (keep header)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
  // Re-insert
  sessions.forEach(function(s){
    sheet.appendRow(SESS_COLS.map(function(k){ return s[k] || ''; }));
  });
  return { ok:true };
}
