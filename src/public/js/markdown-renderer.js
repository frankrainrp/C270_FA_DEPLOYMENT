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

    lines.forEach(function (line) {
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
        return;
      }

      if (inCode) {
        codeLines.push(line);
        return;
      }

      if (!line.trim()) {
        flushParagraph();
        closeList();
        return;
      }

      var heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        var level = heading[1].length;
        output.push("<h" + level + ">" + renderInline(heading[2]) + "</h" + level + ">");
        return;
      }

      if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
        flushParagraph();
        closeList();
        output.push("<hr>");
        return;
      }

      var quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeList();
        output.push("<blockquote><p>" + renderInline(quote[1]) + "</p></blockquote>");
        return;
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
        return;
      }

      var ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (ordered) {
        openList("ol");
        output.push("<li>" + renderInline(ordered[1]) + "</li>");
        return;
      }

      paragraph.push(line.trim());
    });

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
