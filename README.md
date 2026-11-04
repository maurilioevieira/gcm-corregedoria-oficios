# Corregedoria · GCM Iguatu · Controle de Ofícios

Sistema web para a Corregedoria da Guarda Civil Municipal de Iguatu-CE controlar os ofícios recebidos (Ministério Público, Judiciário, Polícia Civil e outros), com os prazos de resposta, a situação de cada um e os relatórios.

- **Site:** GitHub Pages (HTML, CSS e JavaScript puros, sem etapa de build)
- **Banco:** Supabase (PostgreSQL), projeto `controle-corregedoria`, schema `corregedoria`
- **Acesso:** PIN de 6 números, em três níveis (admin, corregedor, auxiliar)

## Estrutura

```
index.html        Tela de PIN e estrutura do aplicativo
css/estilo.css    Visual (cores GCM azul e dourado)
js/config.js      URL e chave pública do Supabase
js/api.js         Única camada que conversa com o banco
js/app.js         Login, sessão, menus por nível e navegação
js/pag-*.js       Páginas do sistema (a partir da Etapa 3)
img/brasao.png    Brasão da GCM (logo, ícone da aba e timbre dos PDFs)
img/logo-prefeitura.png  Logo da Prefeitura (timbre dos PDFs)
js/pdf.js         Relatórios em PDF e planilha CSV
sw.js             Service worker (instalação como aplicativo)
manifest.webmanifest  Nome, cores e ícones do aplicativo
```

## Segurança

- Nenhuma tabela é acessível diretamente: o RLS está ligado, não há nenhuma policy e as permissões das roles públicas foram retiradas.
- O site só chama as funções do schema `corregedoria`, e cada uma confere o PIN e o nível no servidor.
- Os PINs são guardados como hash bcrypt.
- Depois de 5 PINs errados em 15 minutos, o acesso é bloqueado por 15 minutos.
- A chave em `js/config.js` é a **Publishable key**, feita para ficar em código público. A Secret key nunca deve entrar no repositório.
- A sessão fica só na aba aberta (sessionStorage) e termina sozinha depois de 20 minutos sem uso.

## Etapas

1. Banco de dados ✅
2. Base do site: login, layout e conexão ✅
3. Painel com totais e cards coloridos por prazo ✅
4. Cadastro e edição de ofícios, detalhe, histórico e registro de resposta ✅
5. Cadastros (listas suspensas) e usuários ✅
6. Relatórios em PDF ✅
7. Anexos, backup semanal e instalação como aplicativo (PWA) ✅
