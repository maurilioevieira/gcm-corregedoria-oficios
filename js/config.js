/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/config.js · Configurações do sistema
   ------------------------------------------------------------
   Onde achar os valores no Supabase:
     • URL   → Project Settings > Data API (ou Integrations > Data API),
               campo "API URL" SEM o "/rest/v1/" do final.
     • CHAVE → Project Settings > API Keys > "Publishable key"
               (começa com sb_publishable_...). Se o painel mostrar
               só as chaves antigas, use a "anon public".

   Esta chave PODE ficar no código público do GitHub: ela não dá
   acesso às tabelas. Tudo passa pelas funções que exigem PIN.
   NUNCA coloque aqui a "Secret key" nem a "service_role".
   ============================================================ */

window.CONFIG = {
  SUPABASE_URL: 'https://zaoggakbqngsquemnoah.supabase.co',
  SUPABASE_KEY: 'sb_publishable_LEJWA2_OGvLoI2HPzMXkkg_KdSiTcEo',

  // Schema do banco onde estão as funções deste sistema
  SCHEMA: 'corregedoria',

  // Sai sozinho após este tempo sem uso (minutos)
  MINUTOS_INATIVIDADE: 20,

  NOME_SISTEMA: 'Corregedoria · Controle de Ofícios',
  VERSAO: '1.0.0 · etapa 5'
};
