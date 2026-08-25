/* SimpStock - Funções comuns a todas as páginas
   Sessão do usuário, chamadas à API, notificações, modal de
   confirmação, menu responsivo e montagem da navegação. */

(function (global) {
    'use strict';

    // Endereço da API
    var PORTA_API = '5000';
    var API_LOCAL = 'http://127.0.0.1:' + PORTA_API;
    var HOSTS_LOCAIS = ['localhost', '127.0.0.1'];

    // O mesmo servidor entrega as páginas e a API, então o padrão é usar a
    // própria origem. Os casos abaixo cobrem quando os dois estão separados.
    function descobrirApi() {
        // Endereço informado manualmente antes deste script
        if (global.SIMPSTOCK_API) return global.SIMPSTOCK_API;

        // Página aberta direto do disco, sem servidor entregando o site
        if (global.location.protocol === 'file:') return API_LOCAL;

        // Site servido por outro processo local, com a API rodando ao lado
        if (HOSTS_LOCAIS.indexOf(global.location.hostname) !== -1 &&
            global.location.port !== PORTA_API) {
            return API_LOCAL;
        }

        return '';
    }

    var API_URL = descobrirApi();

    // Sessão do usuário
    var CHAVE_TOKEN = 'simpstock_token';
    var CHAVE_NOME = 'simpstock_usuario';
    var CHAVE_ADMIN = 'simpstock_admin';

    var sessao = {
        salvar: function (dados) {
            localStorage.setItem(CHAVE_TOKEN, dados.token);
            localStorage.setItem(CHAVE_NOME, dados.usuario || '');
            localStorage.setItem(CHAVE_ADMIN, dados.is_admin ? 'true' : 'false');
        },
        token: function () {
            return localStorage.getItem(CHAVE_TOKEN);
        },
        nome: function () {
            return localStorage.getItem(CHAVE_NOME) || 'Usuário';
        },
        ehAdmin: function () {
            return localStorage.getItem(CHAVE_ADMIN) === 'true';
        },
        logado: function () {
            return !!localStorage.getItem(CHAVE_TOKEN);
        },
        limpar: function () {
            [CHAVE_TOKEN, CHAVE_NOME, CHAVE_ADMIN,
             // chaves usadas por versões anteriores do sistema
             'usuarioLogado', 'isAdmin', 'produtos', 'produtoEdicao', 'produtoEdicaoIndex'
            ].forEach(function (chave) { localStorage.removeItem(chave); });
        }
    };

    // Sessões antigas não possuem token e não são aceitas pela API
    if (!sessao.token() && localStorage.getItem('usuarioLogado')) {
        sessao.limpar();
    }

    // Funções auxiliares

    // Escapa o texto antes de inserir no HTML, para impedir injeção de código
    function escapar(valor) {
        if (valor === null || valor === undefined) return '';
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Monta o caminho de uma página, funcionando a partir da raiz ou de /src
    function url(arquivo) {
        var raiz = document.body.getAttribute('data-raiz') || '.';
        return arquivo === 'index.html'
            ? raiz + '/index.html'
            : raiz + '/src/' + arquivo;
    }

    // Liga ou desliga o estado de carregamento de um botão
    function carregando(botao, ligado, textoOcupado) {
        if (!botao) return;
        if (ligado) {
            botao.dataset.textoOriginal = botao.dataset.textoOriginal || botao.textContent;
            botao.setAttribute('aria-busy', 'true');
            botao.disabled = true;
            if (textoOcupado) botao.textContent = textoOcupado;
        } else {
            botao.removeAttribute('aria-busy');
            botao.disabled = false;
            if (botao.dataset.textoOriginal) botao.textContent = botao.dataset.textoOriginal;
        }
    }

    // Notificações
    var ICONES = {
        sucesso: '&#10003;',
        erro: '&#10005;',
        alerta: '&#9888;',
        info: '&#8505;'
    };

    function pilhaAvisos() {
        var pilha = document.querySelector('.pilha-avisos');
        if (!pilha) {
            pilha = document.createElement('div');
            pilha.className = 'pilha-avisos';
            pilha.setAttribute('role', 'status');
            pilha.setAttribute('aria-live', 'polite');
            document.body.appendChild(pilha);
        }
        return pilha;
    }

    function aviso(mensagem, tipo, duracao) {
        tipo = tipo || 'info';
        var caixa = document.createElement('div');
        caixa.className = 'aviso aviso--' + tipo;
        caixa.innerHTML =
            '<span class="aviso__icone" aria-hidden="true">' + (ICONES[tipo] || ICONES.info) + '</span>' +
            '<span class="aviso__texto">' + escapar(mensagem) + '</span>' +
            '<button class="aviso__fechar" type="button" aria-label="Fechar aviso">&times;</button>';

        function remover() {
            caixa.classList.add('saindo');
            setTimeout(function () { caixa.remove(); }, 200);
        }

        caixa.querySelector('.aviso__fechar').addEventListener('click', remover);
        pilhaAvisos().appendChild(caixa);
        setTimeout(remover, duracao || (tipo === 'erro' ? 6000 : 4000));
        return caixa;
    }

    // Modal de confirmação

    // Retorna uma Promise que resolve para true quando o usuário confirma
    function confirmar(opcoes) {
        opcoes = opcoes || {};
        return new Promise(function (resolver) {
            var perigo = opcoes.perigo !== false;
            var fundo = document.createElement('div');
            fundo.className = 'fundo-modal';
            fundo.innerHTML =
                '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">' +
                    '<div class="modal__icone' + (perigo ? '' : ' modal__icone--info') + '" aria-hidden="true">' +
                        (perigo ? '&#9888;' : '&#8505;') +
                    '</div>' +
                    '<h2 class="modal__titulo" id="modal-titulo">' + escapar(opcoes.titulo || 'Confirmar ação') + '</h2>' +
                    '<p class="modal__texto">' + escapar(opcoes.texto || 'Deseja continuar?') + '</p>' +
                    '<div class="modal__acoes">' +
                        '<button type="button" class="btn btn--secundario" data-acao="cancelar">' +
                            escapar(opcoes.cancelar || 'Cancelar') + '</button>' +
                        '<button type="button" class="btn ' + (perigo ? 'btn--perigo' : 'btn--primario') + '" data-acao="confirmar">' +
                            escapar(opcoes.confirmar || 'Confirmar') + '</button>' +
                    '</div>' +
                '</div>';

            var focoAnterior = document.activeElement;

            function fechar(resposta) {
                document.removeEventListener('keydown', aoTeclar);
                fundo.remove();
                if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
                resolver(resposta);
            }

            function aoTeclar(e) {
                if (e.key === 'Escape') fechar(false);
            }

            fundo.querySelector('[data-acao="cancelar"]').addEventListener('click', function () { fechar(false); });
            fundo.querySelector('[data-acao="confirmar"]').addEventListener('click', function () { fechar(true); });
            fundo.addEventListener('click', function (e) { if (e.target === fundo) fechar(false); });
            document.addEventListener('keydown', aoTeclar);

            document.body.appendChild(fundo);
            fundo.querySelector('[data-acao="confirmar"]').focus();
        });
    }

    // Chamadas à API

    // Envia a requisição com o token da sessão e converte falhas em Error,
    // já com a mensagem pronta para exibir ao usuário
    function api(caminho, opcoes) {
        opcoes = opcoes || {};
        var cabecalhos = Object.assign({}, opcoes.headers);
        if (opcoes.body) cabecalhos['Content-Type'] = 'application/json';
        var token = sessao.token();
        if (token) cabecalhos['Authorization'] = 'Bearer ' + token;

        return fetch(API_URL + caminho, {
            method: opcoes.method || 'GET',
            headers: cabecalhos,
            body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
        }).then(function (resposta) {
            return resposta.json().catch(function () { return {}; })
                .then(function (dados) {
                    if (resposta.status === 401 && sessao.logado()) {
                        sessao.limpar();
                        aviso('Sua sessão expirou. Faça login novamente.', 'alerta');
                        setTimeout(function () { global.location.href = url('Login.html'); }, 1200);
                    }
                    if (!resposta.ok) {
                        var erro = new Error(dados.message || 'Não foi possível concluir a operação.');
                        erro.status = resposta.status;
                        erro.dados = dados;
                        throw erro;
                    }
                    return dados;
                });
        }, function () {
            // O servidor não respondeu: informa o endereço tentado
            var onde = API_URL || global.location.origin;
            var erro = new Error(
                'Não foi possível falar com o servidor em ' + onde +
                '. Verifique se ele está no ar e tente novamente.'
            );
            erro.offline = true;
            throw erro;
        });
    }

    function sair() {
        confirmar({
            titulo: 'Sair da conta',
            texto: 'Você precisará fazer login novamente para acessar o estoque.',
            confirmar: 'Sair',
            perigo: false
        }).then(function (ok) {
            if (!ok) return;
            sessao.limpar();
            global.location.href = url('Login.html');
        });
    }

    // Navegação
    var MENU_SITE = [
        { texto: 'Início', arquivo: 'index.html', pagina: 'inicio' },
        { texto: 'Sobre nós', arquivo: 'Sobre_nós.html', pagina: 'sobre' },
        { texto: 'Ajuda', arquivo: 'Ajuda.html', pagina: 'ajuda' }
    ];

    var MENU_SISTEMA = [
        { texto: 'Painel', arquivo: 'Tela_inicial.html', pagina: 'painel' },
        { texto: 'Estoque', arquivo: 'tabela_principal.html', pagina: 'produtos' },
        { texto: 'Cadastrar', arquivo: 'Cadastro_de_produtos.html', pagina: 'cadastro' },
        { texto: 'Admin', arquivo: 'Admin.html', pagina: 'admin', somenteAdmin: true },
        { texto: 'Ajuda', arquivo: 'Ajuda.html', pagina: 'ajuda' },
        { texto: 'Sair', acao: 'sair', destaque: true }
    ];

    function montarNavegacao() {
        var lista = document.querySelector('.nav-menu');
        if (!lista || lista.dataset.manual === 'true') return;

        var area = document.body.getAttribute('data-area') || 'site';
        var paginaAtual = document.body.getAttribute('data-pagina') || '';
        var itens = (area === 'sistema' ? MENU_SISTEMA : MENU_SITE).slice();

        // No site público o último item depende de o usuário estar logado
        if (area === 'site') {
            itens.push(sessao.logado()
                ? { texto: 'Meu painel', arquivo: 'Tela_inicial.html', pagina: 'painel', destaque: true }
                : { texto: 'Entrar', arquivo: 'Login.html', pagina: 'login', destaque: true });
        }

        lista.innerHTML = '';
        itens.forEach(function (item) {
            if (item.somenteAdmin && !sessao.ehAdmin()) return;

            var li = document.createElement('li');
            li.className = 'nav-item';
            var a = document.createElement('a');
            a.textContent = item.texto;
            if (item.destaque) a.className = 'nav-destaque';

            if (item.acao === 'sair') {
                a.href = '#';
                a.addEventListener('click', function (e) { e.preventDefault(); sair(); });
            } else {
                a.href = url(item.arquivo);
                if (item.pagina === paginaAtual) a.setAttribute('aria-current', 'page');
            }

            li.appendChild(a);
            lista.appendChild(li);
        });
    }

    function configurarMenuMobile() {
        var botao = document.querySelector('.nav-toggle');
        var lista = document.querySelector('.nav-menu');
        if (!botao || !lista) return;

        botao.addEventListener('click', function () {
            var aberto = lista.classList.toggle('aberto');
            botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        });

        // Fecha o menu ao clicar fora dele
        document.addEventListener('click', function (e) {
            if (!lista.classList.contains('aberto')) return;
            if (botao.contains(e.target) || lista.contains(e.target)) return;
            lista.classList.remove('aberto');
            botao.setAttribute('aria-expanded', 'false');
        });
    }

    function mostrarUsuarioNoTopo() {
        var caixa = document.querySelector('.usuario-atual');
        if (!caixa || !sessao.logado()) return;
        var nome = sessao.nome();
        caixa.innerHTML =
            '<span class="avatar" aria-hidden="true">' + escapar(nome.trim().charAt(0).toUpperCase()) + '</span>' +
            '<span>' + escapar(nome) + '</span>' +
            (sessao.ehAdmin() ? '<span class="etiqueta etiqueta--neutro">ADMIN</span>' : '');
        caixa.classList.add('visivel');
    }

    function preencherAnoRodape() {
        document.querySelectorAll('[data-ano]').forEach(function (el) {
            el.textContent = new Date().getFullYear();
        });
    }

    // Redireciona para o login quem tentar abrir uma página do sistema sem sessão
    function exigirLogin() {
        if (document.body.getAttribute('data-area') !== 'sistema') return true;
        if (sessao.logado()) return true;
        global.location.replace(url('Login.html') + '?motivo=sessao');
        return false;
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!exigirLogin()) return;
        montarNavegacao();
        configurarMenuMobile();
        mostrarUsuarioNoTopo();
        preencherAnoRodape();
    });

    global.SimpStock = {
        API_URL: API_URL,
        api: api,
        sessao: sessao,
        sair: sair,
        url: url,
        escapar: escapar,
        carregando: carregando,
        aviso: aviso,
        sucesso: function (m, d) { return aviso(m, 'sucesso', d); },
        erro: function (m, d) { return aviso(m, 'erro', d); },
        alerta: function (m, d) { return aviso(m, 'alerta', d); },
        info: function (m, d) { return aviso(m, 'info', d); },
        confirmar: confirmar
    };
})(window);
