# Ouvidoria Municipal

Portal do cidadão (`index.html`) e painel da prefeitura (`painel.html`) para receber reclamações, denúncias, solicitações, sugestões e elogios, com fotos, vídeos e áudios.

- **Portal:** funciona no celular sem instalar nada. O cidadão recebe um **protocolo** e um **código de acesso** para acompanhar.
- **Painel:** login por e-mail e senha, perfis de acesso, gráficos de mais reclamados e mais elogiados, filtros por secretaria e caixa de entrada com as mídias.
- **Banco de dados:** Supabase (PostgreSQL), com as regras de acesso dentro do próprio banco.

## Estrutura

```
index.html          portal do cidadão
painel.html         painel da prefeitura (acesso restrito)
config.js           ÚNICO arquivo que você precisa editar
css/estilo.css      visual
js/comum.js         funções compartilhadas
js/portal.js        lógica do portal
js/painel.js        lógica do painel
supabase/schema.sql banco de dados, regras de acesso e armazenamento de arquivos
```

## Publicação passo a passo (cerca de 30 minutos)

### 1. Criar o projeto no Supabase

1. Em [supabase.com](https://supabase.com), clique em **New project**.
2. Dê um nome (por exemplo `ouvidoria`), defina uma senha forte para o banco e escolha a região **South America (São Paulo)**.

### 2. Criar o banco

1. Abra `supabase/schema.sql` e, **no final do arquivo (seção 9)**, troque `seu-email@prefeitura.gov.br` e `Seu nome completo` pelos dados do(a) Ouvidor(a).
2. No Supabase, vá em **SQL Editor → New query**, cole o arquivo inteiro e clique em **Run**. Deve aparecer "Success".

### 3. Configurar o login

Em **Authentication → URL Configuration**:

- **Site URL:** o endereço do painel, por exemplo `https://SEU-USUARIO.github.io/ouvidoria/painel.html`.
- **Redirect URLs:** adicione o mesmo endereço.

Faça isso depois do passo 5, quando já souber o endereço. Até lá, os links de confirmação de e-mail não vão funcionar.

### 4. Ligar o site ao banco

Em **Project Settings → API**, copie a **Project URL** e a chave **anon public** e cole em `config.js`. No mesmo arquivo, troque os textos entre colchetes: município, WhatsApp, telefone, endereço, encarregado de dados e prazo de guarda.

> A chave `anon public` pode ficar no site: ela é pública por natureza. **Nunca** use a chave `service_role` no site.

### 5. Publicar no GitHub Pages

1. Crie um repositório no GitHub (por exemplo `ouvidoria`) e envie todos os arquivos desta pasta.
2. No repositório, vá em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
3. Em um ou dois minutos, o site fica em `https://SEU-USUARIO.github.io/ouvidoria/`. O painel fica em `.../painel.html`.
4. Volte ao passo 3 e cadastre esse endereço no Supabase.

Também funciona em Vercel ou Netlify: importe o repositório, sem nenhuma configuração de build.

### 6. Primeiro acesso ao painel

1. Abra `painel.html` e toque em **Primeiro acesso: criar senha**.
2. Use o mesmo e-mail que você colocou no `schema.sql`, crie a senha e confirme pelo link que chega no seu e-mail.
3. Entre. No botão **Equipe**, libere o acesso das outras pessoas, informando nome, e-mail e perfil. Cada uma cria a própria senha da mesma forma.

### 7. Testar

- Pelo celular, envie uma manifestação com foto e anote o protocolo e o código.
- No painel, ela aparece na caixa de entrada em até 1 minuto, ou na hora, pelo botão **Atualizar**.
- Mude a situação e escreva uma mensagem. Depois, consulte o protocolo no portal: a mensagem aparece para o cidadão.

## Locais do formulário (unidades de saúde, escolas, ônibus, bairros)

No painel, o(a) Ouvidor(a) tem o botão **Locais**. Ali dá para colar as listas oficiais, um nome por linha, em cinco listas: unidades de saúde, escolas e CEINFs, linhas de ônibus e terminais, bairros e outros locais.

- No portal, quando o cidadão escolhe o assunto Saúde, Educação ou Transporte coletivo, o campo de local sugere os nomes da lista correspondente. O campo Bairro sugere os bairros cadastrados.
- O cidadão ainda pode escrever um nome que não esteja na lista.
- Um nome pode ser **ocultado** (sai do formulário, mas continua nas manifestações antigas) ou **excluído**.

**Projeto criado antes desta versão?** Rode uma vez o arquivo `supabase/atualizacao-1-locais.sql` no SQL Editor do Supabase.

Fontes sugeridas para as listas: SESAU (unidades de saúde), SEMED (escolas e EMEIs/CEINFs), Agereg (linhas de ônibus) e Planurb (bairros oficiais).

## Perfis de acesso

| Perfil | Vê | Pode |
|---|---|---|
| Ouvidor(a) | Tudo, inclusive identidade sob sigilo | Alterar, encaminhar, sinalizar conteúdo e gerenciar a equipe |
| Secretaria | Só manifestações da própria secretaria; nome só nas identificadas | Responder e mudar a situação |
| Consulta | Gráficos e manifestações, sem dados pessoais e sem arquivos | Somente leitura |

Essas regras estão **no banco de dados** (Row Level Security). Mesmo que alguém altere o site, o banco não entrega o que o perfil não pode ver.

## Antes de receber manifestações reais

- [ ] Projeto do Supabase e conta do GitHub **em nome da prefeitura**, e não de uma pessoa.
- [ ] Contrato ou termo com cláusulas de proteção de dados com os fornecedores (LGPD).
- [ ] Encarregado de dados nomeado e publicado no `config.js` (LGPD, art. 41).
- [ ] Textos do aviso legal e do aviso de privacidade revisados pela Procuradoria.
- [ ] Domínio oficial (por exemplo `ouvidoria.municipio.uf.gov.br`) apontando para o site.
- [ ] E-mail próprio para o login (**Authentication → SMTP Settings**). O e-mail padrão do Supabase tem limite baixo de envios por hora.
- [ ] Plano do Supabase com backup diário. O plano gratuito pausa projetos sem uso e não tem backup automático.
- [ ] Teste de acessibilidade (eMAG) e de segurança.

## Limitações conhecidas desta versão

- **Sem proteção anti-robô no envio.** Uma pessoa mal-intencionada poderia enviar muitas manifestações ou arquivos falsos. Para produção, vale adicionar um captcha (por exemplo Cloudflare Turnstile) com uma Edge Function do Supabase.
- **Avisos por WhatsApp e e-mail ao cidadão ainda não são enviados.** A preferência fica gravada, mas o envio precisa de integração com um serviço de mensagens.
- **Arquivos órfãos:** se o cidadão desistir no meio do envio, os arquivos já enviados ficam no armazenamento sem manifestação ligada. Uma limpeza periódica resolve.
- **Vídeos .MOV e áudios .OGG/.OPUS** são guardados normalmente, mas alguns navegadores não conseguem reproduzi-los no painel. Nesse caso, baixe o arquivo pelo link.
