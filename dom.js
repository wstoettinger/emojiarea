(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return (root.dom = factory());
        });
    } else if (typeof module === 'object' && module.exports) {
        module.exports = (root.dom = factory());
    } else {
        root.dom = factory();
    }
})(this, function() {

    function addEventListener(node, events, callback) {
        if (events.constructor !== Array)
            events = [events];

        events.forEach(function(event) {
            node.addEventListener(event, callback);
        });
    }

    function dispatchEvent(node, type) {
        var event = document.createEvent('HTMLEvents');
        event.initEvent(type, true, false);
        node.dispatchEvent(event);
    }

    function removeChildren(node) {
        while (node.firstChild)
            node.removeChild(node.firstChild);
    }

    function appendChildren(node, children) {
        children.forEach(function(child) {
            node.appendChild(child);
        });
    }

    function numberInParent(child, childNodes) {
        for (var i = 0; i < childNodes.length; i++) {
            if (childNodes[i] === child)
                return i;
        }

        // We are not in a child node, but in the editor itself. We return -1 and use offsets instead

        return -1;
    }

    function isTextNode(node) {
        return node instanceof Text;
    }

    function isImageNode(node) {
        return node instanceof HTMLImageElement;
    }

    return {
        addEventListener: addEventListener,
        dispatchEvent: dispatchEvent,
        removeChildren: removeChildren,
        appendChildren: appendChildren,
        numberInParent: numberInParent,
        isTextNode: isTextNode,
        isImageNode: isImageNode
    };
});
