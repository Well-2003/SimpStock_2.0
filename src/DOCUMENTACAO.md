# Documentação técnica — SimpStock

Descrição de como o sistema é construído: as camadas que o compõem, o papel de cada arquivo, como os dados trafegam e quais regras governam o comportamento. Para a apresentação do produto, veja o [README](../README.md).

---

## Visão geral

O SimpStock é uma aplicação web em duas camadas que se comunicam por HTTP:

* **Servidor** — API REST em Python com Flask. Valida os dados, controla quem pode acessar o quê e mantém a persistência.
* **Cliente** — páginas HTML com CSS e JavaScript, sem frameworks. Renderiza a interface e consome a API.

O servidor também entrega os arquivos do cliente, de modo que a aplicação inteira roda em um único processo e em uma única origem.

## Por que existe um servidor

A interface sozinha não resolveria o problema. Um navegador não consegue gravar arquivos, e dados guardados apenas no navegador ficam presos ao aparelho de quem os digitou: o lojista cadastraria um produto no computador do caixa e não o veria no celular do depósito.

O servidor existe para resolver três necessidades que só podem ser atendidas fora do navegador:

**Guardar os dados em um lugar só.** O estoque fica no servidor, não no navegador. Qualquer pessoa autorizada, em qualquer aparelho, enxerga o mesmo inventário — e uma alteração feita por uma delas aparece para as outras.

**Decidir quem pode o quê.** Verificações feitas no navegador podem ser contornadas por qualquer pessoa com o console aberto. O servidor confere a identidade e a permissão a cada requisição, de forma que a regra vale independentemente do que o cliente afirme.

**Guardar segredos.** Senhas nunca chegam ao navegador. O servidor recebe a senha digitada, compara com o hash armazenado e devolve apenas um token de sessão.

## Como o cliente e o servidor conversam

Toda operação sobre dados segue o mesmo caminho:

1. A pessoa interage com a página — envia um formulário, clica em excluir, abre a lista.
2. O JavaScript monta uma requisição HTTP e a envia à API, incluindo o token da sessão.
3. O servidor valida o token, aplica as regras de negócio e lê ou grava nos arquivos de dados.
4. A resposta volta em JSON, e o JavaScript atualiza a tela.

Cadastrar um produto, por exemplo, dispara um `POST /produtos` com os campos preenchidos. O servidor confere se os obrigatórios vieram, se a quantidade é um inteiro não negativo e se a validade tem formato de data; gera o identificador; grava no arquivo; e devolve o produto criado. A página só então exibe a confirmação e leva de volta à listagem.

Nenhuma tela grava dados por conta própria. Todo o estado vive no servidor.

---

## Servidor

Implementado em `app.py`, arquivo único dividido em blocos por responsabilidade.

### Persistência

Os dados ficam em dois arquivos JSON: `banco.json` para produtos e `usuarios.json` para contas. A escolha atende ao porte do sistema — algumas centenas de itens — e dispensa a instalação de um banco de dados.

A gravação é atômica: o conteúdo é escrito em um arquivo temporário e só então substitui o original. Se algo interromper o processo no meio da escrita, o arquivo anterior permanece íntegro, em vez de ficar truncado.

### Autenticação

O acesso é controlado por token assinado, não por sessão em memória:

1. `POST /login` recebe e-mail e senha, compara a senha com o hash armazenado e, em caso de sucesso, gera um token assinado contendo o identificador do usuário.
2. O cliente guarda esse token e o envia em `Authorization: Bearer <token>` a cada requisição.
3. O servidor verifica a assinatura, confirma que o token não expirou e carrega o usuário correspondente.

Tokens valem 8 horas. Como são assinados e carregam a própria informação, o servidor não precisa manter lista de sessões ativas.

As senhas são gravadas com hash `scrypt`, nunca em texto. Arquivos de versões anteriores que ainda contenham senhas legíveis são convertidos automaticamente na primeira execução, sem invalidar o acesso de quem já tinha conta.

### Autorização

Duas camadas protegem as rotas, aplicadas como decoradores:

* `requer_login` — recusa a requisição sem token válido, respondendo `401`.
* `requer_admin` — além do token, exige que o usuário tenha perfil de administrador, respondendo `403` caso contrário.

O perfil é lido do arquivo de usuários a partir do token, não de nada que o cliente informe. A interface esconde as opções administrativas de quem não é administrador, mas essa é uma conveniência visual: a decisão que importa é a do servidor.

### Validação

Nenhum dado é gravado como chega. Antes de persistir um produto, o servidor:

* confere a presença dos campos obrigatórios;
* converte a quantidade para inteiro e rejeita valores negativos;
* verifica o formato da data de validade, quando informada;
* monta o registro apenas com os campos conhecidos.

Essa última etapa também protege a integridade dos dados: campos extras enviados pelo cliente são descartados, e o identificador nunca pode ser sobrescrito por quem envia a requisição.

---

## Cliente

Os arquivos ficam em `src/`, separados entre o que é comum a todas as páginas e o que pertence a cada área do sistema.

| Arquivo | Responsabilidade |
|---|---|
| `tema.css` | Variáveis de cor e espaçamento, reset, cabeçalho, botões, etiquetas, notificações e modal |
| `comum.js` | Sessão, chamadas à API, notificações, modal de confirmação, menu responsivo e montagem da navegação |
| `Simpstock_style.css` | Estilos das páginas públicas e da tela de acesso |
| `Simpstock_script.js` | Carrossel de clientes e animações da página inicial |
| `Sistema_style.css` | Estilos das telas internas |
| `Sistema_script.js` | Login, cadastro, painel, estoque e administração |

### Sistema de design

As decisões visuais ficam centralizadas em variáveis CSS no `tema.css` — paleta, escala de espaçamento, raios de borda, sombras e transições. As duas folhas específicas consomem essas variáveis em vez de repetir valores, o que mantém as duas áreas do site visualmente coerentes e permite ajustar a identidade em um lugar só.

### Identificação das páginas

Cada página declara o próprio contexto em atributos do `<body>`:

```html
<body data-raiz=".." data-area="sistema" data-pagina="produtos">
```

* `data-raiz` — caminho até a raiz do site, usado para montar links corretos a partir de qualquer profundidade.
* `data-area` — `site` para páginas públicas, `sistema` para as que exigem sessão.
* `data-pagina` — qual inicializador o `Sistema_script.js` deve executar.

A alternativa seria o JavaScript deduzir o contexto a partir da URL, o que torna o comportamento dependente do caminho em que o site é servido. A declaração explícita elimina essa fragilidade.

### Navegação

O menu não é escrito no HTML de cada página. O `comum.js` o monta em tempo de execução a partir da área declarada e do estado da sessão: visitantes veem a opção de entrar, usuários autenticados veem o atalho para o painel, e o item de administração aparece apenas para administradores.

Isso mantém uma única definição de navegação para todo o site e permitiu que uma mesma página de ajuda atenda visitantes e usuários autenticados.

### Camada de acesso à API

Todas as requisições passam pela função `api()` do `comum.js`, que concentra o que se repetiria em cada chamada: montar o cabeçalho de autorização, converter a resposta, transformar erro da API em exceção com a mensagem já pronta para exibição e tratar sessão expirada de forma uniforme, redirecionando para o login com aviso.

### Segurança na renderização

Todo valor vindo da API passa por uma função de escape antes de ser inserido no HTML. Sem isso, um produto cadastrado com marcação no nome executaria código no navegador de qualquer pessoa que abrisse a listagem.

### Retorno ao usuário

As caixas nativas do navegador foram substituídas por componentes próprios: notificações que aparecem no canto da tela e um modal de confirmação que nomeia o que será afetado, fecha com `Esc` e devolve o foco ao elemento de origem.

As telas também comunicam estados intermediários — esqueleto de carregamento enquanto os dados chegam, estado vazio explicando o próximo passo, mensagens específicas quando a API falha e botões que indicam progresso durante o envio.

---

## Referência da API

Rotas autenticadas exigem o cabeçalho `Authorization: Bearer <token>`, obtido em `/login`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/` | Público | Entrega a página inicial |
| `GET` | `/status` | Público | Confirma que a API está no ar |
| `GET` | `/src/<arquivo>` | Público | Entrega os arquivos do cliente |
| `POST` | `/register` | Público | Cria uma conta de usuário comum |
| `POST` | `/login` | Público | Autentica e devolve o token de sessão |
| `GET` | `/me` | Autenticado | Dados do usuário da sessão atual |
| `GET` | `/produtos` | Autenticado | Lista todos os produtos |
| `POST` | `/produtos` | Autenticado | Cadastra um produto |
| `PUT` | `/produtos/<id>` | Autenticado | Atualiza um produto |
| `DELETE` | `/produtos/<id>` | Autenticado | Remove um produto |
| `GET` | `/usuarios` | Administrador | Lista as contas cadastradas |
| `DELETE` | `/usuarios/<id>` | Administrador | Remove uma conta |

### Códigos de resposta

| Código | Significado |
|---|---|
| `200` / `201` | Operação concluída |
| `400` | Dados inválidos — a mensagem indica o campo |
| `401` | Sem token, ou token inválido ou expirado |
| `403` | Sem permissão para a operação |
| `404` | Registro não encontrado |

### Campos do produto

| Campo | Tipo | Obrigatório |
|---|---|---|
| `nome` | texto | sim |
| `marca` | texto | sim |
| `codigo` | texto | sim |
| `quantidade` | inteiro ≥ 0 | sim |
| `referencia` | texto | sim |
| `validade` | data `AAAA-MM-DD` | não |
| `endereco` | texto | não |

O `id` é gerado pelo servidor e não pode ser definido nem alterado pelo cliente.

---

## Regras de negócio

**Situação do estoque.** Quantidade zero marca o produto como sem estoque; abaixo de 10 unidades, como estoque baixo. Ambas as situações recebem destaque visual na listagem e entram na contagem do painel.

**Situação da validade.** Data já passada marca o produto como vencido; data dentro dos próximos 30 dias, como vencendo. Produtos sem validade informada ficam fora dessa verificação.

**Proteção de contas.** O administrador principal não pode ser excluído, o que garante que sempre reste alguém capaz de gerenciar o sistema. Um administrador também não pode excluir a própria conta.

**Confirmação de exclusões.** Remover um produto ou uma conta exige confirmação explícita, com o nome do item apresentado antes da decisão.

Os limites de 10 unidades e 30 dias são constantes declaradas no início do `Sistema_script.js`.

---

## Execução

O projeto depende apenas do Flask e do Flask-CORS, declarados em `requirements.txt`:

```bash
pip install -r requirements.txt
```

```bash
python app.py
```

A aplicação fica disponível em `http://localhost:5000`.

Abrir os arquivos HTML diretamente pelo explorador de arquivos não funciona: no protocolo `file://` o navegador bloqueia as requisições à API.

### Acesso de administrador

A conta `admin@simpstock.com`, com a senha `admin123`, é criada automaticamente na primeira execução e dá acesso ao painel de usuários. Pode ser recriada ou ter a senha redefinida por linha de comando:

```bash
python app.py --criar-admin
```

Uma senha informada após o comando substitui a padrão.

### Configuração

Todas as variáveis de ambiente são opcionais.

| Variável | Função |
|---|---|
| `PORT` | Porta do servidor. Padrão: `5000`. |
| `SIMPSTOCK_SECRET` | Chave de assinatura dos tokens. Sem ela, uma chave aleatória é gerada e guardada em disco. |
| `SIMPSTOCK_ORIGENS` | Origens aceitas pela API, separadas por vírgula. Padrão: todas. |

Quando o cliente é servido separadamente da API, o endereço do servidor pode ser informado em `window.SIMPSTOCK_API` antes do carregamento do `comum.js`.

---

## Estrutura de arquivos

```bash
/
├── app.py                       # Servidor: API e entrega das páginas
├── banco.json                   # Dados dos produtos
├── usuarios.json                # Contas de usuário
├── requirements.txt             # Dependências Python
├── index.html                   # Página inicial do site
└── src/
    ├── DOCUMENTACAO.md          # Este arquivo
    ├── tema.css                 # Variáveis, componentes e navegação
    ├── comum.js                 # Sessão, API, notificações e modais
    ├── Simpstock_style.css      # Estilos das páginas públicas
    ├── Simpstock_script.js      # Carrossel e animações
    ├── Sistema_style.css        # Estilos das telas do sistema
    ├── Sistema_script.js        # Login, estoque e administração
    ├── Login.html               # Login e criação de conta
    ├── Tela_inicial.html        # Painel com resumo do estoque
    ├── Cadastro_de_produtos.html
    ├── tabela_principal.html    # Listagem do estoque
    ├── Admin.html               # Painel administrativo
    ├── Sobre_nós.html
    ├── Ajuda.html               # Central de ajuda
    └── imagens/                 # Logotipo, ícones e imagens do site
```
