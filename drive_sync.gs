/**
 * Local Judge: Drive sync backend.
 *
 * Folder layout it creates inside the shared folder:
 *   Progress/<student name>/progress.json     one folder per student
 *   Library/<kind>__<key>.json                shared lessons and problems everybody can add
 *
 * SET UP (once, by the owner of the Drive folder):
 *   1. Go to script.google.com, New project, paste this whole file.
 *   2. Deploy > New deployment > type "Web app".
 *        Execute as:      Me
 *        Who has access:  Anyone
 *   3. Authorize when asked, then copy the Web app URL (ends in /exec).
 *   4. Give that URL to everyone. They paste it into Settings > Sync in the app.
 *
 * After you edit this file, use Deploy > Manage deployments > Edit > New version.
 */
const ROOT_FOLDER_ID = '1UE4avNFYmgEkP6NvVcmYM7an6c2OagwG';

// Optional. If you set a secret here, students must also have it in Settings > Sync.
const SECRET = '';

function doGet() {
  return out_({ ok: true, message: 'Local Judge sync is running.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const req = JSON.parse(e.postData.contents);
    if (SECRET && req.secret !== SECRET) throw new Error('Wrong sync secret.');
    switch (req.action) {
      case 'ping':          return out_({ ok: true });
      case 'push_progress': return out_(pushProgress_(req));
      case 'pull_progress': return out_(pullProgress_(req));
      case 'list_library':  return out_(listLibrary_());
      case 'get_item':      return out_(getItem_(req));
      case 'publish_item':  return out_(publishItem_(req));
      default: throw new Error('Unknown action: ' + req.action);
    }
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function root_() { return DriveApp.getFolderById(ROOT_FOLDER_ID); }

function sub_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function file_(folder, name) {
  const it = folder.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function write_(folder, name, text) {
  const f = file_(folder, name);
  if (f) f.setContent(text); else folder.createFile(name, text, MimeType.PLAIN_TEXT);
}

function safe_(s) { return String(s).replace(/[^A-Za-z0-9_.\- ]/g, '_').trim().slice(0, 80) || 'unnamed'; }

// ---- progress -------------------------------------------------------------
function userFolder_(name) { return sub_(sub_(root_(), 'Progress'), safe_(name)); }

function pushProgress_(req) {
  if (!req.user) throw new Error('Missing name.');
  const data = req.data || {};
  data.updated = new Date().toISOString();
  write_(userFolder_(req.user), 'progress.json', JSON.stringify(data));
  return { ok: true };
}

function pullProgress_(req) {
  if (!req.user) throw new Error('Missing name.');
  const f = file_(userFolder_(req.user), 'progress.json');
  return { ok: true, data: f ? JSON.parse(f.getBlob().getDataAsString()) : null };
}

// ---- shared library ---------------------------------------------------------
function libFolder_() { return sub_(root_(), 'Library'); }
function libName_(kind, key) { return safe_(kind + '__' + key.replace(/\//g, '__')) + '.json'; }

function listLibrary_() {
  const items = [];
  const it = libFolder_().getFiles();
  while (it.hasNext()) {
    const f = it.next();
    try {
      const o = JSON.parse(f.getBlob().getDataAsString());
      if (!o || typeof o !== 'object' || !o.key || typeof o.key !== 'string' ||
          (o.kind !== 'lesson' && o.kind !== 'problem') || !o.title) continue;   // not a library item
      items.push({
        kind: o.kind, key: o.key, title: String(o.title), summary: o.summary || '', group: o.group || '',
        author: o.author || '', updated: o.updated || '', course_title: o.course_title || '',
        module_title: o.module_title || ''
      });
    } catch (e) { /* skip files that are not library items */ }
  }
  return { ok: true, items: items };
}

function getItem_(req) {
  const f = file_(libFolder_(), libName_(req.kind, req.key));
  if (!f) throw new Error('That item is no longer in the library.');
  return { ok: true, item: JSON.parse(f.getBlob().getDataAsString()) };
}

function publishItem_(req) {
  const item = req.item;
  if (!item || !item.key || !item.kind || !item.content) throw new Error('Bad item.');
  const folder = libFolder_();
  const name = libName_(item.kind, item.key);
  if (file_(folder, name)) return { ok: true, existed: true };   // never overwrite someone else's item
  item.author = req.author || '';
  item.updated = new Date().toISOString();
  write_(folder, name, JSON.stringify(item));
  return { ok: true, existed: false };
}
