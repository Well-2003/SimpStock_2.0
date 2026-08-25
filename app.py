"""SimpStock - API de controle de estoque.

Servidor Flask que entrega o site e a API. Os dados ficam em arquivos JSON,
as senhas sao gravadas com hash e as rotas de dados exigem um token de sessao
enviado no cabecalho Authorization.
"""

import json
import os
import re
import secrets
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)

# Caminhos dos arquivos, sempre relativos a pasta deste script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARQUIVO_DB = os.path.join(BASE_DIR, 'banco.json')
ARQUIVO_USUARIOS = os.path.join(BASE_DIR, 'usuarios.json')
ARQUIVO_CHAVE = os.path.join(BASE_DIR, '.chave_secreta')

# Origens liberadas para consumir a API.
# Defina SIMPSTOCK_ORIGENS com os endereços separados por vírgula para restringir.
_origens = os.environ.get('SIMPSTOCK_ORIGENS', '*')
CORS(app, origins='*' if _origens == '*' else [o.strip() for o in _origens.split(',')])

def _carregar_chave_secreta():
    """Retorna a chave usada para assinar os tokens de sessão.

    Usa a variável de ambiente SIMPSTOCK_SECRET quando existe. Caso contrário,
    gera uma chave e salva em disco, para que os tokens continuem válidos
    depois que o servidor for reiniciado.
    """
    chave = os.environ.get('SIMPSTOCK_SECRET')
    if chave:
        return chave
    if os.path.exists(ARQUIVO_CHAVE):
        with open(ARQUIVO_CHAVE, 'r', encoding='utf-8') as f:
            guardada = f.read().strip()
            if guardada:
                return guardada
    nova = secrets.token_urlsafe(48)
    with open(ARQUIVO_CHAVE, 'w', encoding='utf-8') as f:
        f.write(nova)
    return nova

SECRET_KEY = _carregar_chave_secreta()
app.config['SECRET_KEY'] = SECRET_KEY
TOKEN_VALIDADE = 60 * 60 * 8  # 8 horas
assinador = URLSafeTimedSerializer(SECRET_KEY, salt='simpstock-sessao')

# Entrega das páginas do site
@app.route('/')
@app.route('/index.html')
def home():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/status')
def status():
    return "SIMPSTOCK ONLINE"

@app.route('/src/<path:arquivo>')
def arquivos_do_site(arquivo):
    return send_from_directory(os.path.join(BASE_DIR, 'src'), arquivo)

# Leitura e gravação dos arquivos JSON
def carregar_json(arquivo):
    if not os.path.exists(arquivo):
        return []
    try:
        with open(arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
        return dados if isinstance(dados, list) else []
    except (OSError, json.JSONDecodeError):
        return []

def salvar_json(arquivo, dados):
    # Escreve num arquivo temporário e só depois substitui o original.
    # Se a gravação falhar no meio, o arquivo antigo continua íntegro.
    temporario = arquivo + '.tmp'
    with open(temporario, 'w', encoding='utf-8') as f:
        json.dump(dados, f, indent=4, ensure_ascii=False)
    os.replace(temporario, arquivo)

def gerar_novo_id(lista):
    # Usa o maior id existente + 1 para não repetir id de item já cadastrado
    if not lista:
        return 1
    return max(item.get('id', 0) for item in lista) + 1

def senha_valida(senha):
    # Mínimo 6 caracteres, com pelo menos uma letra e um número, sem símbolos
    regra = r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$'
    return bool(senha) and re.match(regra, senha) is not None

def usuario_publico(user):
    """Monta o usuário sem a senha, para enviar ao cliente."""
    return {
        "id": user["id"],
        "nome": user["nome"],
        "email": user["email"],
        "is_admin": user.get("is_admin", False),
    }

# Autenticação
PREFIXOS_HASH = ('pbkdf2:', 'scrypt:', 'argon2')

# Conta de administrador padrão
ADMIN_EMAIL = 'admin@simpstock.com'
ADMIN_SENHA = 'admin123'
ADMIN_NOME = 'Administrador'

def garantir_admin(senha=None, forcar=False):
    """Garante que exista um administrador para acessar o sistema.

    Cria a conta padrão quando não há nenhum usuário cadastrado.
    Com forcar=True, redefine a senha do administrador principal.
    """
    usuarios = carregar_json(ARQUIVO_USUARIOS)
    senha = senha or ADMIN_SENHA

    admin = next((u for u in usuarios if u.get('id') == 1), None)

    if admin is None:
        admin = {
            "id": 1,
            "nome": ADMIN_NOME,
            "email": ADMIN_EMAIL,
            "senha": generate_password_hash(senha),
            "is_admin": True,
        }
        usuarios.insert(0, admin)
        salvar_json(ARQUIVO_USUARIOS, usuarios)
        return admin, 'criado'

    if forcar:
        admin['senha'] = generate_password_hash(senha)
        admin['is_admin'] = True
        salvar_json(ARQUIVO_USUARIOS, usuarios)
        return admin, 'atualizado'

    # Sem a marcação de admin ninguém conseguiria abrir o painel de usuários
    if not admin.get('is_admin'):
        admin['is_admin'] = True
        salvar_json(ARQUIVO_USUARIOS, usuarios)
        return admin, 'promovido'

    return admin, 'ok'

def migrar_senhas_para_hash():
    """Converte para hash as senhas que ainda estejam em texto puro.

    Roda no início do servidor. Quem já tinha conta continua entrando com a
    mesma senha, mas o arquivo deixa de guardá-la de forma legível.
    """
    usuarios = carregar_json(ARQUIVO_USUARIOS)
    alterou = False
    for user in usuarios:
        senha = user.get('senha', '')
        if senha and not senha.startswith(PREFIXOS_HASH):
            user['senha'] = generate_password_hash(senha)
            alterou = True
    if alterou:
        salvar_json(ARQUIVO_USUARIOS, usuarios)

def _usuario_do_token():
    """Retorna o usuário dono do token recebido, ou None se o token não valer."""
    cabecalho = request.headers.get('Authorization', '')
    if not cabecalho.startswith('Bearer '):
        return None
    try:
        dados = assinador.loads(cabecalho[7:], max_age=TOKEN_VALIDADE)
    except (BadSignature, SignatureExpired):
        return None
    usuarios = carregar_json(ARQUIVO_USUARIOS)
    return next((u for u in usuarios if u.get('id') == dados.get('id')), None)

def requer_login(f):
    """Bloqueia a rota para quem não enviar um token válido."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        usuario = _usuario_do_token()
        if usuario is None:
            return jsonify({"message": "Sessão inválida ou expirada. Faça login novamente."}), 401
        request.usuario = usuario
        return f(*args, **kwargs)
    return wrapper

def requer_admin(f):
    """Bloqueia a rota para quem não for administrador."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        usuario = _usuario_do_token()
        if usuario is None:
            return jsonify({"message": "Sessão inválida ou expirada. Faça login novamente."}), 401
        if not usuario.get('is_admin'):
            return jsonify({"message": "Acesso restrito a administradores."}), 403
        request.usuario = usuario
        return f(*args, **kwargs)
    return wrapper

# Validação dos produtos
CAMPOS_OBRIGATORIOS = ('nome', 'marca', 'codigo', 'quantidade', 'referencia')

def _vazio(valor):
    """Indica se o valor é None ou uma string em branco.

    A comparação é feita sem usar 'or' porque o número 0 é considerado falso
    em Python, e uma quantidade zerada é um valor válido para o estoque.
    """
    return valor is None or str(valor).strip() == ''

def validar_produto(data):
    """Retorna a lista de erros do produto. Lista vazia significa produto válido."""
    erros = []
    for campo in CAMPOS_OBRIGATORIOS:
        if _vazio(data.get(campo)):
            erros.append("O campo '" + campo + "' é obrigatório.")

    if not _vazio(data.get('quantidade')):
        try:
            if int(data['quantidade']) < 0:
                erros.append("A quantidade não pode ser negativa.")
        except (TypeError, ValueError):
            erros.append("A quantidade deve ser um número inteiro.")

    validade = str(data.get('validade') or '').strip()
    if validade:
        try:
            datetime.strptime(validade, '%Y-%m-%d')
        except ValueError:
            erros.append("A validade deve estar no formato AAAA-MM-DD.")
    return erros

def normalizar_produto(data):
    """Monta o produto com os campos esperados e nos tipos certos.

    Só copia os campos listados aqui, o que evita que a requisição grave
    campos extras ou altere o id do produto.
    """
    return {
        "nome": str(data.get('nome', '')).strip(),
        "marca": str(data.get('marca', '')).strip(),
        "validade": str(data.get('validade') or '').strip(),
        "codigo": str(data.get('codigo', '')).strip(),
        "quantidade": int(data.get('quantidade')),
        "referencia": str(data.get('referencia', '')).strip(),
        "endereco": str(data.get('endereco') or '').strip(),
    }

# Rotas de produtos
@app.route('/produtos', methods=['GET'])
@requer_login
def get_produtos():
    return jsonify(carregar_json(ARQUIVO_DB))

@app.route('/produtos', methods=['POST'])
@requer_login
def add_produto():
    data = request.get_json(silent=True) or {}
    erros = validar_produto(data)
    if erros:
        return jsonify({"message": erros[0], "erros": erros}), 400

    produtos = carregar_json(ARQUIVO_DB)
    novo_produto = {"id": gerar_novo_id(produtos)}
    novo_produto.update(normalizar_produto(data))
    produtos.append(novo_produto)
    salvar_json(ARQUIVO_DB, produtos)
    return jsonify({"message": "Produto cadastrado com sucesso!", "produto": novo_produto}), 201

@app.route('/produtos/<int:id_produto>', methods=['PUT'])
@requer_login
def update_produto(id_produto):
    data = request.get_json(silent=True) or {}
    erros = validar_produto(data)
    if erros:
        return jsonify({"message": erros[0], "erros": erros}), 400

    produtos = carregar_json(ARQUIVO_DB)
    for produto in produtos:
        if produto['id'] == id_produto:
            produto.update(normalizar_produto(data))
            salvar_json(ARQUIVO_DB, produtos)
            return jsonify({"message": "Produto atualizado!", "produto": produto}), 200
    return jsonify({"message": "Produto não encontrado"}), 404

@app.route('/produtos/<int:id_produto>', methods=['DELETE'])
@requer_login
def delete_produto(id_produto):
    produtos = carregar_json(ARQUIVO_DB)
    nova_lista = [p for p in produtos if p['id'] != id_produto]
    if len(produtos) == len(nova_lista):
        return jsonify({"message": "Produto não encontrado"}), 404
    salvar_json(ARQUIVO_DB, nova_lista)
    return jsonify({"message": "Produto excluído!"}), 200

# Cadastro e login de usuários
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    nome = str(data.get('nome', '') or '').strip()
    email = str(data.get('email', '') or '').strip().lower()
    senha = data.get('senha') or ''

    if not nome:
        return jsonify({"message": "Informe o seu nome."}), 400
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return jsonify({"message": "Informe um e-mail válido."}), 400
    if not senha_valida(senha):
        return jsonify({"message": "Senha inválida! Use no mínimo 6 caracteres, com letras e números (sem especiais)."}), 400

    usuarios = carregar_json(ARQUIVO_USUARIOS)
    if any(u.get('email', '').lower() == email for u in usuarios):
        return jsonify({"message": "Este e-mail já está cadastrado."}), 400

    novo_usuario = {
        "id": gerar_novo_id(usuarios),
        "nome": nome,
        "email": email,
        "senha": generate_password_hash(senha),
        "is_admin": False,
    }
    usuarios.append(novo_usuario)
    salvar_json(ARQUIVO_USUARIOS, usuarios)
    return jsonify({"message": "Usuário criado com sucesso!"}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get('email', '') or '').strip().lower()
    senha = data.get('senha') or ''

    usuarios = carregar_json(ARQUIVO_USUARIOS)
    for user in usuarios:
        if user.get('email', '').lower() == email and check_password_hash(user.get('senha', ''), senha):
            token = assinador.dumps({"id": user['id']})
            return jsonify({
                "message": "Login autorizado!",
                "token": token,
                "usuario": user['nome'],
                "is_admin": user.get('is_admin', False),
            }), 200
    # A mensagem é a mesma para e-mail inexistente e senha errada,
    # para não revelar quais e-mails estão cadastrados
    return jsonify({"message": "E-mail ou senha incorretos."}), 401

@app.route('/me', methods=['GET'])
@requer_login
def me():
    # O frontend usa esta rota para confirmar se a sessão continua válida
    return jsonify(usuario_publico(request.usuario)), 200

# Rotas do painel administrativo
@app.route('/usuarios', methods=['GET'])
@requer_admin
def get_usuarios():
    usuarios = carregar_json(ARQUIVO_USUARIOS)
    return jsonify([usuario_publico(u) for u in usuarios])

@app.route('/usuarios/<int:id_usuario>', methods=['DELETE'])
@requer_admin
def delete_usuario(id_usuario):
    if id_usuario == 1:  # Administrador principal não pode ser removido
        return jsonify({"message": "Não é possível excluir o Administrador Principal!"}), 403
    if id_usuario == request.usuario['id']:
        return jsonify({"message": "Você não pode excluir a sua própria conta."}), 400

    usuarios = carregar_json(ARQUIVO_USUARIOS)
    nova_lista = [u for u in usuarios if u['id'] != id_usuario]
    if len(usuarios) == len(nova_lista):
        return jsonify({"message": "Usuário não encontrado"}), 404

    salvar_json(ARQUIVO_USUARIOS, nova_lista)
    return jsonify({"message": "Usuário excluído!"}), 200

# Deixam os arquivos de dados prontos assim que a aplicação carrega
migrar_senhas_para_hash()
garantir_admin()

if __name__ == '__main__':
    import sys

    # python app.py criar-admin [nova-senha]
    if '--criar-admin' in sys.argv:
        posicao = sys.argv.index('--criar-admin')
        nova_senha = sys.argv[posicao + 1] if len(sys.argv) > posicao + 1 else ADMIN_SENHA
        if not senha_valida(nova_senha):
            print("Senha inválida: use no mínimo 6 caracteres, com letras e números.")
            sys.exit(1)
        admin, acao = garantir_admin(senha=nova_senha, forcar=True)
        print("Administrador " + acao + ".")
        print("  E-mail: " + admin['email'])
        print("  Senha:  " + nova_senha)
        sys.exit(0)

    porta = int(os.environ.get('PORT', 5000))
    print("")
    print("  SimpStock rodando em  http://localhost:" + str(porta))
    print("  Entre com  " + ADMIN_EMAIL + "  /  " + ADMIN_SENHA)
    print("  (perdeu a senha?  python app.py --criar-admin)")
    print("")
    app.run(debug=True, port=porta)
