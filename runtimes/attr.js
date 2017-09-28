var __class = require('./class')
module.exports = function() {
  var classes = [];
  var attrs = {};
  [].slice.call(arguments).forEach(function (it) {
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
          key = key[0] + key.slice(1).map(function (it) {
            return it.charAt(0).toUpperCase() + it.substr(1);
          }).join('');
      }
      attrs[key] = val;
    }
  });
  if (classes.length) attrs.className = __class.apply(null, classes);
  return attrs;
}