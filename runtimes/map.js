module.exports = function (obj, each, alt) {
  var result = [], key;
  if (typeof obj.length === 'number') {
    result = [].map.call(obj, each);
  } else {
    for (key in obj) result.push(each(obj[key], key));
  }
  return result.length ? result : alt && alt();
}