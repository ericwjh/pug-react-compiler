module.exports = function () {
    return React.DOM.html(null, React.DOM.body(null, React.DOM.head(null, React.DOM.script({ 'src': '/jquery.js' }), React.DOM.script({ 'src': '/caustic.js' }), React.DOM.script({ 'src': '/app.js' }), false ? React.DOM.script({ 'src': '/jquery.ui.js' }) : null)));
};