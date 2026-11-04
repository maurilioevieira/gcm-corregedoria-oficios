/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   sw.js · "Service worker" (o que permite instalar como aplicativo)
   ------------------------------------------------------------
   Estratégia: REDE PRIMEIRO para os arquivos do próprio site.
     • Com internet: sempre busca a versão mais nova no GitHub
       (nenhuma atualização fica "presa" no celular de ninguém).
     • Sem internet: abre a última versão guardada, só para mostrar
       a tela (os dados sempre exigem conexão com o banco).
   Dados do Supabase NUNCA são guardados aqui: só passam direto.
   ============================================================ */

const VERSAO = 'corregedoria-v7';

const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/estilo.css',
  'js/config.js', 'js/api.js', 'js/app.js', 'js/componentes.js', 'js/pdf.js',
  'js/pag-painel.js', 'js/pag-oficio.js', 'js/pag-oficio-form.js', 'js/pag-arquivo.js',
  'js/pag-relatorios.js', 'js/pag-cadastros.js', 'js/pag-usuarios.js',
  'img/brasao.png', 'img/logo-prefeitura.png', 'img/icone-192.png', 'img/icone-512.png'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(VERSAO)
      .then(function (cache) { return cache.addAll(ARQUIVOS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (nomes) {
        return Promise.all(nomes.filter(function (n) { return n !== VERSAO; }).map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (evento) {
  const req = evento.request;
  if (req.method !== 'GET') return;                       // envios ao banco passam direto
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase, fontes e bibliotecas: direto

  evento.respondWith(
    fetch(req)
      .then(function (resposta) {
        if (resposta && resposta.ok) {
          const copia = resposta.clone();
          caches.open(VERSAO).then(function (cache) { cache.put(req, copia); });
        }
        return resposta;
      })
      .catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (guardado) {
          return guardado || caches.match('index.html');
        });
      })
  );
});
