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

    var emojiRegexp = /:[a-z0-9-_+]+:/;

    function hasEmoji() {
        var selection = range.get();
        if (!selection.length)
            return false;

        var _range = selection[0];
        var currentNode = _range.startContainer;
        if (!dom.isTextNode(currentNode))
            return false;

        var text = currentNode.textContent;
        var match = emojiRegexp.exec(text);
        if (!match)
            return false;

        return match;
    }

    function parse(match) {
        var start = match.index;
        var end = start + match[0].length;
        var selection = range.get();
        var _range = selection[0];
        if (_range.startOffset !== end) {
            // We have probably pasted some text containing a smiley in the middle,
            // we need to move to the correct place first
            _range.setStart(_range.startContainer, end);
            _range.collapse(true);
        }
        var emoji = match[0];
        var image = EmojiArea.findIcon(emoji);
        _range.insertNode(image);
        var previousText = image.previousSibling;
        previousText.textContent = previousText.textContent.replace(emoji, '');
        var nextText = image.nextSibling;
        _range.setStart(nextText, 0);
        _range.collapse(true);
        range.restore([_range]);

        return true;
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
        editor.tabIndex = 0;
        editor.innerText =  textarea.innerText;
        editor.setAttribute('contentEditable', true);

        var onChange = function() { return self.onChange.apply(self, arguments); };
        var enableObjectResizing = function() { document.execCommand('enableObjectResizing', false, false); };
        var disableObjectResizing = function() { document.execCommand('enableObjectResizing', true, true); };

        dom.addEventListener(editor, 'input', onChange);
        dom.addEventListener(editor, ['mousedown', 'focus'], enableObjectResizing);
        dom.addEventListener(editor, 'blur', disableObjectResizing);

        this.editor = editor;

        var text = this.textarea.innerHTML;
        dom.appendChildren(this.editor, [document.createTextNode(text)]);
        var textElement = this.editor.lastChild;
        setTimeout(function() {
            var _range = document.createRange();
            _range.setStart(textElement, textElement.textContent.length);
            range.restore([_range]);
        }, 0);
        setTimeout(function() {
            dom.dispatchEvent(self.editor, 'input');
            var _range = document.createRange();
            _range.selectNode(self.editor.lastChild);
            _range.collapse(false);
            range.restore([_range]);
        }, 0);

        this.lastTextValue = this.val();
        this.textarea.style.display = 'none';

        textarea.parentNode.insertBefore(editor, textarea.nextSibling);

        this.setup();

        dom.addEventListener(this.button, 'mousedown', function() {
            if (self.hasFocus) {
                self.selection = range.get();
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

        dom.addEventListener(this.editor, 'focus', function() { self.hasFocus = true; });
        dom.addEventListener(this.editor, 'blur', function() { self.hasFocus = false; });

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

        dom.addEventListener(button, 'click', function(e) {
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

    EmojiArea.prototype.onChange = function() {
        var match;
        while ((match = hasEmoji())) {
            parse(match);
        }
    };

    EmojiArea.prototype.insert = function(group, emoji) {
        var content;
        var img = EmojiArea.createIcon(group, emoji);
        if (img.attachEvent) {
            img.attachEvent('onresizestart', function(e) { e.returnValue = false; }, false);
        }
        dom.dispatchEvent(this.editor, 'focus');
        if (this.selection) {
            range.restore(this.selection);
        }
        try { range.replace(img); } catch (e) {}
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

        dom.addEventListener(body, 'keydown', function(e) {
            if (e.keyCode === KEY_ESC || e.keyCode === KEY_TAB) {
                self.hide();
            }
        });

        dom.addEventListener(body, 'mouseup', function() {
            self.hide();
        });

        dom.addEventListener(window, 'resize', function() {
            if (self.visible) {
                //self.reposition();
            }
        });

        dom.addEventListener(this.menu, 'mouseup', function(e) {
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
            dom.addEventListener(a, 'click', onClick);


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
