/* SimpStock - Páginas públicas
   Carrossel de clientes e animação de entrada das seções.
   Requer o comum.js, carregado antes deste arquivo. */

(function () {
    'use strict';

    // Carrossel de clientes
    // Desloca a faixa inteira de logos e calcula quantos cabem
    // na tela a partir do layout, para funcionar em qualquer largura
    function iniciarCarrossel() {
        var carrossel = document.querySelector('.carousel');
        if (!carrossel) return;

        var faixa = carrossel.querySelector('.carousel-images');
        var slides = faixa ? Array.prototype.slice.call(faixa.children) : [];
        var anterior = carrossel.querySelector('.prev');
        var proximo = carrossel.querySelector('.next');
        if (!faixa || slides.length === 0) return;

        var pagina = 0;
        var autoPlay = null;

        function porPagina() {
            var largura = slides[0].getBoundingClientRect().width;
            if (!largura) return 1;
            var estilo = getComputedStyle(faixa);
            var espaco = parseFloat(estilo.gap || estilo.columnGap || 0) || 0;
            var cabem = Math.floor((carrossel.clientWidth + espaco) / (largura + espaco));
            return Math.max(1, Math.min(cabem, slides.length));
        }

        function totalPaginas() {
            return Math.max(1, Math.ceil(slides.length / porPagina()));
        }

        function ir(destino) {
            var total = totalPaginas();
            // O resto duplo mantém o índice dentro do intervalo,
            // fazendo a navegação voltar ao começo depois da última página
            pagina = (destino % total + total) % total;

            var visiveis = porPagina();
            var indice = Math.min(pagina * visiveis, slides.length - visiveis);
            var deslocamento = slides[Math.max(0, indice)].offsetLeft - slides[0].offsetLeft;
            faixa.style.transform = 'translateX(' + -deslocamento + 'px)';

            atualizarPontos();
        }

        function atualizarPontos() {
            var pontos = carrossel.querySelector('.carousel-pontos');
            if (!pontos) return;
            var total = totalPaginas();
            if (pontos.children.length !== total) {
                pontos.innerHTML = '';
                for (var i = 0; i < total; i++) {
                    var b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'carousel-ponto';
                    b.setAttribute('aria-label', 'Ir para o grupo ' + (i + 1));
                    b.addEventListener('click', (function (alvo) {
                        return function () { ir(alvo); reiniciarAutoPlay(); };
                    })(i));
                    pontos.appendChild(b);
                }
            }
            Array.prototype.forEach.call(pontos.children, function (b, i) {
                b.classList.toggle('ativo', i === pagina);
                b.setAttribute('aria-current', i === pagina ? 'true' : 'false');
            });
        }

        function reiniciarAutoPlay() {
            if (autoPlay) clearInterval(autoPlay);
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            autoPlay = setInterval(function () { ir(pagina + 1); }, 5000);
        }

        if (anterior) anterior.addEventListener('click', function () { ir(pagina - 1); reiniciarAutoPlay(); });
        if (proximo) proximo.addEventListener('click', function () { ir(pagina + 1); reiniciarAutoPlay(); });

        carrossel.addEventListener('mouseenter', function () { if (autoPlay) clearInterval(autoPlay); });
        carrossel.addEventListener('mouseleave', reiniciarAutoPlay);

        carrossel.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') { ir(pagina - 1); reiniciarAutoPlay(); }
            if (e.key === 'ArrowRight') { ir(pagina + 1); reiniciarAutoPlay(); }
        });

        // Arrastar o carrossel com o dedo no celular
        var toqueInicial = null;
        carrossel.addEventListener('touchstart', function (e) {
            toqueInicial = e.touches[0].clientX;
        }, { passive: true });
        carrossel.addEventListener('touchend', function (e) {
            if (toqueInicial === null) return;
            var distancia = e.changedTouches[0].clientX - toqueInicial;
            if (Math.abs(distancia) > 45) ir(pagina + (distancia < 0 ? 1 : -1));
            toqueInicial = null;
            reiniciarAutoPlay();
        });

        var redimensionando;
        window.addEventListener('resize', function () {
            clearTimeout(redimensionando);
            redimensionando = setTimeout(function () { ir(pagina); }, 150);
        });

        // As imagens terminam de carregar depois do DOM e mudam as medidas,
        // então a posição é recalculada quando a página termina de carregar
        window.addEventListener('load', function () { ir(pagina); });

        ir(0);
        reiniciarAutoPlay();
    }

    // Animação de entrada das seções conforme a rolagem
    function iniciarRevelacao() {
        var alvos = document.querySelectorAll('[data-revelar]');
        if (alvos.length === 0) return;

        if (!('IntersectionObserver' in window) ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            alvos.forEach(function (el) { el.classList.add('revelado'); });
            return;
        }

        var observador = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (entrada) {
                if (!entrada.isIntersecting) return;
                entrada.target.classList.add('revelado');
                observador.unobserve(entrada.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        alvos.forEach(function (el) { observador.observe(el); });
    }

    document.addEventListener('DOMContentLoaded', function () {
        iniciarCarrossel();
        iniciarRevelacao();
    });
})();
