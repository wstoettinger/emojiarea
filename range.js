(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return (root.range = factory());
        });
    } else if (typeof module === 'object' && module.exports) {
        module.exports = (root.range = factory());
    } else {
        root.range = factory();
    }
})(this, function() {

    var get = (function() {
        if (window.getSelection) {
            return function() {
                var sel = window.getSelection();
                var ranges = [];
                if (sel.rangeCount) {
                    var length = sel.rangeCount;
                    for (var i = 0; i < length; i++) {
                        ranges.push(sel.getRangeAt(i));
                    }
                }
            };
        } else if (document.selection && document.selection.createRange) {
            return function() {
                var sel = document.selection;
                return (sel.type.toLowerCase() !== 'none') ? sel.createRange() : null;
            };
        }
    })();

    var restore = (function() {
        if (window.getSelection) {
            return function(selection) {
                var sel = window.getSelection();
                sel.removeAllRanges();
                var length = selection.length;
                for (var i = 0; i < length; i++) {
                    sel.addRange(selection[i]);
                }
            };
        } else if (document.selection && document.selection.createRange) {
            return function(selection) {
                if (selection) {
                    selection.select();
                }
            };
        }
    })();

    var replace = (function() {
        if (window.getSelection) {
            return function(content) {
                var range, sel = window.getSelection();
                var node = typeof content === 'string' ? document.createTextNode(content) : content;
                if (sel.getRangeAt && sel.rangeCount) {
                    range = sel.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(' '));
                    range.insertNode(node);
                    range.setStart(node, 0);

                    window.setTimeout(function() {
                        range = document.createRange();
                        range.setStartAfter(node);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }, 0);
                }
            };
        } else if (document.selection && document.selection.createRange) {
            return function(content) {
                var range = document.selection.createRange();
                if (typeof content === 'string') {
                    range.text = content;
                } else {
                    range.pasteHTML(content.outerHTML);
                }
            };
        }
    })();

    return {
        get: get,
        restore: restore,
        replace: replace
    };
});