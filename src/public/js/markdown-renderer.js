// Small, dependency-free Markdown renderer for Butler notes.
// Raw HTML is escaped and links are restricted to http(s), so note content
// can be previewed without turning saved text into executable markup.
(function initButlerMarkdown(global) {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderInline(value) {
    var source = String(value == null ? "" : value);
    var tokens = [];

    function token(html) {
      var index = tokens.push(html) - 1;
      return "\u0000" + index + "\u0000";
    }

    source = source.replace(/`([^`\n]+)`/g, function (_, code) {
      return token("<code>" + escapeHtml(code) + "</code>");
    });

    source = source.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi, function (_, label, href) {
      return token(
        '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">'
        + escapeHtml(label)
        + "</a>"
      );
    });

    source = escapeHtml(source)
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

    return source.replace(/\u0000(\d+)\u0000/g, function (_, index) {
      return tokens[Number(index)] || "";
    });
  }

  function splitTableRow(value) {
    var source = String(value == null ? "" : value).trim();
    if (source.charAt(0) === "|") source = source.slice(1);
    if (source.charAt(source.length - 1) === "|") source = source.slice(0, -1);

    var cells = [];
    var cell = "";
    var inCode = false;

    for (var index = 0; index < source.length; index += 1) {
      var character = source.charAt(index);
      if (character === "\\" && source.charAt(index + 1) === "|") {
        cell += "|";
        index += 1;
      } else if (character === "`") {
        inCode = !inCode;
        cell += character;
      } else if (character === "|" && !inCode) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += character;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  function tableAlignments(value) {
    var cells = splitTableRow(value);
    if (cells.length < 2 || cells.some(function (cell) {
      return !/^:?-{3,}:?$/.test(cell);
    })) {
      return null;
    }
    return cells.map(function (cell) {
      if (cell.charAt(0) === ":" && cell.charAt(cell.length - 1) === ":") return "center";
      if (cell.charAt(cell.length - 1) === ":") return "right";
      if (cell.charAt(0) === ":") return "left";
      return "";
    });
  }

  function tableCell(tag, value, alignment) {
    return "<" + tag
      + (alignment ? ' style="text-align:' + alignment + '"' : "")
      + ">" + renderInline(value) + "</" + tag + ">";
  }

  function render(markdown) {
    var lines = String(markdown == null ? "" : markdown)
      .replace(/\r\n?/g, "\n")
      .split("\n");
    var output = [];
    var paragraph = [];
    var listType = "";
    var codeLines = [];
    var codeLanguage = "";
    var inCode = false;

    function closeList() {
      if (!listType) return;
      output.push("</" + listType + ">");
      listType = "";
    }

    function flushParagraph() {
      if (!paragraph.length) return;
      closeList();
      output.push("<p>" + renderInline(paragraph.join(" ")) + "</p>");
      paragraph = [];
    }

    function openList(type) {
      flushParagraph();
      if (listType === type) return;
      closeList();
      listType = type;
      output.push("<" + type + ">");
    }

    for (var lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      var line = lines[lineIndex];
      var fence = line.match(/^\s*```\s*([A-Za-z0-9_-]*)\s*$/);
      if (fence) {
        if (inCode) {
          output.push(
            "<pre><code"
            + (codeLanguage ? ' class="language-' + escapeHtml(codeLanguage) + '"' : "")
            + ">" + escapeHtml(codeLines.join("\n")) + "</code></pre>"
          );
          codeLines = [];
          codeLanguage = "";
          inCode = false;
        } else {
          flushParagraph();
          closeList();
          inCode = true;
          codeLanguage = fence[1] || "";
        }
        continue;
      }

      if (inCode) {
        codeLines.push(line);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        closeList();
        continue;
      }

      var alignments = lineIndex + 1 < lines.length
        ? tableAlignments(lines[lineIndex + 1])
        : null;
      var headerCells = alignments ? splitTableRow(line) : [];
      if (alignments && headerCells.length === alignments.length) {
        flushParagraph();
        closeList();
        output.push('<div class="markdown-table-wrap"><table><thead><tr>');
        headerCells.forEach(function (cell, cellIndex) {
          output.push(tableCell("th", cell, alignments[cellIndex]));
        });
        output.push("</tr></thead><tbody>");
        lineIndex += 2;
        while (lineIndex < lines.length && lines[lineIndex].trim()) {
          var rowCells = splitTableRow(lines[lineIndex]);
          if (rowCells.length !== headerCells.length) {
            lineIndex -= 1;
            break;
          }
          output.push("<tr>");
          rowCells.forEach(function (cell, cellIndex) {
            output.push(tableCell("td", cell, alignments[cellIndex]));
          });
          output.push("</tr>");
          lineIndex += 1;
        }
        output.push("</tbody></table></div>");
        continue;
      }

      var heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        var level = heading[1].length;
        output.push("<h" + level + ">" + renderInline(heading[2]) + "</h" + level + ">");
        continue;
      }

      if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
        flushParagraph();
        closeList();
        output.push("<hr>");
        continue;
      }

      var quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeList();
        output.push("<blockquote><p>" + renderInline(quote[1]) + "</p></blockquote>");
        continue;
      }

      var unordered = line.match(/^\s*[-+*]\s+(.+)$/);
      if (unordered) {
        openList("ul");
        var task = unordered[1].match(/^\[([ xX])\]\s*(.*)$/);
        if (task) {
          output.push(
            '<li class="markdown-task"><input type="checkbox" disabled'
            + (task[1].toLowerCase() === "x" ? " checked" : "")
            + "> <span>" + renderInline(task[2]) + "</span></li>"
          );
        } else {
          output.push("<li>" + renderInline(unordered[1]) + "</li>");
        }
        continue;
      }

      var ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (ordered) {
        openList("ol");
        output.push("<li>" + renderInline(ordered[1]) + "</li>");
        continue;
      }

      paragraph.push(line.trim());
    }

    if (inCode) {
      output.push(
        "<pre><code"
        + (codeLanguage ? ' class="language-' + escapeHtml(codeLanguage) + '"' : "")
        + ">" + escapeHtml(codeLines.join("\n")) + "</code></pre>"
      );
    }
    flushParagraph();
    closeList();
    return output.join("\n");
  }

  global.ButlerMarkdown = {
    escapeHtml: escapeHtml,
    render: render,
  };
})(window);
