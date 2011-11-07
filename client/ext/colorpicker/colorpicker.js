/**
 * Code Tools Module for the Cloud9 IDE
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
 
define(function(require, exports, module) {

var ide = require("core/ide");
var ext = require("core/ext");

var Code = require("ext/code/code");
var Range = require("ace/range").Range;
var UndoManager = require("ace/undomanager").UndoManager;

var Colors = {};
var css = require("text!ext/colorpicker/colorpicker.css");
var markup = require("text!ext/colorpicker/colorpicker.xml");
var skin = require("text!ext/colorpicker/skin.xml");

module.exports = ext.register("ext/colorpicker/colorpicker", {
    dev    : "Ajax.org",
    name   : "Colorpicker Code Tool",
    alone  : true,
    type   : ext.GENERAL,
    skin   : skin,

    nodes : [],
    
    init: function(amlNode) {
        apf.document.body.insertMarkup(markup);
        cp = this.colorpicker = clrCodeTools;
        var _self = this;
        this.colorpicker.addEventListener("prop.hex", function(e) {
            _self.onColorPicked(e.oldvalue, e.value);
        });
    },
    
    hook: function() {
        apf.importCssString(css || "");

        function detectColors(pos, line) {
            var colors = line.match(/(#([0-9A-Fa-f]{3,6})\b)|(rgba?\(\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*,\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*,\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*(:?\s*,\s*(?:1|0|0?\.[0-9]{1,2})\s*)?\))|(rgba?\(\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*(:?\s*,\s*(?:1|0|0?\.[0-9]{1,2})\s*)?\))/gi);
            if (!colors || !colors.length)
                return [];
            var start, end;
            var col = pos.column;
            for (var i = 0, l = colors.length; i < l; ++i) {
                start = line.indexOf(colors[i]);
                end = start + colors[i].length;
                if (col >= start && col <= end)
                    return [colors, colors[i]];
            }
            return [colors];
        }
        
        var _self = this;
        
        ide.addEventListener("codetools.rowchange", function(e) {
            var doc = e.doc;
            var pos = e.pos;
            var editor = e.editor;
            
            var line = doc.getLine(1);
            if (!(e.amlEditor.syntax == "css" || e.amlEditor.syntax == "svg" || (line && line.indexOf("<a:skin") > -1)))
                return;

            line = doc.getLine(pos.row);
            var colors = detectColors(pos, line);
            if (colors[0] && colors[0].length)
                _self.showColorTooltip(pos, editor, line, colors[0]);
            else
                _self.hideColorTooltips(editor);
        });
        
        ide.addEventListener("codetools.codeclick", function(e) {
            var doc = e.doc;
            var pos = e.pos;
            var editor = e.editor;

            var line = doc.getLine(1);
            if (!(e.amlEditor.syntax == "css" || e.amlEditor.syntax == "svg" || (line && line.indexOf("<a:skin") > -1)))
                return;
            //do not show anything when a selection is made...
            var range = editor.selection.getRange();
            if (range.start.row !== range.end.row || range.start.column !== range.end.column)
                return;

            var line = doc.getLine(pos.row);
            var colors = detectColors(pos, line);
            if (colors[1]) {
                _self.toggleColorPicker(pos, editor, line, colors[1]);
            }
            else if (_self.colorpicker && _self.colorpicker.visible) {
                if (_self.$activeColor) {
                    _self.$activeColor.at.resumeTracking();
                    delete _self.$activeColor;
                }
                _self.colorpicker.hide();
            }
        });
    },
    
    showColorTooltip: function(pos, editor, line, colors) {
        if (this.colorpicker && this.colorpicker.visible)
            return;

        var markers = [];
        colors.forEach(function(color) {
            var id = color + pos.row;
            var marker = Colors[id];
            // the tooltip DOM node is stored in the third element of the selection array
            if (!marker) {
                var col = line.indexOf(color);
                var range = Range.fromPoints({
                    row: pos.row,
                    column: col
                }, {
                    row: pos.row,
                    column: col + color.length
                });
                var marker = editor.session.addMarker(range, "codetools_colorpicker", function(stringBuilder, range, left, top, viewport) {
                    stringBuilder.push(
                        "<span class='codetools_colorpicker' style='",
                        "left:", left - 3, "px;",
                        "top:", top - 1, "px;",
                        "height:", viewport.lineHeight, "px;",
                        "' onclick='require(\'ext/codetools/codetools\').toggleColorPicker({row:",
                        pos.row, ",column:", pos.column, ",color:\'", color, "\'});'>", color, "</span>"
                    );
                }, true);
                Colors[id] = [range, marker];
            }
            markers.push(marker);
        });
        
        this.hideColorTooltips(editor, markers);
    },
    
    hideColorTooltips: function(editor, exceptions) {
        //if (!exceptions && this.colorpicker.visible)
        //    this.colorpicker.hide();
        if (exceptions && !apf.isArray(exceptions))
            exceptions = [exceptions];
        var marker;
        for (var mid in Colors) {
            marker = Colors[mid][1];
            if (exceptions && exceptions.indexOf(marker) > -1)
                continue;
            editor.session.removeMarker(marker);
            delete Colors[mid];
        }
    },
    
    toggleColorPicker: function(pos, editor, line, color) {
        ext.initExtension(this);
        var cp = this.colorpicker;
        
        var type = "hex";
        var rgb = color.match(/(?:rgba?\(\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*(:?\s*,\s*(?:1|0|0?\.[0-9]{1,2})\s*)?\))|(rgba?\(\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*(:?\s*,\s*(?:1|0|0?\.[0-9]{1,2})\s*)?\))/);
        if (rgb && rgb.length >= 3) {
            rgb = {
                r: rgb[1], 
                g: rgb[2], 
                b: rgb[3]
            };
            color = apf.color.RGBToHex(rgb);
            type = "rgb";
        }
        
        var marker = Colors[color + pos.row];
        var orig = color.replace("#", "");
        color = apf.color.fixHex(orig);
        
        if (cp.visible && color == this.$activeColor.color && pos.row == this.$activeColor.row) {
            this.$activeColor.at.resumeTracking();
            delete this.$activeColor;
            return cp.hide();
        }
        
        var onKeyDown, _self = this;
        apf.addEventListener("keydown", onKeyDown = function(e) {
            var a = _self.$activeColor;
            
            if (!cp || !a || !cp.visible || e.keyCode != 27) 
                return;
                
            clearTimeout(_self.$colorPickTimer);
            a.at.resumeTracking();
            delete _self.$activeColor;
            cp.hide();
            if (a.changed)
                a.at.undo(a.at.undolength - a.start);
            apf.removeEventListener("keydown", onKeyDown);
        });

        this.hideColorTooltips(editor);
        cp.show();
        this.$activeColor = {
            color: color,
            orig: orig,
            type: type,
            row: pos.row,
            marker: marker,
            editor: editor,
            changed: 0,
            start: editor.session.$undoManager.undolength,
            at: editor.session.$undoManager
        };
        cp.setProperty("value", color);
        var coords = ceEditor.$editor.renderer.textToScreenCoordinates(pos.row, line.indexOf(orig) + orig.length);
        
        var y = coords.pageY;
        var x = coords.pageX;
        var pOverflow = apf.getOverflowParent(cp.$ext);
        var height = cp.$ext.offsetHeight;
        var width = cp.$ext.offsetWidth;
        var edgeY = (pOverflow == document.documentElement
            ? (apf.isIE 
                ? pOverflow.offsetHeight 
                : (window.innerHeight + window.pageYOffset)) + pOverflow.scrollTop
            : pOverflow.offsetHeight + pOverflow.scrollTop);
        var edgeX = (pOverflow == document.documentElement
            ? (apf.isIE 
                ? pOverflow.offsetWidth
                : (window.innerWidth + window.pageXOffset)) + pOverflow.scrollLeft
            : pOverflow.offsetWidth + pOverflow.scrollLeft);
        
        if (y + height > edgeY) {
            y = edgeY - height;
            if (y < 0)
                y = 0;
        }
        if (x + width > edgeX) {
            x = edgeX - width;
            if (x < 0)
                x = 0;
        }
        cp.$ext.style.top = (y - 15) + "px";
        cp.$ext.style.left = (x + 15 + (type == "rgb" ? 320 : 0)) + "px";
    },
    
    onColorPicked: function(old, color) {
        var a = this.$activeColor;
        if (!a)
            return;
        
        clearTimeout(this.$colorPickTimer);
        if (a.at.isTracking())
            a.at.pauseTracking();

        var doc = a.editor.session.doc;
        var line = doc.getLine(a.row);
        var newLine;
        if (a.type == "hex") {
            var start = line.indexOf(a.color);
            if (start === -1) {
                start = line.indexOf(a.orig);
                if (start === -1)
                    return;
                else
                    newLine = line.replace(a.orig, color);
            }
            else
                newLine = line.replace(a.color, color);
            doc.replace(a.marker[0], "#" + color);
        }
        else if (a.type == "rgb") {
            var oldRGB = apf.color.hexToRGB(old);
            var regex = new RegExp("(rgba?)\\(\\s*" + oldRGB.r + "\\s*,\\s*" + oldRGB.g + "\\s*,\\s*" + oldRGB.b, "i");
            if (!line.match(regex)) {
                // in case the colorpicker was still holding on to a previous value:
                oldRGB = apf.color.hexToRGB(a.orig);
                regex = new RegExp("(rgba?)\\(\\s*" + oldRGB.r + "\\s*,\\s*" + oldRGB.g + "\\s*,\\s*" + oldRGB.b, "i");
                if (!line.match(regex))
                    return;
            }
            var RGB = apf.color.hexToRGB(color);
            newLine = line.replace(regex, function(m, prefix) {
                return prefix + "(" + RGB.r + ", " + RGB.g + ", " + RGB.b;
            });
            doc.removeLines(a.row, a.row);
            doc.insertLines(a.row, [newLine]);
        }
        a.color = color;
        
        var _self = this;
        this.$colorPickTimer = setTimeout(function() {
            a.at.resumeTracking();
            ++a.changed;
            //doing this across the board would be much more efficient, but the
            //ACE UndoManager just won't play nice.
            //if (a.type == "hex") {
            //    doc.replace(a.marker[0], "#" + color);
            //}
            //else {
                doc.removeLines(a.row, a.row);
                doc.insertLines(a.row, [newLine]);
            //}
            a.editor.session.$informUndoManager.call();
            a.at.pauseTracking();
        }, 200);
    },
    
    enable : function(){
        this.nodes.each(function(item){
            item.enable();
        });
    },

    disable : function(){
        this.nodes.each(function(item){
            item.disable();
        });
    },

    destroy : function(){
        this.nodes.each(function(item){
            item.destroy(true, true);
        });
        this.nodes = [];
    }
});

});