/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/pag-usuarios.js · Aba Usuários (#usuarios) · só administrador
   ------------------------------------------------------------
   • Tabela com todos os usuários (ativos e desativados).
   • Painel lateral para criar ou editar (nome, cargo, nível, PIN).
   • O PIN nunca é exibido: fica criptografado no banco. Só pode
     ser substituído por um novo.
   • Usuários não são excluídos, só desativados: o nome precisa
     continuar no histórico dos ofícios.
   • O banco impede que o sistema fique sem nenhum administrador.
   ============================================================ */

(function () {
  'use strict';

  const U = App.util;
  const esc = U.esc;

  const NIVEIS = [
    { id: 'auxiliar',   nome: 'Auxiliar',     classe: 'n-aux',   desc: 'Cadastra e edita ofícios em aberto, registra resposta e gera relatórios. Não vê conteúdo sigiloso.' },
    { id: 'corregedor', nome: 'Corregedoria', classe: 'n-corr',  desc: 'Tudo do auxiliar, mais ofícios sigilosos, reabrir, excluir e a aba Cadastros.' },
    { id: 'admin',      nome: 'Administrador', classe: 'n-admin', desc: 'Tudo, mais gerenciar usuários e PINs.' }
  ];
  function nivelInfo(id) { return NIVEIS.find(function (n) { return n.id === id; }) || NIVEIS[0]; }

  function htmlTabela(usuarios, editandoId, meuId) {
    return (
      '<section class="cartao usr-tabela-caixa">' +
        '<div class="tabela-rolagem"><table class="tabela">' +
          '<thead><tr><th>Nome</th><th>Cargo</th><th>Nível</th><th>Situação</th><th>Ações</th></tr></thead>' +
          '<tbody>' +
          usuarios.map(function (u) {
            const n = nivelInfo(u.nivel);
            return '<tr class="' + (u.id === editandoId ? 'linha-sel' : '') + (u.ativo ? '' : ' linha-off') + '">' +
              '<td><strong>' + esc(u.nome) + '</strong>' + (u.id === meuId ? ' <span class="voce">você</span>' : '') + '</td>' +
              '<td>' + esc(u.cargo || '—') + '</td>' +
              '<td><span class="nivel ' + n.classe + '">' + esc(n.nome) + '</span></td>' +
              '<td>' + (u.ativo ? '<span class="sit-ativo">● Ativo</span>' : '<span class="sit-off">○ Desativado</span>') + '</td>' +
              '<td><div class="usr-acoes">' +
                '<button type="button" class="botao secundario pequeno" data-editar="' + u.id + '">Editar</button>' +
                (u.ativo ? '<button type="button" class="botao secundario pequeno" data-pin="' + u.id + '">Novo PIN</button>' : '') +
              '</div></td>' +
            '</tr>';
          }).join('') +
          '</tbody>' +
        '</table></div>' +
        '<p class="usr-nota">Usuários não são excluídos, só desativados: o nome continua aparecendo no histórico dos ofícios que eles cadastraram ou responderam.</p>' +
      '</section>'
    );
  }

  function htmlFormulario(u) {
    const novo = !u.id;
    return (
      '<section class="cartao usr-form-caixa" aria-label="' + (novo ? 'Novo usuário' : 'Editar usuário') + '">' +
        '<h2 class="cartao-titulo">' + (novo ? 'Novo usuário' : 'Editar usuário · ' + esc(u.nome)) + '</h2>' +
        '<form id="form-usuario" class="usr-form" novalidate>' +
          '<label class="campo"><span>Nome <span class="obrig">*</span></span><input name="nome" maxlength="80" value="' + esc(u.nome || '') + '" autocomplete="off"></label>' +
          '<label class="campo">Cargo<input name="cargo" maxlength="80" value="' + esc(u.cargo || '') + '" placeholder="Ex.: Auxiliar administrativo" autocomplete="off"></label>' +
          '<div class="campo"><span>Nível de acesso <span class="obrig">*</span></span>' +
            '<div class="usr-niveis" role="radiogroup" aria-label="Nível de acesso">' +
            NIVEIS.map(function (n) {
              const on = (u.nivel || 'auxiliar') === n.id;
              return '<label class="usr-nivel' + (on ? ' marcada' : '') + '">' +
                '<input type="radio" name="nivel" value="' + n.id + '"' + (on ? ' checked' : '') + '>' +
                '<span><strong>' + esc(n.nome) + '</strong><small>' + esc(n.desc) + '</small></span></label>';
            }).join('') +
            '</div></div>' +
          '<div class="janela-grade">' +
            '<label class="campo"><span>' + (novo ? 'PIN (6 números) <span class="obrig">*</span>' : 'Novo PIN (opcional)') + '</span>' +
              '<input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="6 números"></label>' +
            '<label class="campo"><span>Repetir PIN</span>' +
              '<input name="pin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="6 números"></label>' +
          '</div>' +
          '<p class="dica">' + (novo
            ? 'Entregue o PIN pessoalmente. A pessoa pode trocá-lo depois no cadeado (Minha conta).'
            : 'Deixe em branco para manter o PIN atual. O sistema nunca mostra PINs já cadastrados: eles ficam criptografados.') + '</p>' +
          '<label class="marcador"><input type="checkbox" name="ativo"' + (u.ativo === false ? '' : ' checked') + '>Usuário ativo</label>' +
          '<div class="janela-botoes">' +
            '<button type="button" class="botao secundario" data-cancelar>Cancelar</button>' +
            '<button type="submit" class="botao primario">' + (novo ? 'Cadastrar usuário' : 'Salvar') + '</button>' +
          '</div>' +
        '</form>' +
      '</section>'
    );
  }

  async function renderizar(conteudo, ctx) {
    let usuarios = (await U.comCarregando(function () { return API.listarUsuarios(); })).usuarios || [];
    if (!ctx.ativa()) return;

    const meuId = ctx.usuario.id;
    let editando = null; // null = painel fechado; {} = novo; objeto = edição

    conteudo.innerHTML = '<div class="pg-usuarios"></div>';
    const raiz = conteudo.firstElementChild;

    function desenhar(focarPin) {
      raiz.innerHTML =
        '<header class="pagina-topo"><div>' +
          '<h1 class="pagina-titulo">Usuários</h1>' +
          '<p class="texto-suave">Quem acessa o sistema e o que cada um pode fazer.</p>' +
        '</div><div class="pagina-acoes"><button type="button" class="botao primario" data-novo>+ Novo usuário</button></div></header>' +
        '<div class="usr-layout">' +
          htmlTabela(usuarios, editando && editando.id, meuId) +
          (editando ? htmlFormulario(editando) : '') +
        '</div>' +
        '<section class="cartao usr-backup">' +
          '<div><h2 class="cartao-titulo">Backup automático</h2>' +
          '<p class="texto-suave">A cópia semanal dos dados (GitHub Actions) usa uma <strong>chave de backup</strong> própria, que só permite ler e exportar. ' +
          'Gere a chave e cole no segredo <code>BACKUP_TOKEN</code> do repositório de backup. Gerar uma nova chave invalida a anterior.</p></div>' +
          '<button type="button" class="botao secundario" data-chave-backup>Gerar chave de backup</button>' +
        '</section>';

      if (editando) {
        const form = raiz.querySelector('#form-usuario');
        form.querySelectorAll('input[name="nivel"]').forEach(function (r) {
          r.addEventListener('change', function () {
            form.querySelectorAll('.usr-nivel').forEach(function (l) { l.classList.toggle('marcada', l.querySelector('input').checked); });
          });
        });
        form.addEventListener('submit', salvar);
        const alvo = focarPin ? form.elements.pin : form.elements.nome;
        alvo.focus();
        if (window.innerWidth < 900) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    async function salvar(e) {
      e.preventDefault();
      const f = e.target;
      const dados = {
        id: editando.id || null,
        nome: f.elements.nome.value.trim(),
        cargo: f.elements.cargo.value.trim(),
        nivel: (f.querySelector('input[name="nivel"]:checked') || {}).value,
        novo_pin: f.elements.pin.value.trim() || null,
        ativo: f.elements.ativo.checked
      };
      const pin2 = f.elements.pin2.value.trim();

      if (!dados.nome) { U.avisar('Informe o nome.', 'erro'); return; }
      if (!dados.id && !dados.novo_pin) { U.avisar('Defina um PIN para o novo usuário.', 'erro'); return; }
      if (dados.novo_pin && !/^[0-9]{6}$/.test(dados.novo_pin)) { U.avisar('O PIN deve ter exatamente 6 números.', 'erro'); return; }
      if (dados.novo_pin && dados.novo_pin !== pin2) { U.avisar('A repetição não confere com o PIN.', 'erro'); return; }
      if (dados.id === meuId && !dados.ativo) { U.avisar('Você não pode desativar o seu próprio usuário.', 'erro'); return; }

      const souEu = dados.id === meuId;
      if (souEu && dados.nivel !== ctx.usuario.nivel) {
        const ok = await Comp.confirmar('Mudar o seu próprio nível',
          'Você deixará de ser ' + nivelInfo(ctx.usuario.nivel).nome + '. Se deixar de ser administrador, perderá o acesso a esta tela. Continuar?', 'Continuar', true);
        if (!ok) return;
      }

      try {
        await U.comCarregando(function () { return API.salvarUsuario(dados); });
      } catch (erro) { return; }

      U.avisar(dados.id ? 'Usuário atualizado.' : 'Usuário cadastrado.', 'sucesso');
      App.cadastros(true).catch(function () {}); // atualiza a lista "Recebido por"

      if (souEu) {
        // Alterou a si mesmo: passa a usar o novo PIN e recarrega
        // o sistema para aplicar nome e nível novos ao menu.
        if (dados.novo_pin) App.atualizarPinSessao(dados.novo_pin);
        setTimeout(function () { location.reload(); }, 600);
        return;
      }

      editando = null;
      usuarios = (await U.comCarregando(function () { return API.listarUsuarios(); })).usuarios || [];
      if (ctx.ativa()) desenhar();
    }

    async function gerarChave() {
      const ok = await Comp.confirmar('Gerar chave de backup',
        'Uma chave nova será criada e a anterior deixará de funcionar. Depois de gerar, atualize o segredo BACKUP_TOKEN no GitHub.', 'Gerar chave');
      if (!ok) return;
      let r;
      try { r = await U.comCarregando(function () { return API.gerarChaveBackup(); }); } catch (e) { return; }
      await Comp.janela({
        titulo: 'Chave de backup gerada',
        texto: 'Copie agora: por segurança, esta chave não será exibida de novo.',
        corpo: '<label class="campo">Chave<input name="chave" readonly value="' + esc(r.chave) + '" class="chave-backup"></label>' +
               '<button type="button" class="botao azul" data-copiar>Copiar chave</button>',
        botaoOk: 'Já copiei',
        aoAbrir: function (form) {
          const campo = form.querySelector('.chave-backup');
          campo.addEventListener('focus', function () { campo.select(); });
          form.querySelector('[data-copiar]').addEventListener('click', function () {
            campo.select();
            (navigator.clipboard ? navigator.clipboard.writeText(campo.value) : Promise.reject())
              .then(function () { U.avisar('Chave copiada.', 'sucesso'); })
              .catch(function () { document.execCommand('copy'); U.avisar('Chave copiada.', 'sucesso'); });
          });
        }
      });
    }

    raiz.addEventListener('click', function (e) {
      if (e.target.closest('[data-chave-backup]')) { gerarChave(); return; }
      if (e.target.closest('[data-novo]')) { editando = { nivel: 'auxiliar', ativo: true }; desenhar(); return; }
      if (e.target.closest('[data-cancelar]')) { editando = null; desenhar(); return; }
      const ed = e.target.closest('[data-editar]');
      const pin = e.target.closest('[data-pin]');
      const alvo = ed || pin;
      if (alvo) {
        const id = Number(alvo.getAttribute(ed ? 'data-editar' : 'data-pin'));
        editando = Object.assign({}, usuarios.find(function (u) { return u.id === id; }));
        desenhar(!!pin);
      }
    });

    desenhar();
  }

  App.registrarPagina('usuarios', renderizar);
})();
