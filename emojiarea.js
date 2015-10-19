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
        define(['range', 'dom'], function (range, dom) {
            return (root.EmojiArea = factory(range, dom));
        });
    } else if (typeof module === 'object' && module.exports) {
        module.exports = (root.EmojiArea = factory(require('range'), require('dom')));
    } else {
        root.EmojiArea = factory(root.range, root.dom);
    }
})(this, function(range, dom) {
    'use strict';

    var ELEMENT_NODE = 1;
    var TEXT_NODE = 3;
    var TAGS_BLOCK = ['p', 'div', 'pre', 'form'];
    var KEY_ESC = 27;
    var KEY_TAB = 9;

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    var util = {};

    util.escapeRegex = function(str) {
        return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
    };

    util.htmlEntities = function(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };


    util.restoreSelection = range.restore;
    util.saveSelection = range.get;
    util.replaceSelection = range.replace;
    util.addEventListener = dom.addEventListener;
    util.dispatchEvent = dom.dispatchEvent;
    util.removeChildren = dom.removeChildren;
    util.appendChildren = dom.appendChildren;
    util.childNumber = dom.numberInParent;
    util.isTextNode = dom.isTextNode;
    util.isImageNode = dom.isImageNode;

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

        var regexp = /:[a-z0-9-_+]+:/g;
        var lastIndex = 0;
        while (true) {
            var match = regexp.exec(html);
            if (!match)
                break;

            var emoji = EmojiArea.findIcon(match[0]);
            if (!emoji)
                continue;

            var index = match.index;
            var length = match[0].length;
            parts.push(document.createTextNode(html.slice(lastIndex, index)));
            parts.push(emoji);
            lastIndex = index + length;
        }

        html = html.slice(lastIndex);

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

        var onChange = function() { return self.onChange.apply(self, arguments); };
        var enableObjectResizing = function() { document.execCommand('enableObjectResizing', false, false); };
        var disableObjectResizing = function() { document.execCommand('enableObjectResizing', true, true); };

        util.addEventListener(editor, 'input', onChange);
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
        var nodes = Array.prototype.slice.call(container.childNodes);
        // We get an image as the last node if the last text is a single character, and we backspace it. We need to fix this
        if (util.isImageNode(nodes[nodes.length - 1])) {
            console.log('pushing text');
            nodes.push(document.createTextNode(''));
        }
        if (util.isTextNode(nodes[0]) && util.isTextNode(nodes[1])) {
            if (nodes[0].textContent === '')
                nodes = nodes.slice(1);
        }
        console.log('original range:',range);
        var startContainer = util.childNumber(range.startContainer, nodes);
        console.log('startContainer', startContainer);
        var endContainer = util.childNumber(range.endContainer, nodes);
        var startOffset;
        var endOffset;
        if (startContainer === -1) {
            console.log('hmm');
            startContainer = range.startOffset;
            endContainer = range.endOffset;
            startOffset = 0;
            endOffset = 0;
        } else {
            startOffset = nodes[startContainer].textContent.length < range.startOffset ? 0 : range.startOffset;
            endOffset = nodes[endContainer].textContent.length < range.endOffset ? startOffset : range.endOffset;
        }

        return {
            endContainer: endContainer,
            endOffset: endOffset,
            startContainer: startContainer,
            startOffset: startOffset
        };
    }

    function makeRange(internalRange, oldHtml, html) {
        var range = document.createRange();
        var startContainer = internalRange.startContainer;
        var startOffset = internalRange.startOffset;
        var endContainer = internalRange.endContainer;
        var endOffset = internalRange.endOffset;
        var startNode = html[startContainer];
        var endNode = html[endContainer];
        if (html.length > oldHtml.length) {
            // console.log(oldHtml);
            console.log('We have new elements', oldHtml[startContainer]);
            var offsetFromEnd = oldHtml[startContainer].textContent.length - startOffset;
            var indexFromEnd = oldHtml.length - startContainer;
            startContainer = html.length - indexFromEnd;
            endContainer = html.length - indexFromEnd;

            startNode = html[startContainer];
            endNode = html[endContainer];

            var text = startNode.textContent;
            var offset = 0;
            if (text.length > 0) {
                offset = text.length - offsetFromEnd;
                if (offset < 0)
                    offset = 0;
                if (offset >= text.length)
                    offset = text.length - 1;
            }
            console.log(offset);
            startOffset = offset;
            endOffset = offset;
        }
        //console.log(startContainer, startNode);
        console.log(internalRange);
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);

        return range;
    }

    EmojiArea.prototype.onChange = function() {
        console.log('onChange:', this.val());
        var textValue = this.val();
        if (textValue === this.lastTextValue) {
            return;
        }

        if (textValue.length === 0) {
            this.lastTextValue = textValue;
            return;
        }

        var selection = /*this.selection ? this.selection :*/ util.saveSelection();
        var range = internalRange(selection[0], this.editor);
        //console.log(range);
        this.textarea.innerText = textValue;

        var oldHtml = parseText(this.lastTextValue);
        var html = parseText(textValue);
        if (html.length === 1 && util.isTextNode(html[0])) {
            this.lastTextValue = textValue;
            return;
        }

        util.dispatchEvent(this.editor, 'blur');
        util.removeChildren(this.editor);
        util.appendChildren(this.editor, html);
        // console.log(oldHtml);
        // console.log(html);
        var newRange = makeRange(range, oldHtml, html);
        util.restoreSelection([newRange]);
        util.dispatchEvent(this.textarea, 'change');
        this.lastTextValue = textValue;
    };

    // EmojiArea.prototype.onPaste = function() {
    //     console.log('onPaste:', this.val());

    //     this.selection = util.saveSelection();
    //     console.log(internalRange(this.selection[0], this.editor));
    // };

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
