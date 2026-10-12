// =====================================================================
// Configuração da Ouvidoria — edite só este arquivo.
// Os dois valores do Supabase ficam em: Project Settings → API.
// A "anon public key" pode ficar aqui: ela é pública por natureza e o
// que protege os dados são as regras de acesso do arquivo schema.sql.
// NUNCA coloque aqui a "service_role key".
// =====================================================================
window.OUVIDORIA_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseAnonKey: 'COLE-AQUI-A-ANON-PUBLIC-KEY',

  municipio: '[MUNICÍPIO]',
  whatsapp: '[NÚMERO DO WHATSAPP]',
  telefone: '[TELEFONE] · seg a sex, [HORÁRIO]',
  endereco: '[ENDEREÇO DA OUVIDORIA]',
  encarregadoNome: '[NOME DO ENCARREGADO]',
  encarregadoEmail: '[E-MAIL DO ENCARREGADO]',
  prazoGuarda: '[PRAZO DE GUARDA]'
};
