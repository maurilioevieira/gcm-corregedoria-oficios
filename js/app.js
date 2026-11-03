/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/app.js · Núcleo do sistema
   ------------------------------------------------------------
   Responsável por:
     1. Login por PIN (teclado na tela + teclado físico)
     2. Sessão (manter logado ao recarregar; sair por inatividade)
     3. Menus por nível de acesso (lateral e inferior)
     4. Navegação entre páginas (#painel, #novo, #relatorios...)
     5. Utilitários comuns: avisos, carregando, formatação de datas

   Cada página do sistema fica em um arquivo próprio (a partir da
   Etapa 3) e se registra com App.registrarPagina('nome', funcao).
   Assim, o núcleo não precisa ser reescrito a cada etapa.
   ============================================================ */

window.App = (function () {
  'use strict';

  // ===================== UTILITÁRIOS =====================

  const $ = function (seletor, raiz) { return (raiz || document).querySelector(seletor); };

  // Escapa texto antes de colocar no HTML (evita que um assunto com
  // "<script>" digitado num ofício vire código executável na tela).
  function esc(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 'AAAA-MM-DD' → 'DD/MM/AAAA' (sem passar por Date, para não sofrer com fuso)
  function dataBR(iso) {
    if (!iso) return '';
    const p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso);
  }
  function dataCurtaBR(iso) {
    const d = dataBR(iso);
    return d ? d.slice(0, 5) : '';
  }
  // Data e hora de um timestamp do banco, no horário de Fortaleza
  function dataHoraBR(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString('pt-BR', {
      timeZone: 'America/Fortaleza', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
  // Hoje no fuso de Fortaleza, em 'AAAA-MM-DD'
  function hojeISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  }

  function iniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '--';
    const a = partes[0][0] || '';
    const b = partes.length > 1 ? partes[partes.length - 1][0] : (partes[0][1] || '');
    return (a + b).toUpperCase();
  }

  const NOMES_NIVEL = { admin: 'Administrador', corregedor: 'Corregedoria', auxiliar: 'Auxiliar' };

  // ---------- Avisos rápidos (toasts) ----------
  function avisar(mensagem, tipo) {
    const caixa = $('#avisos');
    const item = document.createElement('div');
    item.className = 'aviso ' + (tipo || 'info');
    item.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    item.textContent = mensagem;
    caixa.appendChild(item);
    setTimeout(function () { item.classList.add('saindo'); }, tipo === 'erro' ? 6000 : 3500);
    setTimeout(function () { item.remove(); }, tipo === 'erro' ? 6400 : 3900);
  }

  // ---------- Indicador de carregamento ----------
  let contadorCarregando = 0;
  function carregando(ligar) {
    contadorCarregando = Math.max(0, contadorCarregando + (ligar ? 1 : -1));
    $('#carregando').hidden = contadorCarregando === 0;
  }
  // Executa uma tarefa com o "carregando" ligado e mostra o erro, se houver.
  async function comCarregando(tarefa) {
    carregando(true);
    try {
      return await tarefa();
    } catch (e) {
      if (e && e.codigo !== 'pin' && e.codigo !== 'bloqueado') {
        avisar(e.message || 'Erro inesperado.', 'erro');
      }
      throw e;
    } finally {
      carregando(false);
    }
  }

  // ===================== ÍCONES =====================
  const ICONES = {
    painel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    novo: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 12v6"/><path d="M9 15h6"/>',
    arquivo: '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>',
    relatorios: '<path d="M3 3v18h18"/><path d="M7 15v3"/><path d="M12 10v8"/><path d="M17 6v12"/>',
    cadastros: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    usuarios: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  };
  function icone(nome, tamanho) {
    const t = tamanho || 20;
    return '<svg width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONES[nome] || '') + '</svg>';
  }

  // ===================== ROTAS (páginas do sistema) =====================
  // niveis: quem vê a página no menu e pode abri-la.
  // celular: aparece no menu inferior do celular.
  // etapa: em qual etapa a página será construída (para o aviso provisório).
  const TODOS = ['admin', 'corregedor', 'auxiliar'];
  const ROTAS = {
    painel:     { titulo: 'Painel',       curto: 'Painel',     niveis: TODOS,                   celular: true,  etapa: 3 },
    novo:       { titulo: 'Novo ofício',  curto: 'Novo',       niveis: TODOS,                   celular: true,  etapa: 4 },
    arquivo:    { titulo: 'Arquivo',      curto: 'Arquivo',    niveis: TODOS,                   celular: true,  etapa: 4 },
    relatorios: { titulo: 'Relatórios',   curto: 'Relatórios', niveis: TODOS,                   celular: true,  etapa: 6 },
    cadastros:  { titulo: 'Cadastros',    curto: 'Cadastros',  niveis: ['admin', 'corregedor'], celular: true,  etapa: 5 },
    usuarios:   { titulo: 'Usuários',     curto: 'Usuários',   niveis: ['admin'],               celular: false, etapa: 5 }
  };
  const ROTA_INICIAL = 'painel';

  // Páginas registradas pelos arquivos js/pag-*.js
  const paginas = {};
  function registrarPagina(nome, renderizar) {
    paginas[nome] = renderizar;
  }

  // ===================== ESTADO DA SESSÃO =====================
  const CHAVE_SESSAO = 'corregedoria_sessao';
  const estado = { usuario: null };

  // ===================== CADASTROS EM MEMÓRIA =====================
  // As listas (origens, destinos...) mudam pouco. Guardamos na memória
  // durante a sessão para não buscar de novo a cada página aberta.
  // A tela Cadastros chama App.cadastros(true) após salvar, para atualizar.
  let cacheCadastros = null;
  async function cadastros(forcar) {
    if (!cacheCadastros || forcar) cacheCadastros = await API.listarCadastros(false);
    return cacheCadastros;
  }

  function podeVer(rota) {
    const r = ROTAS[rota];
    return !!(r && estado.usuario && r.niveis.indexOf(estado.usuario.nivel) >= 0);
  }

  // ===================== LOGIN =====================
  let digitos = '';
  let enviandoLogin = false;

  function atualizarPontos() {
    const pontos = document.querySelectorAll('#pin-pontos span');
    pontos.forEach(function (p, i) { p.classList.toggle('cheio', i < digitos.length); });
    $('#pin-pontos').setAttribute('aria-label', digitos.length + ' de 6 dígitos digitados');
  }

  function mostrarErroLogin(texto) {
    $('#login-erro').textContent = texto || '';
    if (texto) {
      const pontos = $('#pin-pontos');
      pontos.classList.remove('tremer');
      void pontos.offsetWidth; // reinicia a animação
      pontos.classList.add('tremer');
    }
  }

  function teclar(tecla) {
    if (enviandoLogin) return;
    if (tecla === 'apagar') {
      digitos = digitos.slice(0, -1);
    } else if (tecla === 'limpar') {
      digitos = '';
    } else if (/^[0-9]$/.test(tecla) && digitos.length < 6) {
      digitos += tecla;
      mostrarErroLogin('');
    }
    atualizarPontos();
    if (digitos.length === 6) entrar(digitos);
  }

  async function entrar(pin) {
    enviandoLogin = true;
    $('#login-instrucao').textContent = 'Verificando…';
    try {
      const usuario = await API.login(pin);
      iniciarSessao(pin, usuario);
    } catch (e) {
      mostrarErroLogin(e.message);
    } finally {
      enviandoLogin = false;
      digitos = '';
      atualizarPontos();
      $('#login-instrucao').textContent = 'Digite seu PIN de 6 números';
    }
  }

  function iniciarSessao(pin, usuario) {
    estado.usuario = { id: usuario.id, nome: usuario.nome, cargo: usuario.cargo, nivel: usuario.nivel };
    API.definirPin(pin);
    // sessionStorage: some sozinho ao fechar a aba/navegador.
    // (localStorage manteria o PIN guardado mesmo depois de fechar.)
    try { sessionStorage.setItem(CHAVE_SESSAO, pin); } catch (e) { /* navegador bloqueou: segue só na memória */ }

    $('#usuario-nome').textContent = usuario.nome;
    $('#usuario-cargo').textContent = (usuario.cargo || NOMES_NIVEL[usuario.nivel] || '');
    $('#usuario-avatar').textContent = iniciais(usuario.nome);

    montarMenus();
    $('#tela-login').hidden = true;
    $('#app').hidden = false;
    reiniciarInatividade();
    navegar();
  }

  function sair(motivo) {
    estado.usuario = null;
    cacheCadastros = null;
    API.limparPin();
    try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* ignora */ }
    clearTimeout(temporizadorInatividade);
    $('#conteudo').innerHTML = '';
    $('#app').hidden = true;
    $('#tela-login').hidden = false;
    digitos = '';
    atualizarPontos();
    mostrarErroLogin(motivo || '');
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  // ===================== INATIVIDADE =====================
  let temporizadorInatividade = null;
  function reiniciarInatividade() {
    if (!estado.usuario) return;
    clearTimeout(temporizadorInatividade);
    temporizadorInatividade = setTimeout(function () {
      sair('Sessão encerrada por inatividade. Digite o PIN novamente.');
    }, (CONFIG.MINUTOS_INATIVIDADE || 20) * 60 * 1000);
  }

  // ===================== MENUS =====================
  function montarMenus() {
    let lateral = '';
    let inferior = '';
    Object.keys(ROTAS).forEach(function (nome) {
      if (!podeVer(nome)) return;
      const r = ROTAS[nome];
      lateral += '<a href="#' + nome + '" class="menu-item" data-rota="' + nome + '">' + icone(nome) + '<span>' + esc(r.titulo) + '</span></a>';
      if (r.celular) {
        inferior += '<a href="#' + nome + '" class="aba" data-rota="' + nome + '">' + icone(nome, 22) + '<span>' + esc(r.curto) + '</span></a>';
      }
    });
    $('#menu-lateral').innerHTML = lateral;
    $('#menu-inferior').innerHTML = inferior;
  }

  function marcarMenuAtivo(rota) {
    document.querySelectorAll('[data-rota]').forEach(function (a) {
      const ativo = a.getAttribute('data-rota') === rota;
      a.classList.toggle('ativo', ativo);
      if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // ===================== NAVEGAÇÃO =====================
  // Endereço: #rota ou #rota/parametro (ex.: #oficio/uuid na Etapa 4)
  function lerEndereco() {
    const partes = location.hash.replace(/^#/, '').split('/');
    return { rota: partes[0] || ROTA_INICIAL, parametro: partes.slice(1).join('/') || null };
  }

  let navegacaoAtual = 0;
  async function navegar() {
    if (!estado.usuario) return;
    const endereco = lerEndereco();
    let rota = endereco.rota;

    // Rotas internas (ex.: detalhe de ofício) que não aparecem no menu
    const interna = !ROTAS[rota] && paginas[rota];
    if (!interna && !podeVer(rota)) {
      if (ROTAS[rota]) avisar('Você não tem acesso a esta área.', 'erro');
      rota = ROTA_INICIAL;
      history.replaceState(null, '', '#' + rota);
    }

    const titulo = (ROTAS[rota] && ROTAS[rota].titulo) || (paginas[rota] && paginas[rota].titulo) || '';
    document.title = titulo + ' · Corregedoria · GCM Iguatu';
    $('#topo-titulo').textContent = titulo;
    marcarMenuAtivo(interna ? null : rota);

    const conteudo = $('#conteudo');
    const minhaNavegacao = ++navegacaoAtual;
    conteudo.innerHTML = '';
    window.scrollTo(0, 0);

    const renderizar = paginas[rota] || paginaProvisoria;
    try {
      await renderizar(conteudo, {
        parametro: endereco.parametro,
        usuario: estado.usuario,
        // Se o usuário trocar de página antes de terminar de carregar,
        // a página antiga sabe que não deve mais desenhar nada.
        ativa: function () { return minhaNavegacao === navegacaoAtual; }
      });
    } catch (e) {
      if (minhaNavegacao !== navegacaoAtual) return;
      if (e && (e.codigo === 'pin' || e.codigo === 'bloqueado')) return;
      conteudo.innerHTML =
        '<div class="estado-vazio erro">' +
          '<h2>Não foi possível carregar esta página</h2>' +
          '<p>' + esc(e && e.message) + '</p>' +
          '<button type="button" class="botao primario" id="botao-tentar">Tentar de novo</button>' +
        '</div>';
      $('#botao-tentar').addEventListener('click', navegar);
    }
    conteudo.focus({ preventScroll: true });
  }

  // Página provisória: aparece enquanto a página real não foi construída.
  // No Painel ela já testa a conexão com o banco de ponta a ponta.
  async function paginaProvisoria(conteudo, ctx) {
    const rota = lerEndereco().rota;
    const r = ROTAS[rota] || ROTAS[ROTA_INICIAL];
    let teste = '';

    if (rota === 'painel') {
      const p = await comCarregando(function () { return API.painel(); });
      if (!ctx.ativa()) return;
      const t = p.totais || {};
      teste =
        '<div class="cartao destaque">' +
          '<h2 class="cartao-titulo">Conexão com o banco: OK</h2>' +
          '<p>Data no servidor (Fortaleza): <strong>' + esc(dataBR(p.hoje)) + '</strong></p>' +
          '<p>Ofícios em aberto: <strong>' + esc(t.abertos) + '</strong> · ' +
          'Vencidos: <strong>' + esc(t.vencidos) + '</strong> · ' +
          'Total no ano: <strong>' + esc(t.total_ano) + '</strong></p>' +
        '</div>';
    }

    conteudo.innerHTML =
      '<header class="pagina-topo"><h1 class="pagina-titulo">' + esc(r.titulo) + '</h1></header>' +
      teste +
      '<div class="estado-vazio">' +
        '<h2>Página em construção</h2>' +
        '<p>Esta área será entregue na <strong>Etapa ' + esc(r.etapa) + '</strong>.</p>' +
        '<p class="texto-suave">Conectado como ' + esc(ctx.usuario.nome) + ' · nível ' +
          esc(NOMES_NIVEL[ctx.usuario.nivel] || ctx.usuario.nivel) + '</p>' +
      '</div>';
  }

  // ===================== MINHA CONTA (trocar PIN) =====================
  function abrirConta() {
    const janela = $('#janela-conta');
    $('#conta-resumo').textContent = estado.usuario.nome + ' · ' + (NOMES_NIVEL[estado.usuario.nivel] || '');
    $('#form-trocar-pin').reset();
    janela.showModal();
    $('#pin-atual').focus();
  }

  async function trocarPin(evento) {
    evento.preventDefault();
    const atual = $('#pin-atual').value.trim();
    const novo = $('#pin-novo').value.trim();
    const repetir = $('#pin-repetir').value.trim();

    if (!/^[0-9]{6}$/.test(novo)) { avisar('O novo PIN deve ter exatamente 6 números.', 'erro'); return; }
    if (novo !== repetir) { avisar('A repetição não confere com o novo PIN.', 'erro'); return; }
    if (novo === atual) { avisar('O novo PIN deve ser diferente do atual.', 'erro'); return; }

    try {
      await comCarregando(function () { return API.trocarMeuPin(atual, novo); });
      // Passa a usar o novo PIN imediatamente, sem pedir login de novo.
      API.definirPin(novo);
      try { sessionStorage.setItem(CHAVE_SESSAO, novo); } catch (e) { /* ignora */ }
      $('#janela-conta').close();
      avisar('PIN alterado com sucesso.', 'sucesso');
    } catch (e) { /* aviso já exibido */ }
  }

  // ===================== INICIALIZAÇÃO =====================
  function iniciar() {
    // Teclado da tela
    $('#teclado').addEventListener('click', function (e) {
      const botao = e.target.closest('button[data-tecla]');
      if (botao) teclar(botao.getAttribute('data-tecla'));
    });
    // Teclado físico (só enquanto a tela de PIN está visível)
    document.addEventListener('keydown', function (e) {
      if ($('#tela-login').hidden) return;
      if (/^[0-9]$/.test(e.key)) { teclar(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { teclar('apagar'); e.preventDefault(); }
      else if (e.key === 'Escape') { teclar('limpar'); }
    });

    // Sair
    ['#botao-sair', '#botao-sair-cel'].forEach(function (s) {
      $(s).addEventListener('click', function () { sair(''); });
    });
    // Minha conta
    ['#botao-conta', '#botao-conta-cel'].forEach(function (s) {
      $(s).addEventListener('click', abrirConta);
    });
    $('#botao-fechar-conta').addEventListener('click', function () { $('#janela-conta').close(); });
    $('#form-trocar-pin').addEventListener('submit', trocarPin);

    // Qualquer uso reinicia o contador de inatividade
    ['click', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) {
      document.addEventListener(ev, reiniciarInatividade, { passive: true });
    });

    window.addEventListener('hashchange', navegar);

    // Se o PIN deixar de valer durante o uso, volta para o login.
    API.quandoPerderSessao(function (erro) {
      sair(erro.codigo === 'bloqueado' ? erro.message : 'Sua sessão expirou. Digite o PIN novamente.');
    });

    if (!API.configurado) {
      mostrarErroLogin('Sistema não configurado: cole a Publishable key em js/config.js.');
      return;
    }

    // Recarregou a página? Valida o PIN guardado na aba e segue logado.
    let pinSalvo = null;
    try { pinSalvo = sessionStorage.getItem(CHAVE_SESSAO); } catch (e) { /* ignora */ }
    if (pinSalvo) {
      $('#login-instrucao').textContent = 'Reconectando…';
      API.login(pinSalvo)
        .then(function (u) { iniciarSessao(pinSalvo, u); })
        .catch(function () {
          try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* ignora */ }
          $('#login-instrucao').textContent = 'Digite seu PIN de 6 números';
        });
    }
  }

  document.addEventListener('DOMContentLoaded', iniciar);

  // O que as páginas das próximas etapas poderão usar:
  return {
    registrarPagina: registrarPagina,
    navegar: navegar,
    usuario: function () { return estado.usuario; },
    cadastros: cadastros,
    podeVer: podeVer,
    util: {
      $: $, esc: esc, dataBR: dataBR, dataCurtaBR: dataCurtaBR, dataHoraBR: dataHoraBR,
      hojeISO: hojeISO, iniciais: iniciais, icone: icone,
      avisar: avisar, carregando: carregando, comCarregando: comCarregando,
      NOMES_NIVEL: NOMES_NIVEL
    }
  };
})();
