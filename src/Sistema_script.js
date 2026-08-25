/* SimpStock - Telas do sistema
   Login, cadastro de conta, painel, estoque e administração.
   Requer o comum.js, carregado antes deste arquivo. */

(function () {
    'use strict';

    var S = window.SimpStock;

    // Limites usados nos alertas da tabela e do painel
    var LIMITE_ESTOQUE_BAIXO = 10;   // abaixo disso o item conta como estoque baixo
    var DIAS_ALERTA_VALIDADE = 30;   // validade dentro deste prazo é sinalizada

    var CHAVE_EDICAO = 'simpstock_produto_edicao';

    // Situação do produto, usada nas etiquetas e no painel
    function diasAteValidade(validade) {
        if (!validade) return null;
        var data = new Date(validade + 'T00:00:00');
        if (isNaN(data)) return null;
        var hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return Math.round((data - hoje) / 86400000);
    }

    function situacaoEstoque(quantidade) {
        var qtd = Number(quantidade);
        if (!isFinite(qtd)) return { tipo: 'neutro', texto: String(quantidade) };
        if (qtd <= 0) return { tipo: 'critico', texto: 'Sem estoque', ordem: 0 };
        if (qtd < LIMITE_ESTOQUE_BAIXO) return { tipo: 'atencao', texto: qtd + ' un. (baixo)', ordem: 1 };
        return { tipo: 'ok', texto: qtd + ' un.', ordem: 2 };
    }

    function situacaoValidade(validade) {
        var dias = diasAteValidade(validade);
        if (dias === null) return { tipo: null, texto: '—' };
        var formatada = new Date(validade + 'T00:00:00').toLocaleDateString('pt-BR');
        if (dias < 0) return { tipo: 'critico', texto: formatada, rotulo: 'Vencido' };
        if (dias === 0) return { tipo: 'critico', texto: formatada, rotulo: 'Vence hoje' };
        if (dias <= DIAS_ALERTA_VALIDADE) return { tipo: 'atencao', texto: formatada, rotulo: dias + ' dias' };
        return { tipo: 'ok', texto: formatada };
    }

    // Login e criação de conta
    function mostrarErroCampo(campoId, mensagem) {
        var campo = document.getElementById(campoId);
        if (!campo) return;
        var alvo = campo.closest('.password-container') || campo;
        var erro = alvo.parentElement.querySelector('.erro-campo[data-de="' + campoId + '"]');
        if (!erro) {
            erro = document.createElement('span');
            erro.className = 'erro-campo';
            erro.setAttribute('data-de', campoId);
            erro.setAttribute('role', 'alert');
            alvo.insertAdjacentElement('afterend', erro);
        }
        erro.textContent = mensagem || '';
        campo.classList.toggle('campo-invalido', !!mensagem);
        campo.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
        if (!mensagem) erro.remove();
    }

    function limparErros(form) {
        form.querySelectorAll('.erro-campo').forEach(function (e) { e.remove(); });
        form.querySelectorAll('.campo-invalido').forEach(function (c) {
            c.classList.remove('campo-invalido');
            c.removeAttribute('aria-invalid');
        });
    }

    var REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var REGEX_SENHA = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;

    function configurarLogin() {
        var form = document.getElementById('formLogin');

        // Explica o motivo quando o usuário foi redirecionado por falta de sessão
        if (new URLSearchParams(window.location.search).get('motivo') === 'sessao') {
            S.alerta('Faça login para acessar o sistema.');
        }

        // Botão que preenche e envia o login do administrador padrão
        var btnDemo = document.getElementById('preencherAdmin');
        if (btnDemo) {
            btnDemo.addEventListener('click', function () {
                document.getElementById('emailLogin').value = 'admin@simpstock.com';
                document.getElementById('senhaLogin').value = 'admin123';
                limparErros(form);
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            limparErros(form);

            var email = document.getElementById('emailLogin').value.trim();
            var senha = document.getElementById('senhaLogin').value;
            var valido = true;

            if (!REGEX_EMAIL.test(email)) {
                mostrarErroCampo('emailLogin', 'Informe um e-mail válido.');
                valido = false;
            }
            if (!senha) {
                mostrarErroCampo('senhaLogin', 'Informe a sua senha.');
                valido = false;
            }
            if (!valido) return;

            var botao = form.querySelector('button[type="submit"]');
            S.carregando(botao, true, 'Entrando...');

            S.api('/login', { method: 'POST', body: { email: email, senha: senha } })
                .then(function (dados) {
                    S.sessao.salvar(dados);
                    S.sucesso('Bem-vindo(a), ' + dados.usuario + '!');
                    setTimeout(function () {
                        window.location.href = 'Tela_inicial.html';
                    }, 500);
                })
                .catch(function (erro) {
                    S.carregando(botao, false);
                    S.erro(erro.message);
                    mostrarErroCampo('senhaLogin', 'Verifique o e-mail e a senha.');
                });
        });
    }

    function configurarCadastro() {
        var form = document.getElementById('formCadastro');
        var campoSenha = document.getElementById('senhaCadastro');
        var medidor = document.getElementById('forcaSenha');

        // Mostra o resultado de cada regra da senha enquanto o usuário digita
        if (campoSenha && medidor) {
            campoSenha.addEventListener('input', function () {
                var senha = campoSenha.value;
                var regras = [
                    { ok: senha.length >= 6, texto: 'mínimo 6 caracteres' },
                    { ok: /[A-Za-z]/.test(senha), texto: 'ao menos uma letra' },
                    { ok: /\d/.test(senha), texto: 'ao menos um número' },
                    { ok: !/[^A-Za-z\d]/.test(senha) || senha === '', texto: 'sem caracteres especiais' }
                ];
                medidor.innerHTML = regras.map(function (r) {
                    return '<li class="' + (r.ok ? 'regra-ok' : 'regra-pendente') + '">' +
                        (r.ok ? '&#10003; ' : '&#8226; ') + r.texto + '</li>';
                }).join('');
            });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            limparErros(form);

            var nome = document.getElementById('nomeCadastro').value.trim();
            var email = document.getElementById('emailCadastro').value.trim();
            var senha = document.getElementById('senhaCadastro').value;
            var valido = true;

            if (nome.length < 2) {
                mostrarErroCampo('nomeCadastro', 'Informe o seu nome.');
                valido = false;
            }
            if (!REGEX_EMAIL.test(email)) {
                mostrarErroCampo('emailCadastro', 'Informe um e-mail válido.');
                valido = false;
            }
            if (!REGEX_SENHA.test(senha)) {
                mostrarErroCampo('senhaCadastro', 'Mínimo 6 caracteres, com letras e números, sem símbolos.');
                valido = false;
            }
            if (!valido) return;

            var botao = form.querySelector('button[type="submit"]');
            S.carregando(botao, true, 'Criando conta...');

            S.api('/register', { method: 'POST', body: { nome: nome, email: email, senha: senha } })
                .then(function () {
                    S.carregando(botao, false);
                    S.sucesso('Conta criada! Agora é só entrar.');
                    form.reset();
                    if (medidor) medidor.innerHTML = '';
                    var btnLogin = document.getElementById('login');
                    if (btnLogin) btnLogin.click();
                    var campoEmail = document.getElementById('emailLogin');
                    if (campoEmail) campoEmail.value = email;
                })
                .catch(function (erro) {
                    S.carregando(botao, false);
                    S.erro(erro.message);
                    if (/e-mail/i.test(erro.message)) mostrarErroCampo('emailCadastro', erro.message);
                    if (/senha/i.test(erro.message)) mostrarErroCampo('senhaCadastro', erro.message);
                });
        });
    }

    function configurarOlhoSenha(iconId, inputId) {
        var icone = document.getElementById(iconId);
        var campo = document.getElementById(inputId);
        if (!icone || !campo) return;
        icone.setAttribute('role', 'button');
        icone.setAttribute('tabindex', '0');
        icone.setAttribute('aria-label', 'Mostrar senha');

        function alternar() {
            var mostrando = campo.getAttribute('type') === 'text';
            campo.setAttribute('type', mostrando ? 'password' : 'text');
            icone.classList.toggle('fa-eye');
            icone.classList.toggle('fa-eye-slash');
            icone.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
        }

        icone.addEventListener('click', alternar);
        icone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); }
        });
    }

    function configurarPainelAnimado() {
        var container = document.getElementById('container');
        var btnRegistrar = document.getElementById('register');
        var btnEntrar = document.getElementById('login');
        if (!container) return;
        if (btnRegistrar) btnRegistrar.addEventListener('click', function () { container.classList.add('active'); });
        if (btnEntrar) btnEntrar.addEventListener('click', function () { container.classList.remove('active'); });
    }

    // Painel inicial: resumo do estoque
    function iniciarPainel() {
        var saudacao = document.getElementById('saudacao');
        if (saudacao) saudacao.textContent = 'Olá, ' + S.sessao.nome() + '!';

        var resumo = document.getElementById('resumoEstoque');
        if (!resumo) return;

        S.api('/produtos')
            .then(function (produtos) {
                var semEstoque = produtos.filter(function (p) { return Number(p.quantidade) <= 0; }).length;
                var baixo = produtos.filter(function (p) {
                    var q = Number(p.quantidade);
                    return q > 0 && q < LIMITE_ESTOQUE_BAIXO;
                }).length;
                var vencendo = produtos.filter(function (p) {
                    var d = diasAteValidade(p.validade);
                    return d !== null && d <= DIAS_ALERTA_VALIDADE;
                }).length;

                var cartoes = [
                    { rotulo: 'Produtos cadastrados', valor: produtos.length, tipo: 'neutro' },
                    { rotulo: 'Sem estoque', valor: semEstoque, tipo: semEstoque ? 'critico' : 'ok' },
                    { rotulo: 'Estoque baixo', valor: baixo, tipo: baixo ? 'atencao' : 'ok' },
                    // A contagem inclui os itens já vencidos
                    { rotulo: 'Vencidos ou vencendo em ' + DIAS_ALERTA_VALIDADE + ' dias', valor: vencendo, tipo: vencendo ? 'atencao' : 'ok' }
                ];

                resumo.innerHTML = cartoes.map(function (c) {
                    return '<div class="cartao-resumo cartao-resumo--' + c.tipo + '">' +
                        '<span class="cartao-resumo__valor">' + c.valor + '</span>' +
                        '<span class="cartao-resumo__rotulo">' + S.escapar(c.rotulo) + '</span>' +
                        '</div>';
                }).join('');
            })
            .catch(function (erro) {
                resumo.innerHTML = '<p class="aviso-inline aviso-inline--erro">' + S.escapar(erro.message) + '</p>';
            });
    }

    // Cadastro e edição de produto
    function iniciarPaginaCadastro() {
        var form = document.getElementById('productForm');
        var titulo = document.getElementById('tituloFormulario');
        var botao = form.querySelector('button[type="submit"]');
        var idEdicao = localStorage.getItem(CHAVE_EDICAO);

        if (idEdicao) {
            localStorage.removeItem(CHAVE_EDICAO);
            S.carregando(botao, true, 'Carregando produto...');
            S.api('/produtos')
                .then(function (produtos) {
                    var produto = produtos.find(function (p) { return String(p.id) === String(idEdicao); });
                    S.carregando(botao, false);
                    if (!produto) {
                        S.alerta('Produto não encontrado. O formulário abriu em branco.');
                        return;
                    }
                    ['nome', 'marca', 'validade', 'codigo', 'quantidade', 'referencia', 'endereco'].forEach(function (campo) {
                        var input = document.getElementById(campo);
                        if (input) input.value = produto[campo] || '';
                    });
                    form.dataset.id = idEdicao;
                    botao.textContent = 'Salvar alterações';
                    botao.dataset.textoOriginal = 'Salvar alterações';
                    if (titulo) titulo.textContent = 'Editar produto';
                    document.title = 'Editar produto - SimpStock';
                })
                .catch(function (erro) {
                    S.carregando(botao, false);
                    S.erro(erro.message);
                });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            limparErros(form);

            var produto = {
                nome: document.getElementById('nome').value.trim(),
                marca: document.getElementById('marca').value.trim(),
                validade: document.getElementById('validade').value,
                codigo: document.getElementById('codigo').value.trim(),
                quantidade: document.getElementById('quantidade').value,
                referencia: document.getElementById('referencia').value.trim(),
                endereco: document.getElementById('endereco').value.trim()
            };

            var valido = true;
            [['nome', 'Informe o nome do produto.'],
             ['marca', 'Informe a marca.'],
             ['codigo', 'Informe o código (SKU).'],
             ['referencia', 'Informe a referência.']].forEach(function (par) {
                if (!produto[par[0]]) { mostrarErroCampo(par[0], par[1]); valido = false; }
            });
            if (produto.quantidade === '' || isNaN(Number(produto.quantidade))) {
                mostrarErroCampo('quantidade', 'Informe a quantidade em números.');
                valido = false;
            } else if (Number(produto.quantidade) < 0) {
                mostrarErroCampo('quantidade', 'A quantidade não pode ser negativa.');
                valido = false;
            }
            if (!valido) {
                S.alerta('Revise os campos destacados.');
                form.querySelector('.campo-invalido').focus();
                return;
            }

            var editando = !!form.dataset.id;
            S.carregando(botao, true, 'Salvando...');

            S.api(editando ? '/produtos/' + form.dataset.id : '/produtos', {
                method: editando ? 'PUT' : 'POST',
                body: produto
            })
                .then(function () {
                    S.sucesso(editando ? 'Produto atualizado!' : 'Produto cadastrado!');
                    setTimeout(function () { window.location.href = 'tabela_principal.html'; }, 600);
                })
                .catch(function (erro) {
                    S.carregando(botao, false);
                    S.erro(erro.message);
                });
        });
    }

    // Tabela de produtos: busca, filtros, ordenação e exclusão
    var COLUNAS = [
        { chave: 'nome', rotulo: 'Nome' },
        { chave: 'marca', rotulo: 'Marca' },
        { chave: 'validade', rotulo: 'Validade' },
        { chave: 'codigo', rotulo: 'Código' },
        { chave: 'quantidade', rotulo: 'Quantidade', numerica: true },
        { chave: 'referencia', rotulo: 'Referência' },
        { chave: 'endereco', rotulo: 'Endereço' }
    ];

    function iniciarPaginaTabela() {
        var tabela = document.getElementById('productTable');
        var corpo = tabela.querySelector('tbody');
        var campoBusca = document.getElementById('buscaProduto');
        var filtroSituacao = document.getElementById('filtroSituacao');
        var contador = document.getElementById('contadorProdutos');
        var btnExcluir = document.getElementById('excluirSelecionadosBtn');

        var produtos = [];
        var ordenacao = { chave: 'nome', crescente: true };

        function esqueleto() {
            var linhas = '';
            for (var i = 0; i < 4; i++) {
                linhas += '<tr>' + '<td><div class="esqueleto"></div></td>'.repeat(9) + '</tr>';
            }
            corpo.innerHTML = linhas;
        }

        function mensagemNaTabela(icone, titulo, texto) {
            corpo.innerHTML = '<tr><td colspan="9">' +
                '<div class="estado-vazio">' +
                    '<div class="estado-vazio__icone" aria-hidden="true">' + icone + '</div>' +
                    '<p class="estado-vazio__titulo">' + S.escapar(titulo) + '</p>' +
                    '<p>' + S.escapar(texto) + '</p>' +
                '</div></td></tr>';
        }

        function produtosVisiveis() {
            var termo = (campoBusca ? campoBusca.value : '').trim().toLowerCase();
            var situacao = filtroSituacao ? filtroSituacao.value : 'todos';

            var lista = produtos.filter(function (p) {
                if (termo) {
                    var alvo = [p.nome, p.marca, p.codigo, p.referencia, p.endereco]
                        .join(' ').toLowerCase();
                    if (alvo.indexOf(termo) === -1) return false;
                }
                var qtd = Number(p.quantidade);
                var dias = diasAteValidade(p.validade);
                if (situacao === 'sem-estoque') return qtd <= 0;
                if (situacao === 'baixo') return qtd > 0 && qtd < LIMITE_ESTOQUE_BAIXO;
                if (situacao === 'vencendo') return dias !== null && dias >= 0 && dias <= DIAS_ALERTA_VALIDADE;
                if (situacao === 'vencido') return dias !== null && dias < 0;
                return true;
            });

            var coluna = COLUNAS.find(function (c) { return c.chave === ordenacao.chave; }) || COLUNAS[0];
            lista.sort(function (a, b) {
                var va = a[coluna.chave];
                var vb = b[coluna.chave];
                var resultado;
                if (coluna.numerica) {
                    resultado = (Number(va) || 0) - (Number(vb) || 0);
                } else {
                    resultado = String(va || '').localeCompare(String(vb || ''), 'pt-BR', { sensitivity: 'base' });
                }
                return ordenacao.crescente ? resultado : -resultado;
            });
            return lista;
        }

        function desenhar() {
            var lista = produtosVisiveis();

            if (contador) {
                contador.textContent = produtos.length === 0
                    ? ''
                    : 'Exibindo ' + lista.length + ' de ' + produtos.length + ' produto(s)';
            }

            if (produtos.length === 0) {
                mensagemNaTabela('&#128230;', 'Nenhum produto cadastrado ainda',
                    'Use o botão "Cadastrar produto" para adicionar o primeiro item ao estoque.');
                return;
            }
            if (lista.length === 0) {
                mensagemNaTabela('&#128269;', 'Nada encontrado',
                    'Nenhum produto corresponde à busca ou ao filtro selecionado.');
                return;
            }

            corpo.innerHTML = lista.map(function (p) {
                var estoque = situacaoEstoque(p.quantidade);
                var validade = situacaoValidade(p.validade);
                var celulaValidade = validade.tipo
                    ? S.escapar(validade.texto) + (validade.rotulo
                        ? ' <span class="etiqueta etiqueta--' + validade.tipo + '">' + S.escapar(validade.rotulo) + '</span>'
                        : '')
                    : '—';

                return '<tr>' +
                    '<td><input type="checkbox" class="select-product" data-id="' + p.id + '" ' +
                        'aria-label="Selecionar ' + S.escapar(p.nome) + '"></td>' +
                    '<td class="celula-nome">' + S.escapar(p.nome) + '</td>' +
                    '<td>' + S.escapar(p.marca) + '</td>' +
                    '<td>' + celulaValidade + '</td>' +
                    '<td>' + S.escapar(p.codigo) + '</td>' +
                    '<td><span class="etiqueta etiqueta--' + estoque.tipo + '">' + S.escapar(estoque.texto) + '</span></td>' +
                    '<td>' + S.escapar(p.referencia) + '</td>' +
                    '<td>' + (p.endereco ? S.escapar(p.endereco) : '—') + '</td>' +
                    '<td class="celula-acoes">' +
                        '<button class="btn btn--pequeno btn--secundario" data-editar="' + p.id + '">Editar</button> ' +
                        '<button class="btn btn--pequeno btn--perigo" data-excluir="' + p.id + '">Excluir</button>' +
                    '</td>' +
                '</tr>';
            }).join('');

            atualizarSelecao();
        }

        function atualizarSelecao() {
            var marcados = corpo.querySelectorAll('.select-product:checked').length;
            if (btnExcluir) {
                btnExcluir.style.display = marcados > 0 ? 'inline-flex' : 'none';
                btnExcluir.textContent = 'Excluir ' + marcados + ' selecionado(s)';
                btnExcluir.dataset.textoOriginal = btnExcluir.textContent;
            }
            var todos = document.getElementById('selecionarTodos');
            if (todos) {
                var total = corpo.querySelectorAll('.select-product').length;
                todos.checked = total > 0 && marcados === total;
                todos.indeterminate = marcados > 0 && marcados < total;
            }
        }

        function carregar() {
            esqueleto();
            return S.api('/produtos')
                .then(function (dados) {
                    produtos = dados;
                    desenhar();
                })
                .catch(function (erro) {
                    mensagemNaTabela('&#9888;', 'Não foi possível carregar o estoque', erro.message);
                    S.erro(erro.message);
                });
        }

        // Ordenação ao clicar no título da coluna
        tabela.querySelectorAll('th[data-ordenar]').forEach(function (th) {
            th.setAttribute('tabindex', '0');
            th.setAttribute('role', 'button');

            function ordenar() {
                var chave = th.getAttribute('data-ordenar');
                if (ordenacao.chave === chave) {
                    ordenacao.crescente = !ordenacao.crescente;
                } else {
                    ordenacao.chave = chave;
                    ordenacao.crescente = true;
                }
                tabela.querySelectorAll('th[data-ordenar]').forEach(function (outro) {
                    outro.removeAttribute('aria-sort');
                });
                th.setAttribute('aria-sort', ordenacao.crescente ? 'ascending' : 'descending');
                desenhar();
            }

            th.addEventListener('click', ordenar);
            th.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ordenar(); }
            });
        });

        // Campo de busca e filtro por situação
        if (campoBusca) {
            campoBusca.addEventListener('input', desenhar);
            var limpar = document.getElementById('limparBusca');
            if (limpar) {
                limpar.addEventListener('click', function () {
                    campoBusca.value = '';
                    if (filtroSituacao) filtroSituacao.value = 'todos';
                    desenhar();
                    campoBusca.focus();
                });
            }
        }
        if (filtroSituacao) filtroSituacao.addEventListener('change', desenhar);

        // Um listener no corpo da tabela atende todas as linhas,
        // inclusive as que forem criadas depois
        corpo.addEventListener('change', function (e) {
            if (e.target.classList.contains('select-product')) atualizarSelecao();
        });

        corpo.addEventListener('click', function (e) {
            var editar = e.target.closest('[data-editar]');
            if (editar) {
                localStorage.setItem(CHAVE_EDICAO, editar.getAttribute('data-editar'));
                window.location.href = 'Cadastro_de_produtos.html';
                return;
            }

            var excluir = e.target.closest('[data-excluir]');
            if (!excluir) return;
            var id = excluir.getAttribute('data-excluir');
            var produto = produtos.find(function (p) { return String(p.id) === String(id); });

            S.confirmar({
                titulo: 'Excluir produto',
                texto: 'O produto "' + (produto ? produto.nome : id) + '" será removido do estoque. Esta ação não pode ser desfeita.',
                confirmar: 'Excluir'
            }).then(function (ok) {
                if (!ok) return;
                S.carregando(excluir, true);
                S.api('/produtos/' + id, { method: 'DELETE' })
                    .then(function () {
                        S.sucesso('Produto excluído.');
                        return carregar();
                    })
                    .catch(function (erro) {
                        S.carregando(excluir, false);
                        S.erro(erro.message);
                    });
            });
        });

        var selecionarTodos = document.getElementById('selecionarTodos');
        if (selecionarTodos) {
            selecionarTodos.addEventListener('change', function () {
                corpo.querySelectorAll('.select-product').forEach(function (cb) {
                    cb.checked = selecionarTodos.checked;
                });
                atualizarSelecao();
            });
        }

        if (btnExcluir) {
            btnExcluir.addEventListener('click', function () {
                var marcados = Array.prototype.slice.call(corpo.querySelectorAll('.select-product:checked'));
                if (marcados.length === 0) return;

                S.confirmar({
                    titulo: 'Excluir ' + marcados.length + ' produto(s)',
                    texto: 'Os produtos selecionados serão removidos do estoque. Esta ação não pode ser desfeita.',
                    confirmar: 'Excluir tudo'
                }).then(function (ok) {
                    if (!ok) return;
                    S.carregando(btnExcluir, true, 'Excluindo...');
                    var pedidos = marcados.map(function (cb) {
                        return S.api('/produtos/' + cb.dataset.id, { method: 'DELETE' })
                            .then(function () { return true; })
                            .catch(function () { return false; });
                    });
                    Promise.all(pedidos).then(function (resultados) {
                        var falhas = resultados.filter(function (r) { return !r; }).length;
                        S.carregando(btnExcluir, false);
                        if (falhas) S.alerta(falhas + ' produto(s) não puderam ser excluídos.');
                        else S.sucesso(marcados.length + ' produto(s) excluído(s).');
                        carregar();
                    });
                });
            });
        }

        carregar();
    }

    // Painel administrativo: lista e remove usuários
    function iniciarPaginaAdmin() {
        var tabela = document.getElementById('tabelaUsuarios');
        var corpo = tabela.querySelector('tbody');

        function mensagem(icone, titulo, texto) {
            corpo.innerHTML = '<tr><td colspan="5">' +
                '<div class="estado-vazio">' +
                    '<div class="estado-vazio__icone" aria-hidden="true">' + icone + '</div>' +
                    '<p class="estado-vazio__titulo">' + S.escapar(titulo) + '</p>' +
                    '<p>' + S.escapar(texto) + '</p>' +
                '</div></td></tr>';
        }

        function carregar() {
            corpo.innerHTML = '<tr>' + '<td><div class="esqueleto"></div></td>'.repeat(5) + '</tr>';
            S.api('/usuarios')
                .then(function (usuarios) {
                    if (usuarios.length === 0) {
                        mensagem('&#128100;', 'Nenhum usuário', 'Ainda não há contas cadastradas.');
                        return;
                    }
                    corpo.innerHTML = usuarios.map(function (u) {
                        var protegido = u.id === 1;
                        return '<tr>' +
                            '<td>' + u.id + '</td>' +
                            '<td class="celula-nome">' + S.escapar(u.nome) + '</td>' +
                            '<td>' + S.escapar(u.email) + '</td>' +
                            '<td><span class="etiqueta etiqueta--' + (u.is_admin ? 'neutro' : 'ok') + '">' +
                                (u.is_admin ? 'Administrador' : 'Comum') + '</span></td>' +
                            '<td class="celula-acoes">' +
                                (protegido
                                    ? '<span class="texto-suave" title="O administrador principal não pode ser removido">Protegido</span>'
                                    : '<button class="btn btn--pequeno btn--perigo" data-remover="' + u.id +
                                      '" data-nome="' + S.escapar(u.nome) + '">Remover</button>') +
                            '</td>' +
                        '</tr>';
                    }).join('');
                })
                .catch(function (erro) {
                    mensagem('&#9888;', 'Não foi possível carregar os usuários', erro.message);
                    S.erro(erro.message);
                });
        }

        corpo.addEventListener('click', function (e) {
            var botao = e.target.closest('[data-remover]');
            if (!botao) return;
            var id = botao.getAttribute('data-remover');

            S.confirmar({
                titulo: 'Remover usuário',
                texto: 'A conta de ' + botao.getAttribute('data-nome') + ' será excluída permanentemente.',
                confirmar: 'Remover'
            }).then(function (ok) {
                if (!ok) return;
                S.carregando(botao, true);
                S.api('/usuarios/' + id, { method: 'DELETE' })
                    .then(function () {
                        S.sucesso('Usuário removido.');
                        carregar();
                    })
                    .catch(function (erro) {
                        S.carregando(botao, false);
                        S.erro(erro.message);
                    });
            });
        });

        carregar();
    }

    // Inicialização: cada página se identifica pelo atributo
    // data-pagina do <body> e recebe só a lógica que precisa
    document.addEventListener('DOMContentLoaded', function () {
        var pagina = document.body.getAttribute('data-pagina');

        // O comum.js já redireciona quem não tem sessão.
        // A checagem aqui evita executar a página durante o redirecionamento.
        if (document.body.getAttribute('data-area') === 'sistema' && !S.sessao.logado()) return;

        switch (pagina) {
            case 'login':
                configurarPainelAnimado();
                configurarOlhoSenha('toggleLogin', 'senhaLogin');
                configurarOlhoSenha('toggleCadastro', 'senhaCadastro');
                if (document.getElementById('formLogin')) configurarLogin();
                if (document.getElementById('formCadastro')) configurarCadastro();
                break;
            case 'painel':
                iniciarPainel();
                break;
            case 'cadastro':
                iniciarPaginaCadastro();
                break;
            case 'produtos':
                iniciarPaginaTabela();
                break;
            case 'admin':
                if (!S.sessao.ehAdmin()) {
                    S.erro('Acesso restrito a administradores.');
                    setTimeout(function () { window.location.href = 'Tela_inicial.html'; }, 1200);
                    return;
                }
                iniciarPaginaAdmin();
                break;
        }
    });
})();
