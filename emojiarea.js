/**
 * emojiarea - A rich textarea control that supports emojis, WYSIWYG-style.
 * Copyright (c) 2012 DIY Co
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
 * file except in compliance with the License. You may obtain a copy of the License at:
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 * @author Brian Reavis <brian@diy.org>
 */

 (function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return (root.EmojiArea = factory());
        });
    } else if (typeof module === 'object' && module.exports) {
        module.exports = (root.EmojiArea = factory());
    } else {
        root.EmojiArea = factory();
    }
})(this, function() {

    var ELEMENT_NODE = 1;
    var TEXT_NODE = 3;
    var TAGS_BLOCK = ['p', 'div', 'pre', 'form'];
    var KEY_ESC = 27;
    var KEY_TAB = 9;

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    var util = {};

    util.restoreSelection = (function() {
        if (window.getSelection) {
            return function(savedSelection) {
                var sel = window.getSelection();
                sel.removeAllRanges();
                for (var i = 0, len = savedSelection.length; i < len; ++i) {
                    sel.addRange(savedSelection[i]);
                }
            };
        } else if (document.selection && document.selection.createRange) {
            return function(savedSelection) {
                if (savedSelection) {
                    savedSelection.select();
                }
            };
        }
    })();

    util.saveSelection = (function() {
        if (window.getSelection) {
            return function() {
                var sel = window.getSelection(), ranges = [];
                if (sel.rangeCount) {
                    for (var i = 0, len = sel.rangeCount; i < len; ++i) {
                        ranges.push(sel.getRangeAt(i));
                    }
                }
                return ranges;
            };
        } else if (document.selection && document.selection.createRange) {
            return function() {
                var sel = document.selection;
                return (sel.type.toLowerCase() !== 'none') ? sel.createRange() : null;
            };
        }
    })();

    util.replaceSelection = (function() {
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

    util.insertAtCursor = function(text, el) {
        text = ' ' + text;
        var val = el.value, endIndex, startIndex, range;
        if (typeof el.selectionStart != 'undefined' && typeof el.selectionEnd != 'undefined') {
            startIndex = el.selectionStart;
            endIndex = el.selectionEnd;
            el.value = val.substring(0, startIndex) + text + val.substring(el.selectionEnd);
            el.selectionStart = el.selectionEnd = startIndex + text.length;
        } else if (typeof document.selection != 'undefined' && typeof document.selection.createRange != 'undefined') {
            el.focus();
            range = document.selection.createRange();
            range.text = text;
            range.select();
        }
    };

    util.escapeRegex = function(str) {
        return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
    };

    util.htmlEntities = function(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    util.addEventListener = function(node, events, callback) {
        if (events.constructor !== Array)
            events = [events];

        events.forEach(function(event) {
            node.addEventListener(event, callback);
        });
    };

    util.dispatchEvent = function(node, type) {
        var event = document.createEvent('HTMLEvents');
        event.initEvent(type, true, false);
        node.dispatchEvent(event);
    };

    util.removeChildren = function(node) {
        while (node.firstChild)
            node.removeChild(node.firstChild);
    };

    util.appendChildren = function(node, children) {
        children.forEach(function(child) {
            node.appendChild(child);
        });
    };

    util.childNumber = function(child, container) {
        if (child === container)
            return container.childNodes.length - 1;

        for (var i = 0; i < container.childNodes.length; i++) {
            if (container.childNodes[i] === child)
                return i;
        }

        console.warn('Could not find child in container', child, container);

        return 0;
    };

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    window.emojiareaOptions = {
        path: '',
        icons: {},
        defaults: {
            button: null,
            buttonLabel: 'Emojis',
            buttonPosition: 'after'
        }
    };

    function parseText(html) {
        var parts = [];

        var regexp = /:[a-z0-9-_+]+:/;

        while (true) {
            var match = regexp.exec(html);
            if (!match)
                break;

            var emoji = EmojiArea.findIcon(match[0]);
            if (!emoji)
                continue;

            var index = match.index;
            parts.push(document.createTextNode(html.substr(0, index)));
            parts.push(emoji);
            html = html.substr(index + match[0].length);
        }

        if (html !== '') {
            parts.push(document.createTextNode(html));
        }

        if (parts[parts.length - 1] instanceof HTMLImageElement) {
            parts.push(document.createTextNode(''));
        }

        return parts;
    }

    /**
     * Editor (rich)
     *
     * @constructor
     * @param {object} $textarea
     * @param {object} options
     */

    var EmojiArea = function(textarea, options) {
        var self = this;

        this.options = options;
        this.textarea = textarea;

        var editor = document.createElement('div');
        editor.classList.add('emoji-wysiwyg-editor');
        editor.innerText =  textarea.innerText;
        editor.setAttribute('contentEditable', true);

        var onChange = function() { return self.onChange.apply(self,arguments); };
        var enableObjectResizing = function() { document.execCommand('enableObjectResizing', false, false); };
        var disableObjectResizing = function() { document.execCommand('enableObjectResizing', true, true); };

        util.addEventListener(editor, ['keyup', 'paste'], onChange);
        util.addEventListener(editor, ['mousedown', 'focus'], enableObjectResizing);
        util.addEventListener(editor, 'blur', disableObjectResizing);

        this.editor = editor;

        var html = parseText(this.textarea.innerHTML);
        util.appendChildren(this.editor, html);
        this.lastTextValue = this.val();
        this.textarea.style.display = 'none';

        textarea.parentNode.insertBefore(editor, textarea.nextSibling);

        this.setup();

        util.addEventListener(this.button, 'mousedown', function() {
            if (self.hasFocus) {
                self.selection = util.saveSelection();
            }
        });
    };

    EmojiArea.expose = function($) {
        $.fn.emojiarea = function(options) {
            options = $.extend({}, emojiareaOptions.defaults, options);
            return this.each(function() {
                var textarea = this;
                new EmojiArea(textarea, options);
            });
        };
    };

    EmojiArea.prototype.setup = function() {
        var self = this;

        util.addEventListener(this.editor, 'focus', function() { self.hasFocus = true; });
        util.addEventListener(this.editor, 'blur', function() { self.hasFocus = false; });

        this.setupButton();
    };

    EmojiArea.prototype.setupButton = function() {
        var self = this;
        var button;

        if (this.options.button) {
            button = this.options.button;
        } else if (this.options.button !== false) {
            button = document.createElement('a');
            button.href = 'javascript:void(0)';
            button.innerHTML = this.options.buttonLabel;
            button.classList.add('emoji-button');
        } else {
            button = '';
        }

        util.addEventListener(button, 'click', function(e) {
            EmojuMenu.show(self);
            e.stopPropagation();
        });

        this.button = button;
    };

    EmojiArea.createIcon = function(group, emoji) {
        var filename = emojiareaOptions.icons[group].icons[emoji];
        var path = emojiareaOptions.path || '';
        if (path.length && path.charAt(path.length - 1) !== '/') {
            path += '/';
        }

        var img = document.createElement('img');
        img.src = path + filename;
        img.alt = util.htmlEntities(emoji);
        return img;
    };

    EmojiArea.findIcon = function(identifier) {
        var emojis = emojiareaOptions.icons;
        for (var group in emojis) {
            for (var key in emojis[group].icons) {
                if (emojis[group].icons.hasOwnProperty(key)) {
                    if (key === identifier) {
                        var filename = emojiareaOptions.icons[group].icons[key];
                        var path = emojiareaOptions.path || '';
                        if (path.length && path.charAt(path.length - 1) !== '/' ) {
                            path += '/';
                        }

                        var img = document.createElement('img');
                        img.src = path + filename;
                        img.alt = util.htmlEntities(key);
                        return img;
                    }
                }
            }
        }
    };

    function internalRange(range, container) {
        return {
            endContainer: util.childNumber(range.endContainer, container),
            endOffset: range.endOffset,
            startContainer: util.childNumber(range.startContainer, container),
            startOffset: range.startOffset
        };
    }

    function makeRange(internalRange, oldHtml, html) {
        var range = document.createRange();
        var startContainer = internalRange.startContainer;
        var startOffset = internalRange.startOffset;
        var endContainer = internalRange.endContainer;
        var endOffset = internalRange.endOffset;
        if (oldHtml.length < html.length) {
            startContainer += 2;
            endContainer += 2;
            startOffset = 0;
            endOffset = 0;
        }
        var startNode = html[startContainer];
        var endNode = html[endContainer];
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);

        return range;
    }

    EmojiArea.prototype.onChange = function() {
        var textValue = this.val();
        console.log('equals:', textValue === this.lastTextValue);
        if (textValue === this.lastTextValue) {
            return;
        }

        var selection = util.saveSelection();
        var range = internalRange(selection[0], this.editor);
        console.log(range);
        this.textarea.innerText = textValue;

        var oldHtml = parseText(this.lastTextValue);
        var html = parseText(textValue);
        util.dispatchEvent(this.editor, 'blur');
        util.removeChildren(this.editor);
        util.appendChildren(this.editor, html);
        console.log(oldHtml);
        console.log(html);
        var newRange = makeRange(range, oldHtml, html);
        util.restoreSelection([newRange]);
        util.dispatchEvent(this.textarea, 'change');
        this.lastTextValue = textValue;
    };

    EmojiArea.prototype.insert = function(group, emoji) {
        var content;
        var img = EmojiArea.createIcon(group, emoji);
        if (img.attachEvent) {
            img.attachEvent('onresizestart', function(e) { e.returnValue = false; }, false);
        }
        util.dispatchEvent(this.editor, 'focus');
        if (this.selection) {
            util.restoreSelection(this.selection);
        }
        try { util.replaceSelection(img); } catch (e) {}
        this.onChange();
    };

    EmojiArea.prototype.val = function() {
        var lines = [];
        var line  = [];

        var flush = function() {
            lines.push(line.join(''));
            line = [];
        };

        var sanitizeNode = function(node) {
            if (node.nodeType === TEXT_NODE) {
                line.push(node.nodeValue);
            } else if (node.nodeType === ELEMENT_NODE) {
                var tagName = node.tagName.toLowerCase();
                var isBlock = TAGS_BLOCK.indexOf(tagName) !== -1;

                if (isBlock && line.length) flush();

                if (tagName === 'img') {
                    var alt = node.getAttribute('alt') || '';
                    if (alt) line.push(alt);
                    return;
                } else if (tagName === 'br') {
                    flush();
                }

                var children = node.childNodes;
                for (var i = 0; i < children.length; i++) {
                    sanitizeNode(children[i]);
                }

                if (isBlock && line.length) flush();
            }
        };

        var children = this.editor.childNodes;
        for (var i = 0; i < children.length; i++) {
            sanitizeNode(children[i]);
        }

        if (line.length) flush();

        return lines.join('\n');
    };

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    /**
     * Emoji Dropdown Menu
     *
     * @constructor
     * @param {object} emojiarea
     */
    var EmojiMenu = function() {
        var self = this;
        var body = document.body;
        var window = window;

        this.visible = false;
        this.emojiarea = null;
        this.menu = document.createElement('div');
        this.menu.classList.add('emoji-menu');
        this.menu.style.display = 'none';
        this.items = document.createElement('div');
        this.menu.innerHTML = this.items;

        body.appendChild(this.menu);

        util.addEventListener(body, 'keydown', function(e) {
            if (e.keyCode === KEY_ESC || e.keyCode === KEY_TAB) {
                self.hide();
            }
        });

        util.addEventListener(body, 'mouseup', function() {
            self.hide();
        });

        util.addEventListener(window, 'resize', function() {
            if (self.visible) {
                //self.reposition();
            }
        });

        util.addEventListener(this.menu, 'mouseup', function(e) {
            e.stopPropagation();
            return false;
        });

        // TODO: FIX ME
        /*this.$menu.on('click', 'a', function(e) {
            var emoji = $('.label', $(this)).text();
            var group = $('.label', $(this)).parent().parent().attr('group');
            if(group && emoji !== ''){
                window.setTimeout(function() {
                    self.onItemSelected.apply(self, [group, emoji]);
                }, 0);
                e.stopPropagation();
                return false;
            }
        });*/

        this.load();
    };

    EmojiMenu.prototype.onItemSelected = function(group, emoji) {
        this.emojiarea.insert(group, emoji);
        this.hide();
    };

    EmojiMenu.prototype.load = function() {
        var html = [];
        var groups = [];
        var options = emojiareaOptions.icons;
        var path = emojiareaOptions.path;
        if (path.length && path.charAt(path.length - 1) !== '/') {
            path += '/';
        }
        var ul = document.createElement('ul');
        ul.classList.add('group-selector');
        for (var group in options) {
            var a = document.createElement('a');
            a.href = '#group_' + group;
            a.classList.add('tab_switch');
            if (group === '<i class="icon-smile"></i>') {
                a.classList.add('active');
            } else {
                a.style.display = 'none';
            }
            var li = document.createElement('li');
            li.innerText = options[group].name;
            a.appendChild(li);
            ul.appendChild(a);
            var groupElement = document.createElement('div');
            groupElement.classList.add('select_group');
            groupElement.setAttribute('group', group);
            groupElement.id = 'group_' + group;

            var onClick = function(ev) {
                var activeTabSwitch = document.querySelector('.tab_switch.active');
                activeTabSwitch.classList.remove('active');
                a.classList.add('active');
                var activeGroup = document.querySelector('.select_group.active');
                activeGroup.classList.remove('active');
                groupElement.classList.add('active');
            };
            util.addEventListener(a, 'click', onClick);


            for (var key in options[group].icons) {
                if (options[group].icons.hasOwnProperty(key)) {
                    var filename = options[key];
                    var emoji = document.createElement('a');
                    emoji.href = 'javascript:void(0)';
                    emoji.title = util.htmlEntities(key);
                    emoji.innerHTML = EmojiArea.createIcon(group, key);
                    groupElement.appendChild(emoji);
                    // TODO: Add span label
                    //html.push('<a href="javascript:void(0)" title="' + util.htmlEntities(key) + '">' + EmojiArea.createIcon(group, key) + '<span class="label">' + util.htmlEntities(key) + '</span></a>');
                }
            }
            this.items.appendChild(groupElement);
        }
        this.menu.appendChild(ul);
    };

    // TODO: FIX ME
    /*EmojiMenu.prototype.reposition = function() {
        var button = this.emojiarea.button;
        var offset = button.offset();
        offset.top += button.outerHeight();
        offset.left += Math.round($button.outerWidth() / 2);

        this.$menu.css({
            top: offset.top,
            left: offset.left
        });
    };*/

    EmojiMenu.prototype.hide = function(callback) {
        if (this.emojiarea) {
            this.emojiarea.menu = null;
            this.emojiarea.button.classList.remove('on');
            this.emojiarea = null;
        }
        this.visible = false;
        this.menu.style.display = 'none';
    };

    EmojiMenu.prototype.show = function(emojiarea) {
        if (this.emojiarea && this.emojiarea === emojiarea) return;
        this.emojiarea = emojiarea;
        this.emojiarea.menu = this;

        //this.reposition();
        this.menu.style.display = 'block';
        this.visible = true;
    };

    EmojiMenu.show = (function() {
        var menu = null;
        return function(emojiarea) {
            menu = menu || new EmojiMenu();
            menu.show(emojiarea);
        };
    })();

    return EmojiArea;
});
