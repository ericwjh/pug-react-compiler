module.exports = function () {
  return [].slice.call(arguments).reduce(function (args, it) {
    if (it == null || it === '') {
      return args;
    } if (typeof it.length === 'number') {
      return args.concat(it);
    } else {
      return args.push(it), args;
    }
  }, []).join(' ');
}