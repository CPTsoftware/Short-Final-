/* Short Final! Service Worker: zeigt Erinnerungen an.
 * Der Server schickt nur ein leeres Signal. Den Text baut dieses Gerät selbst,
 * anhand des Tagesstands, den die App lokal ablegt. Es verlassen keine Lerndaten das Gerät. */
var STATE = 'sf-state';
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
function readState(){
  return caches.open(STATE).then(function(c){ return c.match('state'); }).then(function(r){ return r ? r.json() : null; }).catch(function(){ return null; });
}
function message(s){
  if(s && s.d === isoToday()){
    if(s.done) return 'Tagesziel geschafft. Stark! Jede Extra-Frage hilft trotzdem.';
    if(s.rest > 0) return 'Dir fehlen heute noch ' + fmt(s.rest) + ' Fragen zum Tagesziel.';
  }
  var dn = Math.floor(Date.now() / 86400000);
  return GENERIC[dn % GENERIC.length];
}
self.addEventListener('push', function(e){
  e.waitUntil(readState().then(function(s){
    return self.registration.showNotification('Short Final!', {
      body: message(s), icon: 'short-final-icon-v3.png', badge: 'short-final-icon-v3.png', tag: 'sf-daily', data: {url: './'}
    });
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(list){
    for(var i = 0; i < list.length; i++){ if('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow('./');
  }));
});
