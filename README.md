#EmojiArea

**Note: this will probably not work like you expect at the moment. It is heavily under development. Some of the things below are not even true.**

A small plugin for turning textareas into ones that support emojis. No external dependencies. Uses `contenteditable` for rendering. Bundles twitters twemoji set, but you are of course free to roll your own.

## What it looks like
![Screenshot](http://i.imgur.com/C4Z8F.gif)

## Usage

Without jQuery
```javascript
var textarea = document.querySelector('.my-textarea');
var emojiArea = new EmojiArea(textarea, options);
```

With jQuery
```javascript
EmojiArea.expose($); // registers EmojiArea as a jQuery plugin
$('.my-textarea').emojiarea(options);

// or

var emojiArea = new EmojiArea($('.my-textarea'), options);
```

## Configuration

### Dropdown Menu

![Dropdown Screenshot](http://i.imgur.com/EuTTpHk.png)

By default, the plugin will insert a link after the editor that toggles the emoji selector when clicked.

```html
<a href="javascript:void(0)" class="emoji-button">Emojis</a>
```

If you wish change this behavior and have the button placed before the editor, or change the label of the link, use:

```javascript
$('textarea').emojiarea({
    buttonLabel: 'Add Emoji',
    buttonPosition: 'before'
});
```

Alternatively, if you wish to use your own button:

```javascript
$('textarea').emojiarea({button: '#your-button'});
```

For customizing the visual appearance, see the [CSS / Skinning](#css--skinning) section.

### Available Emojis

```javascript
$.emojiarea.path = '/path/to/folder/with/icons';
$.emojiarea.icons = {
    ':smile:'     : 'smile.png',
    ':angry:'     : 'angry.png',
    ':flushed:'   : 'flushed.png',
    ':neckbeard:' : 'neckbeard.png',
    ':laughing:'  : 'laughing.png'
};
```

For a basic set of emojis, see "packs/basic". 

## CSS / Skinning

See [jquery.emojiarea.css](https://github.com/diy/jquery-emojiarea/blob/master/jquery.emojiarea.css) for the few fundamental CSS styles needed for this to work.

Basically, you'll want to adjust the following styles:

```css
.emoji-wysiwyg-editor /* the editor box itself */
.emoji-menu > div /* the dropdown menu with options */
.emoji-wysiwyg-editor img /* the emoji images in the editor */
```

## License

Copyright &copy; 2012 DIY Co and 2015 Pius Ladenburger

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

I am always happy about an attribution to me and my website, e.g. [\<a href="https://pius-ladenburger.de">Pius Ladenburger\</a>](https://pius-ladenburger.de)
