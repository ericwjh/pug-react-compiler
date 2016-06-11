var esprima = require('esprima');
var escodegen = require('escodegen');
var parseJSExpression = require('character-parser').parseMax;
var Rectifier = require('./rectifier');
var b = require('./builder');
var path = require('path')
  /**
   * Initialize `Compiler` with the given `token` and `options`.
   *
   * @param {Node} node
   * @param {Object} [options]
   * @api public
   */

var Compiler = module.exports = function Compiler(node, options) {
  this.visit = this.visit.bind(this)
  this.options = options = options || {};
  this.node = node;
};

/**
 * Compiler prototype.
 */

Compiler.prototype = {

  /**
   * Compile parse tree to JavaScript.
   *
   * @api public
   */

  compile: function() {

    if (!this.buf) this.generate();
    if (!this.ast) this.rectify();

    var js = escodegen.generate(this.ast)
    return [js].concat(this.helpers).join('\n');
  },

  /**
   * Generate intermediate JavaScript.
   *
   * @api public
   */

  generate: function() {
    this.buf = '';
    this.helpers = [];
    this.depth = -1;
    this.visit(this.node);
  },

  /**
   * Transform intermediate JavaScript.
   *
   * @api public
   */

  rectify: function() {
    this.ast = esprima.parse(this.buf, { sourceType: 'module'});
    var rectifier = new Rectifier(this.ast, this.options)
    this.ast = rectifier.rectify()
  },

  /**
   * Interpolate the given `str`.
   *
   * @param {String} str
   * @api public
   */

  interpolate: function(str) {
    var match;
    var range;
    var src;

    var result = [];
    var buf = '""';

    if (str.val != null) str = str.val;
    if (str === '') return [this.text('""')];

    while (str && (match = /(\\)?([#!]){((?:.|\n)*)$$/.exec(str))) {
      buf += ' + ' + JSON.stringify(str.substr(0, match.index));
      str = match[3];

      if (match[1]) { // escape
        buf += ' + ' + JSON.stringify(match[2] + '{');
        continue;
      }

      range = parseJSExpression(str);
      src = range.src;

      if (match[2] === '!') {
        if (buf) result.push(this.text(buf)), buf = '""';
        result.push(this.unescape(src));
      } else {
        buf += ' + ' + src;
      }

      str = str.substr(range.end + 1);
    }
    if (str){
      if (buf === '""'){
        buf = JSON.stringify(str);
      } else {
        buf += ' + ' + JSON.stringify(str);
      }
    }

    if (buf !== '""') result.push(this.text(buf));

    return result;
  },

  /**
   * Wrap the given `str` around a text sentinel.
   *
   * @param {AST_Node} node
   * @api public
   */

  text: function(str) {
    return 'ǃtext＿(' + str + ')';
  },

  /**
   * Wrap the given `str` around an unescape sentinel.
   *
   * @param {AST_Node} node
   * @api public
   */

  unescape: function(str) {
    return 'ǃunescape＿(' + str + ')';
  },

  /**
   * Visit `node`.
   *
   * @param {Node} node
   * @api public
   */

  visit: function(node) {
    this.depth++;
    this['visit' + node.type](node);
    this.depth--;
  },

  visitConditional: function(cond) {
    var test = cond.test;
    this.buf += ('if (' + test + ') {');
    this.visit(cond.consequent, cond);
    this.buf += ('}')
    if (cond.alternate) {
      if (cond.alternate.type === 'Conditional') {
        this.buf += ('else')
        this.visitConditional(cond.alternate);
      } else {
        this.buf += ('else {');
        this.visit(cond.alternate, cond);
        this.buf += ('}');
      }
    }
  },

  visitWhile: function(loop) {
    var test = loop.test;
    this.buf += '(function(){ var __return = [];\n'
    var buf = this.buf

    for (var i = 0; i < loop.block.nodes.length; ++i) {
      this.buf = ''
      this.visit(loop.block.nodes[i], loop);
      buf += 'var __body' + i + ' = ' + 'function(){\n ' + this.buf.replace(/\n/g, ' ' ) + '};\n'
    }
    
    this.buf = buf
    this.buf += 'while ' + test + ' {'
    for (var i = 0; i < loop.block.nodes.length; ++i) {
      // this.visit(loop.block.nodes[i], loop);
      this.buf += '\n__return.push(__body'+i + '.call(this));'
      // buf += '__return.push((function(){return ' + this.buf + '}).call(this));'
    }
    this.buf += '\n}'
    this.buf += '\nreturn __return;}).call(this);'
  },

  /**
   * Visit case `node`.
   *
   * @param {Literal} node
   * @api public
   */

  visitCase: function(node) {
    throw new Error('not supported');
    this.buf += 'switch(' + node.expr + '){\n';
    this.visit(node.block);
    this.buf += '}\n';
  },

  /**
   * Visit when `node`.
   *
   * @param {Literal} node
   * @api public
   */

  visitWhen: function(node, start) {
    if (node.expr === 'default') {
      this.buf += 'default:\n';
    } else {
      this.buf += 'case ' + node.expr + ':\n';
    }
    if (node.block) {
      this.visit(node.block);
      this.buf += 'break;\n';
    }
  },

  /**
   * Visit literal `node`.
   *
   * @param {Literal} node
   * @api public
   */

  visitLiteral: function(node) {
    this.buf += this.text(JSON.stringify(node.str)) + '\n';
  },

  /**
   * Visit all nodes in `block`.
   *
   * @param {Block} block
   * @api public
   */

  visitBlock: function(block, start) {
    block.nodes.forEach(this.visit);
  },

  /**
   * Visit a mixin's `block` keyword.
   *
   * @param {MixinBlock} block
   * @api public
   */

  visitMixinBlock: function(block) {
    this.buf += 'block ? block() : null;\n';
  },

  /**
   * Visit `doctype`.
   *
   * @param {Doctype} doctype
   * @api public
   */

  visitDoctype: function() {
    throw new Error('not supported');
  },

  /**
   * Visit `mixin`, generating a function that
   * may be called within the template.
   *
   * @param {Mixin} mixin
   * @api public
   */

  visitMixin: function(mixin) {
    throw new Error('not implemented');
  },

  /**
   * Visit `tag`, translate the tag name, generate attributes, and
   * visit the `tag`'s code and block.
   *
   * @param {Tag} tag
   * @api public
   */

  visitTag: function(tag) {
    var name = tag.name;

    this.buf += '\nǃDOM＿(' + name + ',';
    this.visitAttributes(tag.attrs, tag.attributeBlocks);
    this.buf += ');\n{\n';

    if (tag.code) this.visitCode(tag.code);
    this.visit(tag.block);
    this.buf += '}\n';

  },

  /**
   * Visit `filter`, throwing when the filter does not exist.
   *
   * @param {Filter} filter
   * @api public
   */

  visitFilter: function(filter) {
    throw new Error('not implemented');
  },

  /**
   * Visit `text` node.
   *
   * @param {Text} text
   * @api public
   */

  visitText: function(text) {
    this.interpolate(text).forEach(function(str) {
      this.buf += str + ';\n';
    }.bind(this));
  },

  /**
   * Visit a `comment`.
   *
   * @param {Comment} comment
   * @api public
   */

  visitComment: function(comment) {
    if (comment.buffer) this.buf += '//' + comment.val + '\n';
  },

  /**
   * Visit a `BlockComment`.
   *
   * @param {Comment} comment
   * @api public
   */

  visitBlockComment: function(comment) {
    if (!comment.buffer) return;
    this.buf += '/*' + comment.val + '\n';
    this.visit(comment.block);
    this.buf += '*/\n';
  },

  /**
   * Visit `code`, respecting buffer / escape flags.
   * If the code is followed by a block, wrap it in
   * a self-calling function.
   *
   * @param {Code} code
   * @api public
   */

  visitCode: function(code, start) {
    // Wrap code blocks with {}.
    // we only wrap unbuffered code blocks ATM
    // since they are usually flow control

    // Buffer code
    if (code.buffer) {
      if (code.escape) {
        this.buf += 'ǃtext＿(' + code.val + ');\n';
      } else {
        this.buf += this.unescape(code.val) + ';\n';
      }
    } else {
      this.buf += code.val + '\n';
    }

    // Block support
    if (code.block) {
      if (!code.buffer) this.buf += '{\n';
      this.visit(code.block);
      if (!code.buffer) this.buf += '}\n';
    }
  },

  /**
   * Visit `each` block.
   *
   * @param {Each} each
   * @api public
   */

  visitEach: function(each, start) {
    if (!this.hasEachHelper) {
      this.helpers.push("var __map = require('pug-react-compiler/runtimes/map.js')");
      this.hasEachHelper = true;
    }

    this.buf += '__map(' + each.obj + ', (';
    this.buf += each.val + ', ' + ( each.key || '$index' )+ ')=>{\n';
    this.visit(each.block);
    this.buf += '\n})';

    if (each.alternative) {
      this.buf += ', function(){\n';
      this.visit(each.alternative);
      this.buf += '\n}';
    }

    // this.buf += '\n);';
  },

  /**
   * Visit `attrs`.
   *
   * @param {Array} attrs
   * @api public
   */

  visitAttributes: function(attrs, attributeBlocks) {
    if (attributeBlocks.length) {
      if (attrs.length) {
        var val = this.attrs(attrs);
        attributeBlocks.unshift(val);
      }
      this.injectAttrsHelper();
      this.injectClassHelper();
      this.buf += '__attr(' + attributeBlocks.join(',') + ')';
    } else if (attrs.length) {
      this.attrs(attrs, true);
    } else {
      this.buf += 'null'
    }
  },

  /**
   * Compile attributes.
   */

  attrs: function(attrs, buffer) {
    var self = this;
    var classes = [];
    var buf = [];
    var ast;

    function addClass(ast, val) {
      if (b.isEmpty(ast) || b.isLiteral(ast, 'string') && !ast.value.trim()) {
        // no-op
      } else if (b.isLiteral(ast)) {
        var __class = require('../runtimes/class')
        classes.push(JSON.stringify(__class(eval(val))));
      } else {
        self.injectClassHelper();
        classes.push('__class(' + val + ')');
      }
    }

    attrs.forEach(function(attr) {
      // if (!attr.escaped && attr.name != 'class' && attr.name != 'id') {
      //   console.warn(attr.name, 'WARNING: unescaped attributes not supported');
      // }

      var key = attr.name;
      var val = attr.val;

      switch (key) {
        case 'class':
        case 'className':
          ast = esprima.parse(val).body[0].expression;
          if (b.isArrayExpression(ast)) {
            switch (ast.elements.length) {
              case 0:
                return;
              case 1:
                ast = ast.elements[0];
              default:
                ast.elements.forEach(function(ast) {
                  var it = escodegen.generate(ast);
                  addClass(ast, it);
                });
                return;
            }
          }
          addClass(ast, val);
          return;
        case 'for':
          key = 'htmlFor';
          break;
        default:
          if (key.indexOf('data-') === 0) {
            if (val == null || val === 'null') return;
            break;
          }
          if (key.indexOf('aria-') === 0) break;
          key = key.split('-');
          key = key[0] + key.slice(1).map(function(it) {
            return it[0].toUpperCase() + it.substr(1);
          }).join('');
      }

      buf.push(JSON.stringify(key) + ':' + val);
    }.bind(this));

    if (classes.length) buf.push('className:' + classes.join(' + " " + '));

    buf = '{' + buf.join(',') + '}';
    if (buffer) this.buf += buf;
    return buf;
  },

  /**
   * Inject attrs helper.
   */

  injectAttrsHelper: function() {
    this.helpers.push("var __attr = require('pug-react-compiler/runtimes/attr')");
    this.injectAttrsHelper = function() {};
  },

  /**
   * Inject class helper.
   */

  injectClassHelper: function() {
    this.helpers.push("var __class = require('pug-react-compiler/runtimes/class.js')");

    this.injectClassHelper = function() {};
  }

};

function ǃattrs＿() {
  var classes = [];
  var attrs = {};
  [].slice.call(arguments).forEach(function(it) {
    for (var key in it) {
      var val = it[key];
      switch (key) {
        case 'class':
        case 'className':
          classes.push(val);
          return;
        case 'for':
          key = 'htmlFor';
          break;
        default:
          if (key.indexOf('data-') === 0) {
            if (val == null) return;
            val = JSON.stringify(val);
            break;
          }
          if (key.indexOf('aria-') === 0) break;
          key = key.split('-');
          key = key[0] + key.slice(1).map(function(it) {
            return it.charAt(0).toUpperCase() + it.substr(1);
          }).join('');
      }
      attrs[key] = val;
    }
  });
  if (classes.length) attrs.className = ǃclass＿.apply(null, classes);
  return attrs;
}

function ǃclass＿() {
  return [].slice.call(arguments).reduce(function(args, it) {
    if (it == null || it === '') {
      return args;
    }
    if (typeof it.length === 'number') {
      return args.concat(it);
    } else {
      return args.push(it), args;
    }
  }, []).join(' ');
}

function ǃmap＿(obj, each, alt) {
  var result = [],
    key;
  if (typeof obj.length === 'number') {
    result = [].map.call(obj, each);
  } else {
    for (key in obj) result.push(each(obj[key], key));
  }
  return result.length ? result : alt && alt();
}