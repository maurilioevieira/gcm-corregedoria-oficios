/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/pag-painel.js · Página inicial (Painel)
   ------------------------------------------------------------
   Conteúdo:
     1. Totais: em aberto, vencidos, vencem em até 4 dias,
        respondidos no mês e total no ano
     2. Barra "em aberto por destino"
     3. Busca e filtros (situação, destino, origem e período)
     4. Lista de ofícios em cards coloridos pelo prazo

   A regra das cores vem PRONTA do banco (campo "faixa"). Assim o
   painel, a lista e os relatórios nunca discordam entre si.
   O card de cada ofício é desenhado por Comp.htmlCard (componentes.js),
   o mesmo usado na aba Arquivo.
   ============================================================ */

(function () {
  'use strict';

  const U = App.util;
  const esc = U.esc;

  // Filtros ficam guardados enquanto a sessão estiver aberta:
  // ao abrir um ofício e voltar, a busca continua como estava.
  const filtros = {
    q: '',
    situacao: 'aberto',
    destino_id: '',
    origem_id: '',
    periodo: 'todos'
  };

  const SITUACOES = [
    { valor: 'aberto',     nome: 'Em aberto' },
    { valor: 'vencido',    nome: 'Vencidos' },
    { valor: 'respondido', nome: 'Respondidos' },
    { valor: 'arquivado',  nome: 'Arquivados' },
    { valor: 'todos',      nome: 'Todos' }
  ];

  const TITULOS_LISTA = {
    aberto: 'Em aberto', vencido: 'Vencidos', respondido: 'Respondidos',
    arquivado: 'Arquivados', todos: 'Todos os ofícios'
  };

  const PERIODOS = [
    { valor: 'todos', nome: 'Qualquer data' },
    { valor: '30',    nome: 'Últimos 30 dias' },
    { valor: '90',    nome: 'Últimos 90 dias' },
    { valor: 'mes',   nome: 'Este mês' },
    { valor: 'ano',   nome: 'Este ano' }
  ];

  // ---------- Datas ----------
  function somarDias(iso, dias) {
    const p = iso.split('-').map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + dias));
    return d.toISOString().slice(0, 10);
  }

  function periodoParaDatas(periodo) {
    const hoje = U.hojeISO();
    if (periodo === '30') return { de: somarDias(hoje, -30), ate: hoje };
    if (periodo === '90') return { de: somarDias(hoje, -90), ate: hoje };
    if (periodo === 'mes') return { de: hoje.slice(0, 8) + '01', ate: hoje };
    if (periodo === 'ano') return { de: hoje.slice(0, 5) + '01-01', ate: hoje };
    return { de: null, ate: null };
  }

  function dataPorExtenso(iso) {
    const p = iso.split('-').map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
    const texto = d.toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC'
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  // ---------- Montagem do filtro enviado ao banco ----------
  function filtrosParaBanco() {
    const datas = periodoParaDatas(filtros.periodo);
    return {
      q: filtros.q || null,
      situacao: filtros.situacao,
      destino_id: filtros.destino_id || null,
      origem_id: filtros.origem_id || null,
      de: datas.de,
      ate: datas.ate,
      limite: 500
    };
  }

  // ===================== DESENHO =====================

  function htmlTotais(t) {
    function cartao(classe, rotulo, valor, legenda, filtro) {
      return (
        '<button type="button" class="kpi ' + classe + '" data-filtro-rapido="' + filtro + '">' +
          '<span class="kpi-rotulo">' + rotulo + '</span>' +
          '<span class="kpi-valor">' + esc(valor || 0) + '</span>' +
          '<span class="kpi-legenda">' + legenda + '</span>' +
        '</button>'
      );
    }
    return (
      '<section class="kpis" aria-label="Totais">' +
        cartao('kpi-principal', 'Em aberto', t.abertos, 'aguardando resposta', 'aberto') +
        cartao('kpi-vencido', 'Vencidos', t.vencidos, 'prazo já passou', 'vencido') +
        cartao('kpi-alerta', 'Vencem em até 4 dias', t.ate_4_dias, 'atenção imediata', 'aberto') +
        cartao('kpi-neutro', 'Respondidos no mês', t.respondidos_mes, 'mês atual', 'respondido') +
        cartao('kpi-neutro', 'Total no ano', t.total_ano, 'ofícios recebidos', 'todos') +
      '</section>'
    );
  }

  function htmlDestinos(lista) {
    if (!lista || !lista.length) return '';
    const maior = Math.max(1, ...lista.map(function (d) { return d.abertos; }));
    return (
      '<section class="cartao destinos" aria-label="Em aberto por destino">' +
        '<h2 class="destinos-titulo">Em aberto por destino</h2>' +
        lista.map(function (d) {
          const largura = Math.round((d.abertos / maior) * 100);
          return (
            '<div class="destino-linha">' +
              '<div class="destino-topo"><span>' + esc(d.nome) + '</span><strong>' + esc(d.abertos) + '</strong></div>' +
              '<div class="destino-barra"><div style="width:' + largura + '%"></div></div>' +
            '</div>'
          );
        }).join('') +
      '</section>'
    );
  }

  function htmlFiltros(cad) {
    const opcoesOrigem = '<option value="">Todas as origens</option>' +
      (cad.origens || []).map(function (o) {
        return '<option value="' + o.id + '"' + (String(filtros.origem_id) === String(o.id) ? ' selected' : '') + '>' + esc(o.nome) + '</option>';
      }).join('');

    const opcoesPeriodo = PERIODOS.map(function (p) {
      return '<option value="' + p.valor + '"' + (filtros.periodo === p.valor ? ' selected' : '') + '>' + p.nome + '</option>';
    }).join('');

    const chipsSituacao = SITUACOES.map(function (s) {
      const on = filtros.situacao === s.valor;
      return '<button type="button" class="chip' + (on ? ' ativo' : '') + '" aria-pressed="' + on + '" data-situacao="' + s.valor + '">' + s.nome + '</button>';
    }).join('');

    const destinos = [{ id: '', nome: 'Todos' }].concat(cad.destinos || []);
    const chipsDestino = destinos.map(function (d) {
      const on = String(filtros.destino_id) === String(d.id);
      return '<button type="button" class="chip' + (on ? ' ativo' : '') + '" aria-pressed="' + on + '" data-destino="' + d.id + '">' + esc(d.nome) + '</button>';
    }).join('');

    return (
      '<section class="cartao filtros" aria-label="Busca e filtros">' +
        '<div class="filtros-linha">' +
          '<label class="campo campo-busca">Buscar' +
            '<span class="busca-caixa">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
              '<input type="search" id="filtro-busca" placeholder="Assunto, nº do ofício, procedimento, origem ou órgão…" value="' + esc(filtros.q) + '" autocomplete="off">' +
            '</span>' +
          '</label>' +
          '<label class="campo">Origem<select id="filtro-origem">' + opcoesOrigem + '</select></label>' +
          '<label class="campo">Recebidos em<select id="filtro-periodo">' + opcoesPeriodo + '</select></label>' +
        '</div>' +
        '<div class="filtros-linha chips-linha">' +
          '<div class="chips" role="group" aria-label="Situação"><span class="chips-rotulo">Situação:</span>' + chipsSituacao + '</div>' +
          '<div class="chips" role="group" aria-label="Destino"><span class="chips-rotulo">Destino:</span>' + chipsDestino + '</div>' +
        '</div>' +
      '</section>'
    );
  }

  function htmlLista(oficios) {
    const legenda =
      '<div class="legenda">' +
        '<span><i class="ponto p-verde"></i>5 dias ou mais</span>' +
        '<span><i class="ponto p-laranja"></i>3 a 4 dias</span>' +
        '<span><i class="ponto p-vermelho"></i>2 dias ou menos</span>' +
        '<span><i class="ponto p-vencido"></i>Vencido</span>' +
      '</div>';

    const cabecalho =
      '<div class="lista-topo">' +
        '<h2 class="lista-titulo">' + esc(TITULOS_LISTA[filtros.situacao]) +
          ' <span>· ' + oficios.length + ' ofício' + (oficios.length === 1 ? '' : 's') +
          (filtros.situacao === 'aberto' || filtros.situacao === 'vencido' ? ', do prazo mais curto ao mais longo' : '') +
          '</span></h2>' +
        legenda +
      '</div>';

    if (!oficios.length) {
      const temFiltro = filtros.q || filtros.destino_id || filtros.origem_id || filtros.periodo !== 'todos';
      return cabecalho +
        '<div class="estado-vazio">' +
          '<h2>' + (temFiltro ? 'Nenhum ofício encontrado' : 'Nenhum ofício aqui') + '</h2>' +
          '<p>' + (temFiltro
            ? 'Tente outra busca ou limpe os filtros.'
            : (filtros.situacao === 'aberto' ? 'Não há ofícios aguardando resposta.' : 'Nada a mostrar nesta situação.')) + '</p>' +
          (temFiltro ? '<button type="button" class="botao secundario" id="botao-limpar-filtros">Limpar filtros</button>' : '') +
        '</div>';
    }

    return cabecalho + '<div class="lista-oficios">' + oficios.map(function (o) { return Comp.htmlCard(o); }).join('') + '</div>';
  }

  // ===================== PÁGINA =====================

  async function renderizar(conteudo, ctx) {
    const resultado = await U.comCarregando(function () {
      return Promise.all([API.painel(), App.cadastros(), API.listarOficios(filtrosParaBanco())]);
    });
    if (!ctx.ativa()) return;

    const painel = resultado[0];
    const cad = resultado[1];
    const lista = resultado[2].oficios || [];

    // Tudo fica dentro de um "invólucro" próprio desta visita à página.
    // Os eventos são presos a ele (e não ao #conteudo, que é permanente):
    // ao trocar de página o invólucro some junto com seus eventos, sem
    // acumular cliques repetidos a cada vez que se volta ao Painel.
    conteudo.innerHTML = '<div class="pg-painel"></div>';
    const raiz = conteudo.firstElementChild;

    raiz.innerHTML =
      '<header class="pagina-topo">' +
        '<div>' +
          '<div class="pagina-sobretitulo">' + esc(dataPorExtenso(painel.hoje)) + '</div>' +
          '<h1 class="pagina-titulo">Painel de ofícios</h1>' +
        '</div>' +
        '<div class="pagina-acoes">' +
          '<a class="botao secundario" href="#relatorios">Gerar relatório</a>' +
          '<a class="botao primario" href="#novo">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>' +
            'Novo ofício</a>' +
        '</div>' +
      '</header>' +
      htmlTotais(painel.totais || {}) +
      htmlDestinos(painel.por_destino) +
      htmlFiltros(cad) +
      '<section class="lista" id="lista-oficios" aria-live="polite">' + htmlLista(lista) + '</section>';

    ligarEventos(raiz, ctx);
  }

  // Recarrega só a lista (mais rápido que redesenhar a página toda)
  let pedidoLista = 0;
  async function recarregarLista(conteudo, ctx) {
    const meuPedido = ++pedidoLista;
    let resposta;
    try {
      resposta = await U.comCarregando(function () { return API.listarOficios(filtrosParaBanco()); });
    } catch (e) { return; }
    // Ignora respostas antigas (quem digita rápido dispara várias buscas)
    if (meuPedido !== pedidoLista || !ctx.ativa()) return;
    const area = conteudo.querySelector('#lista-oficios');
    area.innerHTML = htmlLista(resposta.oficios || []);
    ligarLimpar(conteudo, ctx);
  }

  function marcarChips(conteudo) {
    conteudo.querySelectorAll('[data-situacao]').forEach(function (b) {
      const on = b.getAttribute('data-situacao') === filtros.situacao;
      b.classList.toggle('ativo', on); b.setAttribute('aria-pressed', on);
    });
    conteudo.querySelectorAll('[data-destino]').forEach(function (b) {
      const on = b.getAttribute('data-destino') === String(filtros.destino_id);
      b.classList.toggle('ativo', on); b.setAttribute('aria-pressed', on);
    });
  }

  function ligarLimpar(conteudo, ctx) {
    const botao = conteudo.querySelector('#botao-limpar-filtros');
    if (!botao) return;
    botao.addEventListener('click', function () {
      filtros.q = ''; filtros.destino_id = ''; filtros.origem_id = ''; filtros.periodo = 'todos';
      conteudo.querySelector('#filtro-busca').value = '';
      conteudo.querySelector('#filtro-origem').value = '';
      conteudo.querySelector('#filtro-periodo').value = 'todos';
      marcarChips(conteudo);
      recarregarLista(conteudo, ctx);
    });
  }

  function ligarEventos(conteudo, ctx) {
    // Busca: espera a pessoa parar de digitar (0,35 s) antes de consultar
    let espera = null;
    conteudo.querySelector('#filtro-busca').addEventListener('input', function (e) {
      clearTimeout(espera);
      const valor = e.target.value.trim();
      espera = setTimeout(function () {
        if (valor === filtros.q) return;
        filtros.q = valor;
        recarregarLista(conteudo, ctx);
      }, 350);
    });

    conteudo.querySelector('#filtro-origem').addEventListener('change', function (e) {
      filtros.origem_id = e.target.value;
      recarregarLista(conteudo, ctx);
    });
    conteudo.querySelector('#filtro-periodo').addEventListener('change', function (e) {
      filtros.periodo = e.target.value;
      recarregarLista(conteudo, ctx);
    });

    conteudo.addEventListener('click', function (e) {
      const chipSit = e.target.closest('[data-situacao]');
      const chipDest = e.target.closest('[data-destino]');
      const kpi = e.target.closest('[data-filtro-rapido]');

      if (chipSit) {
        filtros.situacao = chipSit.getAttribute('data-situacao');
      } else if (chipDest) {
        filtros.destino_id = chipDest.getAttribute('data-destino');
      } else if (kpi) {
        // Clicar num total filtra a lista por ele
        filtros.situacao = kpi.getAttribute('data-filtro-rapido');
        conteudo.querySelector('#lista-oficios').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        return;
      }
      marcarChips(conteudo);
      recarregarLista(conteudo, ctx);
    });

    ligarLimpar(conteudo, ctx);
  }

  App.registrarPagina('painel', renderizar);

})();
