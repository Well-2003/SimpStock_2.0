# SimpStock

**Sistema web de controle de estoque para quem não tem tempo de aprender um sistema.**

Python · Flask · HTML5 · CSS3 · JavaScript

link do site: https://simpstock.pythonanywhere.com/

---

## O problema

Pequenos lojistas controlam estoque em caderno e planilha porque os sistemas disponíveis foram feitos para operadores treinados: telas densas, menus profundos, dezenas de campos obrigatórios. Quem trabalha sozinho na loja não tem uma semana para aprender uma ferramenta.

O resultado é conhecido: produto que acaba sem ninguém perceber, mercadoria vencida na prateleira e contagem que nunca bate.

## O objetivo

Construir um sistema de gerenciamento de estoque **simples e fácil de manusear**, que reúna as informações que realmente importam sobre o inventário e que possa ser usado sem dificuldade por pessoas com pouca familiaridade com tecnologia.

O critério de sucesso adotado foi direto: se o lojista precisa de treinamento para cadastrar um produto, o sistema falhou.

## Público-alvo

* **Pequenos e médios lojistas** que ainda controlam o estoque em caderno ou planilha, sem nenhum sistema automatizado.
* **Pessoas acima de 35 anos** que procuram uma ferramenta direta, sem curva de aprendizado.
* **Negócios em expansão** que chegaram no ponto em que o controle manual não dá mais conta.

---

## O que o sistema entrega

### Site institucional
Página inicial apresentando a ferramenta, seção **Sobre nós** e uma **Central de ajuda** com perguntas frequentes e boas práticas de controle de estoque.

### Acesso e contas
Cadastro e login com validação das regras de senha em tempo real. Senhas gravadas com hash, sessão por token assinado e painel administrativo para gerenciar as contas com acesso ao sistema.

### Controle de estoque
Cadastro de produtos com nome, marca, validade, código, quantidade, referência e localização. Listagem completa com ordenação por qualquer coluna, busca, filtros por situação, alertas automáticos e edição ou exclusão individual e em massa.

### Painel
Tela inicial com o resumo do inventário: total de produtos, itens sem estoque, itens com estoque baixo e itens vencidos ou próximos do vencimento.

---

## Por que ele resolve

**Cadastro em um formulário só.** Nome, marca, código, quantidade e referência. Validade e localização são opcionais. Sem etapas, sem assistentes, sem configuração prévia.

**Avisa antes do prejuízo.** Produtos sem estoque, com menos de 10 unidades ou com validade vencida ou próxima aparecem destacados por cor na própria lista. Não é preciso procurar: o problema se apresenta sozinho.

**Encontra o produto do jeito que a pessoa lembra dele.** A busca varre nome, marca, código, referência e localização ao mesmo tempo — funciona tanto para quem sabe o SKU quanto para quem só lembra a marca.

**Nada se perde por acidente.** Toda exclusão pede confirmação nomeando o que será apagado, e a conta do administrador principal não pode ser removida.

**Funciona no celular.** A mesma interface se adapta à tela pequena, para conferir o estoque de dentro do depósito.

---

## Tecnologias

### Backend
* **Python 3** com **Flask** — API REST e entrega das páginas
* **Flask-CORS** — controle de acesso entre domínios
* **Werkzeug** e **itsdangerous** — hash das senhas e assinatura dos tokens
* **JSON** — persistência em arquivo, dimensionada ao porte do sistema e sem exigir instalação de banco

### Frontend
* **HTML5** e **CSS3** — layout responsivo com sistema de design em variáveis CSS
* **JavaScript** — manipulação do DOM e consumo da API, sem frameworks nem dependências de build

---

## Decisões de engenharia

**Autorização validada no servidor.** O perfil de administrador é determinado pelo token a cada requisição, não pelo que o navegador informa. Alterar o `localStorage` não abre o painel administrativo.

**Senhas nunca em texto puro.** Gravadas com hash `scrypt`. Arquivos de versões anteriores são migrados automaticamente na primeira execução, sem invalidar as senhas já cadastradas.

**Gravação atômica.** O banco é escrito em arquivo temporário e só então substitui o original, de forma que uma falha durante a escrita não deixa os dados corrompidos.

**Saída escapada.** Todo dado vindo do banco é escapado antes de chegar ao HTML, fechando a superfície de XSS na listagem de produtos.

**Um único processo.** O Flask entrega o site e a API na mesma origem, o que elimina configuração de CORS e endereço de API no ambiente de desenvolvimento.

**Estado da página declarado no HTML.** Cada página informa a própria identidade por atributos no `<body>`, em vez de o JavaScript deduzir contexto a partir da URL — que quebrava conforme o caminho em que o site fosse servido.

**Sem dependências de frontend.** Nenhum framework, nenhuma etapa de build. O projeto abre e roda.

---

## Documentação

Arquitetura, funcionamento do servidor e do cliente, referência da API, regras de negócio e execução estão em **[src/DOCUMENTACAO.md](src/DOCUMENTACAO.md)**.
