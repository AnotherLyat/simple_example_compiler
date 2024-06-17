//node lexerParser.js

const TIPOS_TOKEN = {
  'PALAVRA_CHAVE': 'PALAVRA_CHAVE',
  'ID': 'ID',
  'NUMERO': 'NUMERO',
  'OPERADOR': 'OPERADOR',
  'DELIMITADOR': 'DELIMITADOR',
  'TEXTO': 'TEXTO'
};

const PALAVRAS_CHAVE = ['programa', 'fimprog', 'inteiro', 'decimal', 'leia', 'escreva', 'if', 'else'];

const OPERADORES = ['+', '-', '*', '/', '<', '>', '<=', '>=', '!=', '==', ':=', '='];
const DELIMITADORES = ['(', ')', '{', '}', ',', ';'];

function lexer(codigo) {
  const tokens = [];
  codigo = codigo.replace(/\n/g, ' ');  // Remove line breaks
  while (codigo) {
    const match = codigo.match(/^\s*(\b(?:programa|fimprog|inteiro|decimal|leia|escreva|if|else)\b|[a-zA-Z_á-úÁ-Ú][a-zA-Z0-9_á-úÁ-Ú]*|\d+|\+|\-|\*|\/|<|>|<=|>=|!=|==|:=|=|\(|\)|\{|\}|,|;|"([^"\\]*(?:\\.[^"\\]*)*)")\s*/);
    if (match) {
      const valor = match[1];
      codigo = codigo.slice(match[0].length);
      let tipo_token;
      if (PALAVRAS_CHAVE.includes(valor)) {
        tipo_token = TIPOS_TOKEN['PALAVRA_CHAVE'];
      } else if (OPERADORES.includes(valor)) {
        tipo_token = TIPOS_TOKEN['OPERADOR'];
      } else if (DELIMITADORES.includes(valor)) {
        tipo_token = TIPOS_TOKEN['DELIMITADOR'];
      } else if (!isNaN(valor)) {
        tipo_token = TIPOS_TOKEN['NUMERO'];
      } else if (valor[0].match(/[a-zA-Z]/)) {
        tipo_token = TIPOS_TOKEN['ID'];
      } else {
        tipo_token = TIPOS_TOKEN['TEXTO'];
        valor == valor.slice(1, -1);  
      }
      tokens.push([valor, tipo_token]);
    } else if (codigo[0] === ' ') {
      codigo = codigo.slice(1);
    } else {
      throw new Error(`Token inválido: ${codigo}`);
    }
  }
  return tokens;
}

class SemanticAnalyzer {
  constructor() {
    this.symbolTable = {};
  }

  declareVariable(varName, varType) {
    if (this.symbolTable[varName]) {
      throw new Error(`Variável '${varName}' já declarada.`);
    }
    this.symbolTable[varName] = varType;
  }

  checkVariable(varName) {
    if (!this.symbolTable[varName]) {
      throw new Error(`Variável '${varName}' não declarada.`);
    }
    return this.symbolTable[varName];
  }

  checkType(varName, expectedType) {
    const varType = this.checkVariable(varName);
    if (varType !== expectedType) {
      throw new Error(`Tipo incompatível: variável '${varName}' é do tipo '${varType}', esperado '${expectedType}'.`);
    }
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.semanticAnalyzer = new SemanticAnalyzer();
  }

  currentToken() {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  consume(expectedType = null, expectedValue = null) {
    const token = this.currentToken();
    if (token && (!expectedType || token[1] === expectedType) && (!expectedValue || token[0] === expectedValue)) {
      this.pos++;
      return token;
    } else {
      const expected = `${expectedType || ''} ${expectedValue || ''}`.trim();
      throw new Error(`Expected ${expected} but got ${token}`);
    }
  }

  parse() {
    return this.programa();
  }

  programa() {
    this.consume('PALAVRA_CHAVE', 'programa');
    const corpo = this.corpo();
    this.consume('PALAVRA_CHAVE', 'fimprog');
    return ['programa', corpo];
  }

  corpo() {
    const statements = [];
    while (this.currentToken() && this.currentToken()[0] !== 'fimprog') {
      if (['inteiro', 'decimal'].includes(this.currentToken()[0])) {
        statements.push(this.declaracao());
      } else {
        statements.push(this.comando());
      }
    }
    return statements;
  }

  declaracao() {
    const tipo = this.tipo();
    const varList = this.var_list();
    this.consume('DELIMITADOR', ';');
    varList.forEach(varToken => {
      this.semanticAnalyzer.declareVariable(varToken[0], tipo);
    });
    return ['declaracao', tipo, varList];
  }

  tipo() {
    const token = this.consume('PALAVRA_CHAVE');
    if (!['inteiro', 'decimal'].includes(token[0])) {
      throw new Error(`Tipo inválido: ${token[0]}`);
    }
    return token[0];
  }

  var_list() {
    const variables = [this.consume('ID')];
    while (this.currentToken() && this.currentToken()[0] === ',') {
      this.consume('DELIMITADOR', ',');
      variables.push(this.consume('ID'));
    }
    return variables;
  }

  comando() {
    switch (this.currentToken()[0]) {
      case 'escreva':
        return this.escreva();
      case 'leia':
        return this.leia();
      case 'if':
        return this.condicional();
      case '{':
        return this.bloco();
      default:
        if (this.currentToken()[1] === 'ID') {
          return this.atribuicao();
        } else {
          throw new Error(`Comando inválido: ${this.currentToken()}`);
        }
    }
  }

  escreva() {
    this.consume('PALAVRA_CHAVE', 'escreva');
    this.consume('DELIMITADOR', '(');
    const argumentos = this.argumento_list();
    argumentos.forEach(arg => {
      if (arg[1] === 'ID') {
        this.semanticAnalyzer.checkVariable(arg[0]);
      }
    });
    this.consume('DELIMITADOR', ')');
    this.consume('DELIMITADOR', ';');
    return ['escreva', argumentos];
  }

  leia() {
    this.consume('PALAVRA_CHAVE', 'leia');
    this.consume('DELIMITADOR', '(');
    const idToken = this.consume('ID');
    this.semanticAnalyzer.checkVariable(idToken[0]);
    this.consume('DELIMITADOR', ')');
    this.consume('DELIMITADOR', ';');
    return ['leia', idToken];
  }

  condicional() {
    this.consume('PALAVRA_CHAVE', 'if');
    this.consume('DELIMITADOR', '(');
    const expr = this.expr();
    this.consume('DELIMITADOR', ')');
    const bloco = this.bloco();
    if (this.currentToken() && this.currentToken()[0] === 'else') {
      this.consume('PALAVRA_CHAVE', 'else');
      const elseBloco = this.bloco();
      return ['if_else', expr, bloco, elseBloco];
    }
    return ['if', expr, bloco];
  }

  bloco() {
    this.consume('DELIMITADOR', '{');
    const comandos = [];
    while (this.currentToken() && this.currentToken()[0] !== '}') {
      comandos.push(this.comando());
    }
    this.consume('DELIMITADOR', '}');
    return ['bloco', comandos];
  }

  expr() {
    let left = this.termo();
    while (this.currentToken() && this.currentToken()[1] === 'OPERADOR' && ![':=', '='].includes(this.currentToken()[0])) {
      const operador = this.consume('OPERADOR');
      const right = this.termo();
      let leftType, rightType;
      if (left[1] === 'ID') {
        leftType = this.semanticAnalyzer.checkVariable(left[0]);
      } else if (left[1] === 'NUMERO') {
        leftType = 'inteiro';  
      }

      if (right[1] === 'ID') {
        rightType = this.semanticAnalyzer.checkVariable(right[0]);
      } else if (right[1] === 'NUMERO') {
        rightType = 'inteiro';
      }

      if (leftType !== rightType) {
        throw new Error(`Operação inválida entre tipos '${leftType}' e '${rightType}'`);
      }

      left = ['binop', operador, left, right];
    }
    return left;
  }

  termo() {
    const token = this.currentToken();
    if (token[1] === 'ID') {
      return this.consume('ID');
    } else if (token[1] === 'NUMERO') {
      return this.consume('NUMERO');
    } else if (token[0] === '(') {
      this.consume('DELIMITADOR', '(');
      const expr = this.expr();
      this.consume('DELIMITADOR', ')');
      return expr;
    } else {
      throw new Error(`Termo inválido: ${token}`);
    }
  }

  argumento_list() {
    const argumentos = [this.argumento()];
    while (this.currentToken() && this.currentToken()[0] === ',') {
      this.consume('DELIMITADOR', ',');
      argumentos.push(this.argumento());
    }
    return argumentos;
  }

  argumento() {
    const token = this.currentToken();
    if (['TEXTO', 'ID', 'NUMERO'].includes(token[1])) {
      return this.consume();
    } else {
      throw new Error(`Argumento inválido: ${token}`);
    }
  }

  atribuicao() {
    const idToken = this.consume('ID');
    this.semanticAnalyzer.checkVariable(idToken[0]);
    const operador = this.consume('OPERADOR', ':=');
    const expr = this.expr();
    this.consume('DELIMITADOR', ';');
    return ['atribuicao', idToken, operador, expr];
  }
}

function semantic_analysis(ast) {
  const analyzer = new SemanticAnalyzer();

  function traverse(node) {
    if (!node) {
      return;
    }

    switch (node[0]) {
      case 'programa':
        node[1].forEach(stmt => traverse(stmt));
        break;
      case 'declaracao':
        const varType = node[1];
        node[2].forEach(varNode => {
          analyzer.declareVariable(varNode[0], varType);
        });
        break;
      case 'atribuicao':
        const varName = node[1][0];
        analyzer.checkVariable(varName);
        traverse(node[3]);
        break;
      case 'leia':
        const leiaVarName = node[1][0];
        analyzer.checkVariable(leiaVarName);
        break;
      case 'escreva':
        node[1].forEach(arg => {
          if (arg[1] === 'ID') {
            analyzer.checkVariable(arg[0]);
          }
        });
        break;
      case 'if':
      case 'if_else':
        traverse(node[1]);
        traverse(node[2]);
        if (node[0] === 'if_else') {
          traverse(node[3]);
        }
        break;
      case 'bloco':
        node[1].forEach(cmd => traverse(cmd));
        break;
      case 'binop':
        traverse(node[2]);
        traverse(node[3]);
        break;
    }
  }

  traverse(ast);
  return analyzer.symbolTable;
}

const codigoTeste = `
programa
inteiro x, y;
escreva("Olá, mundo!");
leia(x);
if (x > 0) {
  y := x * 2;
  escreva("O dobro de ", x, " é ", y);
} else {
  escreva("O valor de x é negativo");
}
fimprog
`;

const tokens = lexer(codigoTeste);
const fs = require('fs');
fs.writeFileSync('tokens.txt', tokens.map(token => token.toString()).join('\n'));

const parser = new Parser(tokens);
const ast = parser.parse();
fs.writeFileSync('ast.txt', JSON.stringify(ast));

const semanticResults = semantic_analysis(ast);
fs.writeFileSync('semantic_analysis.txt', JSON.stringify(semanticResults));

console.log("Tokens:");
tokens.forEach(token => console.log(token));
console.log("\nAST:");
console.log(ast);
console.log("\nResultados da Análise Semântica:");
console.log(semanticResults);
