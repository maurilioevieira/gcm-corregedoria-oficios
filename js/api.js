/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/api.js · Comunicação com o banco (Supabase)
   ------------------------------------------------------------
   Este é o ÚNICO arquivo que conversa com o Supabase. O resto do
   site chama, por exemplo, API.painel() e recebe os dados prontos.
   Vantagem: se um dia mudar o banco, só este arquivo muda.

   Tratamento de erros (o mesmo padrão das funções do banco):
     • {ok:false, codigo:'pin' | 'bloqueado'} → a sessão caiu:
       avisamos o app para voltar à tela de PIN.
     • {ok:false, codigo:'permissao'}         → mostra o aviso.
     • erro do Supabase (dado inválido)        → mostra a mensagem
       exatamente como o banco escreveu (já está em português).
   ============================================================ */

window.API = (function () {
  'use strict';

  const configurado = CONFIG.SUPABASE_KEY && !CONFIG.SUPABASE_KEY.startsWith('COLE_AQUI');

  const cliente = configurado
    ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
        db: { schema: CONFIG.SCHEMA },
        // Não usamos o login do Supabase (Auth): a identificação é pelo PIN.
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      })
    : null;

  // PIN da sessão atual (fica só na memória e no sessionStorage da aba).
  let pinAtual = null;

  // O app registra aqui o que fazer quando a sessão cair.
  let aoPerderSessao = function () {};

  class ErroAPI extends Error {
    constructor(mensagem, codigo) {
      super(mensagem);
      this.codigo = codigo || 'erro';
    }
  }

  function traduzirErroTecnico(mensagem) {
    const m = String(mensagem || '');
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) {
      return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
    }
    if (/schema must be one of|Invalid schema/i.test(m)) {
      return 'O schema "corregedoria" não está liberado em Data API > Settings > Exposed schemas.';
    }
    if (/Could not find the function/i.test(m)) {
      return 'Função não encontrada no banco. Confira se todos os arquivos SQL foram executados.';
    }
    if (/Invalid API key|No API key/i.test(m)) {
      return 'Chave do Supabase inválida. Confira o arquivo js/config.js.';
    }
    return m || 'Erro inesperado.';
  }

  /**
   * Chama uma função (RPC) do banco.
   * @param {string} funcao   nome da função no schema corregedoria
   * @param {object} params   parâmetros SEM o p_pin (ele é incluído aqui)
   * @param {object} opcoes   { pin: 'xxxxxx' } para usar outro PIN (login)
   */
  async function chamar(funcao, params, opcoes) {
    if (!cliente) {
      throw new ErroAPI('Sistema não configurado: cole a Publishable key no arquivo js/config.js.', 'config');
    }
    const pin = (opcoes && opcoes.pin) || pinAtual;
    const corpo = Object.assign({ p_pin: pin }, params || {});

    let resposta;
    try {
      resposta = await cliente.rpc(funcao, corpo);
    } catch (e) {
      throw new ErroAPI(traduzirErroTecnico(e && e.message), 'rede');
    }

    if (resposta.error) {
      throw new ErroAPI(traduzirErroTecnico(resposta.error.message), 'dados');
    }

    const dados = resposta.data;
    if (dados && dados.ok === false) {
      const erro = new ErroAPI(dados.erro || 'Operação não permitida.', dados.codigo);
      // Se o PIN deixou de valer no meio do uso (trocado, usuário
      // desativado ou bloqueio), o app volta para a tela de login.
      if (!(opcoes && opcoes.pin) && (dados.codigo === 'pin' || dados.codigo === 'bloqueado')) {
        aoPerderSessao(erro);
      }
      throw erro;
    }
    return dados;
  }

  return {
    ErroAPI: ErroAPI,
    configurado: configurado,

    definirPin: function (pin) { pinAtual = pin; },
    limparPin: function () { pinAtual = null; },
    quandoPerderSessao: function (fn) { aoPerderSessao = fn; },

    // ---------- Acesso ----------
    login: function (pin) {
      return chamar('login', {}, { pin: pin });
    },
    trocarMeuPin: function (pinAtualDigitado, novoPin) {
      return chamar('trocar_meu_pin', { p_novo_pin: novoPin }, { pin: pinAtualDigitado });
    },
    listarUsuarios: function () {
      return chamar('listar_usuarios');
    },
    salvarUsuario: function (u) {
      return chamar('salvar_usuario', {
        p_id: u.id || null,
        p_nome: u.nome,
        p_cargo: u.cargo || null,
        p_nivel: u.nivel,
        p_novo_pin: u.novo_pin || null,
        p_ativo: u.ativo !== false
      });
    },

    // ---------- Cadastros ----------
    listarCadastros: function (incluirInativos) {
      return chamar('listar_cadastros', { p_inativos: !!incluirInativos });
    },
    salvarItemLista: function (lista, item) {
      return chamar('salvar_item_lista', {
        p_lista: lista,
        p_id: item.id || null,
        p_nome: item.nome,
        p_ordem: Number(item.ordem) || 0,
        p_ativo: item.ativo !== false
      });
    },
    excluirItemLista: function (lista, id) {
      return chamar('excluir_item_lista', { p_lista: lista, p_id: id });
    },
    salvarOrgao: function (o) {
      return chamar('salvar_orgao', {
        p_id: o.id || null,
        p_origem_id: o.origem_id,
        p_nome: o.nome,
        p_ordem: Number(o.ordem) || 0,
        p_ativo: o.ativo !== false
      });
    },
    excluirOrgao: function (id) {
      return chamar('excluir_orgao', { p_id: id });
    },
    salvarFeriado: function (data, descricao) {
      return chamar('salvar_feriado', { p_data: data, p_descricao: descricao });
    },
    excluirFeriado: function (data) {
      return chamar('excluir_feriado', { p_data: data });
    },
    calcularDataLimite: function (inicio, dias, tipo) {
      return chamar('calcular_data_limite', { p_inicio: inicio, p_dias: Number(dias), p_tipo: tipo || 'corridos' });
    },

    // ---------- Ofícios ----------
    painel: function () {
      return chamar('painel');
    },
    listarOficios: function (filtros) {
      return chamar('listar_oficios', { p_filtros: filtros || {} });
    },
    obterOficio: function (id) {
      return chamar('obter_oficio', { p_id: id });
    },
    salvarOficio: function (dados) {
      return chamar('salvar_oficio', { p_dados: dados });
    },
    concluirOficio: function (id, situacao, respostaNumero, respostaData, obs) {
      return chamar('concluir_oficio', {
        p_id: id,
        p_situacao: situacao,
        p_resposta_numero: respostaNumero || null,
        p_resposta_data: respostaData || null,
        p_obs: obs || null
      });
    },
    reabrirOficio: function (id, motivo) {
      return chamar('reabrir_oficio', { p_id: id, p_motivo: motivo });
    },
    excluirOficio: function (id, motivo) {
      return chamar('excluir_oficio', { p_id: id, p_motivo: motivo });
    },
    relatorioConsolidado: function (de, ate) {
      return chamar('relatorio_consolidado', { p_de: de, p_ate: ate });
    }
  };
})();
