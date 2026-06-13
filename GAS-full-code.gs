const VERSION = 'avatar-2026-06-14-post';

const SHEETS = {
  workers: 'Workers',
  categories: 'Categories',
  tasks: 'Tasks',
  skills: 'Skills',
  snapshots: 'Snapshots',
};

const HEADERS = {
  Workers: ['id', 'name', 'code', 'active', 'avatarDataUrl'],
  Categories: ['id', 'code', 'name', 'color', 'order', 'active'],
  Tasks: ['id', 'code', 'name', 'catId', 'order', 'hasDoc', 'link', 'active'],
  Skills: ['taskId', 'workerId', 'level'],
  Snapshots: ['month', 'fill', 'risk', 'totalsJson'],
};

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = params.callback || '';
  try {
    const action = params.action || 'load';
    if (action === 'version') {
      setupSheets();
      return respond({
        ok: true,
        version: VERSION,
        headers: getHeaderMap_(getSpreadsheet_().getSheetByName(SHEETS.workers)).headers,
      }, callback);
    }
    if (action === 'load') return respond(loadAll(), callback);
    if (action === 'save') {
      const data = safeParse_(params.payload || '{}');
      saveAll(data);
      return respond({ ok: true, version: VERSION }, callback);
    }
    if (action === 'saveAvatar') {
      saveAvatar(params.workerId, params.avatarDataUrl || '');
      return respond({ ok: true, version: VERSION }, callback);
    }
    return respond({ ok: false, error: 'unknown action: ' + action }, callback);
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message ? err.message : err) }, callback);
  }
}

function doPost(e) {
  try {
    const data = safeParse_((e && e.postData && e.postData.contents) || '{}');
    const action = data.action || 'save';
    if (action === 'save') {
      saveAll(data);
      return respond({ ok: true, version: VERSION });
    }
    if (action === 'saveAvatar') {
      saveAvatar(data.workerId, data.avatarDataUrl || '');
      return respond({ ok: true, version: VERSION });
    }
    return respond({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Skillmap')
    .addItem('Setup sheets', 'setupSheets')
    .addToUi();
}

function setupSheets() {
  const ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach(name => ensureSheet_(ss, name, HEADERS[name]));
}

function loadAll() {
  setupSheets();
  const ss = getSpreadsheet_();
  const workers = readSheet_(ss, SHEETS.workers).map(row => ({
    id: String(row.id || ''),
    name: String(row.name || ''),
    code: String(row.code || ''),
    active: toBool_(row.active, true),
    avatarDataUrl: String(row.avatarDataUrl || ''),
  })).filter(row => row.id);

  const categories = readSheet_(ss, SHEETS.categories).map(row => ({
    id: String(row.id || ''),
    code: String(row.code || ''),
    name: String(row.name || ''),
    color: String(row.color || '#4a90d9'),
    order: Number(row.order || 0),
    active: toBool_(row.active, true),
  })).filter(row => row.id);

  const tasks = readSheet_(ss, SHEETS.tasks).map(row => ({
    id: String(row.id || ''),
    code: String(row.code || ''),
    name: String(row.name || ''),
    catId: String(row.catId || ''),
    order: Number(row.order || 0),
    hasDoc: toBool_(row.hasDoc, false),
    link: String(row.link || ''),
    active: toBool_(row.active, true),
  })).filter(row => row.id);

  const skills = {};
  readSheet_(ss, SHEETS.skills).forEach(row => {
    if (row.taskId && row.workerId) {
      skills[String(row.taskId) + '|' + String(row.workerId)] = Number(row.level || 0);
    }
  });

  const snapshots = readSheet_(ss, SHEETS.snapshots).map(row => ({
    month: String(row.month || ''),
    fill: Number(row.fill || 0),
    risk: Number(row.risk || 0),
    totals: safeParse_(row.totalsJson || '{}'),
  })).filter(row => row.month);

  return { ok: true, version: VERSION, workers, categories, tasks, skills, snapshots };
}

function saveAll(data) {
  setupSheets();
  const ss = getSpreadsheet_();
  const avatarMap = readWorkerAvatarMap_(ss);

  writeSheet_(ss, SHEETS.workers, HEADERS.Workers, (data.workers || []).map(w => [
    w.id || '',
    w.name || '',
    w.code || '',
    w.active !== false,
    Object.prototype.hasOwnProperty.call(w, 'avatarDataUrl')
      ? (w.avatarDataUrl || '')
      : (avatarMap[w.id] || ''),
  ]));

  writeSheet_(ss, SHEETS.categories, HEADERS.Categories, (data.categories || []).map(c => [
    c.id || '',
    c.code || '',
    c.name || '',
    c.color || '',
    Number(c.order || 0),
    c.active !== false,
  ]));

  writeSheet_(ss, SHEETS.tasks, HEADERS.Tasks, (data.tasks || []).map(t => [
    t.id || '',
    t.code || '',
    t.name || '',
    t.catId || '',
    Number(t.order || 0),
    !!t.hasDoc,
    t.link || '',
    t.active !== false,
  ]));

  const skillRows = Object.keys(data.skills || {}).map(key => {
    const parts = key.split('|');
    return [parts[0] || '', parts[1] || '', Number(data.skills[key] || 0)];
  });
  writeSheet_(ss, SHEETS.skills, HEADERS.Skills, skillRows);

  writeSheet_(ss, SHEETS.snapshots, HEADERS.Snapshots, (data.snapshots || []).map(s => [
    s.month || '',
    Number(s.fill || 0),
    Number(s.risk || 0),
    JSON.stringify(s.totals || {}),
  ]));
}

function saveAvatar(workerId, avatarDataUrl) {
  if (!workerId) throw new Error('workerId is required');
  setupSheets();
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEETS.workers);
  const info = ensureHeaders_(sheet, HEADERS.Workers);
  const idCol = info.index.id + 1;
  const avatarCol = info.index.avatarDataUrl + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('worker not found: ' + workerId);

  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(workerId)) {
      sheet.getRange(i + 2, avatarCol).setValue(avatarDataUrl || '');
      return true;
    }
  }
  throw new Error('worker not found: ' + workerId);
}

function readWorkerAvatarMap_(ss) {
  const map = {};
  readSheet_(ss, SHEETS.workers).forEach(row => {
    if (row.id && row.avatarDataUrl) map[String(row.id)] = String(row.avatarDataUrl);
  });
  return map;
}

function readSheet_(ss, name) {
  const sheet = ensureSheet_(ss, name, HEADERS[name]);
  const info = ensureHeaders_(sheet, HEADERS[name]);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map(row => {
    const obj = {};
    info.headers.forEach((header, i) => {
      if (header) obj[header] = row[i];
    });
    return obj;
  });
}

function writeSheet_(ss, name, headers, rows) {
  const sheet = ensureSheet_(ss, name, headers);
  ensureHeaders_(sheet, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, requiredHeaders) {
  const width = Math.max(sheet.getLastColumn(), requiredHeaders.length, 1);
  let headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(v => String(v || '').trim());
  if (headers.every(v => !v)) headers = [];
  requiredHeaders.forEach(header => {
    if (headers.indexOf(header) === -1) headers.push(header);
  });
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const index = {};
  headers.forEach((header, i) => {
    if (header) index[header] = i;
  });
  return { headers, index };
}

function getHeaderMap_(sheet) {
  return ensureHeaders_(sheet, HEADERS.Workers);
}

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function safeParse_(text) {
  if (typeof text !== 'string') return text || {};
  try {
    return JSON.parse(text || '{}');
  } catch (err) {
    return {};
  }
}

function toBool_(value, defaultValue) {
  if (value === '' || value === null || typeof value === 'undefined') return defaultValue;
  if (value === true || value === false) return value;
  return String(value).toUpperCase() === 'TRUE';
}

function respond(obj, callback) {
  const json = JSON.stringify(obj);
  const output = ContentService.createTextOutput(callback ? callback + '(' + json + ');' : json);
  output.setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  return output;
}
