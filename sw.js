/* Short Final! Service Worker: zeigt Benachrichtigungen an.
 * Der Server schickt nur ein leeres Signal. Dieses Gerät holt danach selbst die Liste, was fällig ist
 * (Erinnerung, Briefing, Debriefing, Freund-Meldung) und baut die Texte lokal.
 * Briefing und Debriefing formuliert dein eigener API-Schlüssel direkt bei Anthropic.
 * Der Schlüssel und dein Lernstand gehen nie an den Push-Server. */
var STATE = 'sf-state', PRIV = 'sf-priv';
var GENERIC = [
  'Zeit für ein paar Fragen. Kleine Etappen führen zum Ziel.',
  'Der Anflug wartet: Schon heute Fragen geklickt?',
  'Kurz aufs Instrumentenbrett schauen: Wie sieht dein Tagesziel aus?',
  'Dranbleiben zahlt sich aus. Eine Runde Fragen?',
  'Gleitpfad halten: Ein paar Fragen heute, und du bleibst im Plan.'
];
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
function isoToday(){ var d = new Date(), m = d.getMonth() + 1, x = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (x < 10 ? '0' : '') + x; }
function fmt(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function readCache(name, key){
  return caches.open(name).then(function(c){ return c.match(key); }).then(function(r){ return r ? r.json() : null; }).catch(function(){ return null; });
}
function readState(){ return readCache(STATE, 'state'); }
function message(s){
  if(s && s.d === isoToday()){
    if(s.done) return 'Tagesziel geschafft. Stark! Jede Extra-Frage hilft trotzdem.';
    if(s.rest > 0) return 'Dir fehlen heute noch ' + fmt(s.rest) + ' Fragen zum Tagesziel.';
  }
  var dn = Math.floor(Date.now() / 86400000);
  return GENERIC[dn % GENERIC.length];
}
function friendText(it, cfg){
  var nm = (cfg && cfg.fr && cfg.fr[it.g]) || it.n || (it.i ? 'Ein Schüler' : 'Ein Freund');
  if(it.e === 'q') return nm + ' hat heute ' + (it.x ? it.x + ' ' : '') + 'Fragen geklickt.';
  if(it.e === 'o') return it.i ? nm + ' hat ' + (it.x || 'jemanden') + ' überholt.' : nm + ' hat dich überholt.';
  if(it.e === 'g') return nm + ' hat das Tagespensum erreicht.';
  if(it.e === 'b') return nm + ' hat das Abzeichen „' + (it.x || 'neu') + '“ geholt.';
  if(it.e === 's') return nm + ' ist wieder im Soll.';
  if(it.e === 'v') return it.x === 's' ? nm + ' und du seid jetzt Rivalen. Kopf an Kopf!' : (it.x === 'w' ? nm + ' hat dich abgehängt.' : (it.x === 'l' ? 'Du hast ' + nm + ' abgehängt!' : nm + ' hat dich eingeholt!'));
  if(it.e === 'h') return it.x === 'o' ? nm + ' fordert dich heraus!' : (it.x === 'a' ? nm + ' hat deine Challenge angenommen. Los geht\u2019s!' : (it.x === 'd' ? nm + ' hat deine Challenge abgelehnt.' : (it.x === 'w' ? nm + ' hat die Challenge gewonnen.' : (it.x === 'l' ? 'Du hast die Challenge gegen ' + nm + ' gewonnen!' : 'Unentschieden gegen ' + nm + '.'))));
  if(it.e === 'c') return it.x === 'a' ? 'Nachricht an alle von ' + nm : (it.x === 'i' ? nm + ' hat dir ein Bild geschickt.' : 'Neue Nachricht von ' + nm + '.');
  if(it.e === 'p') return nm + ' hat das Paket „' + (it.x || '') + '“ aktualisiert.';
  return nm + ' war aktiv.';
}
function requestText(it){
  var nm = it.n || 'Jemand';
  if(it.k === 'k') return nm + ' hat deine Anfrage angenommen.';
  if(it.ro === 'i') return 'Instructor ' + nm + ' möchte deine Fortschritte sehen.';
  return nm + ' möchte dein Freund sein.';
}
function fallbackText(kind, snap){
  if(kind === 'b'){
    var vf = snap && snap.vorschlag_fach && snap.vorschlag_fach.name ? ' Tipp: ' + snap.vorschlag_fach.name + '.' : '';
    if(snap && snap.rest > 0) return 'Guten Morgen! Für heute stehen ' + fmt(snap.rest) + ' Fragen an. Starte mit einer kurzen Runde.' + vf;
    return 'Guten Morgen! Plane heute eine feste Lernrunde ein.' + vf;
  }
  if(snap && snap.heute > 0) return 'Feierabend: Heute waren es ' + fmt(snap.heute) + ' Fragen. Morgen geht es weiter.';
  return 'Zeit für den Rückblick: Was hast du heute geschafft?';
}
function aiPrompt(kind, snap, weekly){
  var daten = JSON.stringify(snap || {});
  var task = weekly ? 'Schreibe einen kurzen Wochenrückblick: Vergleiche "woche" (summe, aktive_tage, bester_tag) mit der Vorwoche (vorwoche_summe), nenne das stärkste und das am längsten nicht geübte Fach (Felder "schwaechstes_fach", "faecher") und gib einen konkreten Tipp für die kommende Woche.' : kind === 'b'
    ? 'Schreibe ein kurzes, konkretes Briefing für den heutigen Lerntag: Was steht an, worauf zuerst achten. Schlage am Ende genau ein Fach aus dem Feld "vorschlag_fach" vor, das man jetzt klicken könnte (nenne den Fachnamen).'
    : 'Schreibe ein kurzes Debriefing zum heutigen Lerntag: Was lief gut, was nehmen wir für morgen mit.';
  return task + ' Antworte auf Deutsch in der Du-Form, ' + (weekly ? 'höchstens vier kurze Sätze und 450 Zeichen' : 'höchstens drei kurze Sätze und 320 Zeichen') + ', ohne Markdown, ohne Anrede mit Namen. Bleibe bei den Daten und erfinde nichts. Die Daten stammen vom letzten Öffnen der App (Feld "stand_d"). Daten: ' + daten;
}
function aiText(kind, cfg, snap){
  var weekly = kind === 'd' && new Date().getDay() === 0 && cfg && cfg.wk !== false;
  if(!cfg || !cfg.ai || !cfg.ai.key || typeof fetch !== 'function') return Promise.resolve(null);
  var ctl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = ctl ? setTimeout(function(){ ctl.abort(); }, 8500) : null;
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: ctl ? ctl.signal : undefined,
    headers: {'content-type': 'application/json', 'x-api-key': cfg.ai.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'},
    body: JSON.stringify({model: cfg.ai.model || 'claude-haiku-5-5', max_tokens: weekly ? 320 : 220, messages: [{role: 'user', content: aiPrompt(kind, snap, weekly)}]})
  }).then(function(r){ if(timer) clearTimeout(timer); return r.ok ? r.json() : null; }).then(function(j){
    var t = j && j.content && j.content[0] && j.content[0].text;
    t = typeof t === 'string' ? t.replace(/[*#_`]/g, '').replace(/\s+/g, ' ').trim() : '';
    return t.length > 8 ? t.slice(0, weekly ? 480 : 340) : null;
  }).catch(function(){ if(timer) clearTimeout(timer); return null; });
}
function getItems(cfg){
  var base = cfg && cfg.url;
  if(!base || !self.registration.pushManager) return Promise.resolve([{k: 'r'}]);
  return self.registration.pushManager.getSubscription().then(function(sub){
    if(!sub) return [{k: 'r'}];
    return fetch(base + '/msg', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({endpoint: sub.endpoint})})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ return j && j.items && j.items.length ? j.items : [{k: 'r'}]; });
  }).catch(function(){ return [{k: 'r'}]; });
}
function show(title, body, tag){
  return self.registration.showNotification(title, {body: body, icon: 'short-final-icon-v3.png', badge: 'short-final-icon-v3.png', tag: tag, data: {url: './'}});
}
function saveLast(kind, text){
  return caches.open(PRIV).then(function(c){
    return c.put('last-' + kind, new Response(JSON.stringify({d: isoToday(), t: text}), {headers: {'content-type': 'application/json'}}));
  }).catch(function(){});
}
function handle(){
  return Promise.all([readState(), readCache(PRIV, 'cfg')]).then(function(a){
    var st = a[0], cfg = a[1];
    return getItems(cfg).then(function(items){
      var seen = {}, jobs = [], n = 0;
      items.forEach(function(it){
        var id = it.k + (it.e || '') + (it.g || '');
        if(seen[id] || n >= 5) return; seen[id] = 1; n++;
        if(it.k === 'f') jobs.push(show('Short Final!', friendText(it, cfg), 'sf-f-' + (it.g || '') + it.e));
        else if(it.k === 'a' || it.k === 'k') jobs.push(show(it.k === 'a' ? 'Neue Anfrage' : 'Short Final!', requestText(it), 'sf-' + it.k + (it.g || '')));
        else if(it.k === 't') jobs.push(show('Short Final!', 'Test erfolgreich: Benachrichtigungen funktionieren.', 'sf-test'));
        else if(it.k === 'b' || it.k === 'd'){
          var snap = cfg && cfg.snap;
          jobs.push(aiText(it.k, cfg, snap).then(function(t){
            var txt = t || fallbackText(it.k, snap);
            return show(it.k === 'b' ? 'Briefing' : 'Debriefing', txt, 'sf-' + it.k).then(function(){ return t ? saveLast(it.k, t) : null; });
          }));
        }
        else jobs.push(show('Short Final!', message(st), 'sf-daily'));
      });
      return Promise.all(jobs).then(function(){
        if(!(self.clients && self.clients.matchAll)) return null;
        return self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(l){ l.forEach(function(c){ try{ c.postMessage({sf: 'refresh'}); }catch(e){} }); });
      });
    });
  });
}
self.addEventListener('push', function(e){
  e.waitUntil(handle().catch(function(){ return show('Short Final!', message(null), 'sf-daily'); }));
});
self.addEventListener('notificationclick', function(e){
  var tag = (e.notification && e.notification.tag) || '';
  var friends = /^sf-(a|k|f-)/.test(tag);
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(list){
    for(var i = 0; i < list.length; i++){
      if('focus' in list[i]){
        if(friends){ try{ list[i].postMessage({sf: 'open-friends'}); }catch(x){} }
        return list[i].focus();
      }
    }
    return self.clients.openWindow(friends ? './?inbox=1' : './');
  }));
});
